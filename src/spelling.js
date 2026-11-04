import { createHunspellFromStrings } from "hunspell-wasm";

export async function createDictionary(aff, dic, supplement) {
  const primary = await createHunspellFromStrings(aff, dic);
  if (supplement) {
    let extra;
    try {
      extra = await createHunspellFromStrings(supplement.aff, supplement.dic);
    } catch (error) {
      primary.dispose();
      throw error;
    }
    const roots = new Set(
      [dic, supplement.dic].flatMap((list) =>
        list
          .split(/\r?\n/)
          .slice(1)
          .filter(Boolean)
          .map((line) => line.split("/")[0]),
      ),
    );
    return {
      entries: roots.size,
      spell: {
        testSpelling: (word) =>
          primary.testSpelling(word) || extra.testSpelling(word),
        // Keep common-word suggestions first; rare supplemental words are fallback.
        getSpellingSuggestions: (word) => [
          ...new Set([
            ...primary.getSpellingSuggestions(word),
            ...extra.getSpellingSuggestions(word),
          ]),
        ],
        dispose() {
          primary.dispose();
          extra.dispose();
        },
      },
    };
  }
  return {
    spell: primary,
    entries: Number.parseInt(dic.split(/\r?\n/, 1)[0], 10),
  };
}

export function unknownWords(text, dictionary, personal = []) {
  const known = new Set(
    personal.map((word) => word.normalize("NFC").toLocaleLowerCase()),
  );
  const excluded = [
    ...text.matchAll(/(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu),
  ].map((m) => [m.index, m.index + m[0].length]);
  const findings = [];
  const expression = /[\p{L}\p{M}\p{N}]+(?:['’\u002d][\p{L}\p{M}\p{N}]+)*/gu;
  for (const m of text.matchAll(expression)) {
    const word = m[0].normalize("NFC");
    if (
      /\p{N}/u.test(word) ||
      word.length < 2 ||
      excluded.some(([start, end]) => m.index >= start && m.index < end)
    )
      continue;
    if (
      known.has(word.toLocaleLowerCase()) ||
      dictionary.spell.testSpelling(word.replaceAll("’", "'"))
    )
      continue;
    findings.push({
      id: "dictionary",
      category: "spelling",
      start: m.index,
      end: m.index + m[0].length,
      original: m[0],
      message:
        "Palavra não encontrada no dicionário. Pode ser um nome ou termo técnico.",
    });
  }
  return findings;
}

export function spellingOptions(word, dictionary, alternatives = []) {
  if (word.length > 40) return [];
  const options = dictionary.spell
    .getSpellingSuggestions(word.normalize("NFC").replaceAll("’", "'"))
    .slice(0, 5);
  // A short borrowed word may be assigned the surrounding language. Avoid an
  // empty card when another already-bundled language recognizes its correction.
  if (options.length) return options;
  return [
    ...new Set(
      alternatives
        .filter((other) => other !== dictionary)
        .flatMap((other) => spellingOptions(word, other)),
    ),
  ].slice(0, 5);
}
