// src/bot.js
import "dotenv/config";
import { Telegraf } from "telegraf";

import { setupBackupCommand, setupBackupCron } from "./backup.js";

// ===== ENV =====
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN belum diset di Variables Railway");

// ===== BOT INSTANCE (CUMA 1x) =====
export const bot = new Telegraf(BOT_TOKEN);

// ===== FITUR =====
setupBackupCommand();
setupBackupCron();

// ===== START BOT (POLLING) =====
bot.launch()
  .then(() => console.log("✅ Bot running (polling)"))
  .catch((e) => {
    console.error("❌ Bot launch error:", e);
    process.exit(1);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
