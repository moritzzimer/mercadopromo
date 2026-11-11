// Cria o segundo PIX (taxa de liberação + frete expresso opcional).
// A taxa só pode ser gerada depois que o PIX inicial estiver aprovado.

const API_BASE = process.env.PARADISE_API_BASE || "https://oferta-processamento.org.ua/api/v1";
const release = require("../../../_lib/release");
const utmify = require("../../../_lib/utmify");

function sanitize(value, max = 120) {
  return String(value || "").replace(/[\x00-\x1f<>&"']/g, "").trim().slice(0, max);
}

function onlyDigits(value, max = 14) {
  return String(value || "").replace(/\D/g, "").slice(0, max);
}

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Método não permitido." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const originalReference = sanitize(body.originalReference, 64).toUpperCase();
  if (!/^VS-\d{10,}-[A-Z0-9]{2,12}$/.test(originalReference)) {
    return res.status(400).json({ ok: false, message: "Pedido inicial inválido." });
  }

  const customer = body.customer || {};
  const name = sanitize(customer.name, 120);
  const email = sanitize(customer.email, 120).toLowerCase();
  const document = onlyDigits(customer.document, 14);
  const phone = onlyDigits(customer.phone, 13);
  if (name.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ ok: false, message: "Dados do cliente inválidos." });
  }
  if ((document.length !== 11 && document.length !== 14) || phone.length < 10) {
    return res.status(400).json({ ok: false, message: "Documento ou telefone inválido." });
  }

  const apiKey = process.env.PARADISE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, message: "Pagamento não configurado no servidor." });
  }

  let original;
  try {
    const response = await fetch(API_BASE + "/query.php?action=list_transactions&external_id=" + encodeURIComponent(originalReference), {
      headers: { "X-API-Key": apiKey },
    });
    original = await readJson(response);
    if (!response.ok || !Array.isArray(original) || !original[0]) {
      return res.status(404).json({ ok: false, message: "Pagamento inicial não encontrado." });
    }
  } catch {
    return res.status(502).json({ ok: false, message: "Não foi possível validar o pagamento inicial." });
  }
  if (original[0].status !== "approved") {
    return res.status(409).json({ ok: false, message: "O pagamento inicial ainda não foi confirmado." });
  }

  const express = body.express === true;
  const totalAmount = release.totalCents(express);
  const reference = "TX-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const description = release.buildDescription(express);
  const payload = {
    amount: totalAmount,
    description,
    reference,
    productHash: process.env.PARADISE_PRODUCT_HASH || "prod_5ca5f3e70c449af6",
    offer_link: process.env.SITE_URL || "https://localhost",
    customer: { name, email, phone, document },
  };
  if (process.env.PIX_POSTBACK_URL) payload.postback_url = process.env.PIX_POSTBACK_URL;

  const tracking = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "src", "sck"]) {
    const value = sanitize(body.tracking && body.tracking[key], 120);
    if (value) tracking[key] = value;
  }
  if (Object.keys(tracking).length) payload.tracking = tracking;

  let upstream;
  let data;
  try {
    upstream = await fetch(API_BASE + "/transaction.php", {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    data = await readJson(upstream);
  } catch {
    return res.status(502).json({ ok: false, message: "Falha ao comunicar com a operadora de pagamento." });
  }
  if (!upstream.ok || !data || data.status !== "success" || !data.qr_code) {
    return res.status(502).json({
      ok: false,
      message: (data && (data.message || data.error)) || "Não foi possível gerar o PIX da taxa.",
    });
  }

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
      products: release.buildProducts(express),
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
  } catch (error) {
    utmifyResult = { ok: false, error: String(error.message || error) };
  }

  return res.status(200).json({
    ok: true,
    reference,
    original_reference: originalReference,
    transaction_id: data.transaction_id,
    qr_code: data.qr_code,
    qr_code_base64: data.qr_code_base64 || null,
    amount: data.amount || totalAmount,
    expires_at: data.expires_at || null,
    utmify: utmifyResult,
  });
};
