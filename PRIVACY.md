# Política de privacidade / Privacy policy

Última atualização / Last updated: 2026-11-04.

## Português

Grammarlio processa os textos no navegador do usuário. Não exige conta e não possui backend de revisão, telemetria, anúncios, rastreadores ou coleta de textos.

- **Texto e contexto:** permanecem na memória do painel e do worker local durante o uso. Não são enviados a APIs de IA nem salvos em histórico pela extensão. O site original continua sujeito à sua própria política de dados, inclusive quando você aplica alterações nele.
- **Leitura de páginas:** ocorre somente ao clicar em Importar da página, no contexto da aba autorizada pelo usuário. Não há leitura contínua. Campos de senha e tipos de entrada sensíveis não são importados. O usuário pode colar manualmente um texto no painel.
- **Preferências:** apenas o idioma é salvo localmente em `chrome.storage.local`. Nenhum armazenamento sincronizado de conta é usado.
- **Download de IA:** ocorre após clicar no botão de ativação. Pesos, tokenizer e configuração são obtidos de uma revisão fixada no Hugging Face e sua infraestrutura de distribuição. Esses provedores recebem metadados normais de conexão, como endereço IP e arquivo solicitado; não recebem o texto a revisar. O mantenedor não opera um servidor intermediário.
- **Código executável:** JavaScript e WASM são incluídos no pacote da extensão. Não são baixados remotamente durante o uso.
- **Cache:** os dados do modelo ficam no cache local do navegador para reutilização. É possível apagá-los pelo botão Apagar modelo baixado. Desligar IA libera a instância da memória sem apagar o cache. Desinstalar a extensão remove os dados associados à sua origem conforme o comportamento do navegador.
- **Links externos:** abrir o repositório ou os links da documentação é uma navegação normal, sujeita à política do site de destino.

Para dúvidas e problemas, abra uma issue no repositório. Não publique textos privados, senhas ou dados pessoais em issues.

## English

Grammarlio processes writing locally in your browser. No account, review backend, analytics, ads, tracking or text collection is implemented. Text and optional context remain in the panel and local worker memory, not in a saved history. The original website can still process the text you enter or apply there under its own policies.

Page content is imported only upon your explicit action in a temporarily authorized tab. Password and protected input types are excluded. Only your selected language is stored in local extension storage; account sync is not used.

Activating AI downloads pinned model data from Hugging Face and its file delivery infrastructure. Those providers receive normal connection metadata, including your IP address and requested files, but no writing or context to analyze. Executable JavaScript and WASM are packaged with the extension. Model data is cached locally and can be deleted with the provided button. Unloading AI frees its active instance without clearing downloaded data. Uninstall behavior follows browser storage rules.

Opening external documentation or repository links is normal navigation subject to those websites' policies. Please do not include private writing or personal data in public issues.
