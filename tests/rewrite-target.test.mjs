import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rewriteTarget} from '../src/rewrite-target.js';
test('rewrite scope contains the hovered sentence, preserving the rest',()=>{
  const text='Prefix stays.\n🙂 She are happy.\nSuffix stays.';
  const start=text.indexOf('She');
  const target=rewriteTarget(text,{start,end:start+3});
  assert.equal(target.original,'🙂 She are happy.');
  assert.equal(text.slice(target.start,target.end),target.original);
  assert.ok(target.context.includes('Prefix stays.'));
});
test('explicit selection is used without expanding to the whole field',()=>{
  const target=rewriteTarget('Before. Selected text. After.',null,{start:8,end:21});
  assert.equal(target.original,'Selected text');
});
test('oversized sentences are declined, never truncated',()=>{
  assert.equal(rewriteTarget('word '.repeat(1000),{start:5,end:9}),null);
});
