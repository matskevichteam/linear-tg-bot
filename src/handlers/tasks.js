// ─── Task creation: text → parse → select team → create in Linear ────────────

import { bot, TEAMS } from "../config.js";
import { getPending, setPending, deletePending, recoverPending, setLastIssue } from "../state.js";
import { createLinearIssue } from "../linear.js";
import { parseTask, priorityEmoji, priorityLabel, taskSelectKeyboard, formatReply, escapeMd } from "../format.js";

// ─── Handle incoming text → task ────────────────────────────────────────────

export async function handleText(ctx, text) {
  try {
    await ctx.replyWithChatAction("typing");
    console.log("📨 Получил:", text);
    const task = parseTask(text);
    // urgent → high (три приоритета)
    if (task.priority === "urgent") task.priority = "high";
    console.log("🧠 Распарсил:", task);

    setPending(ctx.chat.id, { task });

    const pe = priorityEmoji[task.priority];
    const pl = priorityLabel[task.priority];
    await ctx.reply(
      `📝 *${escapeMd(task.title)}*\n${pe} ${pl} · #${task.label}`,
      { parse_mode: "Markdown", reply_markup: taskSelectKeyboard(task.priority) }
    );
  } catch (e) {
    console.error("❌ Ошибка:", e);
    await ctx.reply("❌ Ошибка: " + e.message);
  }
}

// ─── Register callback handlers ─────────────────────────────────────────────

export function registerTaskHandlers() {
  // Сменить приоритет кнопкой
  bot.callbackQuery(/^prio:(high|medium|low)$/, async (ctx) => {
    try {
      const newPriority = ctx.match[1];
      const pending = getPending(ctx.chat.id) || recoverPending(ctx);
      if (!pending) return ctx.answerCallbackQuery({ text: "Задача не найдена", show_alert: true });

      pending.task.priority = newPriority;
      setPending(ctx.chat.id, pending);

      const pe = priorityEmoji[newPriority];
      const pl = priorityLabel[newPriority];
      await ctx.editMessageText(
        `📝 *${escapeMd(pending.task.title)}*\n${pe} ${pl} · #${pending.task.label}`,
        { parse_mode: "Markdown", reply_markup: taskSelectKeyboard(newPriority) }
      );
      await ctx.answerCallbackQuery();
    } catch (e) {
      console.error("❌ prio: ошибка:", e);
      await ctx.answerCallbackQuery({ text: "❌ Попробуй ещё раз", show_alert: true });
    }
  });

  // Выбрал команду → создаём задачу
  bot.callbackQuery(/^send:(support|docops)$/, async (ctx) => {
    try {
      const teamKey = ctx.match[1];
      const team = TEAMS[teamKey];
      const pending = getPending(ctx.chat.id) || recoverPending(ctx);
      if (!pending) return ctx.answerCallbackQuery({ text: "Задача не найдена", show_alert: true });

      deletePending(ctx.chat.id);

      const issue = await createLinearIssue({ ...pending.task, teamId: team.id });
      if (!issue) {
        await ctx.editMessageText("❌ Не удалось создать задачу в Linear");
        return ctx.answerCallbackQuery({ text: "❌ Linear API не ответил", show_alert: true });
      }

      setLastIssue(ctx.chat.id, issue);
      await ctx.editMessageText(formatReply(pending.task, issue, team.name));
      await ctx.answerCallbackQuery({ text: `✅ → ${team.name}` });
    } catch (e) {
      console.error("❌ send: ошибка:", e);
      await ctx.answerCallbackQuery({ text: "❌ Ошибка, попробуй ещё раз", show_alert: true });
    }
  });

  // Смена приоритета тоже в try/catch — network может упасть на editMessageText
  // (уже зарегистрирован выше — этот блок только для документации)
}
