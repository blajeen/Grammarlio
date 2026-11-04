import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";
// The first-install choice authorizes model downloads and later cache repair.
// Without that consent, remote model fetches remain blocked.
Cache.prototype.add = async function (request) {
  try {
    const response = await self.fetch(request);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    await this.put(
      request,
      new Response(bytes, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }),
    );
  } catch (error) {
    const url = typeof request === "string" ? request : request.url;
    throw new Error(
      `Falha ao baixar ${new URL(url).pathname.split("/").pop()}: ${error.message}`,
    );
  }
};
const nativeFetch = self.fetch.bind(self);
let allowDownload = false;
self.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input.url || String(input);
  if (/^https?:/i.test(url) && !allowDownload)
    return Promise.reject(
      new Error(
        "O modelo não está totalmente no cache. Ative o download pelo botão da IA.",
      ),
    );
  return nativeFetch(input, init);
};
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (event) => {
  if (event.data?.type === "grammarlio-network-policy") {
    allowDownload = event.data.allowDownload === true;
    return;
  }
  handler.onmessage(event);
};
