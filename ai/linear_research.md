# Linear API Research — Telegram Bot Integration

## Аутентификация

- **Personal API Key** — 1500 запросов/час
- **OAuth 2.0** — 500 запросов/час (для мульти-юзер приложений)
- Endpoint: `https://api.linear.app/graphql`
- Headers: `Authorization: <api-key>`, `Content-Type: application/json`

---

## IssueCreateInput — все поля при создании задачи

| Поле | Тип | Описание |
|---|---|---|
| `teamId` | UUID | Команда (обязательно) |
| `title` | String | Заголовок |
| `description` | String | Описание (markdown) |
| `priority` | Int | 1=Urgent, 2=High, 3=Medium, 4=Low |
| `stateId` | UUID | Статус (по умолчанию — первый Backlog) |
| `assigneeId` | UUID | Назначить исполнителя |
| `labelIds` | [UUID] | Массив меток |
| `dueDate` | ISO 8601 | Дедлайн |
| `estimate` | Int | Story points |
| `projectId` | UUID | Проект |
| `cycleId` | UUID | Спринт/цикл |
| `parentIssueId` | UUID | Родительская задача (sub-task) |

---

## IssueUpdateInput — обновление существующей задачи

Те же поля что при создании + можно менять по `id` или короткому ключу (GCO-21).

---

## Мутации

### Задачи
```graphql
issueCreate(input: IssueCreateInput!)
issueUpdate(id: String!, input: IssueUpdateInput!)
issueDelete(id: String!)
archiveIssue(id: String!)
restoreIssue(id: String!)
```

### Комментарии
```graphql
commentCreate(input: { issueId: String!, body: String! })
commentUpdate(id: String!, input: { body: String! })
commentDelete(id: String!)
```

### Связи между задачами
```graphql
issueRelationCreate(input: { issueId, relatedIssueId, type })
# type: blocks | blocked_by | duplicate_of | duplicates | relates_to
```

### Проекты и циклы
```graphql
projectCreate(input: { name, teamId, ... })
cycleCreate(input: { teamId, name, startDate, endDate })
```

### Вебхуки
```graphql
webhookCreate(input: { url, teamId, resourceTypes: [Issue, Comment, ...] })
webhookDelete(id: String!)
```

---

## Полезные запросы (queries)

```graphql
# Получить всех пользователей команды
{ team(id: "team-uuid") { members { nodes { id name email } } } }

# Активные задачи команды
{
  issues(filter: {
    state: { type: { nin: ["completed", "cancelled"] } }
    team: { id: { eq: "team-uuid" } }
  }) {
    nodes { id title url priority state { name } assignee { name } dueDate }
  }
}

# Задачи конкретного исполнителя
{
  user(id: "user-uuid") {
    assignedIssues { nodes { id title url priority state { name } } }
  }
}

# Все проекты
{ projects { nodes { id name status } } }

# Все метки команды
{ team(id: "team-uuid") { labels { nodes { id name color } } } }
```

---

## Вебхуки — Linear → Telegram

### Что умеют
Linear отправляет POST на твой URL при любом событии:

| Событие | Когда |
|---|---|
| `Issue create` | Новая задача |
| `Issue update` | Изменение статуса, приоритета, assignee |
| `Issue remove` | Удаление |
| `Comment create` | Новый комментарий |
| `Comment update` | Правка комментария |

### Структура payload
```json
{
  "action": "create|update|remove",
  "type": "Issue|Comment|Project",
  "actor": { "id": "...", "name": "Julia" },
  "data": {
    "id": "issue-uuid",
    "title": "Написать контент",
    "url": "https://linear.app/...",
    "state": { "name": "In Progress" },
    "priority": 2
  },
  "updatedFrom": { "stateId": "old-state-uuid" }
}
```

### Безопасность
- Заголовок `Linear-Signature` — HMAC-SHA256 подпись тела запроса
- Таймаут ответа: 5 секунд
- Ретраи: через 1 мин, 1 час, 6 часов (макс 3 попытки)

### Регистрация вебхука
```graphql
mutation {
  webhookCreate(input: {
    url: "https://твой-railway-домен.railway.app/webhook"
    teamId: "team-uuid"
    resourceTypes: ["Issue", "Comment"]
  }) {
    webhook { id secret }
  }
}
```

---

## Топ-5 фич для добавления в бота

### 1. Статусы через reply
```
Пользователь отвечает на сообщение бота: "в работе"
→ issueUpdate(stateId: <In Progress id>)
```

### 2. Дедлайны естественным языком
```
"позвонить Диме завтра" → dueDate = new Date() + 1
"сдать в пятницу" → парсинг дня недели
```

### 3. Назначить исполнителя
```
"@julia проверить договор"
→ найти Linear user по имени → assigneeId
```

### 4. Комментарии из Telegram
```
Reply на сообщение бота с задачей → commentCreate(issueId, body)
```

### 5. Уведомления Linear → Telegram (webhook)
```
Задача закрыта → бот пишет в чат:
"✅ GCO-21 закрыта — Написать контент (Julia)"

Задача назначена → бот пишет назначенному:
"📌 Тебе назначена задача: Проверить договор"
```

---

## Мульти-командная схема

```
Telegram группа #support → LINEAR_TEAM_ID = support-uuid
Telegram группа #legal   → LINEAR_TEAM_ID = legal-uuid
Telegram группа #mktg    → LINEAR_TEAM_ID = marketing-uuid
```

В боте: `chatId → teamId` маппинг в .env или конфиге.

---

## Полезные ссылки

- [Linear GraphQL API](https://developers.linear.app/docs/graphql/working-with-the-graphql-api)
- [Linear Webhooks](https://developers.linear.app/docs/webhooks)
- [GraphQL Schema Explorer](https://studio.apollographql.com/public/Linear-API/variant/current/schema)
