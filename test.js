// ─── Tests: modular refactoring verification ────────────────────────────────
// Run: node test.js
// No dependencies — uses Node.js built-in assert

import assert from "node:assert";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n📦 Module imports");
// ═══════════════════════════════════════════════════════════════════════════════

const config = await import("./src/config.js");
const state = await import("./src/state.js");
const linear = await import("./src/linear.js");
const groqMod = await import("./src/groq.js");
const format = await import("./src/format.js");
const onboarding = await import("./src/onboarding.js");
const commands = await import("./src/handlers/commands.js");
const tasks = await import("./src/handlers/tasks.js");
const todo = await import("./src/handlers/todo.js");
const messages = await import("./src/handlers/messages.js");

test("config exports bot, groq, TEAMS, Keyboard, InlineKeyboard", () => {
  assert.ok(config.bot);
  assert.ok(config.groq);
  assert.ok(config.TEAMS);
  assert.ok(config.TEAMS.support);
  assert.ok(config.TEAMS.docops);
  assert.ok(config.Keyboard);
  assert.ok(config.InlineKeyboard);
});

test("state exports all getters/setters", () => {
  assert.strictEqual(typeof state.getPending, "function");
  assert.strictEqual(typeof state.setPending, "function");
  assert.strictEqual(typeof state.deletePending, "function");
  assert.strictEqual(typeof state.getLastIssue, "function");
  assert.strictEqual(typeof state.setLastIssue, "function");
  assert.strictEqual(typeof state.deleteLastIssue, "function");
  assert.strictEqual(typeof state.recoverPending, "function");
});

test("linear exports all 6 API functions", () => {
  assert.strictEqual(typeof linear.createLinearIssue, "function");
  assert.strictEqual(typeof linear.findIssueByKey, "function");
  assert.strictEqual(typeof linear.getActiveIssues, "function");
  assert.strictEqual(typeof linear.createLinearComment, "function");
  assert.strictEqual(typeof linear.completeLinearIssue, "function");
  assert.strictEqual(typeof linear.deleteLinearIssue, "function");
});

test("groq exports downloadTelegramFile, transcribeVoice, extractTasks", () => {
  assert.strictEqual(typeof groqMod.downloadTelegramFile, "function");
  assert.strictEqual(typeof groqMod.transcribeVoice, "function");
  assert.strictEqual(typeof groqMod.extractTasks, "function");
});

test("format exports all functions and constants", () => {
  assert.ok(format.priorityEmoji);
  assert.ok(format.priorityLabel);
  assert.ok(format.priorityMapEmoji);
  assert.strictEqual(typeof format.parseTask, "function");
  assert.strictEqual(typeof format.formatReply, "function");
  assert.strictEqual(typeof format.taskSelectKeyboard, "function");
  assert.strictEqual(typeof format.formatIssueList, "function");
  assert.strictEqual(typeof format.viewList, "function");
  assert.strictEqual(typeof format.viewConfirm, "function");
  assert.strictEqual(typeof format.viewEditMode, "function");
  assert.strictEqual(typeof format.resolveTeamId, "function");
});

test("onboarding exports ONB and registerOnboarding", () => {
  assert.ok(onboarding.ONB);
  assert.strictEqual(typeof onboarding.registerOnboarding, "function");
});

test("handlers export register functions", () => {
  assert.strictEqual(typeof commands.registerCommands, "function");
  assert.strictEqual(typeof tasks.registerTaskHandlers, "function");
  assert.strictEqual(typeof tasks.handleText, "function");
  assert.strictEqual(typeof todo.registerTodoHandlers, "function");
  assert.strictEqual(typeof messages.registerMessageHandlers, "function");
});

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n🧠 parseTask");
// ═══════════════════════════════════════════════════════════════════════════════

test("simple text → medium priority, операционка label", () => {
  const t = format.parseTask("позвонить клиенту");
  assert.strictEqual(t.title, "позвонить клиенту");
  assert.strictEqual(t.priority, "medium");
  assert.strictEqual(t.label, "операционка");
});

test("urgent keyword → high priority", () => {
  const t = format.parseTask("срочно проверить оплату");
  assert.strictEqual(t.priority, "high");
});

test("important keyword → high priority", () => {
  const t = format.parseTask("важно: проверить доступ");
  assert.strictEqual(t.priority, "high");
});

test("low keyword → low priority", () => {
  const t = format.parseTask("низкий — обновить FAQ");
  assert.strictEqual(t.priority, "low");
});

test("payment keywords → платежи label", () => {
  const t = format.parseTask("выставить инвойс для ООО Рога");
  assert.strictEqual(t.label, "платежи");
});

test("support keywords → саппорт label", () => {
  const t = format.parseTask("открой доступ для нового участника");
  assert.strictEqual(t.label, "саппорт");
});

test("content keywords → контент label", () => {
  const t = format.parseTask("написать пост про обновление");
  assert.strictEqual(t.label, "контент");
});

test("long title → truncated to 60 chars", () => {
  const long = "a".repeat(100);
  const t = format.parseTask(long);
  assert.ok(t.title.length <= 60);
  assert.ok(t.title.endsWith("..."));
});

test("priority prefix removed from title", () => {
  const t = format.parseTask("срочно - позвонить клиенту");
  assert.strictEqual(t.title, "позвонить клиенту");
});

