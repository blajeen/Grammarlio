chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

let creating;
async function ensureOffscreen() {
  if (creating) return creating;
  creating = (async () => {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL("offscreen.html")],
    });
    if (!contexts.length)
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["WORKERS"],
        justification:
          "Run the packaged offline spelling worker for text fields, without opening a panel or sending text to a server.",
      });
  })();
  try {
    await creating;
  } finally {
    creating = undefined;
  }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    message?.target !== "grammarlio-background" ||
    !sender.tab ||
    !/^https?:/.test(sender.url || "")
  )
    return;
  (async () => {
    const settings = await chrome.storage.local.get([
      "inlineEnabled",
      "disabledSites",
      "language",
      "personal",
    ]);
    const hostname = new URL(sender.url).hostname;
    if (
      settings.inlineEnabled === false ||
      settings.disabledSites?.includes(hostname)
    )
      return { disabled: true };
    const language = ["pt-BR", "en-US"].includes(message.language)
      ? message.language
      : settings.language || "pt-BR";
    const personal = Array.isArray(settings.personal?.[language])
      ? settings.personal[language]
          .filter((w) => typeof w === "string")
          .slice(0, 5000)
      : [];
    if (message.action === "add-word") {
      if (
        typeof message.word !== "string" ||
        !/^[\p{L}\p{M}'’-]{2,100}$/u.test(message.word)
      )
        throw new Error("Palavra inválida.");
      if (personal.length >= 5000)
        throw new Error("Seu dicionário pessoal chegou a 5.000 palavras.");
      await chrome.storage.local.set({
        personal: {
          ...settings.personal,
          [language]: [
            ...new Set([...personal, message.word.normalize("NFC")]),
          ],
        },
      });
      return { ok: true };
    }
    if (!["check", "suggest"].includes(message.action))
      throw new Error("Ação inválida.");
    if (
      message.action === "check" &&
      (typeof message.text !== "string" || message.text.length > 12000)
    )
      throw new Error(
        "A revisão direta aceita campos de até 12.000 caracteres.",
      );
    if (
      message.action === "suggest" &&
      (typeof message.word !== "string" || message.word.length > 40)
    )
      return { result: [] };
    await ensureOffscreen();
    return await chrome.runtime.sendMessage({
      target: "grammarlio-offscreen",
      action: message.action,
      language,
      personal,
      text: message.text,
      word: message.word,
    });
  })().then(respond, (error) =>
    respond({ error: error.message || String(error) }),
  );
  return true;
});
