import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_DIR = process.env.DB_DIR || "./data";
const DB_FILE = process.env.DB_FILE || "crm.sqlite";

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const dbPath = path.join(DB_DIR, DB_FILE);
export const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
`);

export function saveUser(from) {
  db.prepare(`
    INSERT INTO users (user_id, username, first_name, last_name)
    VALUES (@id, @username, @first_name, @last_name)
    ON CONFLICT(user_id) DO UPDATE SET
      username=excluded.username,
      first_name=excluded.first_name,
      last_name=excluded.last_name,
      updated_at=datetime('now')
  `).run({
    id: from.id,
    username: from.username || "",
    first_name: from.first_name || "",
    last_name: from.last_name || ""
  });
}

export function countUsers() {
  return db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
}
