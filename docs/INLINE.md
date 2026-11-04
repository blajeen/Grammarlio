# Revisão nos campos — v0.4

Instale, responda à oferta inicial de IA e escreva. Sem importação, painel de edição ou escolha de idioma. Dicionários/regras já vêm ativos; a IA é preparada após Sim e carrega automaticamente nos próximos usos. O popup contém um controle global e estado/ativação da IA.

Passe o mouse sobre a palavra sublinhada para abrir o cartão. Correções básicas oferecem alternativas; a IA reescreve a frase com contexto próximo do mesmo campo. Também pode propor estilo sem erro ortográfico. Só aceitar altera o texto. Ignore/adicionar palavra, Ctrl+Alt+G e Esc continuam disponíveis.

## Arquitetura

- `inline.js`/`inline.css`: foco, debounce, hover com tolerância de saída, cartões e overlay isolado em Shadow DOM. Espelho tipográfico para input/textarea e ranges reais em contenteditable, sem spans no conteúdo. IME suspende análise até terminar.
- `inline-dom.js`: elegibilidade, serialização/offsets Unicode e edição nativa conservadora para preservar eventos, desfazer e formatação. Confere todo o texto antes de aplicar e recusa resultados antigos.
- `language.js`/`spell-worker.js`: detecção por frase usando palavras frequentes e cobertura das três bases Hunspell. Língua do site apenas desempata. Texto curto ou ambíguo pode ser mal classificado. `rules.js` fornece regras originais limitadas.
- `background.js`: valida remetentes, limites, ativação e consentimento; mantém um documento offscreen compartilhado. Na instalação oferece IA e tenta ativar abas HTTP/HTTPS já abertas. Uma proteção impede inicialização duplicada do script.
- `offscreen.js`: compartilha worker de dicionários e serviço de IA. Usa apenas `chrome.runtime` das APIs de extensão. Dicionários têm fila; IA permite consultar progresso enquanto carrega/gera.
- `ai-service.js`/`inline-ai-worker.js`: uma instância WebLLM/WebGPU compartilhada, download autorizado, progresso, cancelamento, geração única e recarga do cache. Desligar termina o worker e cancela operações pendentes. Runtime WASM é local. Respostas são materializadas antes de gravar no cache, evitando a falha de streaming observada em uma instalação nova no worker da extensão.
- `rewrite-target.js`/`inline-ai.js`: isolam frase/seleção e até 600 caracteres de contexto do mesmo campo, geram automaticamente, mostram e aplicam apenas após aceite. Cache temporário limitado no campo; resultados de outro texto/foco não são aplicados.
- `welcome.js`/`popup.js`: oferta imediata Sim/Agora não, progresso/erro e controle global mínimo. Preferências persistentes: `aiConsent`, `inlineEnabled`, `personal`. Pesos ficam no cache.

## Limites e exclusões

12.000 caracteres por campo, até 80 achados, frase/seleção de até 3.000 para IA e até 600 de contexto vizinho. Sem corte silencioso. O modelo pode alterar sentido; estilo é apresentado como alternativa, não erro certo.

Inputs de texto/busca, textarea e contenteditable comuns, inclusive frames HTTP/HTTPS. Só o campo em foco em página visível é revisado. Sem garantia para canvas/Google Docs, estruturas próprias, Shadow DOM fechado, CSS transformado ou camada superior nativa.

Senha, tipos sensíveis, códigos identificados, readonly/disabled, aria-readonly/aria-disabled e regiões inert/ocultas são excluídos. Sites podem usar `data-grammarlio="off"` ou `data-gramm="false"` no campo/ancestral. A identificação depende do site. O controle global suspende tudo. Atualizações manuais exigem recarregar abas existentes.

Veja [testes](TESTING.md), [resultados](VALIDATION.md) e [privacidade](../PRIVACY.md).
