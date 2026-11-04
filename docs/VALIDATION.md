# Validation record — v0.4.1 / v0.4.0

## v0.4.1 compatibility update

20 Node tests passed, including expanded English vocabulary, exact `knowldge → knowledge` ranking, borrowed-word fallback and browser-validated embedded-frame senders. Inline acceptance passed 15 cases in both Edge and Chromium. Seven additional editor regressions passed in both browsers: rich text, srcdoc, about:blank/designMode, document.open/write recovery, late editable activation, open Shadow DOM and native modals. They use actual hover/click corrections, with no external requests or page errors. See [compatibility evidence and Pipedrive limitation](COMPATIBILITY.md). The actual user's Pipedrive editor has not been directly inspected. The GPU inference evidence below belongs to v0.4.0; this patch does not change the model/prompt.

## v0.4.0 inference and initial validation

Date: 2026-11-04. Windows, Node.js 24.18.0, isolated profiles, installed Edge 156 and Playwright Chromium/Chrome for Testing 156. Tests used the actual extension, service worker, offscreen document, Hunspell and WebLLM workers. No inference server or mocked AI was used.

## Automated results

- **17 Node tests passed:** rules/prompts, actual full PT/EN/ES dictionaries and inflections, language detection driven by text rather than site language, mixed-sentence UTF-16 offsets, rewrite sentence/selection scope, oversized/stale edit protection.
- Build passed; model runtime SHA-256 matches `model-lock.json`. The fresh release directory contains popup/welcome and local workers, with no old side panel files.
- Smoke passed in **Edge and Chromium**: first-install offer opens automatically, Not now is respected, the popup has one switch and no text/language controls, switch settings persist, all four PNG icon sizes decode, and no external HTTP(S) requests occur before AI activation.
- **15 inline scenarios passed in each browser**, with zero external requests and zero page errors. Cases: initial offer/decline; Portuguese on an English website and whole-word hover without clicking; English/native undo; Spanish; a mixed PT/EN/ES field; rich-text preservation; native input events; Unicode; refusing stale proposals; sensitive/read-only/opt-out exclusions; IME; dismissal; HTTP frame; global switch; restrictive website CSP.

Machine-readable current inline results: [Chromium](inline-evidence-chromium.json), [Edge](inline-evidence-edge.json). These controlled fixtures do not establish compatibility with every editor or third-party website.

## Real local AI in website fields

A **new profile in each browser** accepted Yes in the automatically offered activation window and downloaded/prepared Qwen3-1.7B q4f32_1. During this work, a fresh-profile download exposed Cache API network-streaming failures while saving `tokenizer.json`. Materializing each fetched response before caching resolved the failure. Both browsers subsequently completed real fresh downloads and generated all examples below.

| Language / case | Input | Actual result in both browsers |
| --- | --- | --- |
| English | She are happy to recieve the message. | She is happy to receive the message. |
| Portuguese | Nós vai receber a mensagem. | Nós vamos receber a mensagem. |
| Spanish | Las personas nesecitan ayuda. | Las personas necesitan ayuda. |
| AI-only style | Due to the fact that it was raining, we stayed inside. | Due to the rain, we stayed inside. |
| Portuguese after offline reload | Nós vai receber a mensagem. | Nós vamos receber a mensagem. |

Hover displayed the genuine generated proposal in a card attached to the site field. Tests confirmed generation alone did not edit the field, accepting applied the proposed text, and English prefix/suffix sentences remained intact. The style case created an optional AI underline without a dictionary/rule error.

The offline case turned the global switch off (terminating AI memory), disabled browser network, turned it on, automatically reloaded cached weights and generated again. It proves offline use for these complete caches, not permanent cache retention. Both runs recorded no fixture page errors.

Actual inputs/outputs: [Edge AI evidence](hover-ai-evidence-edge.json), [Chromium AI evidence](hover-ai-evidence-chromium.json). Screenshots: [AI hover](inline-ai-preview.png), [initial offer](welcome-preview.png), [minimal popup](popup-preview.png). The older `ai-evidence-edge.json` / `ai-evidence-chromium.json` are historical v0.2 panel results, not the current UI.

## Practical limits

A handful of controlled sentences cannot establish general writing quality or perfect language detection. This remains experimental. AI can alter meaning; ambiguous short/mixed text and names can be misclassified. The model requires WebGPU and roughly 3 GB available graphics memory, with about 1 GB first download. Basic dictionaries/rules do not require GPU/download. GPU performance and download time depend on the device/network.

Integration with canvas/Google Docs, closed Shadow DOM and complex framework-owned editors is not guaranteed. Automated headless acceptance does not replace accessibility testing, native-toolbar review on every browser version or store approval. A CPU alternative evaluated in an earlier version failed editing-quality checks and is not shipped.

Reproduce using [TESTING.md](TESTING.md). AI tests need GPU, a large download and an isolated profile; default smoke/inline tests do not download a model.
