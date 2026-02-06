import fs from "fs";
import path from "path";
import cron from "node-cron";

export function setupTelegramBackup(bot, exportUsersJson) {
  const DATA_DIR = process.env.DB_DIR || "/app/data";
  const DB_FILE = process.env.DB_FILE || "crm.sqlite";
  const OUT_JSON = path.join(DATA_DIR, "users.json");
  const OUT_DB = path.join(DATA_DIR, DB_FILE);
  const CHANNEL_ID = process.env.BACKUP_CHANNEL_ID;
  const ADMIN_ID = Number(process.env.ADMIN_ID || 0);

  if (!CHANNEL_ID) {
    console.log("⚠️ BACKUP_CHANNEL_ID belum diset");
    return;
  }

  async function runBackup() {
    // export JSON
    const data = exportUsersJson();
    fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 2));

    // kirim ke channel
    await bot.telegram.sendMessage(
      CHANNEL_ID,
      `🗂 Backup ${new Date().toLocaleString()}`
    );

    await bot.telegram.sendDocument(CHANNEL_ID, { source: OUT_JSON });

    if (fs.existsSync(OUT_DB)) {
      await bot.telegram.sendDocument(CHANNEL_ID, { source: OUT_DB });
    }

    console.log("✅ Backup terkirim");
  }

  // AUTO BACKUP SETIAP HARI JAM 02:00 WIB
  cron.schedule("0 2 * * *", () => {
    runBackup().catch(console.error);
  }, {
    timezone: "Asia/Jakarta",
  });

  // MANUAL BACKUP VIA BOT
  bot.command("backup", async (ctx) => {
    if (ADMIN_ID && ctx.from.id !== ADMIN_ID) return;
    await ctx.reply("⏳ Backup berjalan...");
    await runBackup();
    await ctx.reply("✅ Backup dikirim ke channel.");
  });
}
