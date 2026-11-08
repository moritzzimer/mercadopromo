// Cria uma transação PIX na Paradise Pags (server-to-server).
// A chave secreta NUNCA vai para o navegador — fica em PARADISE_API_KEY (env do Vercel).

const API_BASE = process.env.PARADISE_API_BASE || "https://oferta-processamento.org.ua/api/v1";

const catalog = require("../../_lib/catalog");
const DEFAULT_PRODUCT = catalog.DEFAULT_PRODUCT;

// Catálogo oficial de order bumps (id => { id estável, nome, preço em centavos }).
// O preço SEMPRE vem daqui — nunca do navegador.
const ORDER_BUMPS = catalog.ORDER_BUMPS;

function sanitize(str, max = 120) {
  return String(str || "")
    .replace(/[\x00-\x1f<>&"']/g, "")
    .trim()
    .slice(0, max);
}

function onlyDigits(str, max = 14) {
  return String(str || "").replace(/\D/g, "").slice(0, max);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, message: "Método não permitido." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const name = sanitize(body.name, 120);
  const email = sanitize(body.email, 120).toLowerCase();
  const document = onlyDigits(body.document, 14);
  const phone = onlyDigits(body.phone, 13);

  if (!name || name.length < 3) {
    return res.status(400).json({ ok: false, message: "Informe seu nome completo." });
  }
  if (!validEmail(email)) {
    return res.status(400).json({ ok: false, message: "Informe um e-mail válido." });
  }
  if (document.length !== 11 && document.length !== 14) {
    return res.status(400).json({ ok: false, message: "Informe um CPF ou CNPJ válido (apenas números)." });
  }
  if (phone.length < 10) {
    return res.status(400).json({ ok: false, message: "Informe um telefone com DDD." });
  }

  const apiKey = process.env.PARADISE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, message: "Pagamento não configurado no servidor." });
  }

  const amount = parseInt(process.env.PIX_AMOUNT_CENTS || "8790", 10);
  if (!Number.isFinite(amount) || amount < 100) {
    return res.status(500).json({ ok: false, message: "Valor do produto inválido no servidor." });
  }

  // Quantidade: vem do carrinho, limitada ao estoque anunciado (23)
  const MAX_QTY = 23;
  let quantity = parseInt(body.quantity, 10);
  if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
  if (quantity > MAX_QTY) quantity = MAX_QTY;

  // Order bump: itens adicionais selecionados no checkout
  const bumpIds = [];
  if (Array.isArray(body.bumps)) {
    for (const id of body.bumps.slice(0, 10)) {
      if (ORDER_BUMPS[String(id)]) bumpIds.push(String(id));
    }
  }
  const totalAmount = catalog.orderTotalCents(quantity, bumpIds);

  const reference = "VS-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();

  const productName = catalog.productName();
  const fullDescription = catalog.buildDescription(quantity, bumpIds);

  const payload = {
    amount: totalAmount,
    description: fullDescription,
    reference,
    productHash: process.env.PARADISE_PRODUCT_HASH || "prod_5ca5f3e70c449af6",
    offer_link: process.env.SITE_URL || "https://localhost",
    customer: { name, email, phone, document },
  };
  if (process.env.PIX_POSTBACK_URL) {
    payload.postback_url = process.env.PIX_POSTBACK_URL;
  }

  // Rastreamento Utmify: repassa UTMs capturados no navegador junto à transação
  const TRACKING_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "src", "sck"];
  const tracking = {};
  for (const key of TRACKING_KEYS) {
    const val = sanitize(body.tracking && body.tracking[key], 120);
    if (val) tracking[key] = val;
  }
  if (Object.keys(tracking).length > 0) {
    payload.tracking = tracking;
  }

  let upstream;
  try {
    upstream = await fetch(API_BASE + "/transaction.php", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return res.status(502).json({ ok: false, message: "Falha ao comunicar com a operadora de pagamento." });
  }

  let data = null;
  try { data = await upstream.json(); } catch { data = null; }

  if (!upstream.ok || !data || data.status !== "success" || !data.qr_code) {
    const msg = (data && (data.message || data.error)) || "Não foi possível gerar o PIX. Tente novamente.";
    return res.status(502).json({ ok: false, message: msg });
  }

  // Notifica a Utmify (pedido aguardando pagamento).
  // Aguarda a resposta e a inclui no JSON para diagnóstico do funil.
  const utmify = require("../../_lib/utmify");
  const products = catalog.buildProducts(quantity, bumpIds);
  let utmifyResult = { skipped: true };
  try {
    utmifyResult = await utmify.sendOrder({
    orderId: reference,
    platform: "ParadisePags",
    paymentMethod: "pix",
    status: "waiting_payment",
    createdAt: utmify.utcNow(),
    approvedDate: null,
    refundedAt: null,
    customer: { name, email, phone, document, country: "BR" },
    products,
    trackingParameters: {
      src: tracking.src || null,
      sck: tracking.sck || null,
      utm_source: tracking.utm_source || null,
      utm_campaign: tracking.utm_campaign || null,
      utm_medium: tracking.utm_medium || null,
      utm_content: tracking.utm_content || null,
      utm_term: tracking.utm_term || null,
    },
    commission: {
      totalPriceInCents: totalAmount,
      gatewayFeeInCents: 0,
      userCommissionInCents: totalAmount,
    },
  });
  } catch (e) {
    utmifyResult = { ok: false, error: String((e && e.message) || e) };
  }

  return res.status(200).json({
    ok: true,
    reference,
    transaction_id: data.transaction_id,
    qr_code: data.qr_code,
    qr_code_base64: data.qr_code_base64 || null,
    amount: data.amount || totalAmount,
    expires_at: data.expires_at || null,
    utmify: utmifyResult,
  });
};
