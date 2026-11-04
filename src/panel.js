import { CreateWebWorkerMLCEngine, deleteModelAllInfoInCache } from '@mlc-ai/web-llm';
import { analyze, applySuggestion, MAX_TEXT } from './rules.js';
import { captureField, replaceField } from './page.js';
import { rewriteMessages } from './prompt.js';
import model from '../model-lock.json';

const $ = id => document.getElementById(id);
const editor = $('editor');
const appConfig = {model_list:[{...model.record,model_lib:chrome.runtime.getURL('model.wasm')}],cacheBackend:'cache'};
let engine, worker, busy = false, importedTab, previous, revision = 0;
let resultSource, resultRevision, resultText = '';

function notice(text) { $('notice').textContent = text; }
function aiStatus(text) { $('ai-status').textContent = text; }
function errorMessage(error) { return error?.message || String(error); }
function setBusy(value) {
  busy = value;
  $('load').disabled = value || Boolean(engine);
  $('rewrite').disabled = value || !engine;
  $('unload').disabled = value || !engine;
  $('delete-model').disabled = value;
  $('cancel').disabled = !value || !engine;
}
function update() {
  revision++;
  $('count').textContent = `${editor.value.length} / ${MAX_TEXT}`;
  $('result-box').hidden = true;
  const list = $('suggestions');
  list.replaceChildren();
  const text = editor.value;
  const suggestions = analyze(text,$('language').value);
  if (!suggestions.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = text ? 'Nenhum problema encontrado pelas regras iniciais.' : 'Suas sugestões aparecerão aqui.';
    list.append(p);
  }
  for (const suggestion of suggestions) {
    const card = document.createElement('article'); card.className = 'suggestion';
    const from = document.createElement('span'); from.className = 'original'; from.textContent = suggestion.original;
    const to = document.createElement('span'); to.className = 'replacement'; to.textContent = suggestion.replacement;
    const description = document.createElement('p'); description.textContent = suggestion.message;
    const accept = document.createElement('button'); accept.className = 'secondary'; accept.textContent = 'Aceitar';
    accept.addEventListener('click',() => { try { change(applySuggestion(editor.value,suggestion)); } catch(e) { notice(e.message); } });
    card.append(from,document.createTextNode(' → '),to,description,accept); list.append(card);
  }
}
function change(value) {
  previous = editor.value;
  editor.value = value;
  $('undo').disabled = false;
  update();
}
editor.addEventListener('input',update);
$('language').addEventListener('change',async () => {
  editor.lang = $('language').value;
  update();
  await chrome.storage.local.set({language:$('language').value});
});
$('example').onclick = () => {
  importedTab = undefined; $('apply').disabled = true;
  change($('language').value === 'en-US' ? 'i is happy to recieve teh message. They is ready to help.' : 'Nós vai resolver isso concerteza. Há menas dúvidas agora.');
};
$('undo').onclick = () => { if (previous !== undefined) { editor.value = previous; previous = undefined; $('undo').disabled = true; update(); } };
$('import').onclick = async () => {
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id) throw new Error('Nenhuma página disponível.');
    const [response] = await chrome.scripting.executeScript({target:{tabId:tab.id},func:captureField});
    const result = response?.result;
    if (!result || result.error) throw new Error(result?.error || 'Não foi possível ler este campo.');
    if (result.text.length > MAX_TEXT) throw new Error(`Selecione um trecho de até ${MAX_TEXT} caracteres. O texto não foi cortado.`);
    change(result.text);
    importedTab = result.canApply ? tab.id : undefined;
    $('apply').disabled = !result.canApply;
    notice(result.canApply ? 'Texto importado. Confira as alterações antes de aplicar.' : 'Trecho importado para revisão. Use Copiar texto para voltar ao editor original.');
  } catch(e) { importedTab = undefined; $('apply').disabled = true; notice(`${e.message} Você também pode colar o texto.`); }
};
$('apply').onclick = async () => {
  try {
    if (!importedTab) throw new Error('Importe um campo primeiro.');
    const [response] = await chrome.scripting.executeScript({target:{tabId:importedTab},func:replaceField,args:[editor.value]});
    if (!response.result?.ok) throw new Error(response.result?.error || 'Não foi possível aplicar.');
    $('apply').disabled = true; importedTab = undefined; notice('Texto aplicado na página.');
  } catch(e) { notice(e.message); }
};
$('copy').onclick = async () => { try { await navigator.clipboard.writeText(editor.value); notice('Texto copiado.'); } catch { notice('Selecione e copie o texto manualmente.'); } };

