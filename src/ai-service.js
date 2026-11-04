import {
  CreateWebWorkerMLCEngine,
  hasModelInCache,
  deleteModelAllInfoInCache,
} from "@mlc-ai/web-llm";
import { analyze, applySuggestion, MAX_TEXT } from "./rules.js";
import { rewriteMessages } from "./prompt.js";
import model from "../model-lock.json";

const appConfig = {
  model_list: [
    { ...model.record, model_lib: chrome.runtime.getURL("model.wasm") },
  ],
  cacheBackend: "cache",
};
let engine,
  worker,
  loading,
  owner,
  cancelled = false,
  cacheKnown,
  abortLoad,
  abortGeneration,
  epoch = 0;
const state = {
  phase: "idle",
  progress: 0,
  message: "Ative a IA local para baixar ou carregar o modelo.",
  error: "",
};
function destroy() {
  worker?.terminate();
  engine = undefined;
  worker = undefined;
}
async function status() {
  if (cacheKnown === undefined)
    cacheKnown = await hasModelInCache(model.record.model_id, appConfig);
  return {
    ...state,
    ready: Boolean(engine) && state.phase !== "loading",
    cached: cacheKnown,
  };
}
async function load(allowDownload) {
  if (engine) return status();
  if (loading) return loading;
  const version = epoch;
  const operation = (async () => {
    if (!allowDownload && !(await status()).cached)
      throw new Error("Baixe o modelo uma vez para ativar a reescrita local.");
    Object.assign(state, {
      phase: "loading",
      progress: 0,
      error: "",
      message: "Preparando a IA neste dispositivo…",
    });
    try {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: "high-performance",
      });
      if (!adapter)
        throw new Error(
          "WebGPU indisponível. Ative a aceleração gráfica e use um navegador atualizado.",
        );
      const device = await adapter.requestDevice();
      device.destroy();
      if (epoch !== version) throw new Error("IA desligada.");
      worker = new Worker(chrome.runtime.getURL("inline-ai-worker.js"), {
        type: "module",
      });
      worker.postMessage({ type: "grammarlio-network-policy", allowDownload });
      const abort = new Promise((_, reject) => {
        abortLoad = reject;
      });
      engine = await Promise.race([
        CreateWebWorkerMLCEngine(worker, model.record.model_id, {
          appConfig,
          initProgressCallback: (p) => {
            if (epoch === version)
              Object.assign(state, {
                progress: p.progress,
                message: `Preparando IA local · ${Math.min(100, Math.round(p.progress * 100))}%`,
              });
          },
        }),
        abort,
      ]);
      cacheKnown = true;
      Object.assign(state, {
        phase: "ready",
        progress: 1,
        message: "IA pronta. Tudo é gerado neste navegador.",
        error: "",
      });
      return status();
    } catch (error) {
      if (epoch === version) {
        destroy();
        Object.assign(state, {
          phase: "error",
          message: "Não foi possível carregar a IA.",
          error: error.message || String(error),
        });
      }
      throw error;
    }
  })();
  loading = operation;
  try {
    return await operation;
  } finally {
    if (loading === operation) {
      loading = undefined;
      abortLoad = undefined;
    }
  }
}
export async function aiAction(message) {
  if (message.action === "ai-off") {
    epoch++;
    abortLoad?.(new Error("IA desligada."));
    abortGeneration?.(new Error("IA desligada."));
    destroy();
    loading = undefined;
    owner = undefined;
    Object.assign(state, {
      phase: "idle",
      progress: 0,
      error: "",
      message: "IA desligada.",
    });
    return { ok: true };
  }
  if (message.action === "ai-status") return status();
  if (message.action === "ai-load") return load(message.allowDownload === true);
  if (message.action === "ai-cancel") {
    if (message.owner === owner) {
      cancelled = true;
      engine?.interruptGenerate();
    }
    return { ok: true };
  }
  if (message.action === "ai-unload" || message.action === "ai-delete") {
    if (loading)
      throw new Error("Aguarde o carregamento antes de desligar a IA.");
    if (state.phase === "generating")
      throw new Error("Pare a geração antes de desligar a IA.");
    try {
      await engine?.unload();
    } finally {
      destroy();
    }
    Object.assign(state, {
      phase: "idle",
      message: "IA desligada.",
      progress: 0,
      error: "",
    });
    if (message.action === "ai-delete") {
      await deleteModelAllInfoInCache(model.record.model_id, appConfig);
      cacheKnown = false;
    }
    return { ok: true };
  }
  if (message.action !== "ai-rewrite") throw new Error("Ação de IA inválida.");
  if (!engine || state.phase === "loading")
    throw new Error("Carregue a IA primeiro.");
  if (state.phase === "generating") return { busy: true };
  if (
    typeof message.text !== "string" ||
    !message.text.trim() ||
    message.text.length > MAX_TEXT
  )
    throw new Error("Selecione uma frase de até 3.000 caracteres.");
  if (!["correct", "clear", "short", "formal"].includes(message.mode))
    throw new Error("Objetivo inválido.");
  cancelled = false;
  owner = message.owner;
  state.phase = "generating";
  state.message = "Reescrevendo neste dispositivo…";
  const version = epoch;
  try {
    const prepared = analyze(message.text, message.language)
      .sort((a, b) => b.start - a.start)
      .reduce(
        (value, suggestion) => applySuggestion(value, suggestion),
        message.text,
      );
    const abort = new Promise((_, reject) => {
      abortGeneration = reject;
    });
    const reply = await Promise.race([
      engine.chat.completions.create({
        messages: rewriteMessages(
          prepared,
          message.language,
          message.mode,
          message.context || "",
        ),
        temperature: 0,
        max_tokens: 1800,
        extra_body: { enable_thinking: false },
      }),
      abort,
    ]);
    if (cancelled) throw new Error("Geração interrompida.");
    if (reply.choices[0]?.finish_reason === "length")
      throw new Error("A resposta atingiu o limite. Tente uma frase menor.");
    const text = reply.choices[0]?.message?.content
      ?.replace(/<think>[\s\S]*?<\/think>/g, "")
      .trim();
    if (!text || text.length > MAX_TEXT)
      throw new Error(
        "A IA não retornou uma sugestão válida. Tente uma frase menor.",
      );
    return { text };
  } catch (error) {
    if (
      epoch === version &&
      /disposed|device.*lost|out of memory/i.test(
        error.message || String(error),
      )
    ) {
      destroy();
      state.error =
        "A GPU perdeu a sessão. Feche abas pesadas e carregue a IA novamente.";
    }
    throw error;
  } finally {
    if (epoch === version) {
      owner = undefined;
      abortGeneration = undefined;
      state.phase = engine ? "ready" : "error";
      state.message = engine ? "IA pronta." : state.error;
    }
  }
}
