# MercadoPromo — checkout PIX (Vercel)

Loja de oferta única com checkout via PIX (Paradise Pags), pixel Meta + Conversions API e integração UTMify.

URL de produção: https://mercadopromoo.vercel.app/

## Estrutura

- `index.html` — página de vendas + checkout (front-end completo, captura UTMs e dispara InitiateCheckout)
- `api/public/cep.js` — consulta de CEP (ViaCEP)
- `api/public/pix/create.js` — cria transação PIX server-to-server (chave secreta fica só na Vercel)
- `api/public/pix/status.js` — consulta status de uma transação
- `api/public/pix/webhook.js` — recebe postback da Paradise (pagamento aprovado → Purchase no pixel + UTMify)

## Variáveis de ambiente (configurar na Vercel)

Ver `.env.example`. Todas são sensíveis e ficam somente no servidor (nunca no navegador, nunca no repo).

## Publicar na Vercel

Deploy do diretório inteiro como projeto estático + serverless functions (`vercel.json` já contém rotas e cabeçalhos).
