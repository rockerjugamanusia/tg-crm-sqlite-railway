// src/backup.js
import fs from "fs";
import path from "path";
import cron from "node-cron";
import { bot } from "./bot.js";
import { exportUsersJson, getDbPath } from "./db.js";

const DATA_DIR = process.env.DATA_DIR || "/app/data";
const OUT_JSON = path.join(DATA_DIR, "users.json");

const CHANNEL_ID = process.env.BACKUP_CHANNEL_ID; // contoh: -100xxxxxxxxxx
const ADMIN_ID = Number(process.env.ADMIN_ID || 0);

// anti double / anti concurrent
const LOCK_FILE = path.join(DATA_DIR, "backup.lock");
const LAST_FILE = path.join(DATA_DIR, "backup.last.json");

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function acquireLock() {
  try {
    const fd = fs.openSync(LOCK_FILE, "wx");
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

function minuteKeyNow() {
  // WIB (Asia/Jakarta) biar konsisten sama cron
  const d = new Date();
  const iso = new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString(); // shift +7
  return iso.slice(0, 16); // YYYY-MM-DDTHH:MM
}

function alreadySentThisMinute() {
  try {
    const last = JSON.parse(fs.readFileSync(LAST_FILE, "utf8"));
    return last.key === minuteKeyNow();
  } catch {
    return false;
  }
}

function markSentThisMinute() {
  fs.writeFileSync(
    LAST_FILE,
    JSON.stringify({ key: minuteKeyNow(), at: Date.now() }, null, 2)
  );
}

export async function runBackup({ force = false } = {}) {
  ensureDir();

  if (!CHANNEL_ID) {
    console.log("⚠️ BACKUP_CHANNEL_ID belum diset, skip.");
    return { ok: false, reason: "CHANNEL_NOT_SET" };
  }

  if (!force && alreadySentThisMinute()) {
    console.log("⏭️ Backup sudah dikirim menit ini, skip.");
    return { ok: true, skipped: true };
  }

  if (!acquireLock()) {
    console.log("⏭️ Backup sedang berjalan di proses lain, skip.");
    return { ok: true, skipped: true };
  }

  try {
    const data = await exportUsersJson();
    fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 2));

    const caption = `📦 Backup ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`;

    // kirim 1x saja
    await bot.telegram.sendMessage(CHANNEL_ID, caption);
    await bot.telegram.sendDocument(CHANNEL_ID, { source: OUT_JSON });

    const dbPath = getDbPath();
    if (fs.existsSync(dbPath)) {
      await bot.telegram.sendDocument(CHANNEL_ID, { source: dbPath });
    }

    markSentThisMinute();
    console.log("✅ Backup terkirim.");
    return { ok: true };
  } catch (e) {
    console.error("❌ Backup error:", e);
    return { ok: false, error: String(e?.message || e) };
  } finally {
    releaseLock();
  }
}

// Cron (contoh: setiap hari jam 10:32 WIB)
export function setupBackupCron() {
  cron.schedule(
    "32 10 * * *",
    () => runBackup().catch(console.error),
    { timezone: "Asia/Jakarta" }
  );
}

// Command manual
export function setupBackupCommand() {
  bot.command("backup", async (ctx) => {
    try {
      if (ADMIN_ID && ctx.from?.id !== ADMIN_ID) return;

      await ctx.reply("⏳ Backup jalan...");
      const res = await runBackup({ force: true });

      if (res.ok) return ctx.reply("✅ Selesai.");
      return ctx.reply(`❌ Gagal: ${res.error || res.reason || "unknown"}`);
    } catch (e) {
      return ctx.reply(`❌ Gagal: ${String(e?.message || e)}`);
    }
  });
}
