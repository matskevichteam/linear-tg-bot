// ─── Онбординг контент + навигация ──────────────────────────────────────────

import { bot, InlineKeyboard } from "./config.js";

const ONB = {
  main: {
    text:
      `📚 *Онбординг*\n\n` +
      `привет 💙\n` +
      `тут коротко про то, кто за что, где что лежит и как у нас всё устроено.\n` +
      `посмотри один раз — и будешь ориентироваться.`,
    kb: () => new InlineKeyboard()
      .text("🛸 Вход", "onb:part1").row()
      .text("🎤 Тон", "onb:part2").row()
      .text("⚡️ Флоу", "onb:part3").row()
      .text("⬅️", "onb:close"),
  },

  // ── Часть 1 ──
  part1: {
    text:
      `🛸 *Вход*\n\n` +
      `настраиваем пилотную панель.`,
    kb: () => new InlineKeyboard()
      .text("🗝 Доступы", "onb:p1:access").row()
      .text("🧬 AI Setup", "onb:p1:tools").row()
      .text("🫂 Команда", "onb:p1:team").row()
      .text("⬅️", "onb:back"),
  },
  "p1:access": {
    text:
      `✅ *чеклист доступов*\n\n` +
      `тебе понадобятся:\n` +
      `1. github-репо (matsako/gconf)\n` +
      `2. AI setup — настроить свой флоу\n` +
      `3. gconf админка — инвойсы и доступы\n` +
      `4. quick replies в telegram — шаблоны частых ответов\n\n` +
      `*дополнительно:*\n` +
      `• linear — трекер задач support / docops\n` +
      `• MASTER\\_INTAKE (google sheet) — таблица докопса\n\n` +
      `🔑 *где пароли и доступы:*\n` +
      `• gconf files (telegram, support-чат) — dump доступов\n` +
      `• @matsako или @natashadzera`,
    kb: () => new InlineKeyboard().text("⬅️", "onb:part1"),
  },
  "p1:tools": {
    text:
      `🛠 *AI Setup*\n\n` +
      `📦 *GitHub-репо*\n` +
      `приватный репозиторий — артефакты, промпты, кейсы.\n\n` +
      `🤖 *этот бот*\n` +
      `/todo — задачи, /help — справка.\n` +
      `текст или голосовое → задача улетит в Linear.\n\n` +
      `📝 *Cursor* — $20/мес (к @matsako)\n` +
      `AI-редактор. корп. аккаунт.\n\n` +
      `⌨️ *Claude Code / Codex* — $20/мес (к @matsako)\n` +
      `работает через терминал внутри Cursor.`,
    kb: () => new InlineKeyboard().text("⬅️", "onb:part1"),
  },
  "p1:team": {
    text:
      `👥 *команда: кто за что*\n\n` +
      `*Лёша Травкин* @atassist — возвраты, платёжные системы, инвойсы, акты\n\n` +
      `*Лера* @Vahadaldeneg — ЭДО\n\n` +
      `*Наташа Дзера* @NatashaDzera — опс\n\n` +
      `*Юля Мацако* @jmatsako — CEO, стратегия, доступы\n\n` +
      `*Полина* @radikalno — договоры, юрлица _(не писать)_`,
    kb: () => new InlineKeyboard().text("⬅️", "onb:part1"),
  },

  // ── Часть 2 ──
  part2: {
    text:
      `🎤 *Тон*\n\n` +
      `как мы звучим и почему это важно.`,
    kb: () => new InlineKeyboard()
      .text("🪩 Стиль", "onb:p2:tone").row()
      .text("🗃 Материалы", "onb:p2:materials").row()
      .text("⬅️", "onb:back"),
  },
  "p2:tone": {
    text:
      `🎯 *тон и стиль*\n\n` +
      `позиция — «рядом».\n` +
      `не сверху. не снизу. рядом.\n\n` +
      `*начинаем с вопроса.*\n` +
      `мы не начинаем диалог с рассказа о курсе. сначала задаём 1–2 вопроса — чем занимается, какой контекст, зачем пишет. и уже потом помогаем принять решение.\n\n` +
      `_«расскажи, пожалуйста, о своих идеях/задачах — чего хочешь от обучения?»_\n\n` +
      `• не доказываем экспертность\n` +
      `• не поучаем, не продаём в лоб\n` +
      `• делимся тем, как делаем сами\n` +
      `• говорим от «мы», обращаемся на «ты»\n\n` +
      `*пример:*\n` +
      `_приветик! индивидуальный формат мы не делаем, мы повторяем поток каждые 63 дня. мы не забираем доступы и все звонки будут в записи — можно в своём темпе добирать ценность._`,
    kb: () => new InlineKeyboard().text("⬅️", "onb:part2"),
  },
  "p2:materials": {
    text:
      `📖 *материалы и самопроверка*\n\n` +
      `в репо лежат файлы, по которым можно сверить свой тон:\n\n` +
      `• *плейбук:* 10-support/Playbook/support\\_playbook.md\n` +
      `• *grand verbatim:* 10-support/data/grand-verbatim-base.md\n` +
      `  (100+ реальных диалогов — наш source of truth, до января 2026)\n` +
      `• *grand verbatim 2:* 10-support/data/grand\\_verbatim\\_2\\_27.03.md\n` +
      `  (327 чатов с 01.03.2026 — свежие кейсы)\n` +
      `• *FAQ:* 10-support/FAQ/faq\\_inner/FAQ\\_V1.md\n\n` +
      `💡 *как проверить себя:*\n` +
      `открой Cursor, вставь свой ответ и напиши:\n` +
      `_«прочитай playbook и grand-verbatim в 10-support/ и скажи, попадаю ли я в наш тон. дай рекомендации»_\n\n` +
      `📌 последнее обновление — 27.03.2026. чтобы обновить: загрузи новые чаты в data/raw/ и запусти /update-support-kb`,
    kb: () => new InlineKeyboard().text("⬅️", "onb:part2"),
  },

  // ── Часть 3 ──
  part3: {
    text:
      `⚡️ *Флоу*\n\n` +
      `что делаешь каждый день и куда смотреть.`,
    kb: () => new InlineKeyboard()
      .text("🫧 Ответы", "onb:p3:answers").row()
      .text("🎛 Админка", "onb:p3:access").row()
      .text("🌀 DocOps", "onb:p3:docops").row()
      .text("🔬 Knowledge Base", "onb:p3:kb").row()
      .text("⬅️", "onb:back"),
  },
  "p3:answers": {
    text:
      `💬 *ответы*\n\n` +
      `если не знаешь что ответить:\n\n` +
      `1. поищи в Cursor:\n` +
      `FAQ → tech\\_support\\_guides → grand-verbatim → спроси claude\n\n` +
      `2. уточни у Юли или Наташи\n\n` +
      `3. по конкретным темам:\n` +
      `• возвраты → @atassist\n` +
      `• ЭДО → @Vahadaldeneg\n` +
      `• стратегия → @jmatsako\n` +
      `• опс → @NatashaDzera\n` +
      `• документы → _см. чат gconf | документооборот_`,
    kb: () => new InlineKeyboard().text("⬅️", "onb:part3"),
  },
  "p3:access": {
    text:
      `🔑 *доступы и админка*\n\n` +
      `\`https://admin-ui-production-f2ff.up.railway.app/login\`\n\n` +
      `логин и пароль → GCONF FILES (tg)\n\n` +
      `• *payments* — инвойсы\n` +
      `• *promocodes* — промокоды\n` +
      `• *user journey* — проверка юзера по тг`,
    kb: () => new InlineKeyboard().text("⬅️", "onb:part3"),
  },
  "p3:docops": {
    text:
      `📄 *DocOps*\n\n` +
      `• инвойсы — в админке\n` +
      `• флоу со статусами инвойсов/актов пока не реализован\n` +
      `• поэтому MASTER\\_INTAKE (таблица) дублирует админку — чтобы отслеживать статусы и коллаборировать с Лёшей Травкиным по ЭДО и возвратам\n\n` +
      `📌 растёт ~20%/мес\n` +
      `надо автоматизировать с Linear и избавляться от таблицы → переход на Linear + админка`,
    kb: () => new InlineKeyboard().text("⬅️", "onb:part3"),
  },
  "p3:kb": {
    text:
      `🔬 *knowledge base*\n\n` +
      `в саппорте 3 системы, которые стоит поддерживать:\n\n` +
      `1. *knowledge base* — FAQ, grand verbatim, SOP\n` +
      `обновляется через скилл в Cursor: /update-support-kb\n\n` +
      `2. *техгайд* — решения по техническим проблемам участников\n` +
      `10-support/FAQ/tech\\_support\\_guides.md\n\n` +
      `3. *этот бот* — онбординг, задачи, справка\n` +
      `документация → /docs\n\n` +
      `📎 *Master Intake* (реликт) — если надо проверить старые статусы по платежам:\n` +
      `[открыть таблицу](https://docs.google.com/spreadsheets/d/1R4142Q-z8oYeH3BRKWidQ5piykI9Tra5Iwinm-AEnKY/edit?usp=sharing)\n\n` +
      `эти штуки помогают не терять знания и масштабироваться 💙`,
    kb: () => new InlineKeyboard().text("⬅️", "onb:part3"),
  },
};

// ─── Export for use in message handler (keyboard button "📚 Онбординг") ─────

export { ONB };

// ─── Register handlers ──────────────────────────────────────────────────────

export function registerOnboarding() {
  const openMain = async (ctx) => {
    const { text, kb } = ONB.main;
    return ctx.reply(text, { parse_mode: "Markdown", reply_markup: kb() });
  };
  bot.command("onboarding", openMain);
  bot.command("menu", openMain);

  // Навигация по онбордингу
  bot.callbackQuery(/^onb:(.+)$/, async (ctx) => {
    const key = ctx.match[1];

    if (key === "back") {
      const { text, kb } = ONB.main;
      await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: kb() });
      return ctx.answerCallbackQuery();
    }

    if (key === "close") {
      await ctx.editMessageText("📚 онбординг закрыт. /onboarding чтобы открыть снова.");
      return ctx.answerCallbackQuery();
    }

    const section = ONB[key];
    if (!section) return ctx.answerCallbackQuery({ text: "Раздел не найден", show_alert: true });

    await ctx.editMessageText(section.text, { parse_mode: "Markdown", reply_markup: section.kb() });
    await ctx.answerCallbackQuery();
  });
}
