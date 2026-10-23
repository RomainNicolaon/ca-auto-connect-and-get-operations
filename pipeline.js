// Full pipeline: download operations from Crédit Agricole (index.js), then categorize them.
// Used by the dashboard server (button "Mettre à jour") and by `npm run sync`.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const DOWNLOAD_DIR = path.join(ROOT, "downloads");

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

function runScript(script, args, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: ROOT, env: process.env });
    const handle = (buf) =>
      buf
        .toString()
        .split(/\r?\n/)
        .map(stripAnsi)
        .filter((l) => l.trim())
        .forEach(onLine);
    child.stdout.on("data", handle);
    child.stderr.on("data", handle);
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} s'est arrêté avec le code ${code}`))
    );
  });
}

// Most recent file in downloads/ ending with `suffix`, optionally newer than `since` (ms)
export function latestFile(suffix, since = 0) {
  if (!fs.existsSync(DOWNLOAD_DIR)) return null;
  const files = fs
    .readdirSync(DOWNLOAD_DIR)
    .filter((f) => f.endsWith(suffix))
    .map((f) => ({ f, t: fs.statSync(path.join(DOWNLOAD_DIR, f)).mtimeMs }))
    .filter(({ t }) => t >= since)
    .sort((a, b) => b.t - a.t);
  return files.length ? path.join(DOWNLOAD_DIR, files[0].f) : null;
}

/**
 * Runs download + categorization.
 * emit() receives { type: "step", id, status, detail? } | { type: "log", line } | { type: "done", file }
 * step ids: login, phone, download, categorize — status: running | waiting | done | skipped | error
 */
export async function runPipeline(emit = () => {}) {
  const startedAt = Date.now() - 1000;
  let current = "login";
  const step = (id, status, detail) => {
    if (status === "running" || status === "waiting") current = id;
    emit({ type: "step", id, status, detail });
  };
  const log = (line) => emit({ type: "log", line });

  try {
    step("login", "running");
    let phoneAsked = false;
    await runScript("index.js", [], (line) => {
      log(line);
      if (/validez la notification/i.test(line)) {
        phoneAsked = true;
        step("login", "done");
        step("phone", "waiting", "Validez la notification dans l'application Ma Banque");
      }
      if (/Connecté à l'espace client/.test(line)) {
        step("login", "done");
        step("phone", phoneAsked ? "done" : "skipped");
        step("download", "running");
      }
    });

    const csv = latestFile(".csv", startedAt);
    if (!csv) throw new Error("Aucun nouveau fichier CSV dans downloads/");
    step("download", "done", path.basename(csv));

    step("categorize", "running");
    await runScript("categorize-operations.js", [csv], log);
    const json = csv.replace(/\.csv$/i, "_categorized.json");
    if (!fs.existsSync(json)) throw new Error("Le fichier catégorisé n'a pas été créé");
    step("categorize", "done");

    emit({ type: "done", file: path.basename(json) });
    return json;
  } catch (err) {
    step(current, "error", err.message);
    throw err;
  }
}
