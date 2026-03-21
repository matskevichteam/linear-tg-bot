# Linear TG Bot

Telegram-бот для управления задачами в Linear. Создаёт задачи голосом, текстом или форвардом — прямо из Telegram.

## Возможности

- **Текст → задача** — напиши текст, выбери команду (Support / DocOps), задача создана
- **Голосовое → задача** — расшифровка через Groq Whisper + автоприоритет
- **Форвард → задача** — перешли сообщение, бот создаст задачу
- **Мульти-команда** — задачи маршрутизируются в Support или DocOps
- **Автоприоритет** — по ключевым словам (`срочно`, `высокий`, `важно`)
- **Автолейблы** — `саппорт`, `контент`, `платежи`, `операционка`
- **Reply → комментарий** — ответь на сообщение бота, комментарий улетит в Linear
- **Reply + "удалить"** — удаляет задачу из Linear
- **`/todo`** — список активных задач по команде, удаление через inline-кнопки
- **`/help`** — все команды и подсказки
- **`/docs`** — ссылка на документацию
- **`/onboarding`** — интерактивный онбординг с inline-навигацией (вход, тон, флоу)

## Стек

- [grammY](https://grammy.dev/) — Telegram Bot framework
- [Linear GraphQL API](https://developers.linear.app/) — создание и управление задачами
- [Groq](https://groq.com/) — транскрипция голоса (Whisper-large-v3) + извлечение задач (LLaMA 3.3 70B)
- [Railway](https://railway.app/) — деплой и хостинг

## Установка

```bash
git clone https://github.com/matskevichteam/linear-tg-bot
cd linear-tg-bot
npm install
```

Создай `.env`:

```env
TELEGRAM_BOT_TOKEN=...
LINEAR_API_KEY=...
LINEAR_TEAM_ID=...         # UUID команды Support
DOCOPS_TEAM_ID=...         # UUID команды DocOps
GROQ_API_KEY=...
```

### Как получить Team ID

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: YOUR_LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ teams { nodes { id name key } } }"}' | python3 -m json.tool
```

## Запуск

```bash
npm start
```

## Команды

| Команда | Описание |
|---|---|
| `/start` | Главное меню |
| `/todo` | Список активных задач (Support / DocOps / Все) |
| `/help` | Все команды и подсказки |
| `/docs` | Ссылка на GitHub-документацию |
| `/onboarding` | Интерактивный онбординг (вход → тон → флоу) |
| `удалить` | Удалить задачу (reply на сообщение бота) |

## Приоритеты

Бот определяет приоритет автоматически по ключевым словам:

| Слова | Приоритет |
|---|---|
| срочно, asap, горит | 🔴 Срочно |
| высокий, важно, нужно | 🟠 Высокий |
| средний, medium | 🟡 Средний |
| низкий, low | 🟢 Низкий |

Или явно: `высокий - доделать документацию`

## Архитектура

```
Telegram Message
  ↓
grammY bot
  ↓
┌─────────────────────┐
│ Текст / Форвард     │ → parseTask() → [Support | DocOps] → Linear issueCreate
│ Голосовое           │ → Groq Whisper → parseTask() → [Support | DocOps] → Linear
│ Reply (текст)       │ → Linear commentCreate
│ Reply + "удалить"   │ → Linear issueDelete
│ /todo               │ → [Support | DocOps | Все] → Linear issues query
└─────────────────────┘
```

## Деплой на Railway

1. Push на GitHub
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Variables → добавить все 5 ключей из `.env`
4. Готово — бот работает 24/7

## Roadmap

- [ ] Webhook Linear → Telegram (уведомления об изменениях)
- [ ] Назначение исполнителя (`@имя задача`)
- [ ] Дедлайны естественным языком (`в пятницу`, `завтра`)
- [ ] Авторотация по ключевым словам (auto-detect команды без выбора)
- [ ] Статус задачи через reply (`в работе`, `готово`)
- [ ] Групповые чаты (каждый чат привязан к своей команде Linear)
