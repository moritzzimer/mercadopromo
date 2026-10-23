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
    const tracking = evt.tracking || {};
    const evtTime = String(evt.timestamp || "").replace("T", " ").slice(0, 19) || null;
    const amountCents = parseInt(evt.amount, 10);

    // Reconstrói o pedido exatamente como no create.js.
    // O postback da Paradise pode trazer customer_data (cópia do JSON de criação);
    // a descrição gerada por catalog.buildDescription permite recuperar qty + bumps.
    let quantity = 1;
    let bumpIds = [];
    const cd = evt.customer_data;
    const desc = (cd && typeof cd === "object" && cd.description) ? String(cd.description) : "";
    if (desc) {
      const parsed = catalog.parseDescription(desc);
      quantity = parsed.quantity;
      bumpIds = parsed.bumpIds;
    }
    const products = catalog.buildProducts(quantity, bumpIds);

    // Total: confia no amount do postback se válido; senão recalcula pelo catálogo.
    // NUNCA envia null — a Utmify recusa pedido com priceInCents nulo.
    const fallbackTotal = catalog.orderTotalCents(quantity, bumpIds);
    const safeTotal = Number.isFinite(amountCents) && amountCents > 0 ? amountCents : fallbackTotal;

    try {
      utmifyResult = await utmify.sendOrder({
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
