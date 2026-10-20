// Consulta endereço por CEP via ViaCEP (proxy server-side para manter o CSP restrito).
// GET /api/public/cep?cep=01310100

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, message: "Método não permitido." });
    return;
  }

  const cep = String((req.query && req.query.cep) || "").replace(/\D/g, "").slice(0, 8);
  if (cep.length !== 8) {
    return res.status(400).json({ ok: false, message: "CEP inválido." });
  }

  let upstream;
  try {
    upstream = await fetch("https://viacep.com.br/ws/" + cep + "/json/", {
      headers: { "Accept": "application/json" },
    });
  } catch (err) {
    return res.status(502).json({ ok: false, message: "Falha ao consultar o CEP." });
  }

  let data = null;
  try { data = await upstream.json(); } catch { data = null; }

  if (!upstream.ok || !data || data.erro) {
    return res.status(404).json({ ok: false, message: "CEP não encontrado." });
  }

  return res.status(200).json({
    ok: true,
    cep: data.cep || "",
    street: data.logradouro || "",
    complement: data.complemento || "",
    district: data.bairro || "",
    city: data.localidade || "",
    state: data.uf || "",
  });
};
