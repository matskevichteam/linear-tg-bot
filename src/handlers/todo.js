// ─── /todo → выбор команды → список → edit/done/delete ──────────────────────

import { bot, TEAMS, InlineKeyboard } from "../config.js";
import { getActiveIssues, completeLinearIssue, deleteLinearIssue } from "../linear.js";
import { viewList, viewConfirm, viewEditMode, resolveTeamId, resolveTeamLabel } from "../format.js";

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

  // Общий helper — рендер экрана по teamKey + режиму
  const renderView = async (ctx, teamKey, mode) => {
    const teamId = resolveTeamId(teamKey);
    const teamLabel = resolveTeamLabel(teamKey);
    const issues = await getActiveIssues(teamId);
    if (issues.length === 0) {
      const emptyText = mode === "firstOpen"
        ? `${teamLabel} — нет активных задач.`
        : `${teamLabel} — ✅ Все задачи выполнены!`;
      await ctx.editMessageText(emptyText, { reply_markup: new InlineKeyboard() });
      return;
    }
    const view = mode === "confirm" ? viewConfirm
               : mode === "editMode" ? viewEditMode
               : viewList;
    const { text, keyboard } = view(issues, teamKey, teamLabel);
    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
  };

  // Выбрал команду для просмотра
  bot.callbackQuery(/^todo_team:(support|docops|all)$/, async (ctx) => {
    try {
      await renderView(ctx, ctx.match[1], "firstOpen");
      await ctx.answerCallbackQuery();
    } catch (e) {
      console.error("❌ todo_team ошибка:", e);
      await ctx.answerCallbackQuery({ text: "❌ Ошибка", show_alert: true });
    }
  });

  // Обновить → confirm
  bot.callbackQuery(/^todo:refresh:(support|docops|all)$/, async (ctx) => {
    try {
      await renderView(ctx, ctx.match[1], "confirm");
      await ctx.answerCallbackQuery();
    } catch (e) {
      console.error("❌ todo:refresh ошибка:", e);
      await ctx.answerCallbackQuery({ text: "❌ Ошибка", show_alert: true });
    }
  });

  // Изменить → режим редактирования
  bot.callbackQuery(/^todo:edit_mode:(support|docops|all)$/, async (ctx) => {
    try {
      await renderView(ctx, ctx.match[1], "editMode");
      await ctx.answerCallbackQuery();
    } catch (e) {
      console.error("❌ todo:edit_mode ошибка:", e);
      await ctx.answerCallbackQuery({ text: "❌ Ошибка", show_alert: true });
    }
  });

  // Назад → чистый список
  bot.callbackQuery(/^todo:back:(support|docops|all)$/, async (ctx) => {
    try {
      await renderView(ctx, ctx.match[1], "list");
      await ctx.answerCallbackQuery();
    } catch (e) {
      console.error("❌ todo:back ошибка:", e);
      await ctx.answerCallbackQuery({ text: "❌ Ошибка", show_alert: true });
    }
  });

  // Выполнить задачу → остаёмся в edit mode
  bot.callbackQuery(/^done:([^:]+):(support|docops|all)$/, async (ctx) => {
    try {
      const id = ctx.match[1];
      const teamKey = ctx.match[2];
      const ok = await completeLinearIssue(id);
      if (!ok) return ctx.answerCallbackQuery({ text: "❌ Не удалось завершить", show_alert: true });
      await renderView(ctx, teamKey, "editMode");
      await ctx.answerCallbackQuery({ text: "✅ Выполнено" });
    } catch (e) {
      console.error("❌ done ошибка:", e);
      await ctx.answerCallbackQuery({ text: "❌ Ошибка", show_alert: true });
    }
  });

  // Удалить задачу → остаёмся в edit mode
  bot.callbackQuery(/^del:([^:]+):(support|docops|all)$/, async (ctx) => {
    try {
      const id = ctx.match[1];
      const teamKey = ctx.match[2];
      const ok = await deleteLinearIssue(id);
      if (!ok) return ctx.answerCallbackQuery({ text: "❌ Не удалось удалить", show_alert: true });
      await renderView(ctx, teamKey, "editMode");
      await ctx.answerCallbackQuery({ text: "🗑 Удалено" });
    } catch (e) {
      console.error("❌ del ошибка:", e);
      await ctx.answerCallbackQuery({ text: "❌ Ошибка", show_alert: true });
    }
  });
}
