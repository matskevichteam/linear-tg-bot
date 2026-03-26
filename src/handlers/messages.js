// ─── Message handlers: text router, forward, voice ──────────────────────────

import { bot, Keyboard } from "../config.js";
import { getLastIssue, deleteLastIssue, setPending } from "../state.js";
import { findIssueByKey, completeLinearIssue, deleteLinearIssue, createLinearComment } from "../linear.js";
import { downloadTelegramFile, transcribeVoice } from "../groq.js";
import { parseTask, priorityEmoji, priorityLabel, taskSelectKeyboard } from "../format.js";
import { ONB } from "../onboarding.js";
import { handleText } from "./tasks.js";

export function registerMessageHandlers() {
  // ─── Debug ──────────────────────────────────────────────────────────────────
  bot.on("message", async (ctx, next) => {
    console.log("📩", JSON.stringify(ctx.message, null, 2));
    await next();
  });

  // ─── Текст ──────────────────────────────────────────────────────────────────
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    const textLower = text.toLowerCase();

    // Онбординг
    if (text === "📚 Онбординг") {
      const { text: onbText, kb } = ONB.main;
      return ctx.reply(onbText, { parse_mode: "Markdown", reply_markup: kb() });
    }

    // Назад → главное меню
    if (text === "⬅️") {
      const keyboard = new Keyboard().text("📚 Онбординг").resized();
      return ctx.reply(
        "Отправь мне:\n• Текст → создам задачу в Linear\n• Форвард → разберу и создам задачу\n• Голосовое → транскрибирую и создам задачи",
        { reply_markup: keyboard }
      );
    }

    // Готово
    if (textLower === "готово" || textLower === "done" || textLower === "выполнено") {
      let issue = null;
      const replyText = ctx.message.reply_to_message?.text;
      if (replyText) {
        const urlMatch = replyText.match(/linear\.app\/[^\s]*\/issue\/([A-Z\d]+-\d+)/);
        if (urlMatch) issue = await findIssueByKey(urlMatch[1]);
      }
      if (!issue) issue = getLastIssue(ctx.chat.id);
      if (!issue) return ctx.reply("Нет задачи.\nОтветь (reply) на сообщение бота с задачей и напиши «готово».");

      const ok = await completeLinearIssue(issue.id);
      if (ok) return ctx.reply(`✅ Выполнено: ${issue.title}`);
      else return ctx.reply("❌ Не удалось завершить задачу");
    }

    // Удалить
    if (textLower === "удалить" || textLower === "/delete") {
      let issue = null;

      const replyText = ctx.message.reply_to_message?.text;
      if (replyText) {
        const urlMatch = replyText.match(/linear\.app\/[^\s]*\/issue\/([A-Z\d]+-\d+)/);
        if (urlMatch) {
          issue = await findIssueByKey(urlMatch[1]);
        }
      }

      if (!issue) issue = getLastIssue(ctx.chat.id);
      if (!issue) return ctx.reply("Нет задачи для удаления.\nОтветь (reply) на сообщение бота с нужной задачей и напиши «удалить».");

      const ok = await deleteLinearIssue(issue.id);
      if (ok) {
        deleteLastIssue(ctx.chat.id);
        return ctx.reply(`🗑 Удалено: ${issue.title}`);
      } else {
        return ctx.reply("❌ Не удалось удалить задачу");
      }
    }

    // Reply на сообщение бота → комментарий в Linear
    const replyText = ctx.message.reply_to_message?.text;
    if (replyText) {
      const urlMatch = replyText.match(/linear\.app\/[^\s]*\/issue\/([A-Z\d]+-\d+)/);
      if (urlMatch) {
        const issue = await findIssueByKey(urlMatch[1]);
        if (issue) {
          const ok = await createLinearComment(issue.id, text);
          if (ok) return ctx.reply(`💬 Комментарий добавлен к задаче: ${issue.title}`);
          else return ctx.reply("❌ Не удалось добавить комментарий");
        }
      }
    }

    await handleText(ctx, text);
  });

  // ─── Форвард ────────────────────────────────────────────────────────────────
  bot.on("message:forward_origin", async (ctx) => {
    const text = ctx.message.text || ctx.message.caption;
    if (!text) return ctx.reply("⚠️ В форварде нет текста");
    await handleText(ctx, `[Переслано] ${text}`);
  });

  // ─── Голосовое ──────────────────────────────────────────────────────────────
  bot.on("message:voice", async (ctx) => {
    try {
      await ctx.replyWithChatAction("typing");
      await ctx.reply("🎤 Расшифровываю...");

      const fileBuffer = await downloadTelegramFile(ctx.message.voice.file_id);
      const transcript = await transcribeVoice(fileBuffer);
      console.log("🎤 Транскрипция:", transcript);

      await ctx.reply(`🎤 _${transcript}_`, { parse_mode: "Markdown" });

      // Парсим и спрашиваем команду
      const task = parseTask(transcript);
      setPending(ctx.chat.id, { task });

      const pe = priorityEmoji[task.priority];
      const pl = priorityLabel[task.priority];
      await ctx.reply(
        `📝 *${task.title}*\n${pe} ${pl} · #${task.label}\n\nКуда отправить?`,
        { parse_mode: "Markdown", reply_markup: taskSelectKeyboard(task.priority) }
      );
    } catch (e) {
      console.error("❌ Голосовое — ошибка:", e);
      await ctx.reply("❌ Ошибка: " + e.message);
    }
  });
}
