# Grammarlio

A free, open source writing assistant for **Chrome and Edge**, supporting **American English and Brazilian Portuguese**. No account, subscription, remote inference or paid feature gates.

**Experimental v0.1.0:** basic rules cover only a small set of common mistakes. AI rewrites use a small local model and can be wrong. This is not feature or quality parity with Grammarly.

## Install

1. Download `grammarlio-0.1.0.zip` from [Releases](https://github.com/blajeen/Grammarlio/releases) and extract it.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode, choose Load unpacked and select the extracted folder containing `manifest.json`.
4. Pin the extension and click its icon to open the side panel.

The extension is not yet listed in browser stores. Alternatively, clone the repository, install Node.js 22+, run `npm ci` and `npm run check`, then load `dist` as an unpacked extension.

## Use

Select **English · US**, paste your writing or try the example. Accept basic rule suggestions individually. To import a field or selected text, focus it on the page and click Importar da página. If permission is missing, click the extension icon on that page first. Standard text inputs and textareas support applying the reviewed result; rich editors support import and copy only. Internal browser pages, iframes, Shadow DOM and Google Docs integrations are not supported in this initial release.

For AI, click the download/load button, wait for the model, then choose grammar correction, clarity, concision or professional tone. Context is optional. Review the generated text, use it in the editor, then copy or explicitly apply it to the original field. Page updates are refused if the field changed after import.

The current interface is primarily Portuguese, with bilingual language and mode labels. Full interface translation is planned.

## Local AI requirements

- Recent Chromium browser with WebGPU, supported GPU/driver and graphics acceleration enabled.
- Qwen3-1.7B q4f32_1 via WebLLM. Its catalog estimates about **2.6 GB VRAM**; allow approximately 3 GB available graphics memory, with additional system memory overhead.
- Initial model data download is on the order of **1 GB**. Downloads go directly to Hugging Face/file delivery hosts, not a Grammarlio server.
- Cached model data can be reused offline, provided the download is complete and browser storage has not been evicted. Verify offline behavior on your device.
- AI reloads into memory when reopening the panel. Devices without WebGPU still get basic rules; no silent cloud fallback exists.
- 3,000-character text and 600-character context limits are technical constraints, not paid tiers. There are no user quotas. Truncated AI output is rejected.

No text/context history is stored. Only the selected language and cached model files persist. See [Privacy](../PRIVACY.md), [Testing](TESTING.md), [Contributing](../CONTRIBUTING.md), [MIT license](../LICENSE) and [Third-party notices](../THIRD_PARTY_NOTICES.md). No affiliation with Grammarly, Google or Microsoft.
