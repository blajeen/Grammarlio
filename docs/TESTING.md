# Validation and manual acceptance

Automated checks: `npm run check`; browser smoke: `npx playwright install chromium` then `node scripts/smoke.mjs`.

The smoke script uses an isolated temporary Chromium profile, not the user's normal profile. It loads the actual extension, opens its panel, exercises basic editing and uses synthetic page fields to verify text replacement and stale-field protection. No large model is downloaded by this test.

## Manual release checklist

- Load `dist` in current stable Chrome and Edge. Click the extension icon on an ordinary HTTPS page; verify the side panel opens.
- Focus a textarea, select part of it, import, edit and apply. Ensure surrounding text remains intact. Change the original field after import; application must refuse to overwrite it.
- Import a contenteditable field or page selection. Verify only copy is offered; rich formatting must not be rewritten.
- Check password/payment/one-time-code inputs are not imported, and browser internal pages fail with a useful message.
- Verify keyboard navigation, visible focus, status announcements and readability at 200% zoom.
- Check Portuguese and English examples and manually enter clean text to inspect false positives.
- In an environment with WebGPU and enough memory, activate the model and inspect download progress, errors and success. Watch network traffic: no writing or optional context should appear in remote requests.
- Generate each mode in both languages. Check facts, names, numbers, unwanted instructions and unexpected language changes. This is a quality assessment, not proof of correctness.
- Edit the text/change language while generating. The old result must not be accepted. Stop generation; partial output must not be offered as a complete rewrite.
- After a complete download, disconnect internet, reopen the panel, reload AI and generate again. Verify the browser kept all model data. Do not claim universal offline support from a single device.
- Unload AI, erase model cache, then test reactivation and a failed/interrupted download. Test a device/browser without a WebGPU adapter.

Store publication additionally requires store-specific review, listing assets, privacy disclosures and signing/submission. A successful unpacked build is not store approval.
