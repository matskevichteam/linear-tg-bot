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
  let json = await linearGQL(`{ issue(id: "${key}") { id title url } }`);
  if (json.data?.issue) return json.data.issue;
  // Потом ищем по ключу (GCO-21)
  json = await linearGQL(`{ issueSearch(query: "${key}", first: 1) { nodes { id title url } } }`);
  return json.data?.issueSearch?.nodes?.[0] ?? null;
}

export async function getActiveIssues(teamId) {
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

export async function createLinearComment(issueId, body) {
  const json = await linearGQL(
    `mutation { commentCreate(input: { issueId: "${issueId}", body: "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" }) { success } }`
  );
  return json.data?.commentCreate?.success ?? false;
}

export async function completeLinearIssue(id) {
  // Сначала узнаём команду задачи, потом ставим Done для этой команды
  const issueJson = await linearGQL(`{ issue(id: "${id}") { team { id } } }`);
  const teamId = issueJson.data?.issue?.team?.id;
  const doneStates = {
    "f36e0f1a-e439-44e8-8f43-22f92e37cde7": "fb379f65-11fc-4cf7-b289-2244b33bf58c", // support
    "75e41827-d5c1-4e80-89f0-7208651b74f0": "fbdfacab-ced5-4903-844d-2f2195fb2182", // docops
  };
  const stateId = doneStates[teamId];
  if (!stateId) return false;
  const json = await linearGQL(
    `mutation { issueUpdate(id: "${id}", input: { stateId: "${stateId}" }) { success } }`
  );
  return json.data?.issueUpdate?.success ?? false;
}

export async function deleteLinearIssue(id) {
  const json = await linearGQL(`mutation { issueDelete(id: "${id}") { success } }`);
  return json.data?.issueDelete?.success ?? false;
}
