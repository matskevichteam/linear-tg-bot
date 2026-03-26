// ─── Groq: transcription + task extraction ──────────────────────────────────

import { groq } from "./config.js";

export async function downloadTelegramFile(fileId) {
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

export async function transcribeVoice(fileBuffer) {
  const file = new File([fileBuffer], "voice.ogg", { type: "audio/ogg" });
  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    language: "ru",
  });
  return transcription.text;
}

export async function extractTasks(text) {
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
