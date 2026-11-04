const anchors = {
  "pt-BR": new Set(
    "não você vocês estou indo com uma nós amanhã pessoas precisa seu sua muito isso para os uma é".split(
      " ",
    ),
  ),
  "en-US": new Set(
    "the i am is are you we they with your this that need please she have beautiful yesterday".split(
      " ",
    ),
  ),
  "es-ES": new Set(
    "hola estoy voy hacia con una nosotros personas necesita mañana usted ustedes es el los las y español".split(
      " ",
    ),
  ),
};
export function detectLanguage(text, dictionaries, hint = "pt-BR") {
  const words = (
    text
      .replace(/https?:\/\/\S+|\S+@\S+/gu, "")
      .match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu) || []
  ).slice(0, 500);
  if (!words.length) return hint;
  const scores = Object.entries(dictionaries)
    .map(([language, dictionary]) => {
      let known = 0,
        signals = 0;
      for (const word of words) {
        const lower = word.toLocaleLowerCase();
        if (
          dictionary.spell.testSpelling(word) ||
          dictionary.spell.testSpelling(lower)
        )
          known++;
        if (anchors[language].has(lower)) signals++;
      }
      return { language, score: (known + signals * 0.6) / words.length };
    })
    .sort((a, b) => b.score - a.score);
  if (scores[0].score === 0 && words.length <= 3) {
    let best = { language: hint, distance: 3 };
    const word = words.find((w) => w.length >= 3 && w.length <= 30);
    if (word)
      for (const [language, dictionary] of Object.entries(dictionaries))
        for (const option of dictionary.spell
          .getSpellingSuggestions(word)
          .slice(0, 3)) {
          const distance = editDistance(
            word.toLocaleLowerCase(),
            option.toLocaleLowerCase(),
          );
          if (distance < best.distance) best = { language, distance };
        }
    return best.language;
  }
  if (Math.abs(scores[0].score - scores[1].score) < 0.05)
    return scores.find((s) => s.language === hint)?.score >=
      scores[0].score - 0.05
      ? hint
      : scores[0].language;
  return scores[0].language;
}
export function sentenceSegments(text) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
  return [...segmenter.segment(text)].flatMap((part) => {
    const result = [];
    let offset = part.index;
    for (const line of part.segment.split(/(?<=\n)/u)) {
      if (line.trim())
        result.push({ start: offset, end: offset + line.length });
      offset += line.length;
    }
    return result;
  });
}
function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = current;
  }
  return previous[b.length];
}
