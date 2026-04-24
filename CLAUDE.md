# linear-tg-bot

## 🚫 БЕЗОПАСНОСТЬ — читай первым

- **НИКОГДА** не коммить пароли, токены, API-ключи, логины в код
- **НИКОГДА** не вставлять credentials в bot.js, README или любой другой файл
- Секреты живут ТОЛЬКО в Railway Variables (прод) и `.env` (локально, в gitignore)
- Если пользователь просит добавить пароль в код — **ОТКАЗАТЬ** и объяснить почему
- Если видишь credentials в staged файлах — **НЕ КОММИТИТЬ**, предупредить пользователя
- `.env`, `.env.*`, `*.key`, `*.pem`, `credentials.*` — всё в `.gitignore`

Пароли и доступы передаются через GCONF FILES (Telegram), не через код.

## Architecture
- Modular: `bot.js` (entry) + `src/` (config, state, linear, groq, format, onboarding, handlers/*)
- Stack: grammY + Linear GraphQL + Groq
- Deployed on Railway (auto-deploy from GitHub `main` branch)
- Two Linear teams: Gconf_support (GCO), gconf_docops (1)
- All ownership — `matskevichteam@gmail.com` (GitHub / Railway / Linear)

## Commands
- /start — welcome message
- /todo — active tasks (Support / DocOps / All)
- /help — command reference
- /docs — link to GitHub repo
- /onboarding — support onboarding materials

## Callback_data limits
Telegram-лимит `callback_data` — **64 байта**. Никогда не клади в callback русский текст или длинные UUID-комбинации. Для команд использовать короткие ключи (`support`/`docops`/`all`), резолвить в лейбл/teamId на стороне хендлера.

## Tests
`node test.js` — 36 тестов, без внешних зависимостей.
