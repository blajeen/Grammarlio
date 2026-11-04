import styles from "./inline.css";
import { attachInlineAi, rewriteCacheKey } from "./inline-ai.js";
import { rewriteTarget } from "./rewrite-target.js";
import {
  editingHost,
  focusedEditor,
  eligible,
  snapshot,
  domRange,
  replaceInline,
} from "./inline-dom.js";

const listeners = [];
function listen(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  listeners.push({
    target,
    type,
    handler,
    options,
    scope:
      target === window ? "window" : target === document ? "document" : null,
  });
}
function restoreListeners() {
  for (const { target, type, handler, options, scope } of listeners) {
    // Re-adding the same listener is idempotent. Editor document.open() and
    // designMode initialization can erase listeners while retaining our DOM.
    (scope === "window"
      ? window
      : scope === "document"
        ? document
        : target
    ).addEventListener(type, handler, options);
  }
}

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
let hitRegions = [],
  hoverTimer,
  closeTimer,
  hoverIndex = null,
  popupOrigin = "click",
  popupEpoch = 0,
  disposeAi;
let warmTimer,
  warmRunning = false,
  warmJob;
let lastGeometry = "";
const aiCache = new Map();
function closePopup() {
  clearTimeout(hoverTimer);
  clearTimeout(closeTimer);
  popupEpoch++;
  disposeAi?.();
  disposeAi = undefined;
  popup.hidden = true;
  hoverIndex = null;
}
const ignored = new Set();
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
  return !document.hidden && settings.inlineEnabled !== false;
}
function languageFor(element) {
  const explicit = element.closest("[lang]")?.getAttribute("lang") || "";
  return /^en(?:-|$)/i.test(explicit)
    ? "en-US"
    : /^es(?:-|$)/i.test(explicit)
      ? "es-ES"
      : "pt-BR";
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
  lastGeometry = "";
  clearTimeout(timer);
  clearTimeout(warmTimer);
  if (warmRunning) {
    const jobId = warmJob;
    warmRunning = false;
    request("ai-cancel", { jobId }).catch(() => {});
  }
  version++;
  findings = [];
  layer.replaceChildren();
  mirror.replaceChildren();
  badge.hidden = true;
  hitRegions = [];
  closePopup();
}
function disconnect() {
  clear();
  mutationObserver?.disconnect();
  resizeObserver?.disconnect();
  field = undefined;
  data = undefined;
  aiCache.clear();
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
    lastGeometry = "";
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
      const result = await request("check", {
        text: data.text,
        language: "auto",
        hint: languageFor(element),
      });
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
      currentLanguage = result.language || languageFor(element);
      findings = result.result.filter(
        (f) =>
          !ignored.has(
            `${f.language || currentLanguage}:${f.original.toLocaleLowerCase()}`,
          ),
      );
      busy = false;
      badge.dataset.busy = "false";
      badge.textContent = findings.length ? String(findings.length) : "✦";
      badge.title = `Grammarlio · ${currentLanguage} · ${findings.length} sugestão(ões). Clique para revisar.`;
      badge.setAttribute("aria-label", badge.title);
      position();
      warmTimer = setTimeout(() => warmAi(revision, element), 1100);
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
async function warmAi(revision, element) {
  if (
    version !== revision ||
    field !== element ||
    !enabled() ||
    !settings.aiConsent ||
    warmRunning
  )
    return;
  const original = data.text,
    finding = findings[0],
    language = finding?.language || currentLanguage,
    target = rewriteTarget(
      original,
      finding,
      !finding &&
        (field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement)
        ? { start: field.selectionStart, end: field.selectionEnd }
        : undefined,
    );
  if (!finding && original.trim().split(/\s+/).length < 3) return;
  if (!target || aiCache.has(rewriteCacheKey(language, target))) return;
  let jobId;
  try {
    const state = await request("ai-status");
    if (version !== revision || field !== element || !enabled()) return;
    if (state.phase === "loading" || state.phase === "generating") {
      warmTimer = setTimeout(() => warmAi(revision, element), 1300);
      return;
    }
    if (state.phase === "error") return;
    if (!state.ready) await request("ai-load", { allowDownload: true });
    if (version !== revision || field !== element || !enabled()) return;
    warmRunning = true;
    warmJob =
      jobId = `warm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const response = await request("ai-rewrite", {
      text: target.original,
      context: target.context,
      mode: "clear",
      language,
      jobId: warmJob,
    });
    if (version === revision && field === element && !response.busy) {
      aiCache.set(rewriteCacheKey(language, target), response.text);
      if (aiCache.size > 8) aiCache.delete(aiCache.keys().next().value);
      if (
        !findings.length &&
        response.text.trim() !== target.original.trim() &&
        !ignored.has(`${language}:${target.original.toLocaleLowerCase()}`)
      ) {
        findings = [
          {
            id: "ai-rewrite",
            category: "style",
            language,
            ...target,
            message:
              "Uma alternativa para deixar a frase mais natural. Revise antes de aceitar.",
          },
        ];
        lastGeometry = "";
        badge.textContent = "1";
        position();
      }
    }
    if (response.busy)
      warmTimer = setTimeout(() => warmAi(revision, element), 1300);
  } catch {
  } finally {
    if (jobId && warmJob === jobId) warmRunning = false;
  }
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
  restoreListeners();
  if (!field || !eligible(field) || !enabled()) {
    if (field) disconnect();
    return;
  }
  // A native modal makes siblings inert regardless of their z-index. Keep the
  // overlay in the same top-layer dialog as its editor so it stays clickable.
  const container = field.closest("dialog[open]") || document.documentElement;
  if (host.parentElement !== container) container.append(host);
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
  const style = getComputedStyle(field);
  const geometry = [
    version,
    busy,
    findings.length,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    field.clientWidth,
    field.clientHeight,
    field.scrollTop,
    field.scrollLeft,
    clip.left,
    clip.top,
    clip.right,
    clip.bottom,
    style.font,
    style.lineHeight,
    style.letterSpacing,
    style.padding,
    style.textAlign,
  ].join("|");
  if (lastGeometry === geometry) {
    if (!popup.hidden) placePopup();
    return;
  }
  lastGeometry = geometry;
  layer.replaceChildren();
  hitRegions = [];
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
        hitRegions.push({
          index,
          left,
          right,
          top: Math.max(r.top, clip.top),
          bottom: Math.min(r.bottom, clip.bottom),
        });
        const mark = button(
          "",
          () => open(index),
          "mark" +
            (["grammar", "style"].includes(findings[index].category)
              ? " grammar"
              : ""),
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
  const anchor =
    popupIndex !== null ? hitRegions.find((r) => r.index === popupIndex) : null;
  const rect = anchor || field.getBoundingClientRect();
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
function open(index = null, focus = false, origin = "click") {
  if (!field || composing) return;
  clearTimeout(closeTimer);
  clearTimeout(hoverTimer);
  disposeAi?.();
  disposeAi = undefined;
  popupEpoch++;
  const epoch = popupEpoch;
  popupOrigin = origin;
  if (!focus && document.activeElement === host)
    field.focus({ preventScroll: true });
  popupIndex = index;
  popup.classList.toggle("is-hover", origin === "hover");
  popup.replaceChildren();
  popup.hidden = false;
  const header = node("header", "grammarlio");
  const close = button(
    "×",
    () => {
      closePopup();
      field?.focus({ preventScroll: true });
    },
    "close",
  );
  close.setAttribute("aria-label", "Fechar sugestões");
  header.append(node("span", "LOCAL · SEM CONTA"), close);
  popup.append(header);
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
    popup.append(
      node(
        "h3",
        finding.id === "ai-rewrite" ? "Melhorar frase" : finding.original,
      ),
      node("p", finding.message),
    );
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
    if (finding.id === "ai-rewrite") options.hidden = true;
    else if (finding.replacement !== undefined)
      options.append(
        button(finding.replacement, () => apply(finding.replacement), "option"),
      );
    else {
      options.append(node("p", "Buscando alternativas locais…"));
      request("suggest", {
        word: finding.original,
        language: finding.language || currentLanguage,
      })
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
          `${finding.language || currentLanguage}:${finding.original.toLocaleLowerCase()}`,
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
            await request("add-word", {
              word: finding.original,
              language: finding.language || currentLanguage,
            });
            schedule();
          } catch (error) {
            popupNotice(error.message);
          }
        }),
      );
  }
  if (!busy && !lastError && data && data.text.length <= MAX_INLINE) {
    const revision = version,
      element = field,
      original = data.text;
    const selection =
      field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
        ? { start: field.selectionStart, end: field.selectionEnd }
        : undefined;
    const selected = index !== null ? findings[index] : null;
    const target =
      selected?.id === "ai-rewrite"
        ? selected
        : rewriteTarget(
            original,
            selected,
            index === null ? selection : undefined,
          );
    disposeAi = attachInlineAi({
      parent: popup,
      target,
      language: findings[index]?.language || currentLanguage,
      request,
      cache: aiCache,
      isCurrent: () =>
        !popup.hidden &&
        popupEpoch === epoch &&
        version === revision &&
        field === element &&
        eligible(element),
      position: placePopup,
      accept: (range, replacement) => {
        try {
          if (version !== revision || field !== element || composing)
            throw new Error(
              "O texto mudou. Passe o mouse novamente para revisar.",
            );
          replaceInline(element, original, range, replacement);
          schedule();
        } catch (error) {
          popupNotice(error.message);
        }
      },
    });
  }
  const language = findings[index]?.language || currentLanguage;
  popup.append(
    node(
      "p",
      `${{ "pt-BR": "Português", "en-US": "English", "es-ES": "Español" }[language]} · idioma automático`,
      "auto-language",
    ),
  );
  placePopup();
  if (focus)
    (
      popup.querySelector(".option") ||
      popup.querySelector(".finding") ||
      popup.querySelector(".close")
    )?.focus({
      preventScroll: true,
    });
}
listen(badge, "pointerdown", (event) => event.preventDefault());
listen(badge, "click", (event) => open(null, event.detail === 0));
listen(
  window,
  "pointermove",
  (event) => {
    if (!field || busy || composing) return;
    const point = { x: event.clientX, y: event.clientY },
      rect = popup.getBoundingClientRect();
    if (
      !popup.hidden &&
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom
    ) {
      clearTimeout(closeTimer);
      clearTimeout(hoverTimer);
      return;
    }
    const hit = hitRegions.find(
      (r) =>
        point.x >= r.left &&
        point.x <= r.right &&
        point.y >= r.top &&
        point.y <= r.bottom + 2,
    );
    if (hit) {
      clearTimeout(closeTimer);
      if (!popup.hidden && popupIndex === hit.index) return;
      if (hoverIndex !== hit.index) {
        clearTimeout(hoverTimer);
        hoverIndex = hit.index;
        hoverTimer = setTimeout(() => {
          if (field && !busy) open(hit.index, false, "hover");
        }, 180);
      }
    } else {
      clearTimeout(hoverTimer);
      hoverIndex = null;
      if (!popup.hidden && popupOrigin === "hover") {
        clearTimeout(closeTimer);
        closeTimer = setTimeout(closePopup, 400);
      }
    }
  },
  true,
);
listen(
  document,
  "focusin",
  (event) => {
    if (event.composedPath().includes(host)) return;
    activate(editingHost(event.composedPath()[0]));
  },
  true,
);
listen(
  document,
  "input",
  (event) => {
    const editor = editingHost(event.composedPath()[0]);
    if (editor && editor !== field) activate(editor);
    if (
      field &&
      (event.composedPath().includes(field) || field.contains(event.target))
    )
      schedule();
  },
  true,
);
listen(
  document,
  "focusout",
  () => {
    // A microtask can run between native blur and focus, while activeElement is
    // temporarily body. Wait until the complete focus transition has finished.
    setTimeout(() => {
      if (document.activeElement === host) return; // The card is editing this field.
      const next = focusedEditor();
      if (next !== field) activate(next);
    }, 0);
  },
  true,
);
listen(
  document,
  "compositionstart",
  (event) => {
    if (field && (event.target === field || field.contains(event.target))) {
      composing = true;
      clear();
    }
  },
  true,
);
listen(
  document,
  "compositionend",
  () => {
    if (composing) {
      composing = false;
      schedule();
    }
  },
  true,
);
listen(
  document,
  "pointerdown",
  (event) => {
    if (!event.composedPath().includes(host)) {
      closePopup();
      const editor = editingHost(event.composedPath()[0]);
      if (editor) activate(editor);
    }
  },
  true,
);
listen(
  document,
  "keydown",
  (event) => {
    if (event.key === "Escape" && !popup.hidden) {
      closePopup();
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
listen(document, "scroll", position, true);
listen(window, "resize", position);
listen(document, "visibilitychange", () => {
  if (document.hidden) disconnect();
  else if (enabled()) activate(focusedEditor());
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.aiConsent) {
    settings.aiConsent = changes.aiConsent.newValue;
    if (settings.aiConsent && field)
      warmTimer = setTimeout(() => warmAi(version, field), 500);
  }
  if (!["inlineEnabled", "personal"].some((key) => changes[key])) return;
  for (const key of ["inlineEnabled", "personal"])
    if (changes[key]) settings[key] = changes[key].newValue;
  if (!enabled()) disconnect();
  else if (field) {
    schedule();
  } else activate(focusedEditor());
});
chrome.storage.local.get(["inlineEnabled", "aiConsent"]).then((value) => {
  settings = value;
  if (enabled()) activate(focusedEditor());
});
setInterval(() => {
  // Rich-text editors may document.open()/write() their initial blank frame,
  // replacing the DOM and removing document listeners after our injection.
  if (!host.isConnected && document.documentElement) {
    disconnect();
    document.documentElement.append(host);
  }
  restoreListeners();
  if (!field) {
    const active = focusedEditor();
    if (active && active !== host && enabled()) activate(active);
    return;
  }
  if (!field.isConnected || !eligible(field)) {
    disconnect();
    return;
  }
  if (!composing && !busy && snapshot(field).text !== data?.text) schedule();
  else position();
}, 700);
