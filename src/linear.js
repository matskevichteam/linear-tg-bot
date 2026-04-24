// ─── Linear API ─────────────────────────────────────────────────────────────
// Все user-input'ы проходят ТОЛЬКО через GraphQL-переменные. В query-строку
// никогда не подставляем пользовательский текст — это защита от инъекций и
// от случайных ломающихся символов (`, \, ", \n).

export async function linearGQL(query, variables) {
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

export async function createLinearIssue({ title, description, priority, label, teamId }) {
  const priorityMap = { urgent: 1, high: 2, medium: 3, low: 4 };
  const json = await linearGQL(
    `mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { id title url } }
    }`,
    { input: { title, description, priority: priorityMap[priority] ?? 3, teamId } }
  );
  if (json.errors) console.error("❌ Linear API error:", JSON.stringify(json.errors));
  return json.data?.issueCreate?.issue ?? null;
}

export async function findIssueByKey(key) {
  // Сначала пробуем как UUID
  let json = await linearGQL(
    `query FindIssue($id: String!) { issue(id: $id) { id title url } }`,
    { id: key }
  );
  if (json.data?.issue) return json.data.issue;
  // Потом ищем по ключу (GCO-21)
  json = await linearGQL(
    `query SearchIssue($q: String!) { issueSearch(query: $q, first: 1) { nodes { id title url } } }`,
    { q: key }
  );
  return json.data?.issueSearch?.nodes?.[0] ?? null;
}

export async function getActiveIssues(teamId) {
  const filter = teamId
    ? { state: { type: { nin: ["completed", "cancelled"] } }, team: { id: { eq: teamId } } }
    : { state: { type: { nin: ["completed", "cancelled"] } } };
  const json = await linearGQL(
    `query ActiveIssues($filter: IssueFilter!) {
      issues(filter: $filter, orderBy: updatedAt, first: 30) {
        nodes { id title url priority state { name } team { name } }
      }
    }`,
    { filter }
  );
  return json.data?.issues?.nodes ?? [];
}

export async function createLinearComment(issueId, body) {
  const json = await linearGQL(
    `mutation CreateComment($input: CommentCreateInput!) {
      commentCreate(input: $input) { success }
    }`,
    { input: { issueId, body } }
  );
  return json.data?.commentCreate?.success ?? false;
}

// ─── Workflow states cache ──────────────────────────────────────────────────
// Раньше было hardcoded: Map<teamId, completedStateId>.
// Теперь грузится с Linear при старте. Hardcoded — fallback на случай оффлайна.

const FALLBACK_DONE_STATES = {
  "f36e0f1a-e439-44e8-8f43-22f92e37cde7": "fb379f65-11fc-4cf7-b289-2244b33bf58c", // support
  "75e41827-d5c1-4e80-89f0-7208651b74f0": "fbdfacab-ced5-4903-844d-2f2195fb2182", // docops
};
const doneStatesCache = new Map(Object.entries(FALLBACK_DONE_STATES));

export async function fetchDoneStates() {
  try {
    const json = await linearGQL(
      `query DoneStates {
        workflowStates(filter: { type: { eq: "completed" } }, first: 50) {
          nodes { id team { id } }
        }
      }`
    );
    const nodes = json.data?.workflowStates?.nodes ?? [];
    let count = 0;
    for (const node of nodes) {
      if (node.team?.id && node.id) {
        doneStatesCache.set(node.team.id, node.id);
        count++;
      }
    }
    console.log(`💾 linear: загружено ${count} Done state'ов`);
    return count;
  } catch (e) {
    console.error("⚠️ linear: не удалось загрузить workflow states, использую fallback:", e.message);
    return 0;
  }
}

export function getDoneStateId(teamId) {
  return doneStatesCache.get(teamId) ?? null;
}

// Тестовый хелпер
export const __internals = { doneStatesCache, FALLBACK_DONE_STATES };

export async function completeLinearIssue(id) {
  // Сначала узнаём команду задачи, потом ставим Done для этой команды
  const issueJson = await linearGQL(
    `query IssueTeam($id: String!) { issue(id: $id) { team { id } } }`,
    { id }
  );
  const teamId = issueJson.data?.issue?.team?.id;
  if (!teamId) return false;
  const stateId = getDoneStateId(teamId);
  if (!stateId) {
    console.error(`⚠️ completeLinearIssue: нет Done state'а для team ${teamId}`);
    return false;
  }
  const json = await linearGQL(
    `mutation CompleteIssue($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) { success }
    }`,
    { id, stateId }
  );
  return json.data?.issueUpdate?.success ?? false;
}

export async function deleteLinearIssue(id) {
  const json = await linearGQL(
    `mutation DeleteIssue($id: String!) { issueDelete(id: $id) { success } }`,
    { id }
  );
  return json.data?.issueDelete?.success ?? false;
}
