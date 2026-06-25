import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || "./data/clipster.db";
const dbDir = path.dirname(path.resolve(__dirname, "..", "..", dbPath));

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.resolve(__dirname, "..", "..", dbPath));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    keyword TEXT NOT NULL,
    logo_reference_key TEXT,
    clipster_campaign_url TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clips (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    original_filename TEXT,
    source_key TEXT,
    export_key TEXT,
    status TEXT DEFAULT 'uploaded',
    logo_detected INTEGER DEFAULT 0,
    logo_confidence REAL,
    background_type TEXT,
    background_value TEXT,
    instagram_reel_url TEXT,
    submitted_to_clipster INTEGER DEFAULT 0,
    submitted_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  );

  CREATE INDEX IF NOT EXISTS idx_clips_campaign ON clips(campaign_id);
`);

export default db;
