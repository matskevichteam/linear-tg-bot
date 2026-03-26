import "dotenv/config";
import { Bot, Keyboard, InlineKeyboard } from "grammy";
import Groq from "groq-sdk";

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const TEAMS = {
  support: {
    id: process.env.LINEAR_TEAM_ID,
    name: "Support",
    emoji: "📋",
  },
  docops: {
    id: process.env.DOCOPS_TEAM_ID,
    name: "DocOps",
    emoji: "📁",
  },
};

// re-export for convenience
export { Keyboard, InlineKeyboard };
