// Recebe o postback da Paradise Pags e atualiza o pedido na Utmify (paid/refunded/chargeback).
// O disparo do Pixel Meta e da API de Conversões é feito pela própria Utmify —
// aqui mantemos APENAS o rastreamento Utmify para evitar eventos duplicados.
// Configure PIX_POSTBACK_URL=https://<seu-dominio>/api/public/pix/webhook no painel Vercel
// e cadastre a mesma URL no portal da Paradise (webhook).

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  let evt = req.body;
  if (typeof evt === "string") {
    try { evt = JSON.parse(evt); } catch { evt = {}; }
  }
  evt = evt || {};

  const statusMap = { approved: "paid", refunded: "refunded", chargeback: "chargeback" };
  const utmifyStatus = statusMap[evt.status];

  let utmifyResult = null;
  if (utmifyStatus) {
    const utmify = require("../../_lib/utmify");
    const catalog = require("../../_lib/catalog");
    const release = require("../../_lib/release");
    const tracking = evt.tracking || {};
    const evtTime = String(evt.timestamp || "").replace("T", " ").slice(0, 19) || null;
    const amountCents = parseInt(evt.amount, 10);
    const orderId = String(evt.external_id || evt.transaction_id || "");
    const cd = evt.customer_data;
    const desc = (cd && typeof cd === "object" && cd.description) ? String(cd.description) : "";
    let products;
    let fallbackTotal;

    if (/^TX-/.test(orderId)) {
      const express = release.hasExpress(desc, amountCents);
      products = release.buildProducts(express);
      fallbackTotal = release.totalCents(express);
    } else {
      // O pedido inicial mantém quantidade e order bumps originais.
      let quantity = 1;
      let bumpIds = [];
      if (desc) {
        const parsed = catalog.parseDescription(desc);
        quantity = parsed.quantity;
        bumpIds = parsed.bumpIds;
      }
      products = catalog.buildProducts(quantity, bumpIds);
      fallbackTotal = catalog.orderTotalCents(quantity, bumpIds);
    }

    // NUNCA envia total nulo — a Utmify recusa pedido com priceInCents nulo.
    const safeTotal = Number.isFinite(amountCents) && amountCents > 0 ? amountCents : fallbackTotal;

    try {
      utmifyResult = await utmify.sendOrder({
      orderId,
      platform: "ParadisePags",
      paymentMethod: "pix",
      status: utmifyStatus,
      createdAt: utmify.createdAtFromReference(orderId) || evtTime,
      approvedDate: evt.status === "approved" ? evtTime : null,
      refundedAt: evt.status === "refunded" ? evtTime : null,
      customer: {
        name: (evt.customer && evt.customer.name) || "",
        email: (evt.customer && evt.customer.email) || "",
        phone: (evt.customer && evt.customer.phone) || "",
        document: (evt.customer && evt.customer.document) || "",
        country: "BR",
      },
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
        totalPriceInCents: safeTotal,
        gatewayFeeInCents: 0,
        userCommissionInCents: safeTotal,
      },
      });
    } catch (e) {
      utmifyResult = { ok: false, error: String((e && e.message) || e) };
    }
  }

  res.status(200).json({ ok: true, utmify: utmifyResult });
};
