import {chromium} from '@playwright/test';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const channel=process.argv.find(a=>a.startsWith('--browser='))?.split('=')[1] || 'msedge';
const extension=path.resolve('dist');
const profile=process.argv.find(a=>a.startsWith('--profile='))?.slice('--profile='.length) || 'artifacts/ai-test-profile';
const context=await chromium.launchPersistentContext(path.resolve(profile),{
  channel,headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]
});
const evidence={date:new Date().toISOString(),browser:channel,backend:'gpu',cases:[],offline:false,errors:[]};
let timer;
try {
  let [worker]=context.serviceWorkers(); worker ||= await context.waitForEvent('serviceworker');
  const page=await context.newPage();
  await page.setViewportSize({width:420,height:1000});
  page.on('pageerror',e=>evidence.errors.push(e.message));
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/panel.html`);
  evidence.userAgent=await page.evaluate(()=>navigator.userAgent);
  await page.waitForFunction(()=>document.getElementById('dictionary-status').textContent.includes('entradas-base'));
  timer=setInterval(async()=>console.log(await page.locator('#ai-status').textContent().catch(()=>'')),15000);
  async function load() {
    await page.locator('#load').click();
    await page.waitForFunction(()=>!document.getElementById('rewrite').disabled || document.getElementById('ai-status').textContent.includes('Não foi possível'),null,{timeout:300000});
    assert.ok(await page.locator('#rewrite').isEnabled(),await page.locator('#ai-status').textContent());
  }
  async function generate({language,mode,text,context:writingContext='',expected},offline=false) {
    await page.locator('#language').selectOption(language);
    await page.locator('#mode').selectOption(mode);
    await page.locator('#context').fill(writingContext);
    await page.locator('#editor').fill(text);
    const started=Date.now();
    await page.locator('#rewrite').click();
    await page.waitForFunction(()=>!document.getElementById('result-box').hidden || document.getElementById('ai-status').textContent.includes('Não foi possível'),null,{timeout:180000});
    assert.ok(await page.locator('#result-box').isVisible(),await page.locator('#ai-status').textContent());
    const result=await page.locator('#result').textContent();
    for(const expression of expected) assert.match(result,expression);
    if(mode === 'formal') assert.notEqual(result,text,'A formal rewrite should change the direct request');
    assert.doesNotMatch(result,/assistant_response|can't assist|cannot assist|I cannot|desculp|não posso ajudar/i);
    await page.locator('#accept').click();
    assert.equal(await page.locator('#editor').inputValue(),result);
    evidence.cases.push({language,mode,text,context:writingContext,result,offline,milliseconds:Date.now()-started});
    console.log(JSON.stringify(evidence.cases.at(-1)));
    await page.screenshot({path:`artifacts/ai-gpu-${language}-${offline?'offline':mode}.png`,fullPage:true});
  }
  await load();
  await generate({language:'en-US',mode:'correct',text:'She are happy to recieve the message.',expected:[/She is/,/receive/]});
  await generate({language:'pt-BR',mode:'correct',text:'As pessoas precisa de ajuda.',expected:[/pessoas (precisam|estão necessitadas) de ajuda/,/ajuda/]});
  await generate({language:'en-US',mode:'formal',text:'Send the report by Friday.',context:'Professional email to a colleague. The deadline is Friday.',expected:[/report/i,/Friday/]});
  await context.setOffline(true);
  await page.locator('#unload').click();
  await page.waitForFunction(()=>!document.getElementById('load').disabled);
  await load();
  await generate({language:'pt-BR',mode:'correct',text:'Nós vai receber a mensagem.',expected:[/Nós vamos/i,/mensagem/]},true);
  evidence.offline=true;
  assert.deepEqual(evidence.errors,[]);
  console.log('AI acceptance passed, including offline reload.');
} finally {
  clearInterval(timer);
  await mkdir('artifacts',{recursive:true});
  await writeFile(`artifacts/ai-evidence-${channel}.json`,JSON.stringify(evidence,null,2));
  await context.close();
}