test("description preserves full text", () => {
  const text = "первая строка\nвторая строка\nтретья";
  const t = format.parseTask(text);
  assert.strictEqual(t.description, text);
  assert.strictEqual(t.title, "первая строка");
});

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n📊 Format functions");
// ═══════════════════════════════════════════════════════════════════════════════

test("formatReply contains issue title and URL", () => {
  const task = { priority: "high", label: "платежи" };
  const issue = { title: "Тестовая задача", url: "https://linear.app/test" };
  const reply = format.formatReply(task, issue, "Support");
  assert.ok(reply.includes("Тестовая задача"));
  assert.ok(reply.includes("https://linear.app/test"));
  assert.ok(reply.includes("Support"));
  assert.ok(reply.includes("🔴"));
});

test("priorityEmoji has all three levels", () => {
  assert.strictEqual(format.priorityEmoji.high, "🔴");
  assert.strictEqual(format.priorityEmoji.medium, "🟡");
  assert.strictEqual(format.priorityEmoji.low, "🟢");
});

test("priorityMapEmoji maps Linear priority ints", () => {
  assert.strictEqual(format.priorityMapEmoji[1], "🔴");
  assert.strictEqual(format.priorityMapEmoji[3], "🟡");
  assert.strictEqual(format.priorityMapEmoji[4], "🟢");
});

test("formatIssueList formats multiple issues", () => {
  const issues = [
    { title: "Task A", priority: 2 },
    { title: "Task B", priority: 4 },
  ];
  const list = format.formatIssueList(issues);
  assert.ok(list.includes("Task A"));
  assert.ok(list.includes("Task B"));
  assert.ok(list.includes("🔴"));
  assert.ok(list.includes("🟢"));
});

test("resolveTeamId returns null for 'Все задачи'", () => {
  assert.strictEqual(format.resolveTeamId("📋 Все задачи"), null);
});

test("taskSelectKeyboard returns InlineKeyboard", () => {
  const kb = format.taskSelectKeyboard("high");
  assert.ok(kb);
});

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n💾 State management");
// ═══════════════════════════════════════════════════════════════════════════════

test("setPending / getPending / deletePending", () => {
  state.setPending(123, { task: { title: "test" } });
  assert.deepStrictEqual(state.getPending(123), { task: { title: "test" } });
  state.deletePending(123);
  assert.strictEqual(state.getPending(123), undefined);
});

test("setLastIssue / getLastIssue / deleteLastIssue", () => {
  state.setLastIssue(456, { id: "abc", title: "issue", url: "https://example.com" });
  assert.deepStrictEqual(state.getLastIssue(456), { id: "abc", title: "issue", url: "https://example.com" });
  state.deleteLastIssue(456);
  assert.strictEqual(state.getLastIssue(456), undefined);
});

test("getPending returns undefined for unknown chatId", () => {
  assert.strictEqual(state.getPending(99999), undefined);
});

test("recoverPending returns null for empty context", () => {
  const fakeCtx = { callbackQuery: { message: { text: "" } }, chat: { id: 777 } };
  assert.strictEqual(state.recoverPending(fakeCtx), null);
});

test("recoverPending extracts title from bot message", () => {
  const fakeCtx = {
    callbackQuery: { message: { text: "📝 Позвонить клиенту\n🟡 средний · #операционка" } },
    chat: { id: 888 },
  };
  const result = state.recoverPending(fakeCtx);
  assert.ok(result);
  assert.strictEqual(result.task.title, "Позвонить клиенту");
  assert.strictEqual(result.task.priority, "medium");
  // cleanup
  state.deletePending(888);
});

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n🛸 Onboarding");
// ═══════════════════════════════════════════════════════════════════════════════

test("ONB.main has text and kb", () => {
  assert.ok(onboarding.ONB.main.text);
  assert.strictEqual(typeof onboarding.ONB.main.kb, "function");
});

test("ONB has all sections", () => {
  const keys = Object.keys(onboarding.ONB);
  assert.ok(keys.includes("main"));
  assert.ok(keys.includes("part1"));
  assert.ok(keys.includes("part2"));
  assert.ok(keys.includes("part3"));
  assert.ok(keys.includes("p1:access"));
  assert.ok(keys.includes("p2:tone"));
  assert.ok(keys.includes("p3:docops"));
});

test("each ONB section has text and kb function", () => {
  for (const [key, section] of Object.entries(onboarding.ONB)) {
    assert.ok(section.text, `${key} missing text`);
    assert.strictEqual(typeof section.kb, "function", `${key} missing kb function`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n📋 TEAMS config");
// ═══════════════════════════════════════════════════════════════════════════════

test("TEAMS.support has id, name, emoji", () => {
  assert.ok(config.TEAMS.support.id);
  assert.strictEqual(config.TEAMS.support.name, "Support");
  assert.strictEqual(config.TEAMS.support.emoji, "📋");
});

test("TEAMS.docops has id, name, emoji", () => {
  assert.ok(config.TEAMS.docops.id);
  assert.strictEqual(config.TEAMS.docops.name, "DocOps");
  assert.strictEqual(config.TEAMS.docops.emoji, "📁");
});

// ═══════════════════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${"═".repeat(50)}`);
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
