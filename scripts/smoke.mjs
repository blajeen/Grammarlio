import assert from "node:assert/strict";
import { launchExtension } from "./test-browser.mjs";
import { mkdir } from "node:fs/promises";
const { context, worker, id, channel, decline, initialOffer } =
  await launchExtension();
try {
  const external = [];
  context.on("request", (request) => {
    if (/^https?:/.test(request.url())) external.push(request.url());
  });
  await mkdir("artifacts", { recursive: true });
  const welcome = await initialOffer();
  await welcome.setViewportSize({ width: 450, height: 580 });
  await welcome.screenshot({ path: `artifacts/welcome-${channel}.png` });
  await decline();
  const prefs = await worker.evaluate(() =>
    chrome.storage.local.get("aiConsent"),
  );
  assert.equal(prefs.aiConsent, false);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.setViewportSize({ width: 290, height: 250 });
  assert.equal(await page.locator("input").count(), 1);
  assert.equal(await page.locator("select,textarea").count(), 0);
  assert.equal(await page.locator("#enabled").isChecked(), true);
  await page.locator("#enabled").uncheck();
  assert.equal(
    (await worker.evaluate(() => chrome.storage.local.get("inlineEnabled")))
      .inlineEnabled,
    false,
  );
  await page.locator("#enabled").check();
  await page.screenshot({ path: `artifacts/popup-${channel}.png` });
  for (const size of [16, 32, 48, 128]) {
    const dimensions = await page.evaluate(async (size) => {
      const image = new Image();
      image.src = chrome.runtime.getURL(`icons/icon-${size}.png`);
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, size);
    assert.deepEqual(dimensions, [size, size]);
  }
  assert.deepEqual(external, []);
  console.log(
    JSON.stringify({
      automaticInstallOffer: true,
      declineRespected: true,
      minimalPopup: true,
      toggleWorks: true,
      iconsVerified: true,
      externalRequests: 0,
    }),
  );
} finally {
  await context.close();
}
