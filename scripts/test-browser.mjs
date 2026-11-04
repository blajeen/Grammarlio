import { chromium } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
export async function launchExtension(args = process.argv) {
  const channel =
    args.find((a) => a.startsWith("--browser="))?.split("=")[1] || "chromium";
  const extension = path.resolve(
    args.find((a) => a.startsWith("--extension-dir="))?.slice(16) || "dist",
  );
  const profile =
    args.find((a) => a.startsWith("--profile="))?.slice(10) ||
    (await mkdtemp(path.join(tmpdir(), "grammarlio-test-")));
  const existingProfile = existsSync(profile);
  const context = await chromium.launchPersistentContext(profile, {
    channel,
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  let [worker] = context.serviceWorkers();
  worker ||= await context.waitForEvent("serviceworker");
  if (existingProfile && args.some((a) => a.startsWith("--profile="))) {
    const restarted = context.waitForEvent("serviceworker", { timeout: 30000 });
    await worker
      .evaluate(() => {
        setTimeout(() => chrome.runtime.reload(), 30);
      })
      .catch(() => {});
    worker = await restarted;
  }
  const id = new URL(worker.url()).host;
  async function initialOffer(required = true) {
    let welcome;
    for (let n = 0; n < 60; n++) {
      welcome = context
        .pages()
        .find((p) => p.url() === `chrome-extension://${id}/welcome.html`);
      if (welcome) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!welcome && required)
      throw new Error(
        "A janela de ativação não abriu automaticamente na instalação.",
      );
    return welcome;
  }
  async function decline() {
    const welcome = await initialOffer();
    await welcome.locator("#no").click();
    await welcome.locator("#finish").waitFor();
    await welcome.close();
  }
  return { context, worker, id, channel, decline, initialOffer };
}
