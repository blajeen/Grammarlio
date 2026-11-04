const enabled = document.getElementById("enabled"),
  status = document.getElementById("status"),
  ai = document.getElementById("ai-status"),
  activate = document.getElementById("activate");
async function request(action, args = {}) {
  const result = await chrome.runtime.sendMessage({
    target: "grammarlio-background",
    action,
    ...args,
  });
  if (result?.error) throw new Error(result.error);
  return result;
}
chrome.storage.local.get("inlineEnabled").then((settings) => {
  enabled.checked = settings.inlineEnabled !== false;
  status.textContent = enabled.checked
    ? "Ativo. Passe o mouse sobre um erro."
    : "Desligado nos sites.";
});
enabled.onchange = async () => {
  await chrome.storage.local.set({ inlineEnabled: enabled.checked });
  status.textContent = enabled.checked
    ? "Ativo. Passe o mouse sobre um erro."
    : "Desligado nos sites.";
  if (!enabled.checked) await request("ai-off").catch(() => {});
  else update();
};
activate.onclick = () => request("open-welcome");
async function update() {
  try {
    const state = await request("ai-status");
    ai.textContent = !enabled.checked
      ? "A revisão está pausada."
      : state.phase === "loading"
        ? "Preparando IA local…"
        : state.ready
          ? "IA local pronta."
          : state.phase === "error"
            ? "IA indisponível neste dispositivo; correções básicas ativas."
            : state.consent
              ? "A IA será carregada automaticamente no próximo uso."
              : "Reescrita com IA ainda não ativada.";
    activate.hidden = state.consent && state.phase !== "error";
  } catch {
    ai.textContent = "As correções básicas estão disponíveis.";
  }
}
update();
setInterval(update, 1200);
