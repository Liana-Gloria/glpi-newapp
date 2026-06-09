const express = require('express');
const router = express.Router();
const db = require('../db/database');
const requireAdmin = require('../middleware/auth');

// GET /api/settings
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(settings);
});

// PUT /api/settings — mise à jour groupée { key: value, ... }
router.put('/', requireAdmin, (req, res) => {
  const body = req.body || {};
  const keys = Object.keys(body);
  if (keys.length === 0) return res.status(400).json({ error: 'body is required' });
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const save = db.transaction(() => {
    for (const key of keys) {
      const value = body[key];
      stmt.run(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  });
  save();
  res.json({ ok: true });
});

// PUT /api/settings/:key
router.put('/:key', requireAdmin, (req, res) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value is required' });
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(req.params.key, value);
  res.json({ ok: true });
});

// DELETE /api/settings/:key
router.delete('/:key', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM settings WHERE key = ?').run(req.params.key);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
