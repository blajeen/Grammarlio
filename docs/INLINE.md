# Revisão diretamente nos campos

A versão 0.3 adiciona sublinhados e correções sem importar texto para o painel. O script de conteúdo é incluído em páginas e frames HTTP/HTTPS, mas só revisa o campo em foco de uma página visível. Não exige conta, GPU, download de modelo ou servidor. Os dicionários são os mesmos arquivos completos da extensão.

## Uso

1. Instale/atualize a extensão, aceite o acesso aos sites se o navegador solicitar e recarregue as abas existentes.
2. Clique em um campo de texto e escreva. Após uma pausa, as sugestões aparecem sublinhadas. Vermelho identifica ortografia/pontuação; roxo identifica regras gramaticais.
3. Clique no sublinhado para escolher uma alternativa, ignorar a palavra ou adicioná-la ao dicionário pessoal. A alteração só ocorre após aceitar.
4. Use o botão ✦/contagem para listar sugestões e selecionar pt-BR/en-US. Ctrl+Alt+G abre a lista; Esc fecha.
5. Para pausar apenas esse site, use Pausar neste site. No painel, use Reativar nos sites pausados ou desligue o controle global.

## Funcionamento

- `src/inline.js`: interface isolada em Shadow DOM, foco, debounce, composição IME, posições e ações. O overlay desenha sublinhados sem inserir spans no conteúdo original do editor. Para inputs/textarea, usa um espelho invisível com medidas tipográficas; em contenteditable, mede ranges reais.
- `src/inline-dom.js`: elegibilidade, serialização de parágrafos, offsets e aplicação conservadora. Confere novamente o texto inteiro antes de editar, para recusar sugestões antigas. Usa edição nativa de Chromium para preservar input/undo e não substitui innerHTML.
- `src/background.js`: valida mensagens, permissões lógicas de pausa, limites e palavras pessoais. Garante uma instância do documento interno invisível.
- `src/offscreen.js`: organiza uma fila para um worker de dicionário compartilhado pela revisão direta. Isso mantém WASM e carregamento de dicionários fora da página e funciona sem painel aberto. O documento usa somente `chrome.runtime`, conforme as restrições da API offscreen.
- `src/spell-worker.js`: Hunspell/WASM local, com os arquivos `.aff` e `.dic` incluídos. Gramática vem de `src/rules.js`. Não há chamada de rede para revisão.

As configurações `inlineEnabled`, `disabledSites`, `language` e `personal` são armazenadas localmente. `disabledSites` contém somente hostnames explicitamente pausados, não URLs ou histórico de navegação. Texto fica em memória durante a análise. A reescrita contextual por IA continua separada no painel.

## Limites e opt-out

Até 12.000 caracteres por campo, com até 80 achados por análise. Campos maiores exibem uma indicação, sem truncar silenciosamente. Foco em inputs de texto/busca, textarea e contenteditable comuns. A extensão não promete integração universal com frameworks, canvas/Google Docs, Shadow DOM fechado, CSS transformado ou interfaces na camada superior nativa do navegador.

Campos de senha, tipos sensíveis, códigos identificados, readonly/disabled, aria-readonly/aria-disabled e campos em regiões inert/ocultas são excluídos. Sites podem usar `data-grammarlio="off"` ou `data-gramm="false"` em um campo/ancestral. A proteção depende de como o site identifica seus campos; o usuário também pode pausar a revisão.

Testes: `npm run test:inline` ou `node scripts/inline-test.mjs --browser=msedge`. Os testes usam páginas de exemplo locais e perfis de navegador isolados, nunca a sessão normal do usuário. Veja VALIDATION.md e os arquivos de evidência para os resultados reais.