$('load').onclick = async () => {
  if (busy || engine) return;
  setBusy(true); $('progress').hidden = false;
  try {
    if (!navigator.gpu || !await navigator.gpu.requestAdapter()) { aiStatus('WebGPU indisponível. Confira a aceleração gráfica do navegador. A revisão básica continua funcionando.'); return; }
    worker = new Worker(chrome.runtime.getURL('ai-worker.js'),{type:'module'});
    engine = await CreateWebWorkerMLCEngine(worker, model.record.model_id, {
      appConfig,
      initProgressCallback: p => { $('progress').value = p.progress; aiStatus(p.text); }
    });
    aiStatus('IA pronta. As sugestões são geradas neste dispositivo.');
  } catch(e) {
    worker?.terminate(); worker = undefined; engine = undefined;
    aiStatus(`Não foi possível carregar: ${errorMessage(e)}. Confira internet, espaço em disco e memória gráfica. Tente novamente.`);
  } finally { $('progress').hidden = true; setBusy(false); }
};
$('rewrite').onclick = async () => {
  if (!engine || busy) return;
  const text = editor.value.trim();
  if (!text) { notice('Escreva ou importe um texto primeiro.'); return; }
  const snapshot = editor.value;
  const snapshotRevision = revision;
  setBusy(true); aiStatus('Gerando no navegador…');
  let interrupted = false;
  $('cancel').onclick = () => { interrupted = true; engine.interruptGenerate(); aiStatus('Parando…'); };
  try {
    const reply = await engine.chat.completions.create({
      messages:rewriteMessages(text,$('language').value,$('mode').value,$('context').value),
      temperature:0.2, max_tokens:1800, extra_body:{enable_thinking:false}
    });
    if (interrupted) { aiStatus('Geração interrompida.'); return; }
    if (reply.choices[0]?.finish_reason === 'length') throw new Error('A resposta atingiu o limite. Tente um trecho menor.');
    const content = reply.choices[0]?.message?.content?.replace(/<think>[\s\S]*?<\/think>/g,'').trim();
    if (!content) throw new Error('A IA não retornou uma sugestão.');
    if (content.length > MAX_TEXT) throw new Error('A sugestão ficou muito longa. Tente um trecho menor.');
    if (snapshotRevision !== revision) { aiStatus('O texto ou idioma mudou durante a geração. Gere uma nova sugestão.'); return; }
    resultSource = snapshot; resultRevision = revision; resultText = content;
    $('result').textContent = content; $('result-box').hidden = false;
    aiStatus('Sugestão pronta. Revise antes de aceitar.');
  } catch(e) { aiStatus(`Não foi possível gerar: ${errorMessage(e)}`); }
  finally { setBusy(false); }
};
$('accept').onclick = () => {
  if (editor.value !== resultSource || revision !== resultRevision) { notice('O texto mudou. Gere novamente.'); return; }
  change(resultText);
};
async function unload() {
  if (engine) { try { await engine.unload(); } finally { worker?.terminate(); engine = undefined; worker = undefined; } }
}
$('unload').onclick = async () => { setBusy(true); try { await unload(); aiStatus('IA desligada. O modelo permanece no cache para a próxima vez.'); } catch(e) { aiStatus(e.message); } finally { setBusy(false); } };
$('delete-model').onclick = async () => {
  setBusy(true);
  try { await unload(); await deleteModelAllInfoInCache(model.record.model_id,appConfig); aiStatus('Modelo apagado deste navegador.'); }
  catch(e) { aiStatus(`Não foi possível apagar: ${e.message}`); }
  finally { setBusy(false); }
};
chrome.storage.local.get('language').then(({language}) => { if (['pt-BR','en-US'].includes(language)) { $('language').value = language; editor.lang = language; update(); } });
update();
