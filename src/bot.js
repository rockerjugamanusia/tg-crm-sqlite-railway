import { Telegraf } from "telegraf";
import express from "express";
import { runBackupNow, isAdmin, setupBackupCron } from "./backup.js";

// src/bot.js
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN belum diset di Variables Railway");

export const bot = new Telegraf(BOT_TOKEN);


export const bot = new Telegraf(BOT_TOKEN);

// ✅ pasang cron sekali
setupBackupCron(bot);

// ✅ command manual backup
bot.command("backup", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("❌ Kamu bukan admin.");
  await ctx.reply("⏳ Backup jalan...");
  const res = await runBackupNow(bot, { reason: "manual" });
  await ctx.reply(res.ok ? "✅ Selesai." : `❌ Gagal: ${res.error}`);
});

// MODE RUN: WEBHOOK (Railway)
const app = express();
app.use(express.json());

app.get("/", (req, res) => res.status(200).send("OK"));

app.post("/telegraf", (req, res) => {
  bot.handleUpdate(req.body, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : process.env.PUBLIC_URL;

  if (!BASE_URL) {
    console.log("⚠️ PUBLIC_URL / RAILWAY_PUBLIC_DOMAIN belum ada. Webhook tidak diset.");
    console.log("✅ Server jalan di port", PORT);
    return;
  }

  const webhookUrl = `${BASE_URL}/telegraf`;
  await bot.telegram.setWebhook(webhookUrl);
  console.log("✅ Webhook set:", webhookUrl);
  console.log("✅ Server jalan di port", PORT);
});
