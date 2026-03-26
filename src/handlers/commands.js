// ─── Команды: /start, /help, /docs ──────────────────────────────────────────

import { bot } from "../config.js";

const HELP_TEXT = `
💡 *как работать с ботом:*

*создать задачу*
просто напиши текст — выберешь команду (Support / DocOps)

*приоритет*
🔴 высокий · 🟡 средний · 🟢 низкий
бот определит сам, но можно поменять кнопкой

*форвард*
перешли любое сообщение → задача из него

*голосовое*
надиктуй → расшифрую и создам задачу

*комментарий*
ответь (reply) на сообщение бота → комментарий улетит в Linear

*закрыть задачу*
ответь (reply) → \`готово\` или нажми ✅ в /todo

*удалить задачу*
ответь (reply) → \`удалить\` или нажми 🗑 в /todo

*команды*
/todo — задачи (✅ закрыть · 🗑 удалить)
/help — это сообщение
/docs — документация по боту

🔗 [Linear Backlog](https://linear.app/gconf-support/team/GCO/backlog)
_логин: matskevichteam@gmail.com — доступ в GCONF FILES (tg)_
`.trim();

export function registerCommands() {
  bot.command("start", (ctx) => {
    return ctx.reply(
      "Привет! Отправь мне:\n• Текст → создам задачу в Linear\n• Форвард → разберу и создам задачу\n• Голосовое → транскрибирую и создам задачи\n\nВсё остальное — в меню ☰ слева"
    );
  });

  bot.command("help", (ctx) => {
    return ctx.reply(HELP_TEXT, { parse_mode: "Markdown" });
  });

  bot.command("docs", (ctx) => {
    return ctx.reply(
      `📁 Документация по боту\n\nКод, README и документация:\nhttps://github.com/matskevichteam/linear-tg-bot`
    );
  });
}
