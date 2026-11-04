export const rewriteCacheKey = (language, target) =>
  JSON.stringify([language, "clear", target?.original, target?.context]);
export function attachInlineAi({
  parent,
  target,
  language,
  request,
  isCurrent,
  accept,
  position,
  cache,
}) {
  const make = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  const section = make("section", undefined, "inline-ai");
  parent.append(section);
  const status = make("p", "Preparando a reescrita local…", "ai-status");
  status.setAttribute("role", "status");
  const progress = make("progress");
  progress.max = 1;
  progress.hidden = true;
  const output = make("p", "", "ai-output");
  output.hidden = true;
  const use = make("button", "Usar esta versão", "ai-accept option");
  use.type = "button";
  use.hidden = true;
  const activate = make("button", "Ativar IA", "ai-load link");
  activate.type = "button";
  activate.hidden = true;
  const cancel = make("button", "Parar", "ai-cancel link");
  cancel.type = "button";
  cancel.hidden = true;
  section.append(
    make("h4", "✦ Reescrita com IA"),
    status,
    progress,
    output,
    use,
    activate,
    cancel,
  );
  let disposed = false,
    running = false,
    loading = false,
    attempted = false,
    loadAttempted = false,
    result,
    jobId;
  const live = () => !disposed && isCurrent();
  function show(text) {
    result = text;
    output.textContent = text;
    output.hidden = false;
    use.hidden = false;
    status.textContent = "Revise antes de aceitar.";
    position();
  }
  async function generate() {
    if (!live() || !target || running || loading) return;
    const key = rewriteCacheKey(language, target),
      saved = cache.get(key);
    if (saved) {
      show(saved);
      attempted = true;
      return;
    }
    attempted = true;
    running = true;
    cancel.hidden = false;
    jobId =
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    status.textContent = "Reescrevendo neste navegador…";
    position();
    try {
      const response = await request("ai-rewrite", {
        text: target.original,
        context: target.context,
        language,
        mode: "clear",
        jobId,
      });
      if (!live()) return;
      if (response.busy) {
        attempted = false;
        status.textContent = "Concluindo outra revisão…";
        return;
      }
      cache.set(key, response.text);
      if (cache.size > 8) cache.delete(cache.keys().next().value);
      show(response.text);
    } catch (error) {
      if (live()) status.textContent = error.message;
    } finally {
      running = false;
      if (live()) {
        cancel.hidden = true;
        position();
      }
    }
  }
  async function load() {
    if (loading || !live()) return;
    loadAttempted = true;
    loading = true;
    progress.hidden = false;
    status.textContent = "Carregando a IA local…";
    position();
    try {
      await request("ai-load", { allowDownload: true });
      if (live()) {
        loading = false;
        await tick();
      }
    } catch (error) {
      if (live()) {
        status.textContent = error.message;
        activate.hidden = false;
        activate.textContent = "Ver ativação da IA";
      }
    } finally {
      loading = false;
    }
  }
  async function tick() {
    if (!live()) return;
    try {
      const state = await request("ai-status");
      if (!live()) return;
      if (!state.consent) {
        status.textContent =
          "Ative a IA na janela inicial para receber reescritas aqui.";
        activate.hidden = false;
        progress.hidden = true;
        position();
        return;
      }
      activate.hidden = true;
      if (!target) {
        status.textContent =
          "Esta frase é muito longa para a IA. Use um trecho de até 3.000 caracteres.";
        position();
        return;
      }
      if (state.phase === "loading") {
        progress.hidden = false;
        progress.value = state.progress || 0;
        status.textContent = state.message;
        position();
        return;
      }
      progress.hidden = true;
      if (state.ready) {
        if (!running && !attempted && state.phase === "ready") await generate();
        else if (!running && !result && !attempted)
          status.textContent = "Concluindo outra revisão…";
      } else if (state.phase === "idle" && !loadAttempted) await load();
      else if (state.phase === "error") {
        status.textContent =
          state.error || "A IA não está disponível neste dispositivo.";
        activate.hidden = false;
        activate.textContent = "Ver ativação da IA";
      }
      position();
    } catch (error) {
      if (live()) status.textContent = error.message;
    }
  }
  activate.onclick = () =>
    request("open-welcome").catch((error) => {
      status.textContent = error.message;
    });
  cancel.onclick = () => request("ai-cancel", { jobId }).catch(() => {});
  use.onclick = () => {
    if (live() && result) accept(target, result);
  };
  tick();
  const interval = setInterval(tick, 900);
  return () => {
    disposed = true;
    clearInterval(interval);
    if (running) request("ai-cancel", { jobId }).catch(() => {});
  };
}
