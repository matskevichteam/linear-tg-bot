import "dotenv/config";
import { Bot, Keyboard, InlineKeyboard } from "grammy";
import Groq from "groq-sdk";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Команды Linear ─────────────────────────────────────────────────────────

const TEAMS = {
  support: {
    id: process.env.LINEAR_TEAM_ID,
    name: "Support",
    emoji: "📋",
  },
  docops: {
    id: process.env.DOCOPS_TEAM_ID,
    name: "DocOps",
    emoji: "📁",
  },
};

// Ожидающие задачи (ждут выбор команды)
const pendingTask = new Map(); // chatId → { task, text }
const lastIssue = new Map();   // chatId → { id, title, url }

// ─── Linear API ─────────────────────────────────────────────────────────────

async function linearGQL(query, variables) {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: process.env.LINEAR_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function createLinearIssue({ title, description, priority, label, teamId }) {
  const priorityMap = { urgent: 1, high: 2, medium: 3, low: 4 };
  const json = await linearGQL(
    `mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { id title url } }
    }`,
    { input: { title, description, priority: priorityMap[priority] ?? 3, teamId } }
  );
  return json.data?.issueCreate?.issue ?? null;
}

async function findIssueByKey(key) {
  const json = await linearGQL(`{ issue(id: "${key}") { id title url } }`);
  return json.data?.issue ?? null;
}

async function getActiveIssues(teamId) {
  const filter = teamId
    ? `{ state: { type: { nin: ["completed", "cancelled"] } }, team: { id: { eq: "${teamId}" } } }`
    : `{ state: { type: { nin: ["completed", "cancelled"] } } }`;
  const json = await linearGQL(`{
    issues(filter: ${filter}, orderBy: updatedAt, first: 30) {
      nodes { id title url priority state { name } team { name } }
    }
  }`);
  return json.data?.issues?.nodes ?? [];
}

async function createLinearComment(issueId, body) {
  const json = await linearGQL(
    `mutation { commentCreate(input: { issueId: "${issueId}", body: "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" }) { success } }`
  );
  return json.data?.commentCreate?.success ?? false;
}

async function deleteLinearIssue(id) {
  const json = await linearGQL(`mutation { issueDelete(id: "${id}") { success } }`);
  return json.data?.issueDelete?.success ?? false;
}

// ─── Groq ───────────────────────────────────────────────────────────────────

async function downloadTelegramFile(fileId) {
  const res = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  );
  const data = await res.json();
  const filePath = data.result.file_path;
  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`
  );
  const buffer = await fileRes.arrayBuffer();
  return Buffer.from(buffer);
}

async function transcribeVoice(fileBuffer) {
  const file = new File([fileBuffer], "voice.ogg", { type: "audio/ogg" });
  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    language: "ru",
  });
  return transcription.text;
}

async function extractTasks(text) {
  const chat = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `Ты — ассистент для управления задачами. Из текста извлеки список задач.
Верни ТОЛЬКО JSON массив: [{"title": "...", "priority": "urgent|high|medium|low"}]
Без пояснений, только JSON. Если задача одна — массив из 1 элемента.
Приоритет: urgent (срочно/asap/горит), high (важно/нужно/надо), low (можно потом), medium (всё остальное).
Заголовок — краткий, до 60 символов, в инфинитиве.`,
      },
      { role: "user", content: text },
    ],
    temperature: 0.1,
  });
  try {
    const content = chat.choices[0].message.content.trim();
    const cleaned = content.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    return JSON.parse(cleaned);
  } catch {
    return [{ title: text.slice(0, 60), priority: "medium" }];
  }
}

// ─── Парсинг ────────────────────────────────────────────────────────────────

function parseTask(text) {
  const t = text.toLowerCase();

  const priorityExplicit = {
    urgent: ["urgent", "срочный", "срочная"],
    high:   ["высокий", "высокая", "high"],
    medium: ["средний", "средняя", "medium"],
    low:    ["низкий", "низкая", "low"],
  };
  const urgentWords = ["срочно", "asap", "горит", "прямо сейчас", "немедленно"];
  const highWords   = ["важно", "надо", "нужно", "важная", "не забудь", "обязательно"];

  let priority = "medium";
  for (const [p, words] of Object.entries(priorityExplicit)) {
    if (words.some(w => t.includes(w))) { priority = p; break; }
  }
  if (priority === "medium") {
    if (urgentWords.some(w => t.includes(w)))    priority = "urgent";
    else if (highWords.some(w => t.includes(w))) priority = "high";
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

// ─── Форматирование ─────────────────────────────────────────────────────────

const priorityEmoji = { urgent: "🔴", high: "🟠", medium: "🟡", low: "🟢" };
const priorityLabel = { urgent: "Срочно", high: "Высокий", medium: "Средний", low: "Низкий" };
const priorityMapEmoji = { 1: "🔴", 2: "🟠", 3: "🟡", 4: "🟢", 0: "⚪️" };

function formatReply(task, issue, teamName) {
  return `✅ Задача создана в Linear → ${teamName}\n\n📋 ${issue.title}\n${priorityEmoji[task.priority]} ${priorityLabel[task.priority]} · #${task.label}\n🔗 ${issue.url}`;
}

