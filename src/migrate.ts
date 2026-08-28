import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const DB_PATH = "./data/database.db";
const MIGRATIONS_DIR = "./migrations";

const db = new Database(DB_PATH);

db.run(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const applied = new Set(
  db.query("SELECT version FROM schema_migrations").all().map((r: any) => r.version)
);

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let count = 0;

for (const file of files) {
  const version = parseInt(file.split("_")[0]);

  if (applied.has(version)) {
    continue;
  }

  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");

  console.log(`Running: ${file}`);
  db.exec(sql);
  db.run("INSERT INTO schema_migrations (version) VALUES (?)", [version]);
  count++;
}

if (count === 0) {
  console.log("No pending migrations.");
} else {
  console.log(`${count} migration(s) applied.`);
}

db.close();
