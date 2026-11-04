# Compatibilidade dos editores de notas — 0.4.1

Verificação em 2026-11-04, Windows, Chromium/Chrome for Testing 156 e Edge 156, usando a extensão real e páginas locais com texto sintético.

## Problema relatado

O usuário digitou `knowldge` em uma nota do Pipedrive no Chrome e não viu correção ao passar o mouse. A base inglesa já reconhecia a correção `knowledge`; portanto, aumentar o dicionário sozinho não resolveria a falta da interface.

Não foi possível inspecionar o editor da conta do usuário. A aba do Pipedrive não apareceu no inventário disponível e, ao tentar conferir o Chrome, o controle de navegador encerrou a sessão porque não conseguiu confirmar a URL com segurança. **Não afirmamos que o Pipedrive real foi validado.**

## Falhas reproduzidas e correções

Um exemplo com editor em iframe srcdoc não recebia sublinhados na 0.4.0. A nova versão usa a opção oficial de frames relacionados do Chromium e valida remetente/origem fornecidos pelo navegador. Somente subframes about:blank/srcdoc/blob com origem HTTP/HTTPS validada são aceitos; origens opacas são recusadas. [Documentação oficial](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#inject-in-to-related-frames).

Também foram reproduzidas perda da interface/listeners após recriação do documento e bloqueio de cliques pelo diálogo modal nativo. A extensão agora restaura listeners de forma idempotente, recupera o overlay após document.open/write, acompanha campos que ficam editáveis após foco e mantém o cartão dentro do diálogo do editor.

## Sete cenários com hover e aceite

1. Texto rico com palavra dentro de strong: `Test knowldge now.` → `Test knowledge now.`, preservando negrito e texto vizinho.
2. Iframe srcdoc com body contenteditable e site em português.
3. Iframe about:blank com document.designMode.
4. document.open/write depois de a extensão já estar presente, incluindo recuperação do botão do campo.
5. Campo que vira contenteditable depois de receber foco, sem novo focusin.
6. Campo em Shadow DOM aberto.
7. Campo dentro de diálogo modal nativo.

Todos usam o movimento real do mouse sobre a palavra e clique na sugestão `knowledge`. Não há clique forçado, chamada direta ao corretor para aplicar texto ou download de IA. Os testes registram zero requisições externas e zero erros de página.

Evidências: [Chromium](editor-evidence-chromium.json), [Edge](editor-evidence-edge.json). Rode `npm run test:editors` ou `node scripts/editor-test.mjs --browser=msedge`.

## Vocabulário

A base anterior de inglês foi preservada e complementada com o en_US-large oficial ESDB/SCOWL 2026.02.25: 76.958 entradas adicionais de origem, resultando em **80.701 grafias-base distintas na união**, mais flexões. Não são 76.958 palavras inéditas: as listas têm sobreposição. Exemplos antes ausentes e agora aceitos: cybersecurity, astrophotography, neurodiversity, observability. `knowldge` continua incorreto e `knowledge` é a primeira opção. Se o idioma do trecho não oferece alternativa, tenta as outras bases já carregadas.

Arquivos e licenças permanecem integrais; hashes são verificados no build. Português mantém 312.368 entradas-base e espanhol 57.344. Como o próprio projeto [ESDB/SCOWL explica](https://wordlist.aspell.net/hunspell-readme/), a base maior aceita palavras raras que também podem parecer erros de palavras comuns. Não é um dicionário de toda palavra existente nem garantia de precisão universal.

## Conferir no Pipedrive

Atualize para 0.4.1, recarregue a extensão em chrome://extensions e recarregue a aba do Pipedrive. Digite `knowldge` em uma nota de teste e aguarde o sublinhado; passe o mouse e confira `knowledge`. Não precisa ativar a IA para isso. A verificação final na conta real continua pendente; tipos de editor semelhantes foram validados, não todas as versões ou configurações do Pipedrive.
