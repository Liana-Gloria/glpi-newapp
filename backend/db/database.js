const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'glpi.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    type       TEXT,
    serial     TEXT,
    image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT,
    status      TEXT    NOT NULL DEFAULT 'open',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ticket_items (
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    item_id   INTEGER NOT NULL REFERENCES items(id)   ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

// --- Phase 7: GLPI sync tracking columns (added idempotently) -------------
// SQLite has no "ADD COLUMN IF NOT EXISTS", so guard with PRAGMA table_info.
function ensureColumn(table, column, definition) {
  const exists = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

// items: link to the GLPI asset + last status pulled back from GLPI.
ensureColumn('items', 'glpi_id', 'INTEGER');
ensureColumn('items', 'glpi_itemtype', 'TEXT');
ensureColumn('items', 'glpi_status', 'TEXT');
ensureColumn('items', 'glpi_synced_at', 'DATETIME');

// tickets: link to the GLPI ticket.
ensureColumn('tickets', 'glpi_id', 'INTEGER');
ensureColumn('tickets', 'glpi_synced_at', 'DATETIME');

module.exports = db;
