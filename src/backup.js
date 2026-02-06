import fs from "fs";
import path from "path";
import cron from "node-cron";
import { exportUsersJson } from "./db.js";

const DATA_DIR = process.env.DATA_DIR || "/app/data";
const DB_FILE = process.env.DB_FILE || "crm.sqlite";

const OUT_JSON = path.join(DATA_DIR, "users.json");
const OUT_DB = path.join(DATA_DIR, DB_FILE);

// env
const CHANNEL_ID = process.env.BACKUP_CHANNEL_ID; // contoh: -100xxxxxxxxxx
const ADMIN_ID = Number(process.env.ADMIN_ID || 0);

// anti double + anti concurrent
const LOCK_FILE = path.join(DATA_DIR, "backup.lock");
const LAST_FILE = path.join(DATA_DIR, "backup.last.json");

// helper
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

function nowKeyMinute() {
  // YYYY-MM-DDTHH:MM (WIB gak wajib, yang penting konsisten)
  return new Date().toISOString().slice(0, 16);
}

function alreadySentThisMinute() {
  try {
    const last = JSON.parse(fs.readFileSync(LAST_FILE, "utf8"));
    return last.key === nowKeyMinute();
  } catch {
    return false;
  }
}

function markSentThisMinute(meta = {}) {
  fs.writeFileSync(
    LAST_FILE,
    JSON.stringify({ key: nowKeyMinute(), at: Date.now(), ...meta }, null, 2)
  );
}

/**
 * Jalankan backup SEKALI.
 * @param {import("telegraf").Telegraf} bot
 * @param {{reason?: string}} opts
 */
export async function runBackupNow(bot, opts = {}) {
  ensureDir();

  if (!CHANNEL_ID) {
    console.log("⚠️ BACKUP_CHANNEL_ID belum diset, skip.");
    return { ok: false, error: "BACKUP_CHANNEL_ID not set" };
  }

  // anti-double per menit
  if (alreadySentThisMinute()) {
    console.log("⏭️ Backup sudah dikirim menit ini, skip.");
    return { ok: true, skipped: true, reason: "already_sent_this_minute" };
  }

  // lock anti concurrent
  if (!acquireLock()) {
    console.log("⏭️ Backup sedang berjalan di proses lain, skip.");
    return { ok: true, skipped: true, reason: "lock_busy" };
  }

  try {
    // export users json
    const data = await exportUsersJson();
    fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 2));

    // kirim info
    const title =
      `📦 Backup ${new Date().toLocaleString("id-ID")} (${opts.reason || "auto"})`;
    await bot.telegram.sendMessage(CHANNEL_ID, title);

    // kirim json
    await bot.telegram.sendDocument(CHANNEL_ID, { source: OUT_JSON });

    // kirim db kalau ada
    if (fs.existsSync(OUT_DB)) {
      await bot.telegram.sendDocument(CHANNEL_ID, { source: OUT_DB });
    } else {
      console.log("⚠️ DB tidak ditemukan:", OUT_DB);
    }

    markSentThisMinute({ reason: opts.reason || "auto" });
    console.log("✅ Backup terkirim.");
    return { ok: true };
  } catch (e) {
    console.error("❌ Backup error:", e);
    return { ok: false, error: String(e?.message || e) };
  } finally {
    releaseLock();
  }
}

/**
 * Pasang cron 1x.
 * Default: jam 10:32 WIB setiap hari
 * Env opsional:
 * - BACKUP_CRON="32 10 * * *"
 * - BACKUP_CRON_ENABLED="true/false"
 */
export function setupBackupCron(bot) {
  const enabled = String(process.env.BACKUP_CRON_ENABLED || "true") !== "false";
  if (!enabled) {
    console.log("🛑 Backup cron disabled via BACKUP_CRON_ENABLED=false");
    return null;
  }

  const expr = process.env.BACKUP_CRON || "32 10 * * *";

  console.log("⏰ Backup cron aktif:", expr, "TZ Asia/Jakarta");

  return cron.schedule(
    expr,
    () => runBackupNow(bot, { reason: "cron" }).catch(console.error),
    { timezone: "Asia/Jakarta" }
  );
}

/**
 * Helper admin check (dipakai bot.js)
 */
export function isAdmin(ctx) {
  if (!ADMIN_ID) return true; // kalau ADMIN_ID belum diset, anggap semua boleh
  return Number(ctx.from?.id) === ADMIN_ID;
}
