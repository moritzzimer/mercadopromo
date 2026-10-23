// Catálogo oficial do funil: produto principal + order bumps.
// Compartilhado entre create.js (criação do Pix) e webhook.js (aprovação),
// garantindo que o pedido waiting_payment e o paid tenham EXATAMENTE
// os mesmos produtos/ids — a Utmify recusa pedidos com product.id nulo.

const DEFAULT_PRODUCT = "Revólver Pressão M701 Co2 Preto Full Metal 4.5mm Completo";

const MAIN_PRODUCT = { id: "rev-m701-co2" };

// id => { id estável, nome, preço em centavos }
const ORDER_BUMPS = {
  "chumbinhos-500": { id: "bump-chumbinhos-500", name: "Kit 500 Chumbinhos 4.5mm Diabolo", priceCents: 2990 },
  "co2-5caps": { id: "bump-co2-5caps", name: "Kit 5 Cápsulas CO2 12g", priceCents: 3990 },
  "coldre": { id: "bump-coldre", name: "Coldre Tático Universal", priceCents: 3490 },
  "oleo-silicone": { id: "bump-oleo-silicone", name: "Óleo Lubrificante de Silicone para Airgun", priceCents: 1990 },
  "alvos-50": { id: "bump-alvos-50", name: "Kit 50 Alvos de Papel + Suporte", priceCents: 1490 },
};

function productName() {
  return process.env.PIX_PRODUCT_NAME || DEFAULT_PRODUCT;
}

function unitCents() {
  const v = parseInt(process.env.PIX_AMOUNT_CENTS || "8790", 10);
  return Number.isFinite(v) && v > 0 ? v : 8790;
}

// Monta a lista de produtos no formato exigido pela Utmify.
function buildProducts(quantity, bumpIds) {
  const q = Math.max(1, parseInt(quantity, 10) || 1);
  const products = [{
    id: MAIN_PRODUCT.id,
    name: productName(),
    planId: null,
    planName: null,
    quantity: q,
    priceInCents: unitCents(),
  }];
  for (const id of bumpIds || []) {
    const b = ORDER_BUMPS[String(id)];
    if (b) {
      products.push({
        id: b.id,
        name: b.name,
        planId: null,
        planName: null,
        quantity: 1,
        priceInCents: b.priceCents,
      });
    }
  }
  return products;
}

function bumpsTotal(bumpIds) {
  let sum = 0;
  for (const id of bumpIds || []) {
    const b = ORDER_BUMPS[String(id)];
    if (b) sum += b.priceCents;
  }
  return sum;
}

// Total teórico do pedido (sem confiar no amount vindo do postback).
function orderTotalCents(quantity, bumpIds) {
  const q = Math.max(1, parseInt(quantity, 10) || 1);
  return unitCents() * q + bumpsTotal(bumpIds);
}

// Monta a descrição da transação: "3x Produto + Bump1 + Bump2".
function buildDescription(quantity, bumpIds) {
  const q = Math.max(1, parseInt(quantity, 10) || 1);
  const parts = [productName()];
  for (const id of bumpIds || []) {
    const b = ORDER_BUMPS[String(id)];
    if (b) parts.push(b.name);
  }
  return (q > 1 ? q + "x " : "") + parts.join(" + ");
}

// Inverso de buildDescription: extrai quantidade e bumps da descrição.
// Usado no webhook para reconstruir o pedido com os mesmos produtos.
function parseDescription(description) {
  const desc = String(description || "").trim();
  let quantity = 1;
  let rest = desc;
  const m = /^(\d+)x\s+/.exec(desc);
  if (m) {
    quantity = Math.max(1, parseInt(m[1], 10) || 1);
    rest = desc.slice(m[0].length);
  }
  const names = rest.split(/\s+\+\s+/).map((s) => s.trim()).filter(Boolean);
  names.shift(); // nome do produto principal
  const bumpIds = [];
  for (const n of names) {
    for (const [id, b] of Object.entries(ORDER_BUMPS)) {
      if (b.name === n) { bumpIds.push(id); break; }
    }
  }
  return { quantity, bumpIds };
}

module.exports = { DEFAULT_PRODUCT, MAIN_PRODUCT, ORDER_BUMPS, productName, unitCents, buildProducts, bumpsTotal, orderTotalCents, buildDescription, parseDescription };
