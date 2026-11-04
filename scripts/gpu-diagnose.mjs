import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
const server = createServer((q,s)=>s.end('GPU diagnostic'));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try {
  for (const channel of ['chromium','chrome','msedge']) {
    const browser = await chromium.launch({channel,headless:true});
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      console.log(channel,await page.evaluate(async()=>{
        const results=[];
        for (const powerPreference of ['high-performance','low-power']) {
          try {
            const adapter = await navigator.gpu?.requestAdapter({powerPreference});
            if(!adapter) {results.push({powerPreference,error:'No adapter'}); continue;}
            const device = await adapter.requestDevice();
            device.destroy();
            results.push({powerPreference,ok:true,info:adapter.info});
          } catch(e) {results.push({powerPreference,error:String(e)});}
        }
        return results;
      }));
    } finally {await browser.close();}
  }
} finally {server.close();}
