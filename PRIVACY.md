# Política de privacidade / Privacy policy

Última atualização / Last updated: 2026-11-04.

## Português

Grammarlio processa os textos no navegador do usuário. Não exige conta e não possui backend de revisão, telemetria, anúncios, rastreadores ou coleta de textos.

- **Texto e contexto:** permanecem na memória dos componentes locais da extensão durante o uso. Não são enviados a APIs de IA nem salvos em histórico. O site original continua sujeito à sua própria política de dados, inclusive quando você aplica alterações nele.
- **Revisão direta nos sites:** um script incluído na extensão é carregado em páginas HTTP/HTTPS e seus frames HTTP/HTTPS. Ele lê automaticamente o campo de texto em foco da página visível, após pausas na digitação, para desenhar sublinhados e sugerir correções. Também confere se esse campo mudou para reposicionar/remover marcas antigas. Não coleta o texto inteiro da página nem histórico de navegação. O conteúdo é enviado somente por mensagens internas da extensão a um worker local, executado em um documento interno invisível (`offscreen`); não é uma requisição de rede. A revisão pode ser pausada globalmente ou por site. Campos de senha, códigos de acesso identificados, tipos de entrada sensíveis e campos protegidos/somente leitura são excluídos. `data-grammarlio="off"` permite opt-out por campo.
- **Importação opcional:** importar um campo/seleção para o painel continua exigindo clicar em Importar da página. O usuário pode colar manualmente texto no painel. A revisão direta não exige abrir o painel, importar ou criar conta.
- **Preferências e palavras pessoais:** idioma, palavras que você escolhe adicionar ao dicionário pessoal, ativação da revisão direta e nomes dos sites que você explicitamente pausa são salvos em `chrome.storage.local`. A lista de sites pausados não é um histórico de páginas visitadas. É possível apagar palavras e reativar os sites no painel. Nenhum armazenamento sincronizado de conta é usado.
- **Download de IA:** ocorre após clicar no botão de ativação. Pesos, tokenizer e configuração são obtidos de uma revisão fixada no Hugging Face e sua infraestrutura de distribuição. Esses provedores recebem metadados normais de conexão, como endereço IP e arquivo solicitado; não recebem o texto a revisar. O mantenedor não opera um servidor intermediário.
- **Código executável:** JavaScript e WASM são incluídos no pacote da extensão. Não são baixados remotamente durante o uso.
- **Dicionários e cache:** as bases ortográficas pt-BR e en-US são incluídas no pacote e processadas em um worker local Hunspell/WASM. Os dados do modelo de IA ficam no cache do navegador para reutilização. É possível apagá-los pelo botão Apagar modelo baixado. Desligar IA libera a instância da memória sem apagar o cache. Desinstalar a extensão remove os dados associados à sua origem conforme o comportamento do navegador.
- **Links externos:** abrir o repositório ou os links da documentação é uma navegação normal, sujeita à política do site de destino.

Para dúvidas e problemas, abra uma issue no repositório. Não publique textos privados, senhas ou dados pessoais em issues.

## English

Grammarlio processes writing locally in your browser. No account, review backend, analytics, ads, tracking or text collection is implemented. Text and optional context remain in the panel and local worker memory, not in a saved history. The original website can still process the text you enter or apply there under its own policies.

Inline review loads a packaged content script on HTTP/HTTPS pages and HTTP/HTTPS frames. It reads the focused text field in the visible page after typing pauses, checks for later edits and renders underlines and suggestions. It does not collect the full page or browsing history. Text is passed through internal extension messages to a local WASM dictionary worker in an invisible extension document; it is not sent over the network. Pause inline review globally or for a site from the provided controls. Passwords, recognized access codes, protected/read-only fields and sensitive input types are excluded. `data-grammarlio="off"` opts a field out.

Panel import remains an explicit optional action. Inline review does not require a panel, import or account. Selected language, explicitly added personal words, the inline-review switch and hostnames you explicitly pause are stored locally; account sync is not used. Paused hostnames are not a browsing history. Personal words can be erased and paused sites resumed from the panel. Full selected Hunspell dictionary files are bundled and processed locally.

Activating AI downloads pinned model data from Hugging Face and its file delivery infrastructure. Those providers receive normal connection metadata, including your IP address and requested files, but no writing or context to analyze. Executable JavaScript and WASM are packaged with the extension. Model data is cached locally and can be deleted with the provided button. Unloading AI frees its active instance without clearing downloaded data. Uninstall behavior follows browser storage rules.

Opening external documentation or repository links is normal navigation subject to those websites' policies. Please do not include private writing or personal data in public issues.
