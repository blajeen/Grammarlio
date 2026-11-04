// Deliberately conservative, original rules. This is not a complete grammar engine.
const common = [
  ['repeated-word', /\b([\p{L}]+)([ \t]+)\1\b/giu, m => m[1], 'Palavra repetida / Repeated word', 'grammar'],
  ['space-before-punctuation', /[ \t]+([,;!?])/gu, m => m[1], 'Espaço antes da pontuação / Space before punctuation', 'punctuation'],
  ['extra-spaces', /(?<=\S)[ \t]{2,}(?=\S)/gu, () => ' ', 'Espaços extras / Extra spaces', 'punctuation'],
];
const en = [
  ['en-teh', /\bteh\b/giu, () => 'the', 'Possível erro: “the”.', 'spelling'],
  ['en-recieve', /\brecieve\b/giu, () => 'receive', 'A grafia correta é “receive”.', 'spelling'],
  ['en-seperate', /\bseperate\b/giu, () => 'separate', 'A grafia correta é “separate”.', 'spelling'],
  ['en-i-am', /\bi is\b/giu, () => 'I am', 'Use “I am”.', 'grammar'],
  ['en-they-are', /\b(they|we|you) is\b/giu, m => `${m[1]} are`, 'Use “are” com este pronome.', 'grammar'],
  ['en-he-is', /\b(he|she|it) are\b/giu, m => `${m[1]} is`, 'Use “is” com este pronome.', 'grammar'],
  ['en-i', /\bi\b/gu, () => 'I', 'O pronome “I” usa letra maiúscula.', 'spelling'],
];
const pt = [
  ['pt-concerteza', /\bconcerteza\b/giu, () => 'com certeza', '“Com certeza” se escreve separado.', 'spelling'],
  ['pt-agente', /\ba gente (somos|estamos|vamos)\b/giu, m => `a gente ${{somos:'é',estamos:'está',vamos:'vai'}[m[1].toLowerCase()]}`, '“A gente” pede verbo na terceira pessoa do singular.', 'grammar'],
  ['pt-nos', /\bnós vai\b/giu, () => 'nós vamos', 'Use “nós vamos”.', 'grammar'],
  ['pt-mim', /\bpara mim (fazer|dizer|resolver|escrever)\b/giu, m => `para eu ${m[1]}`, 'Antes deste infinitivo, o sujeito é “eu”.', 'grammar'],
  ['pt-menos', /\bmenas\b/giu, () => 'menos', '“Menos” é invariável.', 'grammar'],
  ['pt-excecao', /\bexcessão\b/giu, () => 'exceção', 'A grafia correta é “exceção”.', 'spelling'],
];

function preserveCase(original, replacement) {
  if (original === original.toLocaleUpperCase() && original.length > 1) return replacement.toLocaleUpperCase();
  if (/^\p{Lu}/u.test(original)) return replacement[0].toLocaleUpperCase() + replacement.slice(1);
  return replacement;
}

export function analyze(text, language = 'pt-BR') {
  const matches = [];
  for (const [id, expression, replace, message, category] of [...common, ...(language === 'en-US' ? en : pt)]) {
    for (const match of text.matchAll(new RegExp(expression.source, expression.flags))) {
      const replacement = preserveCase(match[0], replace(match));
      if (replacement === match[0]) continue;
      matches.push({ id, start: match.index, end: match.index + match[0].length, original: match[0], replacement, message, category });
    }
  }
  // One suggestion per overlapping range, so accepting a card never corrupts another.
  const ordered = matches.sort((a,b) => a.start - b.start || b.end - a.end);
  return ordered.filter((m,i) => !ordered.slice(0,i).some(p => p.start < m.end && m.start < p.end));
}

export function applySuggestion(text, suggestion) {
  if (text.slice(suggestion.start, suggestion.end) !== suggestion.original) throw new Error('O texto mudou. Revise novamente.');
  return text.slice(0,suggestion.start) + suggestion.replacement + text.slice(suggestion.end);
}

export const MAX_TEXT = 3000;
