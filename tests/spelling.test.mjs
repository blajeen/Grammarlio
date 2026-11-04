import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createDictionary,
  unknownWords,
  spellingOptions,
} from "../src/spelling.js";

for (const [language, words, wrong, correction] of [
  [
    "en",
    "The beautiful children received helpful messages yesterday.",
    "beutiful",
    "beautiful",
  ],
  [
    "pt",
    "As crianças brasileiras escreveram mensagens úteis para os professores.",
    "portugês",
    "português",
  ],
  [
    "es",
    "Las personas escribieron mensajes útiles para los profesores.",
    "espanol",
    "español",
  ],
]) {
  test(`Full ${language} dictionary accepts inflected words and suggests real corrections`, async () => {
    const [aff, dic] = await Promise.all(
      ["aff", "dic"].map((ext) =>
        readFile(`node_modules/dictionary-${language}/index.${ext}`, "utf8"),
      ),
    );
    const dictionary = await createDictionary(aff, dic);
    assert.ok(dictionary.entries > 40000);
    assert.deepEqual(unknownWords(words, dictionary), []);
    assert.equal(unknownWords(wrong, dictionary)[0].original, wrong);
    assert.ok(spellingOptions(wrong, dictionary).includes(correction));
    assert.deepEqual(
      unknownWords(
        "Grammarlio https://example.invalid/aweirdword test123",
        dictionary,
        ["Grammarlio"],
      ),
      [],
    );
    const text = `🙂 ${wrong}`;
    const [finding] = unknownWords(text, dictionary);
    assert.equal(text.slice(finding.start, finding.end), wrong);
    dictionary.spell.dispose();
  });
}
test("expanded English vocabulary preserves common typo corrections", async () => {
  const [aff, dic, extraAff, extraDic] = await Promise.all(
    [
      "node_modules/dictionary-en/index.aff",
      "node_modules/dictionary-en/index.dic",
      "third_party/en-us-large/en_US-large.aff",
      "third_party/en-us-large/en_US-large.dic",
    ].map((file) => readFile(file, "utf8")),
  );
  const dictionary = await createDictionary(aff, dic, {
    aff: extraAff,
    dic: extraDic,
  });
  try {
    assert.equal(dictionary.entries, 80701);
    assert.deepEqual(
      unknownWords(
        "Knowledge of cybersecurity, astrophotography, neurodiversity and observability.",
        dictionary,
      ),
      [],
    );
    for (const [wrong, correct] of [
      ["knowldge", "knowledge"],
      ["recieve", "receive"],
      ["beutiful", "beautiful"],
    ]) {
      assert.equal(unknownWords(wrong, dictionary)[0].original, wrong);
      assert.equal(spellingOptions(wrong, dictionary)[0], correct);
    }
  } finally {
    dictionary.spell.dispose();
  }
});
