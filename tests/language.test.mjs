import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDictionary, spellingOptions } from "../src/spelling.js";
import { detectLanguage, sentenceSegments } from "../src/language.js";
const dictionaries = {};
for (const [language, code] of [
  ["pt-BR", "pt"],
  ["en-US", "en"],
  ["es-ES", "es"],
]) {
  const [aff, dic] = await Promise.all(
    ["aff", "dic"].map((ext) =>
      readFile(`node_modules/dictionary-${code}/index.${ext}`, "utf8"),
    ),
  );
  let supplement;
  if (language === "en-US") {
    const [extraAff, extraDic] = await Promise.all(
      ["aff", "dic"].map((ext) =>
        readFile(`third_party/en-us-large/en_US-large.${ext}`, "utf8"),
      ),
    );
    supplement = { aff: extraAff, dic: extraDic };
  }
  dictionaries[language] = await createDictionary(aff, dic, supplement);
}
test("language follows the text, not the website language", () => {
  for (const [text, language, hint] of [
    ["estou indo para o akampamento", "pt-BR", "en-US"],
    ["She are happy to recieve the message.", "en-US", "pt-BR"],
    ["Las personas necesita ayuda.", "es-ES", "pt-BR"],
    ["Yo es feliz.", "es-ES", "en-US"],
    ["Eu estudo portugês.", "pt-BR", "es-ES"],
    ["A beutiful garden.", "en-US", "es-ES"],
    ["Estoy estudiando español en la escuela.", "es-ES", "en-US"],
    ["knowldge", "en-US", "pt-BR"],
    ["knowldge", "en-US", "es-ES"],
  ])
    assert.equal(detectLanguage(text, dictionaries, hint), language, text);
});
test("mixed-language paragraphs retain UTF-16 offsets", () => {
  const text =
    "🙂 Eu estudo português.\nThe garden is beautiful.\nEstoy estudiando español.";
  const parts = sentenceSegments(text);
  assert.deepEqual(
    parts.map((p) => detectLanguage(text.slice(p.start, p.end), dictionaries)),
    ["pt-BR", "en-US", "es-ES"],
  );
  assert.equal(
    parts
      .map((p) => text.slice(p.start, p.end))
      .join("")
      .trim(),
    text.trim(),
  );
});
test.after(() => Object.values(dictionaries).forEach((d) => d.spell.dispose()));
test("a borrowed word still offers a correction when the surrounding language has none", () => {
  assert.equal(
    spellingOptions(
      "knowldge",
      dictionaries["pt-BR"],
      Object.values(dictionaries),
    )[0],
    "knowledge",
  );
});
