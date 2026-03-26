// ─── In-memory state ─────────────────────────────────────────────────────────
// При рестарте Railway всё теряется. TODO: persistence (Supabase / JSON file)

const pendingTask = new Map(); // chatId → { task }
const lastIssue = new Map();   // chatId → { id, title, url }

export function getPending(chatId) { return pendingTask.get(chatId); }
export function setPending(chatId, value) { pendingTask.set(chatId, value); }
export function deletePending(chatId) { pendingTask.delete(chatId); }

export function getLastIssue(chatId) { return lastIssue.get(chatId); }
export function setLastIssue(chatId, value) { lastIssue.set(chatId, value); }
export function deleteLastIssue(chatId) { lastIssue.delete(chatId); }

// Восстановить задачу из текста сообщения (после перезапуска бота)
export function recoverPending(ctx) {
  const msgText = ctx.callbackQuery?.message?.text || "";
  const match = msgText.match(/📝 (.+)\n/);
  if (!match) return null;
  const title = match[1].trim();
  const task = { title, description: title, priority: "medium", label: "операционка" };
  setPending(ctx.chat.id, { task });
  return { task };
}
