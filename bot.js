// ─── gconf support bot — entry point ─────────────────────────────────────────
//
// Модульная структура:
//   src/config.js      — env, bot, groq, TEAMS
//   src/state.js       — in-memory state (pendingTask, lastIssue)
//   src/linear.js      — Linear GraphQL API
//   src/groq.js        — Groq transcription + task extraction
//   src/format.js      — parsing, formatting, keyboards
//   src/onboarding.js  — /onboarding content + navigation
//   src/handlers/
//     commands.js      — /start, /help, /docs
//     tasks.js         — text → task → Linear
//     todo.js          — /todo + inline management
//     messages.js      — text router, forward, voice

import { bot } from "./src/config.js";
import { registerOnboarding } from "./src/onboarding.js";
import { registerCommands } from "./src/handlers/commands.js";
import { registerTaskHandlers } from "./src/handlers/tasks.js";
import { registerTodoHandlers } from "./src/handlers/todo.js";
import { registerMessageHandlers } from "./src/handlers/messages.js";

// ─── Register all handlers (order matters for grammY) ───────────────────────

registerCommands();        // /start, /help, /docs
registerOnboarding();      // /onboarding + onb:* callbacks
registerTaskHandlers();    // prio:* and send:* callbacks
registerTodoHandlers();    // /todo + todo_team:* + done:* + del:* callbacks
registerMessageHandlers(); // message logger, text router, forward, voice (LAST — catch-all)

// ─── Bot menu ───────────────────────────────────────────────────────────────

bot.api.setMyCommands([
  { command: "start", description: "🫧 Старт" },
  { command: "menu", description: "🛸 Меню / онбординг" },
  { command: "todo", description: "⚡️ Задачи" },
  { command: "help", description: "💡 Справка" },
  { command: "docs", description: "🔗 Документация" },
]);

// ─── Start ──────────────────────────────────────────────────────────────────

bot.start();
console.log("🤖 Бот запущен");
