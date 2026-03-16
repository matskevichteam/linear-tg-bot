import "dotenv/config";
import { Bot, Keyboard, InlineKeyboard } from "grammy";
import Groq from "groq-sdk";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Запоминаем последнюю задачу для каждого чата
const lastIssue = new Map(); // chatId → { id, title, url }

// ─── Linear ──────────────────────────────────────────────────────────────────

async function createLinearIssue({ title, description, priority, label }) {
  const priorityMap = { urgent: 1, high: 2, medium: 3, low: 4 };

  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: process.env.LINEAR_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        mutation CreateIssue($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue { id title url }
          }
        }
      `,
      variables: {
        input: {
          title,
          description,
          priority: priorityMap[priority] ?? 3,
          teamId: process.env.LINEAR_TEAM_ID,
        },
      },
    }),
  });

  const json = await res.json();
  return json.data?.issueCreate?.issue ?? null;
}

async function findIssueByKey(key) {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: process.env.LINEAR_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `{ issue(id: "${key}") { id title url } }`,
    }),
  });
  const json = await res.json();
  return json.data?.issue ?? null;
}

async function getActiveIssues() {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: process.env.LINEAR_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `{
        issues(
          filter: { state: { type: { nin: ["completed", "cancelled"] } } }
          orderBy: updatedAt
          first: 15
        ) {
          nodes { id title url priority state { name } }
        }
      }`,
    }),
  });
  const json = await res.json();
  return json.data?.issues?.nodes ?? [];
}

async function deleteLinearIssue(id) {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: process.env.LINEAR_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `mutation { issueDelete(id: "${id}") { success } }`,
    }),
  });
  const json = await res.json();
  return json.data?.issueDelete?.success ?? false;
}

// ─── Groq: скачать файл из Telegram ─────────────────────────────────────────

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

// ─── Groq: транскрипция (Whisper) ────────────────────────────────────────────

async function transcribeVoice(fileBuffer) {
  const file = new File([fileBuffer], "voice.ogg", { type: "audio/ogg" });
  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    language: "ru",
  });
  return transcription.text;
}

// ─── Groq: извлечь задачи из текста (LLaMA) ──────────────────────────────────

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

// ─── Парсинг задачи по ключевым словам (для текста) ─────────────────────────

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

// ─── Форматирование ───────────────────────────────────────────────────────────

const priorityEmoji  = { urgent: "🔴", high: "🟠", medium: "🟡", low: "🟢" };
const priorityLabel  = { urgent: "Срочно", high: "Высокий", medium: "Средний", low: "Низкий" };

function formatReply(task, issue) {
  return `✅ Задача создана в Linear\n\n📋 ${issue.title}\n${priorityEmoji[task.priority]} ${priorityLabel[task.priority]} · #${task.label}\n🔗 ${issue.url}`;
}

// ─── Обработка текстового сообщения ──────────────────────────────────────────

async function handleText(ctx, text) {
  try {
    await ctx.replyWithChatAction("typing");
    console.log("📨 Получил:", text);
    const task = parseTask(text);
    console.log("🧠 Распарсил:", task);
    const issue = await createLinearIssue(task);
    console.log("📋 Linear ответил:", issue);
    if (!issue) return ctx.reply("❌ Не удалось создать задачу в Linear");
    lastIssue.set(ctx.chat.id, issue);
    await ctx.reply(formatReply(task, issue));
  } catch (e) {
    console.error("❌ Ошибка:", e);
    await ctx.reply("❌ Ошибка: " + e.message);
  }
}

// ─── Старт ────────────────────────────────────────────────────────────────────

bot.command("start", (ctx) => {
  const keyboard = new Keyboard().text("📚 Онбординг").resized();
  return ctx.reply(
    "Привет! Отправь мне:\n• Текст → создам задачу в Linear\n• Форвард → разберу и создам задачу\n• Голосовое → транскрибирую и создам задачи\n\n/todo — список активных задач",
    { reply_markup: keyboard }
  );
});

bot.command("todo", async (ctx) => {
  try {
    await ctx.replyWithChatAction("typing");
    const issues = await getActiveIssues();
    if (issues.length === 0) return ctx.reply("Нет активных задач.");

    const priorityMap = { 1: "🔴", 2: "🟠", 3: "🟡", 4: "🟢", 0: "⚪️" };

    for (const issue of issues) {
      const keyboard = new InlineKeyboard().text("🗑 Удалить", `del:${issue.id}`);
      await ctx.reply(
        `${priorityMap[issue.priority] ?? "⚪️"} [${issue.title}](${issue.url})\n_${issue.state.name}_`,
        { parse_mode: "Markdown", disable_web_page_preview: true, reply_markup: keyboard }
      );
    }
  } catch (e) {
    console.error("❌ /todo ошибка:", e);
    await ctx.reply("❌ Ошибка: " + e.message);
  }
});

bot.callbackQuery(/^del:(.+)$/, async (ctx) => {
  const id = ctx.match[1];
  await ctx.answerCallbackQuery();
  const ok = await deleteLinearIssue(id);
  if (ok) {
    await ctx.editMessageText("🗑 Удалено", { reply_markup: new InlineKeyboard() });
  } else {
    await ctx.answerCallbackQuery({ text: "❌ Не удалось удалить", show_alert: true });
  }
});

// ─── Debug: ловим все сообщения ───────────────────────────────────────────────

bot.on("message", async (ctx, next) => {
  console.log("📩 Любое сообщение:", JSON.stringify(ctx.message, null, 2));
  await next();
});

// ─── Текст ────────────────────────────────────────────────────────────────────

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
      const urlMatch = replyText.match(/linear\.app\/[^\s]+\/issue\/([A-Z]+-\d+)\//);
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

  await handleText(ctx, text);
});

// ─── Форвард ──────────────────────────────────────────────────────────────────

bot.on("message:forward_origin", async (ctx) => {
  const text = ctx.message.text || ctx.message.caption;
  if (!text) return ctx.reply("⚠️ В форварде нет текста");
  await handleText(ctx, `[Переслано] ${text}`);
});

// ─── Голосовое ────────────────────────────────────────────────────────────────

bot.on("message:voice", async (ctx) => {
  try {
    await ctx.replyWithChatAction("typing");
    await ctx.reply("🎤 Расшифровываю...");

    const fileBuffer = await downloadTelegramFile(ctx.message.voice.file_id);
    const transcript = await transcribeVoice(fileBuffer);
    console.log("🎤 Транскрипция:", transcript);

    await ctx.reply(`🎤 _${transcript}_`, { parse_mode: "Markdown" });
    await ctx.replyWithChatAction("typing");

    const tasks = await extractTasks(transcript);
    console.log("🧠 Задачи из голосового:", tasks);

    const created = [];
    for (const t of tasks) {
      const issue = await createLinearIssue({
        title: t.title,
        description: transcript,
        priority: t.priority,
        label: "операционка",
      });
      if (issue) {
        lastIssue.set(ctx.chat.id, issue);
        created.push({ task: t, issue });
      }
    }

    if (created.length === 0) return ctx.reply("❌ Не удалось создать задачи");

    const reply = created
      .map(({ task, issue }) =>
        `✅ ${issue.title}\n${priorityEmoji[task.priority]} ${priorityLabel[task.priority]}\n🔗 ${issue.url}`
      )
      .join("\n\n");

    await ctx.reply(reply);
  } catch (e) {
    console.error("❌ Голосовое — ошибка:", e);
    await ctx.reply("❌ Ошибка: " + e.message);
  }
});

bot.start();
console.log("🤖 Бот запущен");
