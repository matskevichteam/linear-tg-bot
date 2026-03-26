// ─── /todo → выбор команды → список → edit/done/delete ──────────────────────

import { bot, TEAMS, InlineKeyboard } from "../config.js";
import { getActiveIssues, completeLinearIssue, deleteLinearIssue } from "../linear.js";
import { priorityMapEmoji, viewList, viewConfirm, viewEditMode, resolveTeamId } from "../format.js";

export function registerTodoHandlers() {
  const todoTeamsKeyboard = new InlineKeyboard()
    .text(`${TEAMS.support.emoji} Support`, "todo_team:support")
    .text(`${TEAMS.docops.emoji} DocOps`, "todo_team:docops")
    .row()
    .text("📋 Все задачи", "todo_team:all");

  bot.command("todo", async (ctx) => {
    await ctx.reply("Какую команду показать?", { reply_markup: todoTeamsKeyboard });
  });

  bot.callbackQuery("todo:teams", async (ctx) => {
    await ctx.editMessageText("Какую команду показать?", { reply_markup: todoTeamsKeyboard });
    await ctx.answerCallbackQuery();
  });

  // Выбрал команду для просмотра
  bot.callbackQuery(/^todo_team:(support|docops|all)$/, async (ctx) => {
    const key = ctx.match[1];
    let teamId = null;
    let teamLabel = "📋 Все задачи";
    if (key !== "all") {
      const team = TEAMS[key];
      teamId = team.id;
      teamLabel = `${team.emoji} ${team.name}`;
    }

    const issues = await getActiveIssues(teamId);
    if (issues.length === 0) {
      await ctx.editMessageText(`${teamLabel} — нет активных задач.`);
      return ctx.answerCallbackQuery();
    }
    const { text, keyboard } = viewList(issues, teamLabel);
    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Обновить → показать confirm
  bot.callbackQuery(/^todo:refresh:(.+)$/, async (ctx) => {
    const teamLabel = ctx.match[1];
    const teamId = resolveTeamId(teamLabel);
    const issues = await getActiveIssues(teamId);
    if (issues.length === 0) {
      await ctx.editMessageText(`${teamLabel} — ✅ Все задачи выполнены!`, { reply_markup: new InlineKeyboard() });
    } else {
      const { text, keyboard } = viewConfirm(issues, teamLabel);
      await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    }
    await ctx.answerCallbackQuery();
  });

  // Да, удалить → режим удаления
  bot.callbackQuery(/^todo:edit_mode:(.+)$/, async (ctx) => {
    const teamLabel = ctx.match[1];
    const teamId = resolveTeamId(teamLabel);
    const issues = await getActiveIssues(teamId);
    const { text, keyboard } = viewEditMode(issues, teamLabel);
    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Назад → чистый список
  bot.callbackQuery(/^todo:back:(.+)$/, async (ctx) => {
    try {
      const teamLabel = ctx.match[1];
      const teamId = resolveTeamId(teamLabel);
      const issues = await getActiveIssues(teamId);
      if (issues.length === 0) {
        await ctx.editMessageText(`${teamLabel} — ✅ Все задачи выполнены!`, { reply_markup: new InlineKeyboard() });
      } else {
        const { text, keyboard } = viewList(issues, teamLabel);
        await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
      }
      await ctx.answerCallbackQuery();
    } catch (e) {
      console.error("❌ todo:back ошибка:", e);
      await ctx.answerCallbackQuery({ text: "❌ Ошибка", show_alert: true });
    }
  });

  // Выполнить задачу → обновить список
  bot.callbackQuery(/^done:([^:]+):(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    const teamLabel = ctx.match[2];
    const teamId = resolveTeamId(teamLabel);

    const ok = await completeLinearIssue(id);
    if (!ok) return ctx.answerCallbackQuery({ text: "❌ Не удалось завершить", show_alert: true });

    const issues = await getActiveIssues(teamId);
    if (issues.length === 0) {
      await ctx.editMessageText(`${teamLabel} — ✅ Все задачи выполнены!`, { reply_markup: new InlineKeyboard() });
    } else {
      const { text, keyboard } = viewEditMode(issues, teamLabel);
      await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    }
    await ctx.answerCallbackQuery({ text: "✅ Выполнено" });
  });

  // Удалить задачу → обновить режим удаления
  bot.callbackQuery(/^del:([^:]+):(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    const teamLabel = ctx.match[2];
    const teamId = resolveTeamId(teamLabel);

    const ok = await deleteLinearIssue(id);
    if (!ok) return ctx.answerCallbackQuery({ text: "❌ Не удалось удалить", show_alert: true });

    const issues = await getActiveIssues(teamId);
    if (issues.length === 0) {
      await ctx.editMessageText(`${teamLabel} — ✅ Все задачи выполнены!`, { reply_markup: new InlineKeyboard() });
    } else {
      const { text, keyboard } = viewEditMode(issues, teamLabel);
      await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
    }
    await ctx.answerCallbackQuery({ text: "🗑 Удалено" });
  });
}
