# Grammarlio

A free, open source writing assistant for **Chrome and Edge**, supporting **American English and Brazilian Portuguese**. No account, subscription, remote inference or paid feature gates.

**Experimental v0.3.0:** write directly in website text fields. Recognized issues are underlined; click an underline to see alternatives and apply a correction, with no panel import or account. Full selected Hunspell dictionaries include Brazilian Portuguese VERO (312,368 base entries) and American English SCOWL (49,568), plus inflections. Grammar rules remain limited. This is not feature or quality parity with Grammarly.

Inline review supports text/search inputs, textareas and compatible contenteditable editors, including HTTP/HTTPS frames. Use the small ✦/count button for the language selector and issue list; **Ctrl+Alt+G** opens it and **Esc** closes it. Ignore a word, add it to your local personal dictionary, or pause this site. The side panel provides a global switch and a button to resume paused sites. Only the focused field in a visible page is reviewed. Passwords, recognized access codes and protected/read-only fields are excluded. A site can opt out with `data-grammarlio="off"`.

The new feature requires content-script access to HTTP/HTTPS websites and an `offscreen` permission to run a shared local dictionary worker without opening the panel. Updating may require accepting site access in the browser. Text stays in the browser; no remote checking service is used. Reload existing website tabs after updating.

Inline review accepts fields up to 12,000 characters and displays at most 80 findings per analysis; larger fields are declined without silently truncating. Google Docs/canvas, complex framework-owned editors, closed Shadow DOM, complex CSS transforms and native dialogs covering overlays are not guaranteed. Contextual AI rewriting remains in the side panel; inline checks use dictionaries/rules and need no GPU or model download.

Unknown words offer spelling alternatives and an optional local personal dictionary, which you can clear. AI uses Qwen3 1.7B/WebLLM (~1 GB download) in-browser and requires a compatible WebGPU device. There is never a cloud inference fallback. A CPU alternative was evaluated and withheld because it failed editing-quality tests. See [actual validation results](VALIDATION.md).

## Install

1. Download `grammarlio-0.3.0.zip` from [Releases](https://github.com/blajeen/Grammarlio/releases) and extract it.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode, choose Load unpacked and select the extracted folder containing `manifest.json`.
4. Pin the extension and click its icon to open the side panel.

The extension is not yet listed in browser stores. Alternatively, clone the repository, install Node.js 22+, run `npm ci` and `npm run check`, then load `dist` as an unpacked extension.

## Use

Focus a website text field and start typing. Click the underlines or ✦ button, select **English · US** if needed and accept suggestions directly in the field. For optional panel review, paste text or use Importar da página. Internal browser pages and store pages prohibit extension injection. Compatible rich editors support inline edits; canvas/Google Docs and complex editors do not have dedicated integrations.

For AI, click the download/load button, wait for the model, then choose grammar correction, clarity, concision or professional tone. Context is optional. Review the generated text, use it in the editor, then copy or explicitly apply it to the original field. Page updates are refused if the field changed after import.

The current interface is primarily Portuguese, with bilingual language and mode labels. Full interface translation is planned.

## Local AI requirements

- Recent Chromium browser with WebGPU, supported GPU/driver and graphics acceleration enabled.
- Qwen3-1.7B q4f32_1 via WebLLM. Its catalog estimates about **2.6 GB VRAM**; allow approximately 3 GB available graphics memory, with additional system memory overhead.
- Initial model data download is on the order of **1 GB**. Downloads go directly to Hugging Face/file delivery hosts, not a Grammarlio server.
- Cached model data can be reused offline, provided the download is complete and browser storage has not been evicted. Verify offline behavior on your device.
- AI reloads into memory when reopening the panel. Devices without WebGPU still get full dictionaries and basic grammar rules; no silent cloud fallback exists.
- 3,000-character text and 600-character context limits are technical constraints, not paid tiers. There are no user quotas. Truncated AI output is rejected.

No text/context history is stored. Language, explicitly added personal words, pause preferences (including hostnames you explicitly pause) and model caches persist locally. Clear words/model cache and resume paused sites from the panel. See [Privacy](../PRIVACY.md), [Testing](TESTING.md), [Contributing](../CONTRIBUTING.md), [MIT license](../LICENSE) and [Third-party notices](../THIRD_PARTY_NOTICES.md). No affiliation with Grammarly, Google or Microsoft.
