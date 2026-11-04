import { analyze } from "./rules.js";
let worker,
  sequence = 0,
  queue = Promise.resolve();
const pending = new Map();
function getWorker() {
  if (worker) return worker;
  worker = new Worker(chrome.runtime.getURL("spell-worker.js"), {
    type: "module",
  });
  worker.onmessage = ({ data }) => {
    const task = pending.get(data.id);
    if (!task) return;
    pending.delete(data.id);
    data.error ? task.reject(new Error(data.error)) : task.resolve(data);
  };
  worker.onerror = () => {
    for (const task of pending.values())
      task.reject(new Error("Não foi possível carregar o dicionário local."));
    pending.clear();
    worker.terminate();
    worker = undefined;
  };
  return worker;
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    message?.target !== "grammarlio-offscreen" ||
    sender.id !== chrome.runtime.id
  )
    return;
  const operation = queue
    .then(
      () =>
        new Promise((resolve, reject) => {
          const id = ++sequence;
          pending.set(id, { resolve, reject });
          getWorker().postMessage({
            id,
            type: message.action === "check" ? "check" : "suggest",
            language: message.language,
            text: message.text,
            word: message.word,
            personal: message.personal,
          });
        }),
    )
    .then((data) => {
      if (message.action === "suggest") return data;
      const grammar = analyze(message.text, message.language);
      const spelling = data.result.filter(
        (s) => !grammar.some((g) => g.start < s.end && s.start < g.end),
      );
      return {
        result: [...grammar, ...spelling]
          .sort((a, b) => a.start - b.start)
          .slice(0, 80),
        entries: data.entries,
      };
    });
  queue = operation.catch(() => {});
  operation.then(respond, (error) =>
    respond({ error: error.message || String(error) }),
  );
  return true;
});
