import { createDictionary, unknownWords, spellingOptions } from './spelling.js';
let dictionary, language;
self.onmessage = async ({data}) => {
  try {
    if (!dictionary || language !== data.language) {
      const code = data.language === 'en-US' ? 'en' : 'pt';
      const responses = await Promise.all(['aff','dic'].map(ext=>fetch(new URL(`dictionaries/${code}.${ext}`,self.location.href))));
      if (responses.some(r=>!r.ok)) throw new Error('Não foi possível abrir o dicionário local.');
      const [aff,dic] = await Promise.all(responses.map(r=>r.text()));
      dictionary?.spell.dispose();
      dictionary = await createDictionary(aff,dic); language = data.language;
    }
    const result = data.type === 'suggest' ? spellingOptions(data.word,dictionary) : unknownWords(data.text,dictionary,data.personal);
    self.postMessage({id:data.id,result,entries:dictionary.entries});
  } catch(error) { self.postMessage({id:data.id,error:error.message || String(error)}); }
};
