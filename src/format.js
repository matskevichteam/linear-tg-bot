// ─── Parsing, formatting, keyboards ─────────────────────────────────────────

import { TEAMS, InlineKeyboard } from "./config.js";

// ─── Priority constants ─────────────────────────────────────────────────────

export const priorityEmoji = { high: "🔴", medium: "🟡", low: "🟢" };
export const priorityLabel = { high: "высокий", medium: "средний", low: "низкий" };
export const priorityMapEmoji = { 1: "🔴", 2: "🔴", 3: "🟡", 4: "🟢", 0: "⚪️" };

// ─── Parse task from text ───────────────────────────────────────────────────

export function parseTask(text) {
  const t = text.toLowerCase();

  const priorityExplicit = {
    high:   ["высокий", "высокая", "high", "urgent", "срочный", "срочная", "срочно", "asap", "горит", "немедленно", "важно", "надо", "нужно", "не забудь", "обязательно"],
    medium: ["средний", "средняя", "medium"],
    low:    ["низкий", "низкая", "low"],
  };

  let priority = "medium";
  for (const [p, words] of Object.entries(priorityExplicit)) {
    if (words.some(w => t.includes(w))) { priority = p; break; }
  }

  const labels = {
    "саппорт":     ["доступ", "участник", "впн", "vpn", "chat gpt", "chatgpt", "помочь", "помоги", "открой", "добавь"],
    "контент":     ["пост", "урок", "видео", "текст", "канал", "написать", "опубликовать", "контент", "reels"],
    "платежи":     ["инвойс", "оплата", "счёт", "крипта", "деньги", "оплатить", "перевод", "платёж"],
    "операционка": [],
  };

  let label = "операционка";
  for (const [name, words] of Object.entries(labels)) {
    if (words.some(w => t.includes(w))) { label = name; break; }
  }

  const priorityPrefixRe = /^(urgent|high|low|medium|срочно|срочный|высокий|высокая|низкий|низкая|средний)\s*[-:]\s*/i;
  const firstLine = text.split("\n")[0].trim().replace(priorityPrefixRe, "");
  const title = firstLine.length > 60 ? firstLine.slice(0, 57) + "..." : firstLine;

  return { title, description: text, priority, label };
}

// ─── Format reply ───────────────────────────────────────────────────────────

export function formatReply(task, issue, teamName) {
  return `✅ Задача создана в Linear → ${teamName}\n\n📋 ${issue.title}\n${priorityEmoji[task.priority]} ${priorityLabel[task.priority]} · #${task.label}\n🔗 ${issue.url}`;
}

// ─── Task select keyboard (priority + team) ─────────────────────────────────

export function taskSelectKeyboard(detectedPriority) {
  const keyboard = new InlineKeyboard()
    .text(detectedPriority === "high" ? "🔴 ✓" : "🔴", `prio:high`)
    .text(detectedPriority === "medium" ? "🟡 ✓" : "🟡", `prio:medium`)
    .text(detectedPriority === "low" ? "🟢 ✓" : "🟢", `prio:low`)
    .row()
    .text(`${TEAMS.support.emoji} Support`, `send:support`)
    .text(`${TEAMS.docops.emoji} DocOps`, `send:docops`);
  return keyboard;
}

// ─── Todo views ─────────────────────────────────────────────────────────────

export function formatIssueList(issues) {
  return issues
    .map(i => `${priorityMapEmoji[i.priority] ?? "⚪️"} ${i.title}`)
    .join("\n");
}

// Состояние 1: чистый список
export function viewList(issues, teamKey, teamLabel) {
  const text = `${teamLabel} — *Активные задачи (${issues.length}):*\n\n${formatIssueList(issues)}`;
  const keyboard = new InlineKeyboard().text("🔄 Обновить", `todo:refresh:${teamKey}`).text("⬅️", `todo:teams`);
  return { text, keyboard };
}

// Состояние 2: подтверждение
export function viewConfirm(issues, teamKey, teamLabel) {
  const text = `${teamLabel} — *Активные задачи (${issues.length}):*\n\n${formatIssueList(issues)}`;
  const keyboard = new InlineKeyboard()
    .text("✏️ изменить", `todo:edit_mode:${teamKey}`)
    .text("⬅️", `todo:teams`);
  return { text, keyboard };
}

// Состояние 3: список с кнопками ✅ и 🗑
export function viewEditMode(issues, teamKey, teamLabel) {
  const text = `${teamLabel} — *выбери задачу:*`;
  const keyboard = new InlineKeyboard();
  for (const issue of issues) {
    const emoji = priorityMapEmoji[issue.priority] ?? "⚪️";
    const title = issue.title.length > 25 ? issue.title.slice(0, 23) + "…" : issue.title;
    keyboard.url(`${emoji} ${title}`, issue.url).text("✅", `done:${issue.id}:${teamKey}`).text("🗑", `del:${issue.id}:${teamKey}`).row();
  }
  keyboard.text("⬅️", `todo:back:${teamKey}`);
  return { text, keyboard };
}

// teamKey → teamId (null для "all")
export function resolveTeamId(teamKey) {
  if (teamKey === "all") return null;
  return TEAMS[teamKey]?.id ?? null;
}

// teamKey → отображаемый лейбл
export function resolveTeamLabel(teamKey) {
  if (teamKey === "all") return "📋 Все задачи";
  const t = TEAMS[teamKey];
  return t ? `${t.emoji} ${t.name}` : teamKey;
}
