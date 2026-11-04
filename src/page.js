// These functions run only after the user's explicit action, in the active tab.
export function captureField() {
  const el = document.activeElement;
  const isPlain = el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && ['text','search'].includes(el.type));
  if (el instanceof HTMLInputElement && !isPlain) return { error: 'Este tipo de campo não é lido. Use um campo de texto comum.' };
  if (isPlain) {
    if (el.disabled || el.readOnly || /password|cc-|one-time-code/i.test(el.autocomplete)) return { error: 'Campo protegido ou somente leitura.' };
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = start !== end;
    const snapshot = { element: el, value: el.value, start: selected ? start : 0, end: selected ? end : el.value.length };
    globalThis.__grammarlioTarget = snapshot;
    return { text: el.value.slice(snapshot.start,snapshot.end), canApply: true };
  }
  delete globalThis.__grammarlioTarget;
  const selection = window.getSelection()?.toString();
  if (selection) return { text: selection, canApply: false };
  if (el?.isContentEditable) return { text: el.innerText, canApply: false };
  return { error: 'Clique em um campo de texto ou selecione um trecho na página e tente novamente. Em editores complexos, copie e cole.' };
}

export function replaceField(replacement) {
  const t = globalThis.__grammarlioTarget;
  if (!t || !t.element.isConnected || t.element.value !== t.value) return { error: 'O campo mudou. Importe o texto novamente para evitar sobrescrever sua edição.' };
  const el = t.element;
  if (el.disabled || el.readOnly) return { error: 'O campo não permite edição.' };
  const value = t.value.slice(0,t.start) + replacement + t.value.slice(t.end);
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  delete globalThis.__grammarlioTarget;
  return { ok: true };
}
