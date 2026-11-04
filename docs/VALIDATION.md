# Validation record — v0.2.0

Date: 2026-11-04. Environment: Windows, Node.js 24.18.0, isolated browser profiles. GPU generation was tested in installed Edge 156, using the actual extension panel and packaged worker/runtime, not an external inference server.

- Ten automated Node tests passed for English/Portuguese rules, actual dictionary inflections and corrections, clean examples, Unicode offsets, stale edits, overlapping suggestions and prompts.
- Extension build passed. Packaged model runtime SHA-256 matched model-lock.json.
- Browser smoke passed: extension service worker and panel loaded; complete dictionaries loaded; suggested spelling alternatives could be accepted; personal words could be stored and cleared; language switching and undo worked. HTML-looking text was not rendered as executable HTML, password import was blocked, selected textarea replacement preserved surrounding text, and stale page edits were rejected.
- No HTTP(S) requests were observed during the basic panel smoke before explicit AI activation.
- The original `dxil.dll Windows Error: 87` was reproduced in the old Chromium 141 automation browser. Installed Chrome and Edge both successfully created real WebGPU devices. Updated Playwright 1.64.1 also provided a working Chromium 156 device. We do not modify system drivers or users' browser flags. The extension now checks device creation before starting the GPU model.

## Real GPU inference

The Qwen3 1.7B download completed (~930 MB of model parameters). The actual extension produced these results:

| Input | Result |
| --- | --- |
| She are happy to recieve the message. | She is happy to receive the message. |
| As pessoas precisa de ajuda. | As pessoas estão necessitadas de ajuda. |
| Send the report by Friday. (professional email context) | Please send the report by Friday. |
| Nós vai receber a mensagem. (offline after unloading and reloading model) | Nós vamos receber a mensagem. |

The GPU acceptance test passed all four cases, accepted the proposed text into the extension editor and observed no page errors. Generation took about 4–6 seconds per short example in the Edge run, excluding model load. Chrome for Testing/Chromium 156 also passed all four cases, including offline reload; its cold/after-reload generations took about 37–39 seconds and subsequent examples about 3–4 seconds. These are measurements for this machine, not performance guarantees. The grammar mode prepares deterministic rule corrections before asking the model; proposals remain unapplied until accepted. Synthetic inputs and actual outputs are preserved in the JSON evidence files next to this document.

The offline case explicitly disabled network access, unloaded the model, loaded it again from browser cache and generated a new answer. This proves that tested cache/profile worked offline, not that browser storage can never be evicted.

**Limits of validation:** a handful of controlled sentences cannot establish overall writing quality. The Portuguese example is grammatical but changes phrasing more than a minimal correction should; the UI therefore presents proposals for review. Complex editor integrations, native toolbar interactions on every browser version, accessibility across assistive technologies and store acceptance still need broader testing. The extension remains experimental.

Run `node scripts/ai-acceptance.mjs --browser=msedge` to reproduce acceptance, or select `--browser=chromium` with its own `--profile=`. These optional commands download a large model; the default smoke test does not. See TESTING.md for the wider checklist.

A CPU/ONNX alternative was evaluated. It loaded and generated real text but failed the Portuguese and contextual editing-quality checks, sometimes replying with explanations or refusals. It is not shipped in this version. GPU support remains a requirement for AI; full dictionaries do not need a GPU.
