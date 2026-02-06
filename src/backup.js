import fs from "fs";
import path from "path";
import cron from "node-cron";
import { bot } from "./bot.js";
import { exportUsersJson } from "./db.js";

const DATA_DIR = process.env.DATA_DIR || "/app/data";
const OUT_JSON = path.join(DATA_DIR, "users.json");
const DB_FILE = process.env.DB_FILE || "crm.sqlite";
const OUT_DB  = path.join(DATA_DIR, DB_FILE);

const CHANNEL_ID = process.env.BACKUP_CHANNEL_ID; // contoh: -100xxxxxxxxxx
const ADMIN_ID = Number(process.env.ADMIN_ID || 0);

// file untuk anti double
const LOCK_FILE = path.join(DATA_DIR, "backup.lock");
const LAST_FILE = path.join(DATA_DIR, "backup.last.json");

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// kunci proses (kalau ada 2 instance/2 cron kepanggil bareng → yang kedua skip)
function acquireLock() {
  try {
    const fd = fs.openSync(LOCK_FILE, "wx"); // wx = fail jika file sudah ada
    fs.writeFileSync(fd, String(Date.now()));
    fs.closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch {}
}

// anti double per menit (biar kalau restart cepat tidak kirim ulang)
function alreadySentThisMinute() {
  try {
    const last = JSON.parse(fs.readFileSync(LAST_FILE, "utf8"));
    const nowKey = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    return last.key === nowKey;
  } catch {
    return false;
  }
}

function markSentThisMinute() {
  const key = new Date().toISOString().slice(0, 16);
  fs.writeFileSync(LAST_FILE, JSON.stringify({ key, at: Date.now() }, null, 2));
}

export async function runBackup() {
  ensureDir();

  if (!CHANNEL_ID) {
    console.log("⚠️ BACKUP_CHANNEL_ID belum diset, skip.");
    return;
  }

  // 1) anti double menit
  if (alreadySentThisMinute()) {
    console.log("⏭️ Backup sudah dikirim menit ini, skip.");
    return;
  }

  // 2) lock anti concurrent
  if (!acquireLock()) {
    console.log("⏭️ Backup sedang berjalan di proses lain, skip.");
    return;
  }

  try {
    // export json users
    const data = await exportUsersJson();
    fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 2));

    // kirim ke channel
    await bot.telegram.sendMessage(
      CHANNEL_ID,
      `📦 Backup ${new Date().toLocaleString("id-ID")}`
    );

    await bot.telegram.sendDocument(CHANNEL_ID, { source: OUT_JSON });

    // kirim db kalau ada
    if (fs.existsSync(OUT_DB)) {
      await bot.telegram.sendDocument(CHANNEL_ID, { source: OUT_DB });
    }

    markSentThisMinute();
    console.log("✅ Backup terkirim.");
  } catch (e) {
    console.error("❌ Backup error:", e);
  } finally {
    releaseLock();
  }
}

// Cron (contoh: setiap hari jam 10:32 WIB)
cron.schedule("32 10 * * *", () => {
  runBackup().catch(console.error);
}, { timezone: "Asia/Jakarta" });

// Manual command (biar gak dobel juga)
bot.command("backup", async (ctx) => {
  if (ADMIN_ID && ctx.from?.id !== ADMIN_ID) return;
  await ctx.reply("⏳ Backup jalan...");
  await runBackup();
  await ctx.reply("✅ Selesai.");
});
