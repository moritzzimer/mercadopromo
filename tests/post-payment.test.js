const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const releasePage = fs.readFileSync(path.join(root, "liberacao.html"), "utf8");
const tracking = fs.readFileSync(path.join(root, "rastreio.html"), "utf8");
const routes = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
const status = fs.readFileSync(path.join(root, "api", "public", "pix", "status.js"), "utf8");
const release = require("../api/_lib/release");
const utmify = require("../api/_lib/utmify");
const createRelease = require("../api/public/pix/release/create");

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function validRequest(express) {
  return {
    method: "POST",
    body: {
      originalReference: "VS-1730000000000-ABC123",
      customer: { name: "Cliente Teste", email: "cliente@example.com", document: "11144477735", phone: "11999999999" },
      express,
      tracking: { utm_source: "teste" },
    },
  };
}

test("Pix inicial aprovado abre a etapa de liberação", () => {
  assert.match(index, /if\(j\.status==='approved'\)\{showSuccess\(j\);\}/);
  assert.match(index, /window\.location\.replace\('\/liberacao\?pedido='\+encodeURIComponent\(currentRef\)\)/);
  assert.match(index, /sessionStorage\.setItem\('mp_release_customer'/);
});

test("taxa tem valor obrigatório e frete expresso opcional", () => {
  assert.equal(release.totalCents(false), 1473);
  assert.equal(release.totalCents(true), 2370);
  assert.match(releasePage, /R\$ 14,73/);
  assert.match(releasePage, /R\$ 8,97/);
  assert.match(releasePage, /Opcional/);
  assert.match(releasePage, /\/api\/public\/pix\/release\/create/);
});

test("segundo Pix aprovado abre o rastreio", () => {
  assert.match(releasePage, /location\.replace\('\/rastreio\?pedido=' \+ encodeURIComponent\(referenciaAtual\)\)/);
  assert.match(releasePage, /localStorage\.setItem\('mp_pago_' \+ referenciaAtual/);
  assert.match(releasePage, /localStorage\.setItem\('mp_ultimo_pedido', referenciaAtual/);
});

test("tela pós-pagamento usa o banner e o tema Mercado Pago", () => {
  for (const page of [releasePage, tracking]) {
    assert.match(page, /assets\/checkout\/banner-atualizacao\.png/);
    assert.match(page, /assets\/checkout\/mp-brand\.png/);
  }
  assert.match(tracking, /2 a 4 dias úteis/);
  assert.match(tracking, /@keyframes piscar-status/);
  assert.match(tracking, /prefers-reduced-motion:reduce/);
});

test("rastreio só aceita a referência da taxa aprovada", () => {
  assert.match(tracking, /!\/\^TX-\/\.test\(codigo\)/);
  assert.match(tracking, /j\.status !== 'approved'/);
  assert.match(tracking, /\/api\/public\/pix\/status\?reference=/);
  assert.match(status, /paid_at: tx\.paid_at/);
});

test("rotas de liberação e acompanhamento estão configuradas", () => {
  assert.match(routes, /"source": "\/liberacao"/);
  assert.match(routes, /"destination": "\/liberacao\.html"/);
  assert.match(routes, /"source": "\/rastreio"/);
  assert.match(routes, /"destination": "\/rastreio\.html"/);
  assert.ok(fs.statSync(path.join(root, "assets", "checkout", "banner-atualizacao.png")).size > 0);
});

test("referência da taxa mantém a data de criação na Utmify", () => {
  assert.equal(utmify.createdAtFromReference("TX-1730000000000-ABC123"), utmify.createdAtFromReference("VS-1730000000000-ABC123"));
});

test("cobrança da taxa valida o Pix inicial e inclui frete opcional", async t => {
  const oldKey = process.env.PARADISE_API_KEY;
  const oldToken = process.env.UTMIFY_API_TOKEN;
  process.env.PARADISE_API_KEY = "teste-local";
  delete process.env.UTMIFY_API_TOKEN;
  t.after(() => {
    if (oldKey === undefined) delete process.env.PARADISE_API_KEY; else process.env.PARADISE_API_KEY = oldKey;
    if (oldToken === undefined) delete process.env.UTMIFY_API_TOKEN; else process.env.UTMIFY_API_TOKEN = oldToken;
  });

  const calls = [];
  t.mock.method(global, "fetch", async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("query.php")) {
      return { ok: true, json: async () => [{ id: 1, status: "approved" }] };
    }
    return { ok: true, json: async () => ({ status: "success", transaction_id: 2, qr_code: "pix-teste", amount: 2370 }) };
  });

  const res = responseMock();
  await createRelease(validRequest(true), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.amount, 2370);
  assert.match(res.body.reference, /^TX-/);
  assert.equal(calls.length, 2);
  const payload = JSON.parse(calls[1].options.body);
  assert.equal(payload.amount, 2370);
  assert.equal(payload.description, "Taxa de liberação do pedido + Frete expresso");
  assert.equal(payload.productHash, "prod_5ca5f3e70c449af6");
});

test("taxa não pode ser criada com Pix inicial pendente", async t => {
  const oldKey = process.env.PARADISE_API_KEY;
  process.env.PARADISE_API_KEY = "teste-local";
  t.after(() => { if (oldKey === undefined) delete process.env.PARADISE_API_KEY; else process.env.PARADISE_API_KEY = oldKey; });
  let calls = 0;
  t.mock.method(global, "fetch", async () => {
    calls += 1;
    return { ok: true, json: async () => [{ id: 1, status: "pending" }] };
  });
  const res = responseMock();
  await createRelease(validRequest(false), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.ok, false);
  assert.equal(calls, 1);
});

test("webhook registra taxa e frete como produtos do segundo pagamento", async t => {
  const webhook = require("../api/public/pix/webhook");
  let order = null;
  t.mock.method(utmify, "sendOrder", async value => { order = value; return { ok: true }; });
  const res = responseMock();
  await webhook({
    method: "POST",
    body: {
      status: "approved",
      external_id: "TX-1730000000000-TESTE",
      amount: 2370,
      timestamp: "2023-10-26T12:00:00Z",
      customer_data: { description: "Taxa de liberação do pedido + Frete expresso" },
      customer: { name: "Cliente Teste", email: "cliente@example.com", document: "11144477735", phone: "11999999999" },
    },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(order.orderId, "TX-1730000000000-TESTE");
  assert.deepEqual(order.products.map(product => product.id), ["taxa-liberacao", "frete-expresso"]);
  assert.equal(order.commission.totalPriceInCents, 2370);
});
