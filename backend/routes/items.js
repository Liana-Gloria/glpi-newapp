const express = require('express');
const router = express.Router();
const db = require('../db/database');
const requireAdmin = require('../middleware/auth');
const autosync = require('../glpi/autosync');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// GET /api/items?type=&search=  (recherche multi-critère)
router.get('/', (req, res) => {
  const { type, search } = req.query;
  const where = [];
  const params = [];

  if (type) {
    where.push('type = ?');
    params.push(type);
  }
  if (search) {
    where.push('(name LIKE ? OR serial LIKE ? OR type LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const sql =
    'SELECT * FROM items' +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY created_at DESC';
  const items = db.prepare(sql).all(...params);
  res.json(items);
});

// GET /api/items/types — liste distincte des types (pour le filtre)
router.get('/types', (req, res) => {
  const rows = db
    .prepare("SELECT DISTINCT type FROM items WHERE type IS NOT NULL AND type <> '' ORDER BY type")
    .all();
  res.json(rows.map((r) => r.type));
});

// GET /api/items/:id
router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// POST /api/items
router.post('/', requireAdmin, upload.single('image'), (req, res) => {
  const { name, type, serial } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const image_path = req.file ? `/uploads/${req.file.filename}` : null;
  const result = db.prepare(
    'INSERT INTO items (name, type, serial, image_path) VALUES (?, ?, ?, ?)'
  ).run(name, type || null, serial || null, image_path);
  autosync.syncItem(result.lastInsertRowid); // temps réel -> GLPI
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/items/:id
router.put('/:id', requireAdmin, upload.single('image'), (req, res) => {
  const { name, type, serial } = req.body;
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const image_path = req.file ? `/uploads/${req.file.filename}` : existing.image_path;
  db.prepare(
    'UPDATE items SET name = ?, type = ?, serial = ?, image_path = ? WHERE id = ?'
  ).run(name ?? existing.name, type ?? existing.type, serial ?? existing.serial, image_path, req.params.id);
  autosync.syncItem(req.params.id); // temps réel -> GLPI
  res.json({ ok: true });
});

// DELETE /api/items/:id
router.delete('/:id', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
