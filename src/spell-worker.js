import { createDictionary, unknownWords, spellingOptions } from "./spelling.js";
import { detectLanguage, sentenceSegments } from "./language.js";
const dictionaries = {};
async function getDictionary(language) {
  if (dictionaries[language]) return dictionaries[language];
  const code = { "pt-BR": "pt", "en-US": "en", "es-ES": "es" }[language];
  const responses = await Promise.all(
    ["aff", "dic"].map((ext) =>
      fetch(new URL(`dictionaries/${code}.${ext}`, self.location.href)),
    ),
  );
  if (responses.some((r) => !r.ok))
    throw new Error("Não foi possível abrir o dicionário local.");
  const [aff, dic] = await Promise.all(responses.map((r) => r.text()));
  let supplement;
  if (language === "en-US") {
    const extra = await Promise.all(
      ["aff", "dic"].map((ext) =>
        fetch(new URL(`dictionaries/en-large.${ext}`, self.location.href)),
      ),
    );
    if (extra.some((response) => !response.ok))
      throw new Error("Não foi possível abrir o vocabulário inglês ampliado.");
    const [extraAff, extraDic] = await Promise.all(
      extra.map((response) => response.text()),
    );
    supplement = { aff: extraAff, dic: extraDic };
  }
  return (dictionaries[language] = await createDictionary(
    aff,
    dic,
    supplement,
  ));
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "auto") {
      for (const language of ["pt-BR", "en-US", "es-ES"])
        await getDictionary(language);
      const segments = sentenceSegments(data.text).map((part) => ({
        ...part,
        language: detectLanguage(
          data.text.slice(part.start, part.end),
          dictionaries,
          data.hint,
        ),
      }));
      const result = segments.flatMap((part) =>
        unknownWords(
          data.text.slice(part.start, part.end),
          dictionaries[part.language],
          data.personalByLanguage?.[part.language] || [],
        ).map((f) => ({
          ...f,
          start: f.start + part.start,
          end: f.end + part.start,
          language: part.language,
        })),
      );
      const language = segments[0]?.language || data.hint || "pt-BR";
      self.postMessage({
        id: data.id,
        result,
        segments,
        language,
        entries: dictionaries[language].entries,
      });
      return;
    }
    const dictionary = await getDictionary(data.language);
    const result =
      data.type === "suggest"
        ? spellingOptions(data.word, dictionary, Object.values(dictionaries))
        : unknownWords(data.text, dictionary, data.personal);
    self.postMessage({ id: data.id, result, entries: dictionary.entries });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message || String(error) });
  }
};
