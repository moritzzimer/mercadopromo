# Projeto com visual restaurado

Use esta versão: **venture-shop-vercel-ready**.

## O que foi ajustado

- Layout original para computador e celular, logo, fotos, fontes e estilos preservados em arquivos locais.
- Controles locais de galeria, menus e painéis recuperados.
- UTMify, pixels, analytics, chamadas de rastreamento, credenciais e integração antiga de Pix removidos.
- O botão de compra mantém o visual e informa que o pagamento está indisponível. Nenhum pagamento é criado e nenhum dado é enviado.
- A consulta de entrega e a busca dependiam de serviços externos; exibem uma mensagem de indisponibilidade.

## Publicar na Vercel

1. Use esta pasta como raiz do projeto.
2. Escolha o preset **Other**. Não configure comando de instalação ou build.
3. Use a raiz como pasta de saída e publique. Não há variáveis de ambiente necessárias.

O arquivo `vercel.json` inclui rotas e cabeçalhos para hospedagem estática. Referência: [configuração oficial da Vercel](https://vercel.com/docs/project-configuration/vercel-json).

Este pacote contém somente o front-end estático. Para aceitar pagamentos, será necessário integrar um backend e guardar as credenciais somente no servidor.
