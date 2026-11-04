import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDictionary,unknownWords,spellingOptions} from '../src/spelling.js';

for (const [language,words,wrong,correction] of [
  ['en','The beautiful children received helpful messages yesterday.','beutiful','beautiful'],
  ['pt','As crianças brasileiras escreveram mensagens úteis para os professores.','portugês','português'],
  ['es','Las personas escribieron mensajes útiles para los profesores.','espanol','español']
]) {
  test(`Full ${language} dictionary accepts inflected words and suggests real corrections`,async()=>{
    const [aff,dic] = await Promise.all(['aff','dic'].map(ext=>readFile(`node_modules/dictionary-${language}/index.${ext}`,'utf8')));
    const dictionary = await createDictionary(aff,dic);
    assert.ok(dictionary.entries > 40000);
    assert.deepEqual(unknownWords(words,dictionary),[]);
    assert.equal(unknownWords(wrong,dictionary)[0].original,wrong);
    assert.ok(spellingOptions(wrong,dictionary).includes(correction));
    assert.deepEqual(unknownWords('Grammarlio https://example.invalid/aweirdword test123',dictionary,['Grammarlio']),[]);
    const text = `🙂 ${wrong}`;
    const [finding] = unknownWords(text,dictionary);
    assert.equal(text.slice(finding.start,finding.end),wrong);
    dictionary.spell.dispose();
  });
}
