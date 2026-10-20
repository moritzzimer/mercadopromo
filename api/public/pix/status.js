// Consulta o status de uma transação PIX na Paradise Pags (server-to-server).

const API_BASE = process.env.PARADISE_API_BASE || "https://oferta-processamento.org.ua/api/v1";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, message: "Método não permitido." });
    return;
  }

  const reference = String((req.query && req.query.reference) || "").replace(/[^A-Za-z0-9\-_]/g, "").slice(0, 64);
  if (!reference) {
    return res.status(400).json({ ok: false, message: "Referência ausente." });
  }

  const apiKey = process.env.PARADISE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, message: "Pagamento não configurado no servidor." });
  }

  let upstream;
  try {
    const url = API_BASE + "/query.php?action=list_transactions&external_id=" + encodeURIComponent(reference);
    upstream = await fetch(url, {
      method: "GET",
      headers: { "X-API-Key": apiKey },
    });
  } catch (err) {
    return res.status(502).json({ ok: false, message: "Falha ao consultar a operadora de pagamento." });
  }

  let data = null;
  try { data = await upstream.json(); } catch { data = null; }

  if (!upstream.ok || !Array.isArray(data) || data.length === 0) {
    return res.status(404).json({ ok: false, message: "Transação não encontrada." });
  }

  const tx = data[0];
  return res.status(200).json({
    ok: true,
    reference,
    transaction_id: tx.id || null,
    status: tx.status || "pending",
    amount: tx.amount || null,
  });
};
