# MercadoPromo — checkout PIX (Vercel)

Loja de oferta única com checkout via PIX (Paradise Pags), pixel Meta + Conversions API e integração UTMify.

URL de produção: https://mercadopromoo.vercel.app/

## Estrutura

- `index.html` — página de vendas + checkout (front-end completo, captura UTMs e dispara InitiateCheckout)
- `liberacao.html` — segunda etapa após o Pix inicial: taxa de R$ 14,73 e frete expresso opcional de R$ 8,97
- `rastreio.html` — acompanhamento liberado somente após a aprovação do segundo Pix
- `api/public/cep.js` — consulta de CEP (ViaCEP)
- `api/public/pix/create.js` — cria transação PIX server-to-server (chave secreta fica só na Vercel)
- `api/public/pix/release/create.js` — valida o Pix inicial e cria a cobrança da taxa com o mesmo `productHash`
- `api/public/pix/status.js` — consulta status de uma transação
- `api/public/pix/webhook.js` — recebe postback da Paradise e registra separadamente produto, taxa e frete na UTMify

## Variáveis de ambiente (configurar na Vercel)

Ver `.env.example`. Todas são sensíveis e ficam somente no servidor (nunca no navegador, nunca no repo).

## Publicar na Vercel

Deploy do diretório inteiro como projeto estático + serverless functions (`vercel.json` já contém rotas e cabeçalhos).
