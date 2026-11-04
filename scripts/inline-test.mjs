import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Inline acceptance fixture</title><style>
body{font:16px/1.5 system-ui;background:#f6f7f2;margin:32px;color:#253e35}main{max-width:740px;margin:auto}label{display:block;margin:20px 0 6px}textarea,input,[contenteditable]{font:18px/1.6 Arial;padding:14px;border:2px solid #b4c9b4;border-radius:8px;box-sizing:border-box;background:white;width:100%}textarea{height:125px;resize:both}input{height:58px}[contenteditable]{min-height:100px}p{margin:0 0 10px}iframe{width:100%;height:160px;border:1px solid #ccc}#controlled{margin-bottom:15px}.spacer{height:600px}
</style></head><body><main><h1>Grammarlio · teste direto nos campos</h1><label>Português</label><textarea id="pt" lang="pt-BR">Nós vai resolver isso concerteza.</textarea><label>English</label><input id="en" lang="en-US" value="A beutiful garden."><label>Editor com formatação</label><div id="rich" contenteditable="true" lang="pt-BR"><p>Eu estudo <strong>portugês</strong>.</p><p>Este texto continua aqui.</p></div><label>Campo controlado por eventos</label><input id="controlled" lang="en-US" value="We is ready."><output id="model">We is ready.</output><label>Senha</label><input id="password" type="password" value="concerteza"><label>Código de acesso</label><input id="otp" autocomplete="one-time-code" value="concerteza"><label>Opt-out</label><textarea id="optout" data-grammarlio="off">concerteza</textarea><div class="spacer"></div><label>Campo com rolagem</label><textarea id="scroll" lang="en-US">A beautiful garden.\nA beautiful garden.\nA beautiful garden.\nA beautiful garden.\nA beutiful garden.</textarea><iframe src="/frame" title="Editor em iframe"></iframe></main><script>document.getElementById('controlled').addEventListener('input',e=>{document.getElementById('model').textContent=e.target.value;});</script></body></html>`;
const server = createServer((request, response) => {
  if (request.url === "/fixture.css") {
    response.setHeader("content-type", "text/css");
    response.end(html.match(/<style>([\s\S]*?)<\/style>/)[1]);
    return;
  }
  if (request.url === "/fixture.js") {
    response.setHeader("content-type", "text/javascript");
    response.end(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
    return;
  }
  response.setHeader("content-type", "text/html;charset=utf-8");
  if (request.url === "/strict") {
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; frame-src 'self'",
    );
    response.end(
      html
        .replace(
          /<style>[\s\S]*?<\/style>/,
          '<link rel="stylesheet" href="/fixture.css">',
        )
        .replace(
          /<script>[\s\S]*?<\/script>/,
          '<script src="/fixture.js"></script>',
        ),
    );
    return;
  }
  response.end(
    request.url === "/frame"
      ? '<html lang="en"><textarea id="frame-text" style="font:18px Arial;width:95%;height:90px" lang="en-US">They is ready.</textarea></html>'
      : html,
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const extension = path.resolve(
  process.argv.find((a) => a.startsWith("--extension-dir="))?.slice(16) ||
    "dist",
);
const profile = await mkdtemp(path.join(tmpdir(), "grammarlio-inline-"));
const channel =
  process.argv.find((a) => a.startsWith("--browser="))?.split("=")[1] ||
  "chromium";
const context = await chromium.launchPersistentContext(profile, {
  channel,
  headless: true,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ],
});
const evidence = {
  date: new Date().toISOString(),
  browser: channel,
  cases: [],
  externalRequests: [],
  errors: [],
};
try {
  let [worker] = context.serviceWorkers();
  worker ||= await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  context.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(origin))
      evidence.externalRequests.push(request.url());
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1100, height: 1000 });
  page.on("pageerror", (error) => evidence.errors.push(error.message));
  await page.goto(origin);
  evidence.userAgent = await page.evaluate(() => navigator.userAgent);
  evidence.extensionVersion = await worker.evaluate(
    () => chrome.runtime.getManifest().version,
  );
  const root = page.locator("[data-grammarlio-root]");
  async function mark(word) {
    return root.locator(`.mark[data-word="${word}"]`).first();
  }
  async function correct(field, word, replacement) {
    await page.locator(field).focus();
    const underline = await mark(word);
    await underline.waitFor({ timeout: 20000 });
    await underline.click();
    await root.getByRole("button", { name: replacement, exact: true }).click();
  }
  await correct("#pt", "concerteza", "com certeza");
  assert.equal(
    await page.locator("#pt").inputValue(),
    "Nós vai resolver isso com certeza.",
  );
  await correct("#pt", "Nós vai", "Nós vamos");
  assert.equal(
    await page.locator("#pt").inputValue(),
    "Nós vamos resolver isso com certeza.",
  );
  evidence.cases.push("Portuguese grammar and spelling applied directly");

  await correct("#en", "beutiful", "beautiful");
  assert.equal(await page.locator("#en").inputValue(), "A beautiful garden.");
  await page.locator("#en").press("Control+z");
  assert.equal(await page.locator("#en").inputValue(), "A beutiful garden.");
  evidence.cases.push("English dictionary alternatives and native undo");
  await page.locator("#en").fill("🙂 A beutiful garden.");
  await correct("#en", "beutiful", "beautiful");
  assert.equal(
    await page.locator("#en").inputValue(),
    "🙂 A beautiful garden.",
  );
  evidence.cases.push("Unicode emoji offsets preserve surrounding text");

  await correct("#rich", "portugês", "português");
  assert.equal(await page.locator("#rich strong").textContent(), "português");
  assert.equal(await page.locator("#rich p").count(), 2);
  assert.match(
    await page.locator("#rich").innerText(),
    /Este texto continua aqui\./,
  );
  evidence.cases.push(
    "Contenteditable correction preserves surrounding formatting and paragraphs",
  );

  await correct("#controlled", "We is", "We are");
  assert.equal(await page.locator("#model").textContent(), "We are ready.");
  evidence.cases.push("Controlled field receives the native input event");

  await page.locator("#en").fill("A beutiful garden.");
  await (await mark("beutiful")).click();
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
  await root.locator(".notice").filter({ hasText: "O texto mudou" }).waitFor();
  evidence.cases.push(
    "Stale suggestions refuse to overwrite a later page edit",
  );

  await page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "readonly";
    input.readOnly = true;
    input.value = "concerteza";
    document.querySelector("main").append(input);
  });
  for (const selector of ["#password", "#otp", "#optout", "#readonly"]) {
    await page.locator(selector).focus();
    await page.waitForTimeout(550);
    assert.equal(await root.locator(".mark").count(), 0);
    assert.equal(await root.locator(".badge").isVisible(), false);
  }
  evidence.cases.push(
    "Passwords, access codes, read-only fields and per-field opt-out are excluded",
  );

  await page.locator("#pt").focus();
  await page.locator("#pt").evaluate((el) => {
    el.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    el.value = "concerteza";
    el.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
  });
  await page.waitForTimeout(800);
  assert.equal(await root.locator(".mark").count(), 0);
  await page
    .locator("#pt")
    .evaluate((el) =>
      el.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true }),
      ),
    );
  await (await mark("concerteza")).waitFor();
  evidence.cases.push(
    "IME composition waits until the user finishes composing",
  );

  await page.locator("#pt").fill("Eu estudo portugês.");
  await (await mark("portugês")).click();
  await root.getByRole("button", { name: "Ignorar nesta edição" }).click();
  await page.waitForTimeout(750);
  assert.equal(await root.locator('.mark[data-word="portugês"]').count(), 0);
  await page.locator("#pt").fill("Grammarlio");
  await (await mark("Grammarlio")).click();
  await root
    .getByRole("button", { name: "Adicionar ao meu dicionário" })
    .click();
  await page.waitForTimeout(900);
  assert.equal(await root.locator('.mark[data-word="Grammarlio"]').count(), 0);
  evidence.cases.push(
    "Ignore and personal dictionary work from the inline popup",
  );

  await page.locator("#pt").fill("Olá universozz.");
  await (await mark("universozz")).click();
  await root.getByLabel("Idioma da revisão").selectOption("en-US");
  await page.locator("#pt").fill("A beutiful garden.");
  await (await mark("beutiful")).waitFor();
  evidence.cases.push("Inline language selector changes the dictionary");

  await page.locator("#scroll").focus();
  await page
    .locator("#scroll")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await (await mark("beutiful")).waitFor();
  const underlineBox = await (await mark("beutiful")).boundingBox(),
    fieldBox = await page.locator("#scroll").boundingBox();
  assert.ok(
    underlineBox.y >= fieldBox.y &&
      underlineBox.y + underlineBox.height <= fieldBox.y + fieldBox.height,
  );
  await (await mark("beutiful")).click();
  await root.getByRole("button", { name: "beautiful", exact: true }).click();
  evidence.cases.push(
    "Textarea scroll keeps the underline clipped inside the field",
  );

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
  evidence.cases.push("HTTP iframe text field is reviewed in its own frame");

  await page.locator("#en").fill("A beutiful garden.");
  await (await mark("beutiful")).click();
  await root.getByRole("button", { name: "Pausar neste site" }).click();
  await page.locator("#en").fill("teh message");
  await page.waitForTimeout(900);
  assert.equal(await root.locator(".badge").isVisible(), false);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/panel.html`);
  await panel.locator("#resume-sites").click();
  await page.bringToFront();
  await page.locator("#en").focus();
  await (await mark("teh")).waitFor();
  evidence.cases.push("Site pause and panel resume work without an account");

  await panel.bringToFront();
  await panel.locator("#inline-enabled").uncheck();
  await page.bringToFront();
  await page.locator("#en").focus();
  await page.waitForTimeout(600);
  assert.equal(await root.locator(".badge").isVisible(), false);
  await panel.bringToFront();
  await panel.locator("#inline-enabled").check();
  await page.bringToFront();
  await page.locator("#en").focus();
  await (await mark("teh")).waitFor();
  evidence.cases.push("Global pause and resume are respected by the page");
  await page.locator("#en").press("Control+Alt+g");
  await root.locator(".popup").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  assert.equal(await root.locator(".popup").isVisible(), false);
  await page.locator("h1").click();
  await root.locator(".badge").waitFor({ state: "hidden" });
  evidence.cases.push(
    "Keyboard shortcut opens suggestions and Escape closes them",
  );
  await page.locator("#en").fill("word ".repeat(2600));
  await root.locator(".badge").filter({ hasText: "…" }).waitFor();
  await root.locator(".badge").click();
  await root.locator(".popup p").filter({ hasText: "12.000" }).waitFor();
  assert.equal(await root.locator(".mark").count(), 0);
  evidence.cases.push(
    "Oversized fields are declined without silently truncating text",
  );
  const strict = await context.newPage();
  await strict.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      window.__cspViolations.push(event.violatedDirective),
    );
  });
  await strict.goto(origin + "/strict");
  await strict.locator("#en").focus();
  const strictRoot = strict.locator("[data-grammarlio-root]");
  const strictMark = strictRoot.locator('.mark[data-word="beutiful"]');
  await strictMark.waitFor();
  assert.equal(
    await strictMark.evaluate((el) => getComputedStyle(el).position),
    "fixed",
  );
  await strictMark.click();
  await strictRoot
    .getByRole("button", { name: "beautiful", exact: true })
    .click();
  assert.equal(await strict.locator("#en").inputValue(), "A beautiful garden.");
  assert.deepEqual(await strict.evaluate(() => window.__cspViolations), []);
  await strict.close();
  await page.bringToFront();
  evidence.cases.push(
    "Inline UI and correction work under a restrictive website CSP",
  );
  assert.deepEqual(evidence.externalRequests, []);
  assert.deepEqual(evidence.errors, []);
  await page.locator("#en").fill("A beautiful garden.");
  await page.locator("#pt").fill("Nós vai escrever concerteza.");
  await root.locator(".badge").click();
  await root.getByLabel("Idioma da revisão").selectOption("pt-BR");
  await (await mark("concerteza")).click();
  await root
    .getByRole("button", { name: "com certeza", exact: true })
    .waitFor();
  await mkdir("artifacts", { recursive: true });
  await page.setViewportSize({ width: 1100, height: 720 });
  await page.screenshot({
    path: `artifacts/inline-${channel}.png`,
    fullPage: false,
  });
  evidence.passed = true;
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await mkdir("artifacts", { recursive: true });
  if (!evidence.passed)
    await context
      .pages()
      .at(-1)
      ?.screenshot({ path: `artifacts/inline-failure-${channel}.png` })
      .catch(() => {});
  await writeFile(
    `artifacts/inline-evidence-${channel}.json`,
    JSON.stringify(evidence, null, 2),
  );
  await context.close();
  server.close();
}
