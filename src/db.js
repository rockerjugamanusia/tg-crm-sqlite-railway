// src/db.js
import fs from "fs";
import path from "path";
import initSqlJs from "sql.js";

const DATA_DIR = process.env.DATA_DIR || "/app/data";
const DB_FILE  = process.env.DB_FILE || "crm.sqlite";
const DB_PATH  = path.join(DATA_DIR, DB_FILE);

let SQL = null;
let db = null;

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function getSQL() {
  if (SQL) return SQL;

  // sql.js butuh locateFile agar bisa load wasm di node_modules
  SQL = await initSqlJs({
    locateFile: (file) => `node_modules/sql.js/dist/${file}`,
  });

  return SQL;
}

export async function getDb() {
  if (db) return db;

  ensureDir();
  const SQL = await getSQL();

  if (fs.existsSync(DB_PATH)) {
    const filebuf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(new Uint8Array(filebuf));
  } else {
    db = new SQL.Database();
  }

  // Pastikan tabel users ada (biar query tidak error)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Simpan awal
  await saveDb();
  return db;
}

export async function saveDb() {
  if (!db) return;
  ensureDir();
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export async function exportUsersJson() {
  const db = await getDb(); // <- ini kunci: db pasti ada sebelum exec
  const res = db.exec(`SELECT * FROM users ORDER BY created_at DESC;`);

  if (!res || !res[0]) return [];

  const cols = res[0].columns;
  const rows = res[0].values;

  return rows.map((r) => {
    const obj = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = r[i];
    return obj;
  });
}

export function getDbPath() {
  return DB_PATH;
}
