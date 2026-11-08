// Envia um pedido para a Utmify (https://docs.utmify.com.br/send-orders).
// Requer UTMIFY_API_TOKEN nas variáveis de ambiente (credencial gerada no dashboard Utmify).

const ENDPOINT = "https://api.utmify.com.br/api-credentials/orders";

async function sendOrder(order) {
  const token = process.env.UTMIFY_API_TOKEN;
  if (!token) return { skipped: true };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": token,
      },
      body: JSON.stringify(order),
      signal: controller.signal,
    });
    let bodyText = null;
    try { bodyText = (await resp.text()).slice(0, 400); } catch { bodyText = null; }
    return { ok: resp.ok, status: resp.status, body: bodyText };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  } finally {
    clearTimeout(timeout);
  }
}

// Formato de data exigido pela Utmify: "YYYY-MM-DD HH:mm:ss" (UTC)
function utcNow() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function createdAtFromReference(reference) {
  const m = /^VS-(\d{10,})-/.exec(String(reference || ""));
  if (!m) return null;
  return new Date(parseInt(m[1], 10)).toISOString().slice(0, 19).replace("T", " ");
}

module.exports = { sendOrder, utcNow, createdAtFromReference };
