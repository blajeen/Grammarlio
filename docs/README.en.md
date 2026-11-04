# Grammarlio

Free, open source writing assistance for Chrome and Edge. **Brazilian Portuguese, American English and Spanish, detected from the text. No account or subscription. Processing stays in your browser.**

Experimental v0.4.1: write in a website field, pause, then hover an underlined word to see corrections and local AI rewriting. Accept to apply; generating a proposal never edits your writing automatically. Style alternatives can also appear in correctly spelled sentences. No import or editing panel. The popup offers one on/off switch and AI status/activation.

Version 0.4.1 fixes related-origin about:blank/srcdoc frames, designMode, editor document recreation, late editable activation, open Shadow DOM fields and native modal dialogs. `knowldge → knowledge` is tested through real hover/acceptance in these controlled fixtures. The user’s actual Pipedrive account editor has not been directly inspected. See [compatibility evidence](COMPATIBILITY.md).

## Install

1. Download `grammarlio-0.4.1.zip` from [Releases](https://github.com/blajeen/Grammarlio/releases) and extract it.
2. Open `chrome://extensions` or `edge://extensions`, enable Developer mode and choose Load unpacked.
3. Select the folder containing `manifest.json`. The first-install window immediately offers AI activation: Yes downloads/prepares the model; Not now leaves basic corrections active without downloading it.
4. Write in a supported website field and hover the underlines. The icon opens the global switch and lets you revisit activation.

Not yet published in stores. Updates require replacing files, reloading the extension, accepting changed permissions if requested and reloading website tabs. Current UI: Portuguese.

## Local dictionaries and AI

Full selected Hunspell files are bundled: Portuguese VERO (312,368 base entries), English SCOWL/ESDB combined (80,701 distinct base spellings) and Spanish LibreOffice (57,344), plus affixes. These are complete open datasets, not every existing word. The English expansion bundles official ESDB/SCOWL en_US-large 2026.02.25 alongside the previous dictionary, retaining common-word suggestion priority. Original licenses and build-verified hashes are included. Larger lists also accept uncommon words that may resemble typos. Grammar rules are limited. Automatic language detection works per sentence; short or ambiguous text can be misidentified.

Qwen3-1.7B q4f32_1/WebLLM runs locally. Activation downloads about **1 GB** of data from Hugging Face/file hosts and requires **WebGPU** with approximately **3 GB available graphics memory**. No writing/context is transmitted. JavaScript and WASM executable code are packaged. Cached data reloads automatically and can work offline if browser storage is retained. Consent also authorizes replacing missing model files. Turning off releases AI memory; turning on resumes automatic loading on next use. Without a compatible GPU, basic corrections remain available.

No per-text fee or paid tiers. Computation, disk, electricity and downloads use the user's resources. No inference server or training on user writing.

## Scope and privacy

Supports text/search inputs, textareas and compatible contenteditable fields, including HTTP/HTTPS frames. Only the focused field in a visible page is reviewed. Passwords, identified sensitive/access-code fields, readonly/disabled and opted-out fields are excluded. Sites can use `data-grammarlio="off"` or `data-gramm="false"` on a field/ancestor. Canvas/Google Docs, complex editors, closed Shadow DOM, complex transforms and native dialogs are not guaranteed. Ctrl+Alt+G opens suggestions; Esc closes them.

Technical limits: 12,000 characters per field, 80 findings, 3,000-character sentence/selection per AI rewrite and 600 characters of neighboring context from the same field. Larger input is declined without truncation. AI may change meaning or make mistakes; review facts, names and numbers. This is not Grammarly quality or feature parity.

No analytics, sync or saved writing history. Activation, AI consent and personal words persist locally; model data stays in cache. Text and results remain in memory. The original website retains its own policies. Remove data through browser storage controls or uninstall. See [Privacy](../PRIVACY.md).

## Development

Node.js 22+: `npm ci`, `npm run check`, `npx playwright install chromium`, `npm run test:browser`, `npm run test:inline`. Load `dist` unpacked. Optional real GPU test: `node scripts/hover-ai-test.mjs --browser=msedge --profile=artifacts/edge-ai`; use a separate profile for `--browser=chromium`.

[Validation](VALIDATION.md) · [Testing](TESTING.md) · [Architecture](INLINE.md) · [Contributing](../CONTRIBUTING.md) · [Third-party notices](../THIRD_PARTY_NOTICES.md). Application code: MIT. No affiliation with Grammarly, Google or Microsoft.
