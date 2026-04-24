// ─── In-memory state + optional JSON persistence ────────────────────────────
// Если DATA_DIR указан и доступен на запись — state.json грузится на старте
// и сохраняется после каждого изменения (debounced).
// На Railway: смонтируй volume, установи DATA_DIR=/data в Variables.
// Локально: fallback на ./data/state.json.

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || "./data";
const STATE_FILE = path.join(DATA_DIR, "state.json");

const pendingTask = new Map(); // chatId → { task }
const lastIssue = new Map();   // chatId → { id, title, url }

// ─── Persistence ────────────────────────────────────────────────────────────

function serialize() {
  return JSON.stringify({
    pendingTask: Array.from(pendingTask.entries()),
    lastIssue: Array.from(lastIssue.entries()),
  });
}

function ensureDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    return true;
  } catch (e) {
    console.error(`⚠️ state: не удалось создать ${DATA_DIR}:`, e.message);
    return false;
  }
}

export function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    const { pendingTask: p = [], lastIssue: l = [] } = JSON.parse(raw);
    pendingTask.clear(); lastIssue.clear();
    for (const [k, v] of p) pendingTask.set(Number(k), v);
    for (const [k, v] of l) lastIssue.set(Number(k), v);
    console.log(`💾 state: загружено pending=${pendingTask.size} lastIssue=${lastIssue.size}`);
  } catch (e) {
    console.error("⚠️ state: битый state.json, стартую с пустого:", e.message);
  }
}

// Атомарная запись через .tmp → rename
function saveSync() {
  if (!ensureDir()) return;
  try {
    const tmp = STATE_FILE + ".tmp";
    fs.writeFileSync(tmp, serialize());
    fs.renameSync(tmp, STATE_FILE);
  } catch (e) {
    console.error("⚠️ state: ошибка записи:", e.message);
  }
}

// Debounced save — на случай, если за 100мс много setPending/setLastIssue подряд
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; saveSync(); }, 100);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function getPending(chatId) { return pendingTask.get(chatId); }
export function setPending(chatId, value) { pendingTask.set(chatId, value); scheduleSave(); }
export function deletePending(chatId) { pendingTask.delete(chatId); scheduleSave(); }

export function getLastIssue(chatId) { return lastIssue.get(chatId); }
export function setLastIssue(chatId, value) { lastIssue.set(chatId, value); scheduleSave(); }
export function deleteLastIssue(chatId) { lastIssue.delete(chatId); scheduleSave(); }

// Восстановить задачу из текста сообщения (fallback, если state.json пропал)
export function recoverPending(ctx) {
  const msgText = ctx.callbackQuery?.message?.text || "";
  const match = msgText.match(/📝 (.+)\n/);
  if (!match) return null;
  const title = match[1].trim();
  const task = { title, description: title, priority: "medium", label: "операционка" };
  setPending(ctx.chat.id, { task });
  return { task };
}

// ─── Lifecycle: load at import, flush on shutdown ───────────────────────────

loadState();

// Graceful shutdown — Railway шлёт SIGTERM перед рестартом, успеем записать
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    saveSync();
    process.exit(0);
  });
}

// Тестовые хелперы (для node test.js)
export const __internals = { saveSync, STATE_FILE, DATA_DIR };
