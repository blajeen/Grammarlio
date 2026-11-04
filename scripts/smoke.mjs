import {chromium} from '@playwright/test';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {captureField,replaceField} from '../src/page.js';

const profile = process.argv.includes('--keep-profile') ? path.resolve('artifacts/ai-test-profile') : await mkdtemp(path.join(tmpdir(),'grammarlio-test-'));
const extension = path.resolve(process.argv.find(arg=>arg.startsWith('--extension-dir='))?.slice(16) || 'dist');
const channel = process.argv.find(a=>a.startsWith('--browser='))?.split('=')[1] || 'chromium';
const context = await chromium.launchPersistentContext(profile,{channel,headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
try {
  let [worker] = context.serviceWorkers();
  worker ||= await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const panel = await context.newPage();
  await panel.setViewportSize({width:420,height:1000});
  const errors=[]; const remote=[];
  panel.on('pageerror',e=>errors.push(e.message));
  context.on('request',r=>{if (/^https?:/.test(r.url())) remote.push(r.url());});
  await panel.goto(`chrome-extension://${id}/panel.html`);
  await panel.waitForFunction(()=>document.getElementById('dictionary-status').textContent.includes('entradas-base'));
  await panel.locator('#language').selectOption('pt-BR');
  await panel.locator('#example').click();
  await panel.waitForFunction(()=>document.getElementById('dictionary-status').textContent.includes('entradas-base'));
  await panel.locator('.suggestion').first().waitFor();
  assert.equal(await panel.locator('.suggestion').count(),3);
  await panel.locator('.suggestion button').first().click();
  assert.match(await panel.locator('#editor').inputValue(),/^Nós vamos/);
  await panel.locator('#undo').click();
  assert.match(await panel.locator('#editor').inputValue(),/^Nós vai/);
  await panel.locator('#language').selectOption('en-US');
  await panel.locator('#example').click();
  await panel.waitForFunction(()=>document.getElementById('dictionary-status').textContent.includes('entradas-base'));
  assert.equal(await panel.locator('.suggestion').count(),4);
  assert.equal(await panel.locator('#rewrite').isDisabled(),true);
  await panel.locator('#editor').fill('<img src=x onerror=alert(1)> teh');
  assert.equal(await panel.locator('#suggestions img').count(),0);
  for (const [language,text,word,replacement] of [['pt-BR','Eu estudo portugês.','portugês','português'],['en-US','A beutiful garden.','beutiful','beautiful']]) {
    await panel.locator('#language').selectOption(language);
    await panel.locator('#editor').fill(text);
    const card=panel.locator('.suggestion').filter({hasText:word});
    await card.getByRole('button',{name:'Ver opções'}).click();
    await card.getByRole('button',{name:replacement,exact:true}).click();
    assert.equal(await panel.locator('#editor').inputValue(),text.replace(word,replacement));
  }
  await panel.locator('#editor').fill('Grammarlio');
  await panel.getByRole('button',{name:'Adicionar ao meu dicionário'}).click();
  await panel.waitForFunction(()=>document.getElementById('dictionary-status').textContent.includes('0 palavra(s)'));
  const saved=await panel.evaluate(()=>chrome.storage.local.get('personal'));
  assert.ok(saved.personal['en-US'].includes('Grammarlio'));
  await panel.locator('#clear-personal').click();
  await panel.getByRole('button',{name:'Adicionar ao meu dicionário'}).waitFor();
  assert.deepEqual(errors,[]);
  assert.deepEqual(remote,[],'No network requests before explicit AI activation');
  const initialRequestCount=remote.length;
  await mkdir('artifacts',{recursive:true});
  await panel.locator('#language').selectOption('pt-BR');
  await panel.locator('#example').click();
  await panel.screenshot({path:'artifacts/panel.png',fullPage:true});

  const page = await context.newPage();
  await page.setContent('<textarea id="text">before teh after</textarea><input type="password" value="secret"><div contenteditable="true">Rich text</div>');
  await page.locator('textarea').focus();
  await page.locator('textarea').evaluate(el=>el.setSelectionRange(7,10));
  const captured = await page.evaluate(captureField);
  assert.deepEqual(captured,{text:'teh',canApply:true});
  assert.deepEqual(await page.evaluate(replaceField,'the'),{ok:true});
  assert.equal(await page.locator('textarea').inputValue(),'before the after');
  await page.evaluate(captureField);
  await page.locator('textarea').fill('New writing');
  assert.match((await page.evaluate(replaceField,'stale')).error,/mudou/);
  assert.equal(await page.locator('textarea').inputValue(),'New writing');
  await page.locator('input').focus();
  assert.ok((await page.evaluate(captureField)).error);
  await page.locator('div').focus();
  assert.equal((await page.evaluate(captureField)).canApply,false);
  const gpu = await panel.evaluate(async()=>{const adapter=await navigator.gpu?.requestAdapter(); return Boolean(adapter);});
  if (process.argv.includes('--ai')) {
    assert.ok(gpu,'WebGPU required for AI acceptance test');
    panel.on('console',msg=>{if(msg.type()==='error') console.log('Browser error:',msg.text().slice(0,300));});
    await panel.locator('#language').selectOption('en-US');
    await panel.locator('#editor').fill('She are happy to recieve the message.');
    await panel.locator('#load').click();
    const timer = setInterval(async()=>console.log('AI:',await panel.locator('#ai-status').textContent().catch(()=>'')),15000);
    try {
      await panel.waitForFunction(()=>!document.getElementById('rewrite').disabled || document.getElementById('ai-status').textContent.includes('Não foi possível'),null,{timeout:240000});
      assert.equal(await panel.locator('#rewrite').isEnabled(),true,await panel.locator('#ai-status').textContent());
      await panel.locator('#rewrite').click();
      await panel.locator('#result-box').waitFor({state:'visible',timeout:120000});
      const result = await panel.locator('#result').textContent();
      assert.match(result,/She is/);
      assert.match(result,/receive/);
      console.log('Real local AI generation:',result);
    } finally { clearInterval(timer); }
  }
  console.log(JSON.stringify({extensionLoaded:true,panelErrors:errors,remoteRequestsBeforeAI:initialRequestCount,fieldRoundTrip:true,staleEditProtected:true,passwordBlocked:true,webgpuAdapter:gpu,screenshot:'artifacts/panel.png'},null,2));
} finally { await context.close(); }
