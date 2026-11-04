# Third-party components

The Grammarlio application code is MIT licensed. Third-party components retain their own licenses.

- WebLLM 0.2.87: Apache-2.0. https://github.com/mlc-ai/web-llm
- MLC compiled model runtime: Apache-2.0. https://github.com/mlc-ai/binary-mlc-llm-libs
- Qwen3-1.7B weights: Apache-2.0. https://huggingface.co/Qwen/Qwen3-1.7B
- MLC quantization of Qwen3-1.7B: https://huggingface.co/mlc-ai/Qwen3-1.7B-q4f32_1-MLC
- esbuild (build-time): MIT. https://github.com/evanw/esbuild
- Playwright (test-time): Apache-2.0. https://github.com/microsoft/playwright
- Hunspell WASM 0.3.0: Hunspell LGPL/GPL/MPL tri-license, distributed with the original COPYING, COPYING.LESSER and COPYING.MPL texts. https://github.com/rotemdan/hunspell-wasm ; upstream Hunspell source: https://github.com/hunspell/hunspell
- dictionary-pt 4.0.0: Brazilian Portuguese VERO/LibreOffice dictionary, 312,368 base entries plus affixes. LGPL-3.0 OR MPL-2.0. Original dictionary files and credits are included unchanged in dictionaries/pt.aff, pt.dic and pt-LICENSE. Source package: https://www.npmjs.com/package/dictionary-pt/v/4.0.0 ; repository: https://github.com/wooorm/dictionaries/tree/main/dictionaries/pt
- dictionary-en 4.0.0: American English SCOWL-derived Hunspell dictionary, 49,568 base entries plus affixes. MIT AND BSD and the original notices included in dictionaries/en-LICENSE. Source package: https://www.npmjs.com/package/dictionary-en/v/4.0.0 ; repository: https://github.com/wooorm/dictionaries/tree/main/dictionaries/en

The model is downloaded separately after the user clicks the activation button. The application does not train a new model and does not bundle LanguageTool or Grammarly code, rules or data. Dependency license banners and the license files described above are included in the build. Dictionary affix/word-list files are unmodified and remain separately replaceable, under their original licenses; the Grammarlio MIT license does not replace those terms. Consult package-lock.json for package integrity/version pins and model-lock.json for the model/runtime revisions and runtime SHA-256. The Portuguese dictionary is distributed under its MPL-2.0 option with a copy in third_party/MPL-2.0.txt.