// ─── Выбор команды (inline кнопки) ──────────────────────────────────────────

function teamSelectKeyboard(prefix) {
  return new InlineKeyboard()
    .text(`${TEAMS.support.emoji} Support`, `${prefix}:support`)
    .text(`${TEAMS.docops.emoji} DocOps`, `${prefix}:docops`);
}

// ─── Обработка текста → задача → спросить команду ───────────────────────────

async function handleText(ctx, text) {
  try {
    await ctx.replyWithChatAction("typing");
    console.log("📨 Получил:", text);
    const task = parseTask(text);
    console.log("🧠 Распарсил:", task);

    // Сохраняем задачу, спрашиваем команду
    pendingTask.set(ctx.chat.id, { task });

    const pe = priorityEmoji[task.priority];
    const pl = priorityLabel[task.priority];
    await ctx.reply(
      `📝 *${task.title}*\n${pe} ${pl} · #${task.label}\n\nКуда отправить?`,
      { parse_mode: "Markdown", reply_markup: teamSelectKeyboard("send") }
    );
  } catch (e) {
    console.error("❌ Ошибка:", e);
    await ctx.reply("❌ Ошибка: " + e.message);
  }
}

// Выбрал команду → создаём задачу
bot.callbackQuery(/^send:(support|docops)$/, async (ctx) => {
  const teamKey = ctx.match[1];
  const team = TEAMS[teamKey];
  const pending = pendingTask.get(ctx.chat.id);
  if (!pending) return ctx.answerCallbackQuery({ text: "Задача не найдена", show_alert: true });

  pendingTask.delete(ctx.chat.id);

  const issue = await createLinearIssue({ ...pending.task, teamId: team.id });
  if (!issue) {
    await ctx.editMessageText("❌ Не удалось создать задачу в Linear");
    return ctx.answerCallbackQuery();
  }

  lastIssue.set(ctx.chat.id, issue);
  await ctx.editMessageText(formatReply(pending.task, issue, team.name));
  await ctx.answerCallbackQuery({ text: `✅ → ${team.name}` });
});

// ─── Старт, Help, Docs ─────────────────────────────────────────────────────

const HELP_TEXT = `
📋 *Как работать с ботом:*

*Создать задачу*
Просто напиши текст — выберешь команду (Support / DocOps)
🔗 [Linear Backlog](https://linear.app/gconf-support/team/GCO/backlog)
_логин: matskevichteam@gmail.com — доступ в GCONF FILES (tg)_

*Приоритет*
Пиши в начале: \`высокий\`, \`срочно\`, \`низкий\`
Или бот определит сам по словам

*Форвард*
Перешли любое сообщение → задача из него

*Голосовое*
Надиктуй → расшифрую и создам задачу

*Комментарий*
Ответь (reply) на сообщение бота → комментарий улетит в Linear

*Удалить задачу*
Ответь (reply) на сообщение бота и напиши \`удалить\`

*Команды*
/todo — список активных задач
/help — это сообщение
/docs — документация
`.trim();

bot.command("start", (ctx) => {
  const keyboard = new Keyboard().text("📚 Онбординг").resized();
  return ctx.reply(
    "Привет! Отправь мне:\n• Текст → создам задачу в Linear\n• Форвард → разберу и создам задачу\n• Голосовое → транскрибирую и создам задачи\n\n/todo — список активных задач\n/help — все команды\n/docs — документация по боту",
    { reply_markup: keyboard }
  );
});

bot.command("help", (ctx) => {
  return ctx.reply(HELP_TEXT, { parse_mode: "Markdown" });
});

bot.command("docs", (ctx) => {
  return ctx.reply(
    `📁 *Документация по боту*\n\nВесь код, README и исследования Linear API лежат здесь:\n[github.com/Pupeca/linear\\-tg\\-bot](https://github.com/Pupeca/linear-tg-bot)`,
    { parse_mode: "MarkdownV2" }
  );
});

// ─── /todo → выбор команды → список ─────────────────────────────────────────

bot.command("todo", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text(`${TEAMS.support.emoji} Support`, "todo_team:support")
    .text(`${TEAMS.docops.emoji} DocOps`, "todo_team:docops")
    .row()
    .text("📋 Все задачи", "todo_team:all");
  await ctx.reply("Какую команду показать?", { reply_markup: keyboard });
});

function formatIssueList(issues) {
  return issues
    .map(i => `${priorityMapEmoji[i.priority] ?? "⚪️"} ${i.title}`)
    .join("\n");
}

