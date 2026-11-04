# Validation record — v0.1.0

Date: 2026-11-04. Environment: Windows, Node.js 24.18.0, Playwright Chromium 141.0.7390.37, isolated browser profile.

- Seven automated Node tests passed for English/Portuguese rules, clean examples, Unicode offsets, stale edits, overlapping suggestions and prompts.
- Extension build passed. Packaged model runtime SHA-256 matched model-lock.json.
- Browser smoke passed: extension service worker and panel loaded, suggestions could be accepted/undone, language switching worked, HTML-looking text was not rendered as executable HTML, password import was blocked, selected textarea replacement preserved surrounding text, stale page edits were rejected.
- No HTTP(S) requests were observed during the basic panel smoke before explicit AI activation.
- AI initialization was attempted. WebGPU exposed an adapter but `requestDevice` failed with `DynamicLib.Open: dxil.dll Windows Error: 87` in this environment. Software-adapter testing did not expose a usable adapter. The UI displayed the load error and basic review remained available.

**Not validated here:** completed model download, real AI generations, quality of rephrasing, complete cached offline AI operation, Chrome/Edge stable native side-panel interaction, or store acceptance. These remain manual acceptance items, not claims of a fully tested AI product. The extension is offered as an experimental development release.

Run `node scripts/smoke.mjs --ai` on a compatible GPU device to add a real download/generation acceptance test. This optional test downloads a large model; the default smoke test does not. See TESTING.md for the wider checklist.
