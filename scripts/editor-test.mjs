import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { launchExtension } from "./test-browser.mjs";
const html = `<!doctype html><html lang="pt"><meta charset="utf-8"><style>body{font:18px Arial;margin:24px}iframe{display:block;width:700px;height:180px;margin:24px 0} [contenteditable],textarea{font:20px/1.5 Arial;min-height:65px;border:1px solid #bbb;padding:12px;width:650px}dialog{width:750px}</style><h1>Compatibilidade dos editores de notas</h1><div id="direct" class="fr-element fr-view" role="textbox" contenteditable="true"><p>Test <strong>knowldge</strong> now.</p></div><iframe id="srcdoc" srcdoc="<html lang='pt'><body contenteditable='true' style='font:20px Arial;min-height:120px'><p>knowldge</p></body></html>"></iframe><iframe id="blank"></iframe><div id="late" tabindex="0">knowldge</div><div id="shadow"></div><dialog id="dialog"><div id="modal-note" contenteditable="true">knowldge</div></dialog><script>
const frame=document.getElementById('blank');frame.contentDocument.open();frame.contentDocument.write('<html lang="pt"><body style="font:20px Arial;min-height:120px"><p>knowldge</p></body></html>');frame.contentDocument.close();frame.contentDocument.designMode='on';
const root=document.getElementById('shadow').attachShadow({mode:'open'});root.innerHTML='<textarea id="shadow-note">knowldge</textarea>';
</script></html>`;
const server = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html;charset=utf-8");
  res.end(html);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
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
  context.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(origin))
      evidence.externalRequests.push(r.url());
  });
  await decline();
  page = await context.newPage();
  page.on("pageerror", (e) => evidence.errors.push(e.message));
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.goto(origin);
  evidence.extensionVersion = await worker.evaluate(
    () => chrome.runtime.getManifest().version,
  );
  async function correct(surface, field, name) {
    await field.click();
    const root = surface.locator("[data-grammarlio-root]");
    const mark = root.locator('.mark[data-word="knowldge"]').first();
    await mark.waitFor({ timeout: 15000 }).catch(async (error) => {
      console.log(
        name,
        await surface.locator("body").evaluate((el) => ({
          mode: document.designMode,
          active: document.activeElement.outerHTML,
          editable: el.isContentEditable,
          root: document
            .querySelector("[data-grammarlio-root]")
            ?.shadowRoot?.textContent?.slice(-1500),
        })),
      );
      throw error;
    });
    const box = await mark.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y - 7);
    await root
      .getByRole("button", { name: "knowledge", exact: true })
      .waitFor({ timeout: 10000 })
      .catch(async (error) => {
        console.log(
          name,
          "hover",
          box,
          await root.evaluate((el) => ({
            text: el.shadowRoot.querySelector(".popup")?.textContent,
            hidden: el.shadowRoot.querySelector(".popup")?.hidden,
            marks: [...el.shadowRoot.querySelectorAll(".mark")].map((el) => ({
              word: el.dataset.word,
              rect: el.getBoundingClientRect().toJSON(),
            })),
            computed: {
              position: getComputedStyle(el).position,
              pointer: getComputedStyle(el).pointerEvents,
            },
          })),
        );
        throw error;
      });
    await root.getByRole("button", { name: "knowledge", exact: true }).click();
    const value = await field.evaluate((el) =>
      "value" in el ? el.value : el.textContent,
    );
    assert.ok(value.includes("knowledge"), value);
    assert.ok(!value.includes("knowldge"));
    evidence.cases.push(name);
  }
  await correct(
    page,
    page.locator("#direct"),
    "Nested rich-text note: whole-word hover knowldge → knowledge",
  );
  assert.equal(await page.locator("#direct strong").textContent(), "knowledge");
  assert.equal(
    (await page.locator("#direct").textContent()).trim(),
    "Test knowledge now.",
  );
  await correct(
    page.frameLocator("#srcdoc"),
    page.frameLocator("#srcdoc").locator("body"),
    "srcdoc iframe with editable body and Portuguese site hint",
  );
  await correct(
    page.frameLocator("#blank"),
    page.frameLocator("#blank").locator("body"),
    "about:blank iframe with document.designMode",
  );
  // Recreate the frame document only after the extension is already present.
  await page.evaluate(() => {
    const doc = document.getElementById("blank").contentDocument;
    doc.open();
    doc.write(
      '<html lang="pt"><body contenteditable="true" style="font:20px Arial;min-height:120px"><p>knowldge</p></body></html>',
    );
    doc.close();
  });
  await correct(
    page.frameLocator("#blank"),
    page.frameLocator("#blank").locator("body"),
    "Editor document.open/write after extension startup recovers automatically",
  );
  const rewritten = page.frameLocator("#blank");
  await rewritten.locator("[data-grammarlio-root] .badge").click();
  await rewritten
    .locator("[data-grammarlio-root] .popup")
    .waitFor({ state: "visible" });
  await page.locator("#late").focus();
  await page.locator("#late").evaluate((el) => (el.contentEditable = "true"));
  const late = page.locator("#late");
  await page
    .locator('[data-grammarlio-root] .mark[data-word="knowldge"]')
    .waitFor({ timeout: 5000 });
  await correct(
    page,
    late,
    "Editor becomes editable after focus without a new focus event",
  );
  await correct(
    page,
    page.locator("#shadow textarea"),
    "Open Shadow DOM text field",
  );
  await page.evaluate(() => document.getElementById("dialog").showModal());
  await correct(
    page,
    page.locator("#modal-note"),
    "Note inside a native modal dialog",
  );
  assert.deepEqual(evidence.externalRequests, []);
  assert.deepEqual(evidence.errors, []);
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: `artifacts/editors-${channel}.png` });
  evidence.passed = true;
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await mkdir("artifacts", { recursive: true });
  if (!evidence.passed)
    await page
      ?.screenshot({ path: `artifacts/editors-failure-${channel}.png` })
      .catch(() => {});
  await writeFile(
    `artifacts/editor-evidence-${channel}.json`,
    JSON.stringify(evidence, null, 2),
  );
  await context.close();
  server.close();
}