// Состояние 1: чистый список
function viewList(issues, teamLabel) {
  const text = `${teamLabel} — *Активные задачи (${issues.length}):*\n\n${formatIssueList(issues)}`;
  const keyboard = new InlineKeyboard().text("🔄 Обновить", `todo:refresh:${teamLabel}`);
  return { text, keyboard };
}

// Состояние 2: подтверждение удаления
function viewConfirm(issues, teamLabel) {
  const text = `${teamLabel} — *Активные задачи (${issues.length}):*\n\n${formatIssueList(issues)}\n\n_Хочешь удалить задачу?_`;
  const keyboard = new InlineKeyboard()
    .text("🗑 Удалить", `todo:delete_mode:${teamLabel}`)
    .text("⬅️ Назад", `todo:back:${teamLabel}`);
  return { text, keyboard };
}

// Состояние 3: список с кнопками удаления
function viewDeleteMode(issues, teamLabel) {
  const text = `${teamLabel} — *Выбери задачу для удаления:*`;
  const keyboard = new InlineKeyboard();
  for (const issue of issues) {
    const emoji = priorityMapEmoji[issue.priority] ?? "⚪️";
    const title = issue.title.length > 32 ? issue.title.slice(0, 30) + "…" : issue.title;
    keyboard.url(`${emoji} ${title}`, issue.url).text("🗑", `del:${issue.id}:${teamLabel}`).row();
  }
  keyboard.text("⬅️ Назад", `todo:back:${teamLabel}`);
  return { text, keyboard };
}

function resolveTeamId(teamLabel) {
  if (teamLabel === "📋 Все задачи") return null;
  for (const t of Object.values(TEAMS)) {
    if (`${t.emoji} ${t.name}` === teamLabel) return t.id;
  }
  return null;
}

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
bot.callbackQuery(/^todo:delete_mode:(.+)$/, async (ctx) => {
  const teamLabel = ctx.match[1];
  const teamId = resolveTeamId(teamLabel);
  const issues = await getActiveIssues(teamId);
  const { text, keyboard } = viewDeleteMode(issues, teamLabel);
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
    const { text, keyboard } = viewDeleteMode(issues, teamLabel);
    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
  }
  await ctx.answerCallbackQuery({ text: "🗑 Удалено" });
});

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
    const backKeyboard = new Keyboard().text("⬅️").resized();
    return ctx.reply(
      `📚 *Онбординг саппорта*\n\n` +
      `Добро пожаловать в команду! Здесь будут все нужные материалы:\n\n` +
      `• Как работать с задачами в Linear\n` +
      `• Правила коммуникации с клиентами\n` +
      `• Частые вопросы и ответы\n` +
      `• Полезные ссылки и контакты\n\n` +
      `_— материалы скоро появятся здесь —_`,
      { parse_mode: "Markdown", reply_markup: backKeyboard }
    );
  }

  // Назад → главное меню
  if (text === "⬅️") {
    const keyboard = new Keyboard().text("📚 Онбординг").resized();
    return ctx.reply(
      "Отправь мне:\n• Текст → создам задачу в Linear\n• Форвард → разберу и создам задачу\n• Голосовое → транскрибирую и создам задачи",
      { reply_markup: keyboard }
    );
  }

  // Удалить
  if (textLower === "удалить" || textLower === "/delete") {
    let issue = null;

    const replyText = ctx.message.reply_to_message?.text;
    if (replyText) {
      const urlMatch = replyText.match(/linear\.app\/[^\s]+\/issue\/([A-Z\d]+-\d+)\//);
      if (urlMatch) {
        issue = await findIssueByKey(urlMatch[1]);
      }
    }

    if (!issue) issue = lastIssue.get(ctx.chat.id);
    if (!issue) return ctx.reply("Нет задачи для удаления.\nОтветь (reply) на сообщение бота с нужной задачей и напиши «удалить».");

    const ok = await deleteLinearIssue(issue.id);
    if (ok) {
      lastIssue.delete(ctx.chat.id);
      return ctx.reply(`🗑 Удалено: ${issue.title}`);
    } else {
      return ctx.reply("❌ Не удалось удалить задачу");
    }
  }

  // Reply на сообщение бота → комментарий в Linear
  const replyText = ctx.message.reply_to_message?.text;
  if (replyText) {
    const urlMatch = replyText.match(/linear\.app\/[^\s]+\/issue\/([A-Z\d]+-\d+)\//);
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
    pendingTask.set(ctx.chat.id, { task });

    const pe = priorityEmoji[task.priority];
    const pl = priorityLabel[task.priority];
    await ctx.reply(
      `📝 *${task.title}*\n${pe} ${pl} · #${task.label}\n\nКуда отправить?`,
      { parse_mode: "Markdown", reply_markup: teamSelectKeyboard("send") }
    );
  } catch (e) {
    console.error("❌ Голосовое — ошибка:", e);
    await ctx.reply("❌ Ошибка: " + e.message);
  }
});

bot.start();
console.log("🤖 Бот запущен");
