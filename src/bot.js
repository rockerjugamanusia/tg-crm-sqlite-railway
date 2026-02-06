import { Telegraf } from "telegraf";
import { upsertUser, getAllUsers } from "./db.js";
export const bot = new Telegraf(process.env.BOT_TOKEN);

// /start
bot.start(async (ctx) => {
  const u = ctx.from;
  await upsertUser(u);

  await ctx.reply(
    "✅ Kamu sudah tersimpan ke database.\n\n" +
      "Perintah:\n" +
      "/me - lihat data kamu\n" +
      "/users - list users (admin)\n" +
      "/backup - kirim backup sekarang (admin)"
  );
});

bot.command("me", async (ctx) => {
  const u = ctx.from;
  await upsertUser(u);
  await ctx.reply(
    `🧾 Data kamu:\nID: ${u.id}\nUsername: ${u.username || "-"}\nNama: ${u.first_name || "-"} ${u.last_name || ""}`
  );
});

function isAdmin(ctx) {
  const adminId = String(process.env.ADMIN_ID || "");
  return adminId && String(ctx.from?.id) === adminId;
}

bot.command("users", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("❌ Kamu bukan admin.");

  const rows = await getAllUsers();
  if (!rows.length) return ctx.reply("Belum ada user.");

  const text = rows
    .slice(0, 50)
    .map((r, i) => `${i + 1}. ${r.user_id} | @${r.username || "-"} | ${r.first_name || "-"} ${r.last_name || ""}`)
    .join("\n");

  await ctx.reply("👥 Users (max 50):\n" + text);
});

import { runBackupNow, isAdmin, setupBackupCron } from "./backup.js";

// pas app start
setupBackupCron(bot);

// command manual
bot.command("backup", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("❌ Kamu bukan admin.");
  await ctx.reply("⏳ Backup jalan...");
  const res = await runBackupNow(bot, { reason: "manual" });
  await ctx.reply(res.ok ? "✅ Selesai." : `❌ Gagal: ${res.error}`);
});

