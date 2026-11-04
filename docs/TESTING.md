# Testing v0.4

Node.js 22+: `npm ci`, `npm run check`, `npx playwright install chromium`. Tests use synthetic local HTTP fixtures and isolated profiles, never the user's normal browser session.

## Default checks — no model download

```sh
npm run test:browser
npm run test:inline
node scripts/smoke.mjs --browser=msedge
node scripts/inline-test.mjs --browser=msedge
```

Smoke proves that the first-install AI window opens automatically, Not now prevents activation/downloads, the popup has one switch without text/language settings, and icons load at their required sizes. Inline acceptance tests the actual packaged content-script/background/offscreen/Hunspell combination: hover without clicking, automatic PT/EN/ES on an English website, mixed-language fields, native undo/events, rich-text preservation, Unicode, stale text, protected fields, IME, personal words/dismissal, frames, global switch and restrictive website CSP. Unexpected external requests or page errors fail the test. Evidence/screenshots go under ignored `artifacts/`.

Node tests cover rules/prompts, actual dictionary inflections/suggestions, sentence language detection/offsets, rewrite scope/selection and oversized input. They do not establish general language quality.

## Actual GPU AI — optional large download

```sh
node scripts/hover-ai-test.mjs --browser=msedge --profile=artifacts/edge-ai
node scripts/hover-ai-test.mjs --browser=chromium --profile=artifacts/chromium-ai
```

Requires compatible WebGPU, about 3 GB available graphics memory, disk and approximately 1 GB download per fresh profile. Never run two tests against one profile. Existing explicit test profiles reload the extension to avoid stale worker code after development builds. For first-install acceptance choose a directory that does not exist yet.

The test chooses Yes in the activation window, waits for preparation, then hovers and accepts real generated rewrites in English, Portuguese and Spanish directly in website fields. Neighboring text is preserved and generation itself must not edit anything. It also checks an AI-only style suggestion and turns review off, disables network, turns it on and generates again from cache. No mocked model/server. Outputs/screenshots: `artifacts/hover-ai-*`.

Pass `--extension-dir=dist-v0.4.0` to browser scripts to validate a release directory. Build a fresh package with `node scripts/build.mjs --out=dist-v0.4.0`.

## Manual review before store publication

- Install on current Chrome/Edge: confirm native activation window, progress, refusal/retry and basic review without GPU. Check already-open tabs.
- Hover and enter the card, accept, check keyboard focus, announcements, Esc/Ctrl+Alt+G and 200% zoom.
- Try clean/incorrect text in all languages, ambiguous short text, names/numbers and meaning changes. A few sentences are not a benchmark.
- Edit/switch fields during generation: stale text must not be applied. Turn off during download/generation and resume.
- Inspect network: model files may download after consent; writing/context must never appear. Check offline complete cache, eviction and interrupted downloads.
- Validate real editors individually before claiming support. Internal browser/store pages and canvas editors are not supported integrations.

Store listing, disclosures, assets and approval are separate from an unpacked build.
