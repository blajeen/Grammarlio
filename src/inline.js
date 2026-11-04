import styles from "./inline.css";
import {
  editingHost,
  eligible,
  snapshot,
  domRange,
  replaceInline,
} from "./inline-dom.js";

const host = document.createElement("div");
host.setAttribute("data-grammarlio-root", "");
const shadow = host.attachShadow({ mode: "open" });
const sheet = document.createElement("style");
sheet.textContent = styles;
shadow.append(sheet);
const layer = document.createElement("div");
layer.className = "layer";
layer.setAttribute("aria-hidden", "true");
shadow.append(layer);
const mirror = document.createElement("div");
mirror.className = "mirror";
mirror.setAttribute("aria-hidden", "true");
shadow.append(mirror);
const badge = document.createElement("button");
badge.className = "badge";
badge.hidden = true;
badge.type = "button";
badge.setAttribute("aria-keyshortcuts", "Control+Alt+G");
shadow.append(badge);
const popup = document.createElement("section");
popup.className = "popup";
popup.hidden = true;
popup.setAttribute("role", "dialog");
popup.setAttribute("aria-label", "Sugestões do Grammarlio");
shadow.append(popup);
document.documentElement.append(host);

let field,
  data,
  findings = [],
  timer,
  version = 0,
  composing = false,
  busy = false,
  currentLanguage = "pt-BR",
  settings = {},
  popupIndex = null,
  frame,
  lastError = "";
const ignored = new Set(),
  languages = new WeakMap();
