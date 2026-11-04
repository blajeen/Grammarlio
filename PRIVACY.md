# Privacidade / Privacy

Atualização / Updated: 2026-11-04 · v0.4.0

## Português

Grammarlio processa textos no navegador. Não exige conta e não possui servidor de revisão, telemetria, anúncios, rastreadores ou histórico de escrita.

- **Revisão:** scripts empacotados atuam em páginas e frames HTTP/HTTPS. Leem o campo em foco da página visível após pausas e conferem edições posteriores para posicionar sublinhados e recusar sugestões antigas. Não coletam a página inteira ou histórico de navegação. Na instalação tentam ativar abas HTTP/HTTPS já abertas.
- **Processamento:** mensagens internas levam texto a workers locais de Hunspell e, após ativação, WebLLM em um documento invisível (`offscreen`). Não são requisições de rede. A IA usa uma frase/seleção e até 600 caracteres vizinhos do mesmo campo. Texto, contexto, respostas e um pequeno cache temporário ficam na memória, sem histórico salvo.
- **Consentimento:** a janela inicial oferece Sim/Agora não. Antes do Sim não há download do modelo. Sim autoriza download inicial e recargas automáticas, inclusive baixar arquivos ausentes após perda do cache. Agora não mantém correções básicas e permite ativar depois pelo ícone/cartão. Desligar suspende revisão e libera a IA, preservando cache e consentimento.
- **Dados locais:** `chrome.storage.local` guarda `inlineEnabled`, `aiConsent` e palavras adicionadas explicitamente ao dicionário pessoal por idioma. Sem sincronização de conta ou lista de sites visitados. Preferências antigas de idioma/pausa por site são removidas na atualização. Apague dados pelos controles do navegador ou desinstale.
- **Modelo e rede:** dados de uma revisão fixada do Qwen3 vêm do Hugging Face e sua infraestrutura. Esses provedores recebem metadados normais de conexão, como IP e arquivos pedidos, nunca texto, contexto ou respostas. JavaScript e WASM executáveis são empacotados, sem execução de código remoto. Dados do modelo permanecem no cache conforme as regras do navegador.
- **Dicionários:** bases completas pt-BR, en-US e es-ES são incluídas e processadas sem rede.
- **Proteções:** senhas, tipos sensíveis, códigos identificados, readonly/disabled e campos opt-out são excluídos. Sites podem usar `data-grammarlio="off"` ou `data-gramm="false"` no campo/ancestral. A identificação depende da marcação do site; o controle global suspende revisão.
- **Site original:** continua sujeito à própria política, inclusive após aplicar sugestões. Links de documentação/repositório são navegação normal sujeita à política do destino.

Abra issues sem incluir textos privados, senhas ou dados pessoais.

## English

Grammarlio processes writing locally without an account, review server, analytics, ads, trackers or writing history. Packaged scripts read the focused field in a visible HTTP/HTTPS page/frame after typing pauses and check later edits. Installation also attempts to activate already-open eligible tabs. Full-page text and browsing history are not collected.

Internal messages pass text to local Hunspell/WebLLM workers in an invisible extension document; they are not network requests. AI uses one sentence/selection and up to 600 neighboring characters from the same field. Text, context, responses and temporary suggestions stay in memory, not saved history.

The first-install window asks Yes/Not now before downloading AI. Yes authorizes initial downloads and automatic reloads, including replacing files lost from browser cache. Not now keeps basic corrections, with later activation from the icon/card. The global off switch suspends review and releases AI memory, retaining cache and consent.

Local storage keeps activation, AI consent and explicitly added personal words by language. No sync or visited-site list. Obsolete language/site-pause settings are removed on update. Use browser storage controls or uninstall to remove data.

Pinned model data comes from Hugging Face/delivery hosts, which receive IP/requested-file metadata, never writing/context/responses. Executable JavaScript/WASM are packaged. Model data is cached under browser storage rules; all three dictionaries are bundled and work offline.

Passwords, identified sensitive/access-code fields, readonly/disabled and opted-out fields are excluded. Sites may opt out with `data-grammarlio="off"` or `data-gramm="false"` on a field/ancestor; detection depends on markup. The original website's policies still apply to your writing. External links are normal navigation. Exclude private text from public issues.
