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

  if (utmifyStatus) {
    const utmify = require("../../_lib/utmify");
    const tracking = evt.tracking || {};
    const evtTime = String(evt.timestamp || "").replace("T", " ").slice(0, 19) || null;
    const amountCents = parseInt(evt.amount, 10);
    const productName = process.env.PIX_PRODUCT_NAME || "Revólver Pressão M701 Co2 Preto Full Metal 4.5mm Completo";
    utmify.sendOrder({
      orderId: String(evt.external_id || evt.transaction_id || ""),
      platform: "ParadisePags",
      paymentMethod: "pix",
      status: utmifyStatus,
      createdAt: utmify.createdAtFromReference(evt.external_id) || evtTime,
      approvedDate: evt.status === "approved" ? evtTime : null,
      refundedAt: evt.status === "refunded" ? evtTime : null,
      customer: {
        name: (evt.customer && evt.customer.name) || "",
        email: (evt.customer && evt.customer.email) || "",
        phone: (evt.customer && evt.customer.phone) || "",
        document: (evt.customer && evt.customer.document) || "",
        country: "BR",
      },
      products: [{
        id: "rev-m701-co2",
        name: productName,
        planId: null,
        planName: null,
        quantity: 1,
        priceInCents: Number.isFinite(amountCents) ? amountCents : null,
      }],
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
        totalPriceInCents: Number.isFinite(amountCents) ? amountCents : 0,
        gatewayFeeInCents: 0,
        userCommissionInCents: Number.isFinite(amountCents) ? amountCents : 0,
      },
    });
  }

  res.status(200).json({ ok: true });
};
