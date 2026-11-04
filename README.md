# Grammarlio ✦

**Um assistente de escrita gratuito e open source para Chrome e Edge, em português brasileiro e inglês americano. Sem conta. Sem assinatura. Processamento no navegador.**

[English guide](docs/README.en.md) · [Privacidade](PRIVACY.md) · [Contribuir](CONTRIBUTING.md)

> **Versão 0.2.0 — experimental.** Sem assinatura ou recursos pagos. Agora inclui dicionários completos das bases Hunspell selecionadas, com flexões, e IA local por GPU testada com gerações reais. Ainda não tem a cobertura ou a qualidade do Grammarly. Há limites técnicos descritos abaixo.

## Novidades da versão 0.2

- Português brasileiro: **312.368 entradas-base** VERO/LibreOffice; inglês americano: **49.568 entradas-base** SCOWL, mais flexões. Os arquivos completos `.aff` e `.dic` são incluídos na extensão e funcionam offline.
- Ortografia por Hunspell/WebAssembly, sugestões de grafia sob demanda e palavras pessoais salvas só no dispositivo. É possível apagar esse dicionário pessoal no painel.
- “Dicionário completo” significa usar as bases abertas completas; não significa conter toda palavra existente, definições, nomes ou termos técnicos. A gramática continua tendo cobertura inicial.
- IA com Qwen3 1.7B via WebLLM (~1 GB de download e ~3 GB de memória gráfica). Exige WebGPU. Não existe fallback para servidor. Uma alternativa por CPU foi avaliada e não incluída por falhar nos testes de qualidade de edição.
- A falha gráfica original foi reproduzida no Chromium antigo da automação; os navegadores Chrome e Edge instalados conseguiram criar dispositivos WebGPU. A integração recebe uma verificação real de `requestDevice`, além de detectar o adaptador.
- Geração real, testes em português/inglês e recarga offline são documentados em [docs/VALIDATION.md](docs/VALIDATION.md). Esses testes não garantem qualidade universal.

## O que já faz

- Painel lateral para revisar texto sem sair da página.
- Dicionários locais completos das bases selecionadas, além de regras gramaticais originais para alguns erros comuns em pt-BR e en-US. Sugestões são aceitas individualmente.
- IA local para corrigir, melhorar clareza, encurtar ou ajustar formalidade; contexto opcional.
- Importação do campo de texto ou trecho selecionado, somente quando você solicita.
- Aplicação em `textarea` e `input` de texto/busca, com proteção contra sobrescrever um campo que mudou desde a importação.
- Em editores ricos, importa texto para revisão e permite copiar o resultado. Não substitui o HTML nem a formatação.
- Desfazer a última alteração no editor do painel, copiar resultado, desligar IA e apagar o modelo baixado.

**Ainda não faz:** sublinhado automático em toda página, integração própria com Google Docs, edição de campos dentro de iframes/Shadow DOM, sincronização, suporte móvel ou funcionamento garantido em todos os sites. O recurso de desfazer do painel não desfaz edições já aplicadas na página.

## Instalar no Chrome ou Edge

### Opção A — download pronto

