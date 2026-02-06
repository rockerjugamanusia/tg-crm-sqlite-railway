import "dotenv/config";
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";

const DB_DIR = process.env.DB_DIR || "./data";
const DB_FILE = process.env.DB_FILE || "crm.sqlite";

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const dbPath = path.join(DB_DIR, DB_FILE);
export const db = new sqlite3.Database(dbPath);

// buat tabel users
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
});

// simpan user (upsert)
export function saveUser(from) {
  const sql = `
    INSERT INTO users (user_id, username, first_name, last_name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username=excluded.username,
      first_name=excluded.first_name,
      last_name=excluded.last_name,
      updated_at=datetime('now')
  `;

  db.run(sql, [
    from.id,
    from.username || "",
    from.first_name || "",
    from.last_name || ""
  ]);
}

// hitung total user (async)
export function countUsers() {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) AS c FROM users", (err, row) => {
      if (err) return reject(err);
      resolve(row.c);
    });
  });
}
