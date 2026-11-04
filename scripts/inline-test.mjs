import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { launchExtension } from "./test-browser.mjs";
const css =
  "body{font:16px/1.6 system-ui;background:#faf9f5;color:#243c35;margin:32px}main{max-width:740px;margin:auto}textarea,input,[contenteditable]{display:block;font:18px/1.6 Arial;padding:14px;width:100%;box-sizing:border-box;border:1px solid #b8c9b6;border-radius:8px;background:white;margin:12px 0 24px}textarea{height:110px}input{height:58px}[contenteditable]{min-height:90px}iframe{width:100%;height:160px}";
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><title>Grammarlio inline</title></head><body><main><h1>Escreva. O idioma é automático.</h1><label>Português</label><textarea id="pt">estou indo para o akampamento.</textarea><label>English</label><input id="en" value="A beutiful garden."><label>Español</label><textarea id="es">Yo es feliz.</textarea><label>Editor com formatação</label><div id="rich" contenteditable="true"><p>Eu estudo <strong>portugês</strong>.</p><p>Este texto continua aqui.</p></div><input id="controlled" value="We is ready."><output id="model">We is ready.</output><input id="password" type="password" value="akampamento"><input id="otp" autocomplete="one-time-code" value="akampamento"><input id="readonly" readonly value="akampamento"><textarea id="optout" data-grammarlio="off">akampamento</textarea><textarea id="mixed">Nós vai chegar. They is ready. Yo es feliz.</textarea><iframe src="/frame" title="Editor em frame"></iframe></main><script src="/fixture.js"></script></body></html>`;
const server = createServer((request, response) => {
  if (request.url === "/fixture.css") {
    response.setHeader("content-type", "text/css");
    response.end(css);
    return;
  }
  if (request.url === "/fixture.js") {
    response.setHeader("content-type", "text/javascript");
    response.end(
      "document.getElementById('controlled').addEventListener('input',e=>document.getElementById('model').textContent=e.target.value);",
    );
    return;
  }
  response.setHeader("content-type", "text/html;charset=utf-8");
  if (request.url === "/strict")
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; frame-src 'self'",
    );
  response.end(
    request.url === "/frame"
      ? '<html lang="pt"><textarea id="frame-text">They is ready.</textarea></html>'
      : html,
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const { context, worker, id, channel, decline } = await launchExtension();
const evidence = {
  date: new Date().toISOString(),
  browser: channel,
  cases: [],
  externalRequests: [],
  errors: [],
};
let page;
try {
  context.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(origin))
      evidence.externalRequests.push(request.url());
  });
  await decline();
  evidence.cases.push("Installation immediately offers AI and respects No");
  page = await context.newPage();
  await page.setViewportSize({ width: 1100, height: 900 });
  page.on("pageerror", (error) => evidence.errors.push(error.message));
  await page.goto(origin);
  evidence.userAgent = await page.evaluate(() => navigator.userAgent);
  evidence.extensionVersion = await worker.evaluate(
    () => chrome.runtime.getManifest().version,
  );
  const root = page.locator("[data-grammarlio-root]");
  const mark = (word) => root.locator(`.mark[data-word="${word}"]`).first();
  async function hover(word) {
    await mark(word).waitFor({ timeout: 25000 });
    let box;
    for (let i = 0; i < 15 && !box; i++) {
      box = await mark(word).boundingBox();
      if (!box) await page.waitForTimeout(60);
    }
    assert.ok(box, "A marca precisa ter posição visível");
    await page.mouse.move(box.x + box.width / 2, box.y - 7);
    await root.locator(".popup").waitFor({ state: "visible" });
  }
  async function correct(selector, word, replacement) {
    await page.locator(selector).focus();
    await hover(word);
    await root.getByRole("button", { name: replacement, exact: true }).click();
  }
  await correct("#pt", "akampamento", "acampamento");
  assert.equal(
    await page.locator("#pt").inputValue(),
    "estou indo para o acampamento.",
  );
  evidence.cases.push(
    "Portuguese detected on an English website; whole-word hover opens correction without clicking",
  );
  await correct("#en", "beutiful", "beautiful");
  assert.equal(await page.locator("#en").inputValue(), "A beautiful garden.");
  await page.locator("#en").press("Control+z");
  assert.equal(await page.locator("#en").inputValue(), "A beutiful garden.");
  evidence.cases.push(
    "English auto-detection, spelling correction and native undo",
  );
  await correct("#es", "Yo es", "Yo soy");
  assert.equal(await page.locator("#es").inputValue(), "Yo soy feliz.");
  evidence.cases.push("Spanish auto-detection and grammar correction");
  await page.locator("#mixed").focus();
  for (const word of ["Nós vai", "They is", "Yo es"])
    await mark(word).waitFor();
  await correct("#mixed", "Nós vai", "Nós vamos");
  await correct("#mixed", "They is", "They are");
  await correct("#mixed", "Yo es", "Yo soy");
  assert.equal(
    await page.locator("#mixed").inputValue(),
    "Nós vamos chegar. They are ready. Yo soy feliz.",
  );
  evidence.cases.push(
    "Mixed Portuguese, English and Spanish sentences use their own dictionaries and rules",
  );
  await correct("#rich", "portugês", "português");
  assert.equal(await page.locator("#rich strong").textContent(), "português");
  assert.equal(await page.locator("#rich p").count(), 2);
  evidence.cases.push(
    "Rich-text formatting and surrounding paragraphs are preserved",
  );
  await correct("#controlled", "We is", "We are");
  assert.equal(await page.locator("#model").textContent(), "We are ready.");
  evidence.cases.push("Native input events update site-controlled fields");
  await page.locator("#en").fill("🙂 A beutiful garden.");
  await correct("#en", "beutiful", "beautiful");
  assert.equal(
    await page.locator("#en").inputValue(),
    "🙂 A beautiful garden.",
  );
  evidence.cases.push("Unicode emoji offsets remain intact");
  await page.locator("#en").fill("A beutiful garden.");
  await hover("beutiful");
  await root.getByRole("button", { name: "beautiful", exact: true }).waitFor();
  await page.evaluate(() => {
    document.getElementById("en").value = "New writing from the site.";
    const shadow = document.querySelector("[data-grammarlio-root]").shadowRoot;
    [...shadow.querySelectorAll(".option")]
      .find((b) => b.textContent === "beautiful")
      .click();
  });
  assert.equal(
    await page.locator("#en").inputValue(),
    "New writing from the site.",
  );
  evidence.cases.push("Stale proposals refuse to overwrite later page edits");
  for (const selector of ["#password", "#otp", "#readonly", "#optout"]) {
    await page.locator(selector).focus();
    await page.waitForTimeout(550);
    assert.equal(await root.locator(".badge").isVisible(), false);
  }
  evidence.cases.push(
    "Passwords, access codes, read-only fields and opt-out are excluded",
  );
  await page.locator("#pt").focus();
  await page.locator("#pt").evaluate((el) => {
    el.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    el.value = "estou indo para o akampamento";
    el.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
  });
  await page.waitForTimeout(700);
  assert.equal(await root.locator(".mark").count(), 0);
  await page
    .locator("#pt")
    .evaluate((el) =>
      el.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true }),
      ),
    );
  await mark("akampamento").waitFor();
  evidence.cases.push("IME composition is not interrupted");
  await hover("akampamento");
  await root.getByRole("button", { name: "Ignorar nesta edição" }).click();
  await page.waitForTimeout(700);
  assert.equal(await mark("akampamento").count(), 0);
  evidence.cases.push("Dismiss works directly in the hover card");
  const frame = page.frameLocator("iframe");
  await frame.locator("#frame-text").focus();
  const frameRoot = frame.locator("[data-grammarlio-root]");
  await frameRoot.locator('.mark[data-word="They is"]').click();
  await frameRoot
    .getByRole("button", { name: "They are", exact: true })
    .click();
  assert.equal(
    await frame.locator("#frame-text").inputValue(),
    "They are ready.",
  );
  evidence.cases.push(
    "HTTP iframe uses automatic language and inline corrections",
  );
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  assert.equal(await popup.locator("select,textarea").count(), 0);
  assert.equal(await popup.locator("input").count(), 1);
  await popup.locator("#enabled").uncheck();
  await page.bringToFront();
  await page.locator("#en").fill("A beutiful garden.");
  await page.waitForTimeout(800);
  assert.equal(await root.locator(".badge").isVisible(), false);
  await popup.bringToFront();
  await popup.locator("#enabled").check();
  await page.bringToFront();
  await page.locator("#en").focus();
  await mark("beutiful").waitFor();
  evidence.cases.push(
    "Minimal popup has one on/off control and no configuration",
  );
  const strict = await context.newPage();
  await strict.addInitScript(() => {
    window.__violations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      window.__violations.push(event.violatedDirective),
    );
  });
  await strict.goto(origin + "/strict");
  await strict.locator("#en").focus();
  const sr = strict.locator("[data-grammarlio-root]");
  await sr.locator('.mark[data-word="beutiful"]').click();
  await sr.getByRole("button", { name: "beautiful", exact: true }).click();
  assert.equal(await strict.locator("#en").inputValue(), "A beautiful garden.");
  assert.deepEqual(await strict.evaluate(() => window.__violations), []);
  await strict.close();
  await page.bringToFront();
  evidence.cases.push(
    "Restrictive website CSP is supported without image or network violations",
  );
  assert.deepEqual(evidence.externalRequests, []);
  assert.deepEqual(evidence.errors, []);
  await page.locator("#pt").fill("Nós vai escrever concerteza.");
  await hover("concerteza");
  await root
    .getByRole("button", { name: "com certeza", exact: true })
    .waitFor();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: `artifacts/inline-${channel}.png` });
  evidence.passed = true;
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await mkdir("artifacts", { recursive: true });
  if (!evidence.passed)
    await page
      ?.screenshot({ path: `artifacts/inline-failure-${channel}.png` })
      .catch(() => {});
  await writeFile(
    `artifacts/inline-evidence-${channel}.json`,
    JSON.stringify(evidence, null, 2),
  );
  await context.close();
  server.close();
}
