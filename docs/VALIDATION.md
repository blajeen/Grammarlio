# Validation record — v0.3.0

## Inline review

The actual extension content script, background service worker, offscreen document and packaged Hunspell worker were tested together on synthetic HTTP pages in Chromium/Chrome for Testing and installed Edge. No panel import was used for these corrections. The test exercises seventeen scenarios:

1. Portuguese spelling/grammar accepted directly in a textarea.
2. English dictionary corrections in an input, with native undo.
3. Emoji/Unicode offsets preserving surrounding text.
4. Contenteditable corrections preserving bold text and surrounding paragraphs.
5. Input events updating a site-controlled value.
6. A later page edit refusing an old suggestion.
7. Passwords, access codes, readonly fields and per-field opt-out excluded.
8. IME composition waiting until compositionend.
9. Ignoring findings and adding a word to the personal dictionary in the inline popup.
10. Inline language selection changing dictionaries.
11. Scrolled textareas keeping marks clipped inside the field.
12. HTTP iframe editing in the frame's own content script.
13. Site pause and panel-based resume.
14. Global pause and resume.
15. Ctrl+Alt+G and Escape keyboard actions.
16. Oversized fields being declined without silent truncation.
17. Inline styling and correction on a website with restrictive script/style/image/connect CSP directives. Underlines use pure CSS rather than data-URL images, avoiding the img-src violation found during testing.

The tests record zero external HTTP(S) requests and no page errors during inline review. This is evidence for the tested pages and scenarios, not a claim of compatibility with every third-party editor. The inline feature uses bundled dictionaries/rules, not the GPU model. It is independent of the AI rewriting feature below. See INLINE.md for architecture, permissions, limits and opt-out controls.

## Existing grammar, dictionaries and AI validation

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
