import { test } from "node:test";
import assert from "node:assert/strict";
import { isContentSender } from "../src/sender.js";
test("embedded editors trust the Chromium sender origin, never a message hint", () => {
  const base = {
    id: "extension-id",
    tab: { id: 2 },
    frameId: 3,
    origin: "https://crm.example",
  };
  for (const url of [
    "about:blank",
    "about:srcdoc",
    "blob:https://crm.example/test",
  ])
    assert.equal(isContentSender({ ...base, url }, base.id), true, url);
  assert.equal(
    isContentSender({ ...base, url: "https://crm.example/notes" }, base.id),
    true,
  );
  for (const changes of [
    { origin: "null" },
    { origin: "chrome-extension://other" },
    { frameId: 0 },
    { id: "other" },
    { tab: undefined },
    { url: "chrome://settings" },
  ])
    assert.equal(
      isContentSender({ ...base, url: "about:blank", ...changes }, base.id),
      false,
      JSON.stringify(changes),
    );
});