let mutationObserver, resizeObserver;
const MAX_INLINE = 12000;
function node(tag, text, cls) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (cls) element.className = cls;
  return element;
}
function button(text, action, cls = "link") {
  const element = node("button", text, cls);
  element.type = "button";
  element.addEventListener("click", action);
  return element;
}
function enabled() {
  return (
    !document.hidden &&
    settings.inlineEnabled !== false &&
    !settings.disabledSites?.includes(location.hostname)
  );
}
function languageFor(element) {
  const explicit = element.closest("[lang]")?.getAttribute("lang") || "";
  return (
    languages.get(element) ||
    settings.language ||
    (/^en(?:-|$)/i.test(explicit) ? "en-US" : "pt-BR")
  );
}
async function request(action, args = {}) {
  const response = await chrome.runtime.sendMessage({
    target: "grammarlio-background",
    action,
    language: currentLanguage,
    ...args,
  });
  if (!response)
    throw new Error("Recarregue a página para conectar a extensão.");
  if (response.disabled) {
    clear();
    throw new Error("Revisão pausada neste site.");
  }
  if (response.error) throw new Error(response.error);
  return response;
}
function clear() {
  clearTimeout(timer);
  version++;
  findings = [];
  layer.replaceChildren();
  mirror.replaceChildren();
  badge.hidden = true;
  popup.hidden = true;
}
function disconnect() {
  clear();
  mutationObserver?.disconnect();
  resizeObserver?.disconnect();
  field = undefined;
  data = undefined;
}
function activate(element) {
  if (!enabled() || !eligible(element)) {
    disconnect();
    return;
  }
  if (element === field) return;
  disconnect();
  field = element;
  ignored.clear();
  currentLanguage = languageFor(field);
  mutationObserver = new MutationObserver(() => {
    if (field && snapshot(field).text !== data?.text) schedule();
    else position();
  });
  mutationObserver.observe(field, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      "style",
      "class",
      "disabled",
      "readonly",
      "type",
      "autocomplete",
      "aria-hidden",
    ],
  });
  resizeObserver = new ResizeObserver(position);
  resizeObserver.observe(field);
  schedule();
}
function schedule() {
  if (!field || !eligible(field) || !enabled()) {
    disconnect();
    return;
  }
  clear();
  lastError = "";
  badge.hidden = false;
  badge.dataset.busy = "true";
  badge.textContent = "✦";
  badge.setAttribute("aria-label", "Grammarlio: verificando no dispositivo");
  busy = true;
  if (composing) return;
  const revision = version,
    element = field;
  position();
  timer = setTimeout(async () => {
    data = snapshot(element);
    if (data.text.length > MAX_INLINE) {
      busy = false;
      badge.dataset.busy = "false";
      badge.textContent = "…";
      badge.title =
        "Campo maior que 12.000 caracteres; revisão direta indisponível.";
      badge.setAttribute("aria-label", badge.title);
      return;
    }
    try {
      const result = await request("check", { text: data.text });
      if (
        version !== revision ||
        field !== element ||
        composing ||
        !eligible(element)
      )
        return;
      if (snapshot(element).text !== data.text) {
        schedule();
        return;
      }
      findings = result.result.filter(
        (f) =>
          !ignored.has(`${currentLanguage}:${f.original.toLocaleLowerCase()}`),
      );
      busy = false;
      badge.dataset.busy = "false";
      badge.textContent = findings.length ? String(findings.length) : "✦";
      badge.title = `Grammarlio · ${currentLanguage} · ${findings.length} sugestão(ões). Clique para revisar.`;
      badge.setAttribute("aria-label", badge.title);
      position();
    } catch (error) {
      if (version === revision) {
        busy = false;
        lastError = /context invalidated/i.test(error.message)
          ? "A extensão foi atualizada. Recarregue esta página."
          : error.message;
        badge.dataset.busy = "false";
        badge.textContent = "!";
        badge.title = lastError;
        badge.setAttribute("aria-label", lastError);
      }
    }
  }, 450);
}
function clipping(element) {
  const r = element.getBoundingClientRect();
  let clip = {
    left: Math.max(0, r.left + element.clientLeft),
    top: Math.max(0, r.top + element.clientTop),
    right: Math.min(
      innerWidth,
      r.left + element.clientLeft + element.clientWidth,
    ),
    bottom: Math.min(
      innerHeight,
      r.top + element.clientTop + element.clientHeight,
    ),
  };
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent),
      rect = parent.getBoundingClientRect();
    if (/hidden|clip|scroll|auto/.test(style.overflowX)) {
      clip.left = Math.max(clip.left, rect.left);
      clip.right = Math.min(clip.right, rect.right);
    }
    if (/hidden|clip|scroll|auto/.test(style.overflowY)) {
      clip.top = Math.max(clip.top, rect.top);
      clip.bottom = Math.min(clip.bottom, rect.bottom);
    }
  }
  return clip;
}
function plainRanges() {
  const rect = field.getBoundingClientRect(),
    computed = getComputedStyle(field);
  Object.assign(mirror.style, {
    left: `${rect.left + field.clientLeft}px`,
    top: `${rect.top + field.clientTop}px`,
    width: `${field.clientWidth}px`,
    height: `${field.clientHeight}px`,
  });
  const inner = node("div");
  for (const property of [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "fontStretch",
    "fontVariant",
    "fontKerning",
    "fontFeatureSettings",
    "fontVariationSettings",
    "letterSpacing",
    "wordSpacing",
    "lineHeight",
    "textAlign",
    "textIndent",
    "textTransform",
    "direction",
    "tabSize",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "wordBreak",
  ])
    inner.style[property] = computed[property];
  const single = field instanceof HTMLInputElement;
  Object.assign(inner.style, {
    boxSizing: "border-box",
    margin: "0",
    border: "0",
    width: `${field.clientWidth}px`,
    whiteSpace: single ? "pre" : "pre-wrap",
    overflowWrap: single
      ? "normal"
      : field.wrap === "off"
        ? "normal"
        : "break-word",
    transform: `translate(${-field.scrollLeft}px,${-field.scrollTop}px)`,
  });
  if (!single && field.wrap === "off") inner.style.whiteSpace = "pre";
  if (single) {
    const lineHeight =
      parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2;
    inner.style.lineHeight = `${lineHeight}px`;
    inner.style.paddingTop = `${Math.max(parseFloat(computed.paddingTop), (field.clientHeight - parseFloat(computed.paddingTop) - parseFloat(computed.paddingBottom) - lineHeight) / 2 + parseFloat(computed.paddingTop))}px`;
  }
  const text = document.createTextNode(data.text + "\u200b");
  inner.append(text);
  mirror.replaceChildren(inner);
  return findings.map((f) => {
    const range = document.createRange();
    range.setStart(text, f.start);
    range.setEnd(text, f.end);
    return [...range.getClientRects()];
  });
}
function position() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
}
function draw() {
  if (!field || !eligible(field) || !enabled()) {
    if (field) disconnect();
    return;
  }
  const rect = field.getBoundingClientRect(),
    clip = clipping(field);
  if (clip.right <= clip.left || clip.bottom <= clip.top) {
    badge.hidden = true;
    layer.replaceChildren();
    popup.hidden = true;
    return;
  }
  badge.hidden = false;
  badge.style.left = `${Math.max(clip.left, clip.right - 35)}px`;
  badge.style.top = `${Math.max(clip.top, clip.bottom - 29)}px`;
  layer.replaceChildren();
  if (data && findings.length && !busy && !composing) {
    if (snapshot(field).text !== data.text) {
      schedule();
      return;
    }
    if (
      !(
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement
      )
    )
      data = snapshot(field);
    const ranges =
      field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
        ? plainRanges()
        : findings.map((f) => [
            ...(domRange(data, f.start, f.end)?.getClientRects() || []),
          ]);
    ranges.forEach((rects, index) =>
      rects.forEach((r) => {
        const left = Math.max(r.left, clip.left),
          right = Math.min(r.right, clip.right),
          top = r.bottom - 5;
        if (right <= left || top < clip.top || top + 5 > clip.bottom) return;
        const mark = button(
          "",
          () => open(index),
          "mark" + (findings[index].category === "grammar" ? " grammar" : ""),
        );
        mark.tabIndex = -1;
        mark.setAttribute("aria-label", `Corrigir ${findings[index].original}`);
        mark.dataset.word = findings[index].original;
        Object.assign(mark.style, {
          left: `${left}px`,
          top: `${top}px`,
          width: `${right - left}px`,
        });
        mark.addEventListener("pointerdown", (event) => event.preventDefault());
        layer.append(mark);
      }),
    );
  }
  if (!popup.hidden) placePopup();
}
function placePopup() {
  if (!field) return;
  const rect = field.getBoundingClientRect();
  popup.style.left = `${Math.max(10, Math.min(rect.left, innerWidth - popup.offsetWidth - 10))}px`;
  const below = rect.bottom + 8,
    above = rect.top - popup.offsetHeight - 8;
  popup.style.top = `${Math.max(10, Math.min(below + popup.offsetHeight < innerHeight ? below : above, innerHeight - popup.offsetHeight - 10))}px`;
}
function popupNotice(text) {
  let message = popup.querySelector(".notice");
  if (!message) {
    message = node("p", "", "notice");
    message.setAttribute("role", "status");
    popup.append(message);
  }
  message.textContent = text;
  placePopup();
}
function open(index = null, focus = false) {
  if (!field || composing) return;
  if (!focus && document.activeElement === host)
    field.focus({ preventScroll: true });
  popupIndex = index;
  popup.replaceChildren();
  popup.hidden = false;
  const header = node("header", "grammarlio");
  const close = button(
    "×",
    () => {
      popup.hidden = true;
      field?.focus({ preventScroll: true });
    },
    "close",
  );
  close.setAttribute("aria-label", "Fechar sugestões");
  header.append(node("span", "LOCAL · SEM CONTA"), close);
  popup.append(header);
  const row = node("label", undefined, "row");
  row.append(node("span", "Idioma do texto"));
  const select = node("select");
  select.setAttribute("aria-label", "Idioma da revisão");
  for (const [value, label] of [
    ["pt-BR", "Português · Brasil"],
    ["en-US", "English · US"],
  ]) {
    const option = node("option", label);
    option.value = value;
    select.append(option);
  }
  select.value = currentLanguage;
  select.addEventListener("change", async () => {
    currentLanguage = select.value;
    languages.set(field, currentLanguage);
    settings.language = currentLanguage;
    field.focus({ preventScroll: true });
    await chrome.storage.local.set({ language: currentLanguage });
    schedule();
  });
  row.append(select);
  popup.append(row);
  if (lastError) popup.append(node("p", lastError, "notice"));
  else if (busy) popup.append(node("p", "Verificando neste dispositivo…"));
  else if (data?.text.length > MAX_INLINE)
    popup.append(
      node(
        "p",
        "Este campo supera o limite técnico de 12.000 caracteres. Revise um trecho menor.",
      ),
    );
  else if (index === null) {
    popup.append(
      node(
        "p",
        findings.length
          ? "Clique em uma palavra para ver sugestões."
          : "Nenhuma sugestão encontrada. Isso não garante que o texto esteja correto.",
      ),
    );
    findings.forEach((f, i) =>
      popup.append(button(f.original, () => open(i), "finding")),
    );
  } else {
    const finding = findings[index],
      revision = version,
      original = data?.text;
    if (!finding) {
      popup.hidden = true;
      return;
    }
    popup.append(node("h3", finding.original), node("p", finding.message));
    const options = node("div", undefined, "options");
    popup.append(options);
    const apply = (replacement) => {
      try {
        if (revision !== version || composing)
          throw new Error("O texto mudou. Aguarde a nova revisão.");
        replaceInline(field, original, finding, replacement);
        schedule();
      } catch (error) {
        popupNotice(error.message);
      }
    };
    if (finding.replacement !== undefined)
      options.append(
        button(finding.replacement, () => apply(finding.replacement), "option"),
      );
    else {
      options.append(node("p", "Buscando alternativas locais…"));
      request("suggest", { word: finding.original })
        .then((result) => {
          if (version !== revision || popupIndex !== index || popup.hidden)
            return;
          options.replaceChildren();
          for (const replacement of result.result)
            options.append(
              button(replacement, () => apply(replacement), "option"),
            );
          if (!result.result.length)
            options.append(
              node(
                "p",
                "Nenhuma alternativa encontrada. Você pode editar manualmente.",
              ),
            );
          placePopup();
        })
        .catch((error) => popupNotice(error.message));
    }
    popup.append(
      button("Ignorar nesta edição", () => {
        ignored.add(
          `${currentLanguage}:${finding.original.toLocaleLowerCase()}`,
        );
        field?.focus({ preventScroll: true });
        schedule();
      }),
    );
    if (finding.id === "dictionary")
      popup.append(
        button("Adicionar ao meu dicionário", async () => {
          try {
            field?.focus({ preventScroll: true });
            await request("add-word", { word: finding.original });
            schedule();
          } catch (error) {
            popupNotice(error.message);
          }
        }),
      );
  }
  popup.append(
    node("hr"),
    button("Pausar neste site", async () => {
      const saved = await chrome.storage.local.get("disabledSites");
      await chrome.storage.local.set({
        disabledSites: [
          ...new Set([...(saved.disabledSites || []), location.hostname]),
        ],
      });
      disconnect();
    }),
  );
  placePopup();
  if (focus)
    (popup.querySelector(".option") || popup.querySelector("select"))?.focus({
      preventScroll: true,
    });
}
badge.addEventListener("pointerdown", (event) => event.preventDefault());
badge.addEventListener("click", (event) => open(null, event.detail === 0));
document.addEventListener(
  "focusin",
  (event) => {
    if (event.composedPath().includes(host)) return;
    activate(editingHost(event.composedPath()[0]));
  },
  true,
);
document.addEventListener(
  "input",
  (event) => {
    if (
      field &&
      (event.composedPath().includes(field) || field.contains(event.target))
    )
      schedule();
  },
  true,
);
document.addEventListener(
  "focusout",
  () => {
    // A microtask can run between native blur and focus, while activeElement is
    // temporarily body. Wait until the complete focus transition has finished.
    setTimeout(() => {
      let active = document.activeElement;
      if (active === host) return; // The inline dialog is editing this field.
      while (active?.shadowRoot?.activeElement)
        active = active.shadowRoot.activeElement;
      const next = editingHost(active);
      if (next !== field) activate(next);
    }, 0);
  },
  true,
);
document.addEventListener(
  "compositionstart",
  (event) => {
    if (field && (event.target === field || field.contains(event.target))) {
      composing = true;
      clear();
    }
  },
  true,
);
document.addEventListener(
  "compositionend",
  () => {
    if (composing) {
      composing = false;
      schedule();
    }
  },
  true,
);
document.addEventListener(
  "pointerdown",
  (event) => {
    if (!event.composedPath().includes(host)) popup.hidden = true;
  },
  true,
);
document.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape" && !popup.hidden) {
      popup.hidden = true;
      field?.focus({ preventScroll: true });
    }
    if (
      field &&
      event.ctrlKey &&
      event.altKey &&
      event.key.toLowerCase() === "g" &&
      !event.isComposing
    ) {
      event.preventDefault();
      open(null, true);
    }
  },
  true,
);
document.addEventListener("scroll", position, true);
window.addEventListener("resize", position);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) disconnect();
  else if (enabled()) activate(editingHost(document.activeElement));
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  for (const key of ["inlineEnabled", "disabledSites", "language", "personal"])
    if (changes[key]) settings[key] = changes[key].newValue;
  if (!enabled()) disconnect();
  else if (field) {
    currentLanguage = languageFor(field);
    schedule();
  } else activate(editingHost(document.activeElement));
});
chrome.storage.local
  .get(["inlineEnabled", "disabledSites", "language"])
  .then((value) => {
    settings = value;
    if (enabled()) activate(editingHost(document.activeElement));
  });
setInterval(() => {
  if (!field) return;
  if (!field.isConnected || !eligible(field)) {
    disconnect();
    return;
  }
  if (!composing && !busy && snapshot(field).text !== data?.text) schedule();
  else position();
}, 700);