1. Abra [Releases](https://github.com/blajeen/Grammarlio/releases) e baixe `grammarlio-0.2.0.zip`.
2. Extraia o ZIP para uma pasta permanente. Não tente carregar o ZIP diretamente.
3. No Chrome, abra `chrome://extensions`. No Edge, abra `edge://extensions`.
4. Ative **Modo do desenvolvedor**.
5. Clique em **Carregar sem compactação** / **Load unpacked** e selecione a pasta extraída que contém `manifest.json`.
6. Fixe o ícone da extensão na barra do navegador e clique nele para abrir o painel.

A extensão ainda não está publicada nas lojas. Esta instalação manual é para avaliação; atualizações exigem substituir os arquivos e clicar em Recarregar na página de extensões. Somente o mantenedor precisa de conta no GitHub para publicar; usuários da extensão não precisam de conta no Grammarlio nem no GitHub para baixar uma versão pública.

### Opção B — compilar o código

Requer Node.js 22 ou superior, npm e Git.

```sh
git clone https://github.com/blajeen/Grammarlio.git
cd Grammarlio
npm ci
npm run check
```

Carregue a pasta **`dist`** seguindo os passos acima. A compilação precisa de internet para instalar dependências e obter o runtime WASM fixado em `model-lock.json`; o SHA-256 é verificado antes de gerar a extensão. O JavaScript e o WASM executáveis ficam no pacote, sem execução de código remoto.

## Usar

1. Escolha **Português · Brasil** ou **English · US** no painel.
2. Cole um texto ou use **Experimentar exemplo**.
3. Para importar de um site, clique no campo/seleção da página e depois em **Importar da página** no painel. Se não houver acesso, clique no ícone da extensão nessa página para conceder acesso temporário. Páginas internas do navegador e lojas de extensões bloqueiam a importação.
4. Revise as sugestões básicas e aceite apenas as desejadas.
5. Para reescrita, clique em **Baixar / carregar IA no navegador**, aguarde e escolha um objetivo. Acrescente o contexto que deseja compartilhar com o modelo local.
6. Confira a sugestão, clique em **Usar no editor** e depois copie ou aplique na página.

O texto da página só é lido por ação explícita. A extensão não lê campos de senha, pagamento ou códigos de acesso identificados como protegidos. Evite colar informações sensíveis manualmente em qualquer campo se não deseja processá-las.

## IA local: origem do conhecimento e requisitos

Usamos **Qwen3-1.7B**, quantizado para WebLLM (`q4f32_1`). O conhecimento linguístico vem dos pesos de um modelo previamente treinado; não há banco de frases do Grammarly, consultas à internet para revisar textos ou treinamento com textos de usuários.

- Navegador Chromium recente com WebGPU, aceleração gráfica habilitada e driver compatível. A disponibilidade depende da combinação navegador/sistema/GPU.
- O catálogo do WebLLM estima **2.6 GB de memória gráfica** para essa configuração; reserve aproximadamente 3 GB disponíveis. A memória total usada pode ser maior.
- O download inicial é da ordem de **1 GB**. O tamanho real inclui pesos, tokenizer e configuração. Use uma conexão adequada e espaço disponível em disco.
- Os dados do modelo vêm do Hugging Face e podem ser redirecionados à sua infraestrutura de arquivos. O texto do usuário não faz parte dessas requisições.
- Após o download completo, os arquivos são mantidos no cache do navegador. O navegador pode apagar o cache por falta de espaço ou configuração; nesse caso será necessário baixar novamente. O modo offline deve ser verificado no seu dispositivo.
- A IA precisa ser carregada novamente na memória ao reabrir o painel. Fechar o painel pode interromper a geração.
- Sem WebGPU, os dicionários e as regras continuam disponíveis. A IA desta versão exige GPU compatível. Não há fallback silencioso para servidor.

Textos no editor são limitados a **3.000 caracteres**, e o contexto opcional a 600, para controlar uso de memória e latência. A geração aceita até 1.800 tokens de resposta. Esses são limites técnicos, não planos pagos. Nenhum texto é cortado silenciosamente na importação. Sugestões longas/truncadas são rejeitadas. **Apagar modelo baixado** remove o cache do modelo atual.

Um modelo pequeno pode errar, alterar o sentido ou seguir instruções contidas no próprio texto. O prompt orienta preservar fatos, mas não oferece garantia. Sempre revise nomes, números e significado antes de aceitar. A qualidade em ambos os idiomas precisa de avaliação comunitária.

## Privacidade e permissões

Não há cadastro, telemetria, anúncios, servidor de revisão ou histórico de textos/contexto. O idioma e as palavras que você escolhe adicionar ao dicionário pessoal são salvos em `chrome.storage.local`; os arquivos dos modelos ficam no cache. Veja [PRIVACY.md](PRIVACY.md).

| Permissão | Motivo |
| --- | --- |
| `activeTab` | Acesso temporário à página em que você acionou a extensão |
| `scripting` | Importar um trecho e aplicar uma alteração solicitada |
| `storage` | Lembrar o idioma e as palavras pessoais localmente |
| `sidePanel` | Mostrar o editor na lateral |

Não pedimos acesso permanente a todos os sites. O código não é injetado continuamente em suas páginas.

## Desenvolvimento e validação

```sh
npm test
npm run build
npx playwright install chromium
node scripts/smoke.mjs
```

Os testes verificam regras bilíngues, flexões reais dos dicionários, sugestões de grafia, posições de edição, palavras pessoais e proteção contra sugestões antigas. O teste padrão de navegador carrega a extensão e verifica o painel, campos de teste e ausência de rede antes da IA; não baixa modelos.

Para testes reais opcionais de IA (download grande, perfil isolado em `artifacts/`):

```sh
node scripts/ai-acceptance.mjs --browser=msedge
node scripts/ai-acceptance.mjs --browser=chromium --profile=artifacts/chromium-ai-test-profile
```

O primeiro usa o Edge instalado; o segundo usa Chrome for Testing (Chromium), ambos com WebGPU. Verifique os resultados de geração, contexto e recarga offline em [docs/VALIDATION.md](docs/VALIDATION.md) e o procedimento em [docs/TESTING.md](docs/TESTING.md). Para diagnóstico gráfico sem modificar drivers: `node scripts/gpu-diagnose.mjs`.

O projeto não exige servidor. Hospedagem/distribuição de arquivos, publicação em lojas e trabalho de manutenção podem ter custos para o mantenedor.

## Próximas etapas

- Avaliar precisão e falsos positivos em corpora de pt-BR e en-US com licenças adequadas.
- Expandir regras e avaliar a cobertura dos dicionários, preservando atribuição e licenças.
- Melhorar feedback de download, recuperação de falhas e acessibilidade.
- Adicionar sugestões junto aos campos e integrações específicas com editores ricos.
- Validar o pacote e os avisos de privacidade para publicação nas lojas Chrome/Edge.

## Licença e créditos

Código do Grammarlio: [MIT](LICENSE). Modelo e componentes de terceiros preservam suas próprias licenças; veja [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Não afiliado ao Grammarly, LanguageTool, Google ou Microsoft.
