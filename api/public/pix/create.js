// Cria uma transação PIX na Paradise Pags (server-to-server).
// A chave secreta NUNCA vai para o navegador — fica em PARADISE_API_KEY (env do Vercel).

const API_BASE = process.env.PARADISE_API_BASE || "https://oferta-processamento.org.ua/api/v1";

const DEFAULT_PRODUCT = "Revólver Pressão M701 Co2 Preto Full Metal 4.5mm Completo";

// Catálogo oficial de order bumps (id => preço em centavos). O cliente envia os ids;
// o preço SEMPRE vem daqui — nunca do navegador.
const ORDER_BUMPS = {
  "chumbinhos-500": { name: "Kit 500 Chumbinhos 4.5mm Diabolo", priceCents: 2990 },
  "co2-5caps": { name: "Kit 5 Cápsulas CO2 12g", priceCents: 3990 },
  "coldre": { name: "Coldre Tático Universal", priceCents: 3490 },
  "oleo-silicone": { name: "Óleo Lubrificante de Silicone para Airgun", priceCents: 1990 },
  "alvos-50": { name: "Kit 50 Alvos de Papel + Suporte", priceCents: 1490 },
};

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

  // Order bump: itens adicionais selecionados no checkout
  const selectedBumps = [];
  if (Array.isArray(body.bumps)) {
    for (const id of body.bumps.slice(0, 10)) {
      const bump = ORDER_BUMPS[String(id)];
      if (bump) selectedBumps.push(bump);
    }
  }
  const bumpsTotal = selectedBumps.reduce((sum, b) => sum + b.priceCents, 0);
  const totalAmount = amount + bumpsTotal;

  const reference = "VS-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();

  const productName = process.env.PIX_PRODUCT_NAME || DEFAULT_PRODUCT;
  const fullDescription = selectedBumps.length
    ? productName + " + " + selectedBumps.map((b) => b.name).join(" + ")
    : productName;

  const payload = {
    amount: totalAmount,
    description: fullDescription,
    reference,
    source: "api_externa",
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

  // Notifica a Utmify (pedido aguardando pagamento) — não bloqueia a resposta ao cliente
  const utmify = require("../../_lib/utmify");
  const products = [{
    id: "rev-m701-co2",
    name: productName,
    planId: null,
    planName: null,
    quantity: 1,
    priceInCents: amount,
  }].concat(selectedBumps.map((b) => ({
    id: null,
    name: b.name,
    planId: null,
    planName: null,
    quantity: 1,
    priceInCents: b.priceCents,
  })));
  utmify.sendOrder({
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

  return res.status(200).json({
    ok: true,
    reference,
    transaction_id: data.transaction_id,
    qr_code: data.qr_code,
    qr_code_base64: data.qr_code_base64 || null,
    amount: data.amount || totalAmount,
    expires_at: data.expires_at || null,
  });
};
