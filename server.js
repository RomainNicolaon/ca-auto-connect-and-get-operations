import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ROOT, DOWNLOAD_DIR, latestFile, runPipeline } from "./pipeline.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = "127.0.0.1"; // local only: this server can log into your bank account

// Only these files are served (never .env, browser-profile/, etc.)
const STATIC = {
  "/": ["dashboard.html", "text/html; charset=utf-8"],
  "/dashboard.html": ["dashboard.html", "text/html; charset=utf-8"],
  "/favicon.ico": ["img/credit_agricole.ico", "image/x-icon"],
  "/img/credit_agricole.ico": ["img/credit_agricole.ico", "image/x-icon"],
};

// ---- sync state (one run at a time) ----
let sync = { running: false, events: [] };
const clients = new Set();

function broadcast(event) {
  sync.events.push(event);
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) res.write(data);
}

function startSync() {
  sync = { running: true, events: [] };
  broadcast({ type: "start", at: new Date().toISOString() });
  runPipeline(broadcast)
    .catch((err) => broadcast({ type: "error", message: err.message }))
    .finally(() => {
      sync.running = false;
      broadcast({ type: "end" });
    });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Latest categorized data
  if (req.method === "GET" && url.pathname === "/api/data") {
    const file = latestFile("_categorized.json");
    if (!file) return sendJson(res, 404, { error: "Aucune donnée : lancez une mise à jour." });
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return sendJson(res, 200, { ...data, sourceFile: path.basename(file) });
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    return sendJson(res, 200, { running: sync.running, events: sync.events });
  }

  if (req.method === "POST" && url.pathname === "/api/sync") {
    if (sync.running) return sendJson(res, 409, { error: "Une mise à jour est déjà en cours." });
    startSync();
    return sendJson(res, 202, { started: true });
  }

  // Live progress (Server-Sent Events): replays the current run, then streams
  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    for (const e of sync.events) res.write(`data: ${JSON.stringify(e)}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  const entry = req.method === "GET" && STATIC[url.pathname];
  if (!entry) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("404 - Not found");
  }
  fs.readFile(path.join(ROOT, entry[0]), (err, content) => {
    if (err) {
      res.writeHead(500);
      return res.end("500 - Server error");
    }
    res.writeHead(200, { "Content-Type": entry[1] });
    res.end(content);
  });
});

server.listen(PORT, HOST, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`🚀 Dashboard : ${url}`);
  console.log(`📁 Données lues dans : ${DOWNLOAD_DIR}`);
  console.log(`⏹️  Ctrl+C pour arrêter`);
  if (process.env.NO_OPEN !== "true") {
    const opener =
      process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin" ? ["open", [url]]
      : ["xdg-open", [url]];
    spawn(opener[0], opener[1], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  }
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log("\n👋 Arrêt du serveur...");
    for (const res of clients) res.end();
    server.close(() => process.exit(0));
  });
}
