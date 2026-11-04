import { createHunspellFromStrings } from "hunspell-wasm";

export async function createDictionary(aff, dic) {
  return {
    spell: await createHunspellFromStrings(aff, dic),
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

export function spellingOptions(word, dictionary) {
  if (word.length > 40) return [];
  return dictionary.spell
    .getSpellingSuggestions(word.normalize("NFC").replaceAll("’", "'"))
    .slice(0, 5);
}
