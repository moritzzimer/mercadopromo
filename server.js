const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const hostIndex = args.indexOf("--host");
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT) || 5173;
const host = hostIndex >= 0 && args[hostIndex + 1] && !args[hostIndex + 1].startsWith("--")
  ? args[hostIndex + 1]
  : "0.0.0.0";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname);
  } catch {
    res.writeHead(400).end("URL inválida");
    return;
  }
  const routes = { "/": "index.html", "/checkout": "index.html", "/produto": "index.html", "/liberacao": "rastreio.html", "/rastreio": "rastreio.html" };
  const relative = routes[ pathname] || pathname.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403).end("Acesso negado");
    return;
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Página não encontrada");
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(port, host, () => console.log(`MercadoPromo em http://localhost:${port}`));
module.exports = server;
