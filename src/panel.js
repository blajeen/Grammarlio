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
let spelling = [], spellTimer, spellId = 0, spellQueue = Promise.resolve();
const spellTasks = new Map();
const personal = {'pt-BR':[], 'en-US':[]};
const spellWorker = new Worker(chrome.runtime.getURL('spell-worker.js'),{type:'module'});
spellWorker.onmessage = ({data}) => {
  const task = spellTasks.get(data.id); if (!task) return;
  spellTasks.delete(data.id);
  data.error ? task.reject(new Error(data.error)) : task.resolve(data);
};
spellWorker.onerror = error => {
  for (const task of spellTasks.values()) task.reject(new Error(error.message || 'Falha no dicionário.'));
  spellTasks.clear();
};
function spellRequest(args) {
  // Serialize loads/checks so a language switch cannot race a dictionary initialization.
  const operation = spellQueue.then(()=>new Promise((resolve,reject)=>{
    const id=++spellId; spellTasks.set(id,{resolve,reject}); spellWorker.postMessage({id,...args});
  }));
  spellQueue = operation.catch(()=>{}); return operation;
}

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
  spelling = [];
  clearTimeout(spellTimer);
  const snapshot = revision;
  $('dictionary-status').textContent = 'Verificando no dicionário local…';
  spellTimer = setTimeout(async()=>{
    try {
      const language = $('language').value;
      const data = await spellRequest({type:'check',language,text:editor.value,personal:personal[language]});
      if(snapshot !== revision) return;
      spelling = data.result;
      $('dictionary-status').textContent = `${data.entries.toLocaleString('pt-BR')} entradas-base + flexões · ${spelling.length} palavra(s) não encontrada(s).`;
      renderSuggestions();
    } catch(error) { if(snapshot === revision) $('dictionary-status').textContent = `Dicionário: ${errorMessage(error)}`; }
  },300);
  renderSuggestions();
}
function renderSuggestions() {
  const list = $('suggestions');
  list.replaceChildren();
  const text = editor.value;
  const grammar = analyze(text,$('language').value);
  const suggestions = [...grammar,...spelling.filter(s=>!grammar.some(g=>g.start<s.end && s.start<g.end))].sort((a,b)=>a.start-b.start);
  if (!suggestions.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = text ? 'Nenhuma sugestão no momento. Confira o status do dicionário abaixo.' : 'Suas sugestões aparecerão aqui.';
    list.append(p);
  }
  for (const suggestion of suggestions.slice(0,40)) {
    const card = document.createElement('article'); card.className = 'suggestion';
    const from = document.createElement('span'); from.className = 'original'; from.textContent = suggestion.original;
    const to = document.createElement('span'); to.className = 'replacement'; to.textContent = suggestion.replacement || '';
    const description = document.createElement('p'); description.textContent = suggestion.message;
    if (suggestion.id === 'dictionary') {
      from.className = 'unknown-word';
      const options = document.createElement('div'); options.className = 'actions';
      const suggest = document.createElement('button'); suggest.className = 'secondary'; suggest.textContent = 'Ver opções';
      const add = document.createElement('button'); add.className = 'link'; add.textContent = 'Adicionar ao meu dicionário';
      const snapshot = revision, language = $('language').value;
      suggest.onclick = async()=>{
        suggest.disabled = true; suggest.textContent = 'Buscando…';
        try {
          const data = await spellRequest({type:'suggest',language,word:suggestion.original});
          if (revision !== snapshot) return;
          options.replaceChildren();
          for (const replacement of data.result) {
            const button = document.createElement('button'); button.className = 'secondary'; button.textContent = replacement;
            button.onclick = ()=>{try {change(applySuggestion(editor.value,{...suggestion,replacement}));} catch(error) {notice(error.message);} };
            options.append(button);
          }
          if(!data.result.length) options.textContent = 'Nenhuma alternativa encontrada. Você pode editar manualmente.';
        } catch(error) { suggest.disabled=false; suggest.textContent='Tentar novamente'; notice(errorMessage(error)); }
      };
      add.onclick = async()=>{
        if (revision !== snapshot) return;
        if(personal[language].length >= 5000) {notice('Seu dicionário pessoal atingiu 5.000 palavras. Apague-o para recomeçar.');return;}
        personal[language] = [...new Set([...personal[language],suggestion.original.normalize('NFC')])];
        await chrome.storage.local.set({personal}); update();
      };
      options.append(suggest); card.append(from,description,options,add); list.append(card); continue;
    }
    const accept = document.createElement('button'); accept.className = 'secondary'; accept.textContent = 'Aceitar';
    accept.addEventListener('click',() => { try { change(applySuggestion(editor.value,suggestion)); } catch(e) { notice(e.message); } });
    card.append(from,document.createTextNode(' → '),to,description,accept); list.append(card);
  }
  if(suggestions.length>40) { const p=document.createElement('p');p.className='hint';p.textContent='Mostrando as primeiras 40 sugestões. Novas sugestões aparecem conforme você revisa.';list.append(p); }
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
      const adapter = await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});
      if (!adapter) throw new Error('WebGPU indisponível. Ative a aceleração gráfica e use um navegador atualizado. A ortografia continua funcionando offline.');
      // Checking the adapter alone is insufficient: a driver can fail at requestDevice.
      const device = await adapter.requestDevice(); device.destroy();
      worker = new Worker(chrome.runtime.getURL('ai-worker.js'),{type:'module'});
      engine = await CreateWebWorkerMLCEngine(worker, model.record.model_id, {
        appConfig,
        initProgressCallback: p => { $('progress').value = p.progress; aiStatus(p.text); }
      });
      aiStatus('IA pronta na GPU. As sugestões são geradas neste dispositivo.');
  } catch(e) {
    worker?.terminate(); worker = undefined; engine = undefined;
    aiStatus(`Não foi possível carregar: ${errorMessage(e)}. Confira a aceleração gráfica, memória disponível e atualização do navegador/driver. Os dicionários continuam funcionando.`);
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
    // Apply deterministic grammar findings to the prompt, while keeping the editor
    // unchanged until the user accepts the complete proposal.
    const prepared = analyze(text,$('language').value).sort((a,b)=>b.start-a.start).reduce((value,suggestion)=>applySuggestion(value,suggestion),text);
    const reply = await engine.chat.completions.create({
      messages:rewriteMessages(prepared,$('language').value,$('mode').value,$('context').value),
      temperature:0, max_tokens:1800, extra_body:{enable_thinking:false}
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
  } catch(e) {
    const message=errorMessage(e);
    if (/disposed|device.*lost|out of memory/i.test(message)) {
      worker?.terminate(); worker=undefined; engine=undefined;
      aiStatus('A GPU perdeu a sessão ou ficou sem memória. Feche abas pesadas e carregue a IA novamente. Seu texto continua no editor.');
    } else aiStatus(`Não foi possível gerar: ${message}`);
  }
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
$('clear-personal').onclick = async()=>{personal['en-US']=[];personal['pt-BR']=[];await chrome.storage.local.set({personal});update();notice('Dicionário pessoal apagado.');};
chrome.storage.local.get(['language','personal']).then(({language,personal:saved}) => {
  for(const lang of ['pt-BR','en-US']) if(Array.isArray(saved?.[lang])) personal[lang]=saved[lang].filter(w=>typeof w==='string' && w.length<=100).slice(0,5000);
  if (['pt-BR','en-US'].includes(language)) { $('language').value = language; editor.lang = language; }
  update();
});
update();
