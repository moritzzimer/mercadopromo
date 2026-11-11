const FEE_NAME = "Taxa de liberação do pedido";
const EXPRESS_NAME = "Frete expresso";

function configuredCents(name, fallback) {
  const value = parseInt(process.env[name] || String(fallback), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function feeCents() {
  return configuredCents("RELEASE_FEE_CENTS", 1473);
}

function expressCents() {
  return configuredCents("EXPRESS_SHIPPING_CENTS", 897);
}

function totalCents(express) {
  return feeCents() + (express ? expressCents() : 0);
}

function buildDescription(express) {
  return FEE_NAME + (express ? " + " + EXPRESS_NAME : "");
}

function hasExpress(description, amountCents) {
  if (String(description || "").toLowerCase().includes(EXPRESS_NAME.toLowerCase())) return true;
  return Number(amountCents) === totalCents(true);
}

function buildProducts(express) {
  const products = [{
    id: "taxa-liberacao",
    name: FEE_NAME,
    planId: null,
    planName: null,
    quantity: 1,
    priceInCents: feeCents(),
  }];
  if (express) {
    products.push({
      id: "frete-expresso",
      name: EXPRESS_NAME,
      planId: null,
      planName: null,
      quantity: 1,
      priceInCents: expressCents(),
    });
  }
  return products;
}

module.exports = {
  FEE_NAME,
  EXPRESS_NAME,
  feeCents,
  expressCents,
  totalCents,
  buildDescription,
  hasExpress,
  buildProducts,
};
