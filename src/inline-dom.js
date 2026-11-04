export function editingHost(element) {
  if (!(element instanceof HTMLElement)) return null;
  if (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLInputElement
  )
    return element;
  if (!element.isContentEditable) return null;
  while (element.parentElement?.isContentEditable)
    element = element.parentElement;
  return element;
}

export function eligible(element) {
  if (!element?.isConnected || element.disabled || element.readOnly)
    return false;
  if (
    element instanceof HTMLInputElement &&
    !["text", "search"].includes(element.type)
  )
    return false;
  if (
    !(
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element.isContentEditable
    )
  )
    return false;
  if (
    element.closest(
      '[data-grammarlio="off"], [data-gramm="false"], [aria-hidden="true"], [aria-readonly="true"], [aria-disabled="true"], [inert]',
    )
  )
    return false;
  const sensitive = `${element.autocomplete || ""} ${element.name || ""} ${element.id || ""}`;
  if (
    /password|passwd|one-time-code|cc-|credit.?card|card.?number|\botp\b|\bcvv\b|\bcvc\b|secret/i.test(
      sensitive,
    )
  )
    return false;
  return getComputedStyle(element).visibility !== "hidden";
}

export function snapshot(element) {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  )
    return { text: element.value, segments: [] };
  let text = "";
  const segments = [];
  const block = /^(DIV|P|LI|UL|OL|BLOCKQUOTE|PRE|H[1-6]|SECTION)$/;
  function newline() {
    if (text && !text.endsWith("\n")) text += "\n";
  }
  function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const start = text.length;
      text += node.data;
      segments.push({ node, start, end: text.length });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (
      node !== element &&
      (node.contentEditable === "false" ||
        node.matches('script,style,[hidden],[aria-hidden="true"]') ||
        getComputedStyle(node).display === "none")
    ) {
      newline();
      return;
    }
    if (node.tagName === "BR") {
      text += "\n";
      return;
    }
    if (node !== element && block.test(node.tagName)) newline();
    for (const child of node.childNodes) visit(child);
    if (node !== element && block.test(node.tagName)) newline();
  }
  visit(element);
  return { text, segments };
}

export function domRange(data, start, end) {
  const first = data.segments.find((s) => s.start <= start && s.end > start);
  const last = data.segments.find((s) => s.start < end && s.end >= end);
  if (!first || !last) return null;
  const range = document.createRange();
  range.setStart(first.node, start - first.start);
  range.setEnd(last.node, end - last.start);
  return range;
}

export function replaceInline(element, original, suggestion, replacement) {
  if (!eligible(element)) throw new Error("Este campo não permite edição.");
  const current = snapshot(element);
  if (
    current.text !== original ||
    current.text.slice(suggestion.start, suggestion.end) !== suggestion.original
  )
    throw new Error("O texto mudou. Aguarde a nova revisão.");
  element.focus({ preventScroll: true });
  const plain =
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement;
  if (plain) element.setSelectionRange(suggestion.start, suggestion.end);
  else {
    const range = domRange(current, suggestion.start, suggestion.end);
    if (!range)
      throw new Error("Não foi possível localizar este trecho no editor.");
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
  // Chromium's native edit path preserves undo and editor input events. Never
  // replace innerHTML: formatting and framework-owned structure must survive.
  let before;
  const observe = (event) => {
    before = event;
  };
  element.addEventListener("beforeinput", observe, { capture: true });
  let edited;
  try {
    edited = document.execCommand("insertText", false, replacement);
  } finally {
    element.removeEventListener("beforeinput", observe, { capture: true });
  }
  if (!edited && snapshot(element).text === original) {
    if (before?.defaultPrevented || !plain)
      throw new Error("O editor não aceitou esta alteração.");
    const event = new InputEvent("beforeinput", {
      inputType: "insertReplacementText",
      data: replacement,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    if (!element.dispatchEvent(event))
      throw new Error("O site bloqueou esta alteração.");
    const value =
      original.slice(0, suggestion.start) +
      replacement +
      original.slice(suggestion.end);
    const proto =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
    element.setSelectionRange(
      suggestion.start + replacement.length,
      suggestion.start + replacement.length,
    );
    element.dispatchEvent(
      new InputEvent("input", {
        inputType: "insertReplacementText",
        data: replacement,
        bubbles: true,
        composed: true,
      }),
    );
  }
}
