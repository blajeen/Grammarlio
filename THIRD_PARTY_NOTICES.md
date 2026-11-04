# Third-party components

The Grammarlio application code is MIT licensed. Third-party components retain their own licenses.

- WebLLM 0.2.87: Apache-2.0. https://github.com/mlc-ai/web-llm
- MLC compiled model runtime: Apache-2.0. https://github.com/mlc-ai/binary-mlc-llm-libs
- Qwen3-1.7B weights: Apache-2.0. https://huggingface.co/Qwen/Qwen3-1.7B
- MLC quantization of Qwen3-1.7B: https://huggingface.co/mlc-ai/Qwen3-1.7B-q4f32_1-MLC
- esbuild (build-time): MIT. https://github.com/evanw/esbuild
- Playwright (test-time): Apache-2.0. https://github.com/microsoft/playwright

The model is downloaded separately after the user clicks the activation button. The application does not train a new model and does not bundle LanguageTool or Grammarly code, rules or data. Dependency license banners are preserved in the build; WebLLM's full license is also included in the distribution. Consult package-lock.json for exact dependency versions and model-lock.json for pinned upstream revisions and the compiled runtime SHA-256.
