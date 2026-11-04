const status = document.getElementById("status"),
  choice = document.getElementById("choice"),
  progress = document.getElementById("progress"),
  finish = document.getElementById("finish");
async function request(action, args = {}) {
  const result = await chrome.runtime.sendMessage({
    target: "grammarlio-background",
    action,
    ...args,
  });
  if (!result || result.error)
    throw new Error(
      result?.error || "Recarregue a extensão e tente novamente.",
    );
  return result;
}
document.getElementById("no").onclick = async () => {
  await request("ai-consent", { accepted: false });
  await request("ai-off");
  choice.hidden = true;
  status.textContent =
    "Tudo certo. As correções básicas já funcionam nos três idiomas. A IA pode ser ativada depois pelo ícone da extensão.";
  finish.hidden = false;
};
finish.onclick = () => window.close();
document.getElementById("yes").onclick = async () => {
  choice.hidden = true;
  progress.hidden = false;
  status.textContent = "Preparando a IA neste navegador…";
  let timer;
  try {
    await chrome.storage.local.set({ inlineEnabled: true });
    await request("ai-consent", { accepted: true });
    timer = setInterval(
      () =>
        request("ai-status")
          .then((state) => {
            progress.value = state.progress || 0;
            status.textContent = state.message;
          })
          .catch(() => {}),
      700,
    );
    await request("ai-load", { allowDownload: true });
    status.textContent =
      "Pronto! Escreva em qualquer campo compatível e passe o mouse sobre o erro para ver a reescrita.";
    finish.hidden = false;
  } catch (error) {
    status.textContent = `Não foi possível ativar a IA: ${error.message} As correções básicas continuam funcionando.`;
    choice.hidden = false;
    finish.hidden = false;
  } finally {
    clearInterval(timer);
    progress.hidden = true;
  }
};
