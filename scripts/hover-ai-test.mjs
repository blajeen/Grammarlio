import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { launchExtension } from "./test-browser.mjs";
const html =
  '<!doctype html><html lang="en"><meta charset="utf-8"><style>body{font:16px system-ui;margin:35px;background:#faf9f5;color:#243c35}textarea{display:block;font:18px/1.6 Arial;width:700px;height:160px;padding:16px;margin:24px 0;border:1px solid #bdcdb9;border-radius:8px}</style><h1>Grammarlio · IA no próprio campo</h1><textarea id="en">Prefix stays.\nShe are happy to recieve the message.\nSuffix stays.</textarea><textarea id="pt">Nós vai receber a mensagem.</textarea><textarea id="es">Las personas nesecitan ayuda.</textarea></html>';
const server = createServer((req, res) => {
  res.setHeader("content-type", "text/html;charset=utf-8");
  res.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const args = process.argv.some((a) => a.startsWith("--profile="))
  ? process.argv
  : [...process.argv, "--profile=artifacts/ai-test-profile"];
const { context, worker, id, channel, initialOffer } =
  await launchExtension(args);
const evidence = {
  date: new Date().toISOString(),
  browser: channel,
  extensionVersion: await worker.evaluate(
    () => chrome.runtime.getManifest().version,
  ),
  cases: [],
  errors: [],
  offline: false,
};
let timer, page;
try {
  let welcome = await initialOffer(false);
  welcome ||= await context.newPage();
  if (!welcome.url().endsWith("/welcome.html"))
    await welcome.goto(`chrome-extension://${id}/welcome.html`);
  page = await context.newPage();
  await page.goto(origin);
  await page.setViewportSize({ width: 1100, height: 850 });
  page.on("pageerror", (error) => evidence.errors.push(error.message));
  welcome.on("pageerror", (error) =>
    console.log("Welcome error:", error.message),
  );
  await welcome.bringToFront();
  await welcome.locator("#yes").click();
  context.on("console", (message) => {
    if (message.type() === "error")
      console.log("Browser:", message.text().slice(0, 350));
  });
  timer = setInterval(async () => {
    console.log(
      "IA:",
      await welcome
        .locator("#status")
        .textContent()
        .catch(() => ""),
    );
  }, 15000);
  await welcome.locator("#finish").waitFor({ timeout: 300000 });
  assert.match(await welcome.locator("#status").textContent(), /Pronto!/);
  clearInterval(timer);
  timer = undefined;
  await welcome.close();
  await page.bringToFront();
  const root = page.locator("[data-grammarlio-root]");
  async function hover(word) {
    const mark = root.locator(`.mark[data-word="${word}"]`).first();
    await mark.waitFor({ timeout: 25000 });
    let box;
    for (let i = 0; i < 15 && !box; i++) {
      box = await mark.boundingBox();
      if (!box) await page.waitForTimeout(60);
    }
    assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y - 7);
    await root.locator(".popup").waitFor({ state: "visible" });
  }
  async function rewrite(selector, word, language, expected) {
    await page.locator(selector).focus();
    const original = await page.locator(selector).inputValue();
    await hover(word);
    await root.locator(".ai-accept").waitFor({ timeout: 180000 });
    const result = await root.locator(".ai-output").textContent();
    for (const pattern of expected) assert.match(result, pattern);
    assert.notEqual(result, original);
    assert.equal(
      await page.locator(selector).inputValue(),
      original,
      "Generating a suggestion must not edit the field automatically",
    );
    await page.screenshot({ path: `artifacts/hover-ai-${language}.png` });
    await root.locator(".ai-accept").click();
    const applied = await page.locator(selector).inputValue();
    assert.ok(applied.includes(result));
    if (selector === "#en") {
      assert.ok(applied.startsWith("Prefix stays.\n"));
      assert.ok(applied.endsWith("\nSuffix stays."));
    }
    evidence.cases.push({ language, original, result, applied });
    console.log(JSON.stringify(evidence.cases.at(-1)));
  }
  await mkdir("artifacts", { recursive: true });
  await rewrite("#en", "recieve", "en-US", [
    /message/i,
    /receiv|happy|glad|delight/i,
  ]);
  await rewrite("#pt", "Nós vai", "pt-BR", [/mensagem/i]);
  await rewrite("#es", "nesecitan", "es-ES", [/ayuda/i]);
  await page.evaluate(() => {
    const el = document.createElement("textarea");
    el.id = "style";
    el.value = "Due to the fact that it was raining, we stayed inside.";
    document.body.append(el);
  });
  await rewrite(
    "#style",
    "Due to the fact that it was raining, we stayed inside.",
    "style",
    [/rain/i],
  );
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.locator("#enabled").uncheck();
  await page.bringToFront();
  await page.locator("#pt").fill("Nós vai receber a mensagem.");
  await page.waitForTimeout(700);
  assert.equal(await root.locator(".badge").isVisible(), false);
  await context.setOffline(true);
  await popup.bringToFront();
  await popup.locator("#enabled").check();
  await page.bringToFront();
  await rewrite("#pt", "Nós vai", "pt-BR", [/mensagem/i]);
  evidence.offline = true;
  assert.deepEqual(evidence.errors, []);
  evidence.userAgent = await page.evaluate(() => navigator.userAgent);
  evidence.passed = true;
  console.log(
    "Real hover AI acceptance passed in all three languages and after offline reload.",
  );
} finally {
  clearInterval(timer);
  await mkdir("artifacts", { recursive: true });
  if (!evidence.passed)
    await page
      ?.screenshot({ path: "artifacts/hover-ai-failure.png" })
      .catch(() => {});
  await writeFile(
    `artifacts/hover-ai-evidence-${channel}.json`,
    JSON.stringify(evidence, null, 2),
  );
  await context.close();
  server.close();
}
