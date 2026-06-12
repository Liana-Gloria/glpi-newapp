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

  -- Coûts / temps passés par ticket (Feuille 3 de l'import).
  CREATE TABLE IF NOT EXISTS ticket_costs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id       INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    duration_second INTEGER DEFAULT 0,
    time_cost       REAL    DEFAULT 0,
    fixed_cost      REAL    DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
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

// ticket_costs: origine du coût. 'import' = coût importé du CSV/GLPI (défaut),
// 'kanban' = coût saisi à la clôture d'un ticket sur le Kanban. Permet de
// distinguer les deux dans la page "Coûts par item".
ensureColumn('ticket_costs', 'source', "TEXT DEFAULT 'import'");

// --- Import CSV: colonnes métier supplémentaires (Feuilles 1 & 2) ----------
// items (Feuille 1) : on conserve toutes les colonnes du CSV.
ensureColumn('items', 'status', 'TEXT');
ensureColumn('items', 'location', 'TEXT');
ensureColumn('items', 'manufacturer', 'TEXT');
ensureColumn('items', 'model', 'TEXT');
ensureColumn('items', 'inventory_number', 'TEXT');
ensureColumn('items', 'assigned_user', 'TEXT');

// tickets (Feuille 2) : référence d'origine + métadonnées.
ensureColumn('tickets', 'ref_ticket', 'TEXT');     // Ref_Ticket du CSV (clé de liaison avec les coûts)
ensureColumn('tickets', 'ticket_type', 'TEXT');    // Incident / Request...
ensureColumn('tickets', 'priority', 'TEXT');
ensureColumn('tickets', 'ticket_date', 'TEXT');    // Date + Heure d'origine
ensureColumn('tickets', 'resolution', 'TEXT');     // commentaire de clôture (saisi au passage en "Vita")

// --- Index uniques pour l'upsert (import idempotent) -----------------------
// Un item est identifié par son nom (PC-ADM-001...) ; un ticket par sa référence.
// Si d'anciennes données contiennent des doublons, on n'empêche pas le boot :
// l'index échoue, l'upsert retombera alors sur de simples INSERT.
try {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_items_name   ON items(name);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_ref  ON tickets(ref_ticket) WHERE ref_ticket IS NOT NULL;
  `);
} catch (err) {
  console.warn('[db] Index unique non créé (doublons existants ?):', err.message);
}

module.exports = db;
