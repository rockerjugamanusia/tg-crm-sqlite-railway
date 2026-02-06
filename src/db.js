import "dotenv/config";
import fs from "fs";
import path from "path";
import initSqlJs from "sql.js";

const DB_DIR = process.env.DB_DIR || "./data";
const DB_FILE = process.env.DB_FILE || "crm.sqlite";
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const dbPath = path.join(DB_DIR, DB_FILE);

let SQL;
let db;
let saveTimer = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }, 500); // debounce
}

export async function initDb() {
  if (db) return;

  SQL = await initSqlJs({});
  if (fs.existsSync(dbPath)) {
    const fileBuf = fs.readFileSync(dbPath);
    db = new SQL.Database(new Uint8Array(fileBuf));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  scheduleSave();
}

export function saveUser(from) {
  const stmt = db.prepare(`
    INSERT INTO users (user_id, username, first_name, last_name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username=excluded.username,
      first_name=excluded.first_name,
      last_name=excluded.last_name,
      updated_at=datetime('now')
  `);
  stmt.bind([
    from.id,
    from.username || "",
    from.first_name || "",
    from.last_name || ""
  ]);
  stmt.step();
  stmt.free();
  scheduleSave();
}

export function countUsers() {
  const res = db.exec("SELECT COUNT(*) AS c FROM users");
  const c = res?.[0]?.values?.[0]?.[0] ?? 0;
  return c;
}
