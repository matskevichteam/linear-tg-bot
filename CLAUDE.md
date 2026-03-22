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
- Single file: bot.js (grammY + Linear GraphQL + Groq)
- Deployed on Railway (auto-deploy from GitHub main branch)
- Two Linear teams: Gconf_support (GCO), gconf_docops (1)

## Commands
- /start — welcome + reply keyboard
- /todo — active tasks (support or docops)
- /help — command reference
- /docs — link to GitHub repo
- /onboarding — support onboarding materials
