import {build} from 'esbuild';
import {prebuiltAppConfig} from '@mlc-ai/web-llm';
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const outName = process.argv.find(arg=>arg.startsWith('--out='))?.slice(6) || 'dist';
if (!/^dist(?:-[a-zA-Z0-9.-]+)?$/.test(outName)) throw new Error('Use uma pasta de saída dist ou dist-versao.');
const out = path.join(root,outName);
await mkdir(out,{recursive:true});
let lock;
try { lock = JSON.parse(await readFile('model-lock.json','utf8')); }
catch(e) {
  if (e.code !== 'ENOENT') throw e;
  const record = prebuiltAppConfig.model_list.find(m => m.model_id === 'Qwen3-1.7B-q4f32_1-MLC');
  if (!record) throw new Error('Modelo não encontrado.');
  const metadata = await fetch('https://huggingface.co/api/models/mlc-ai/Qwen3-1.7B-q4f32_1-MLC');
  if (!metadata.ok) throw new Error('Falha ao consultar a revisão do modelo.');
  const {sha} = await metadata.json();
  const github = await fetch('https://api.github.com/repos/mlc-ai/binary-mlc-llm-libs/commits/main',{headers:{'User-Agent':'grammarlio-build'}});
  if (!github.ok) throw new Error('Falha ao consultar revisão do runtime.');
  const {sha:runtimeSha} = await github.json();
  const wasmSource = record.model_lib.replace('/main/',`/${runtimeSha}/`);
  const response = await fetch(wasmSource);
  if (!response.ok) throw new Error(`Falha ao obter runtime: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  lock = {record:{...record,model:`${record.model}/resolve/${sha}/`},wasmSource,wasmSha256:createHash('sha256').update(bytes).digest('hex')};
  await writeFile('model-lock.json',JSON.stringify(lock,null,2)+'\n');
  await writeFile(path.join(out,'model.wasm'),bytes);
}
let wasm;
try { wasm = await readFile(path.join(out,'model.wasm')); } catch {}
if (!wasm || createHash('sha256').update(wasm).digest('hex') !== lock.wasmSha256) {
  const response = await fetch(lock.wasmSource);
  if (!response.ok) throw new Error(`Falha ao baixar runtime: ${response.status}`);
  wasm = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(wasm).digest('hex') !== lock.wasmSha256) throw new Error('Checksum inválido do runtime.');
  await writeFile(path.join(out,'model.wasm'),wasm);
}
await cp('extension',out,{recursive:true});
await mkdir(path.join(out,'dictionaries'),{recursive:true});
for (const lang of ['en','pt']) {
  for (const ext of ['aff','dic']) await cp(`node_modules/dictionary-${lang}/index.${ext}`,path.join(out,`dictionaries/${lang}.${ext}`));
  await cp(`node_modules/dictionary-${lang}/license`,path.join(out,`dictionaries/${lang}-LICENSE`));
}
await cp('node_modules/hunspell-wasm/wasm/hunspell.wasm',path.join(out,'hunspell.wasm'));
await build({entryPoints:['src/panel.js','src/background.js','src/ai-worker.js','src/spell-worker.js'],outdir:out,bundle:true,format:'esm',platform:'browser',target:'chrome116',legalComments:'eof',external:['fs/promises','module','fs','path','url']});
await cp('LICENSE',path.join(out,'LICENSE'));
await cp('THIRD_PARTY_NOTICES.md',path.join(out,'THIRD_PARTY_NOTICES.md'));
await cp('node_modules/@mlc-ai/web-llm/LICENSE',path.join(out,'WEBLLM-LICENSE'));
await cp('third_party/MPL-2.0.txt',path.join(out,'dictionaries/MPL-2.0.txt'));
for (const file of ['COPYING','COPYING.LESSER','COPYING.MPL']) await cp(`node_modules/hunspell-wasm/${file}`,path.join(out,`dictionaries/HUNSPELL-${file}`));
console.log(`Extensão gerada em ${outName}/. Runtime WASM local verificado por SHA-256.`);
