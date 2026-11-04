chrome.runtime.onInstalled.addListener(async (details) => {
  const { aiConsent } = await chrome.storage.local.get("aiConsent");
  await chrome.storage.local.remove([
    "language",
    "disabledSites",
    "inlineAiEnabled",
  ]);
  if (details.reason === "install") {
    const tabs = await chrome.tabs.query({
      url: ["http://*/*", "https://*/*"],
    });
    await Promise.allSettled(
      tabs
        .filter((tab) => tab.id)
        .map((tab) =>
          chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            files: ["inline.js"],
          }),
        ),
    );
  }
  if (
    details.reason === "install" ||
    (details.reason === "update" && aiConsent === undefined)
  )
    chrome.windows
      .create({
        url: chrome.runtime.getURL("welcome.html"),
        type: "popup",
        width: 450,
        height: 580,
      })
      .catch(console.error);
});

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
  const panel =
    sender.id === chrome.runtime.id &&
    ["popup.html", "welcome.html"].some(
      (path) => sender.url === chrome.runtime.getURL(path),
    );
  if (
    message?.target !== "grammarlio-background" ||
    (!panel && (!sender.tab || !/^https?:/.test(sender.url || "")))
  )
    return;
  (async () => {
    const settings = await chrome.storage.local.get([
      "inlineEnabled",
      "personal",
      "aiConsent",
    ]);
    if (!panel && settings.inlineEnabled === false) return { disabled: true };
    const language = ["pt-BR", "en-US", "es-ES", "auto"].includes(
      message.language,
    )
      ? message.language
      : "pt-BR";
    const personal = Array.isArray(settings.personal?.[language])
      ? settings.personal[language]
          .filter((w) => typeof w === "string")
          .slice(0, 5000)
      : [];
    if (message.action === "open-welcome") {
      await chrome.windows.create({
        url: chrome.runtime.getURL("welcome.html"),
        type: "popup",
        width: 450,
        height: 580,
      });
      return { ok: true };
    }
    if (panel && message.action === "ai-consent") {
      await chrome.storage.local.set({ aiConsent: message.accepted === true });
      return { ok: true };
    }
    if (message.action?.startsWith("ai-")) {
      if (
        ![
          "ai-status",
          "ai-load",
          "ai-rewrite",
          "ai-cancel",
          "ai-unload",
          "ai-delete",
          "ai-off",
        ].includes(message.action)
      )
        throw new Error("Ação de IA inválida.");
      if (
        message.action === "ai-rewrite" &&
        (typeof message.text !== "string" ||
          message.text.length > 3000 ||
          typeof (message.context || "") !== "string" ||
          (message.context || "").length > 600 ||
          !["correct", "clear", "short", "formal"].includes(message.mode))
      )
        throw new Error("Frase ou objetivo inválido.");
      if (message.action === "ai-load" || message.action === "ai-rewrite") {
        if (settings.aiConsent !== true)
          throw new Error(
            "Ative a IA na janela inicial para autorizar o download local.",
          );
      }
      await ensureOffscreen();
      const jobId =
        typeof message.jobId === "string" &&
        /^[a-zA-Z0-9_-]{1,64}$/.test(message.jobId)
          ? message.jobId
          : "default";
      const result = await chrome.runtime.sendMessage({
        target: "grammarlio-offscreen",
        action: message.action,
        language,
        text: message.text,
        mode: message.mode,
        context: message.context || "",
        allowDownload: message.allowDownload === true,
        owner: `${sender.tab?.id ?? "panel"}:${sender.frameId ?? 0}:${sender.documentId || sender.url}:${jobId}`,
      });
      return message.action === "ai-status"
        ? {
            ...result,
            enabled: settings.aiConsent === true,
            consent: settings.aiConsent === true,
          }
        : result;
    }
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
      personalByLanguage: settings.personal || {},
      hint: ["pt-BR", "en-US", "es-ES"].includes(message.hint)
        ? message.hint
        : "pt-BR",
      text: message.text,
      word: message.word,
    });
  })().then(respond, (error) =>
    respond({ error: error.message || String(error) }),
  );
  return true;
});
