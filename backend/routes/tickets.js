const express = require('express');
const router = express.Router();
const db = require('../db/database');
const requireAdmin = require('../middleware/auth');

// GET /api/tickets
router.get('/', (req, res) => {
  const tickets = db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all();
  res.json(tickets);
});

// GET /api/tickets/:id  (avec items liés)
router.get('/:id', (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  ticket.items = db.prepare(
    'SELECT i.* FROM items i JOIN ticket_items ti ON ti.item_id = i.id WHERE ti.ticket_id = ?'
  ).all(req.params.id);
  res.json(ticket);
});

// POST /api/tickets
router.post('/', (req, res) => {
  const { title, description, status } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const result = db.prepare(
    'INSERT INTO tickets (title, description, status) VALUES (?, ?, ?)'
  ).run(title, description || null, status || 'open');
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/tickets/:id
router.put('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { title, description, status } = req.body;
  db.prepare(
    'UPDATE tickets SET title = ?, description = ?, status = ? WHERE id = ?'
  ).run(title ?? existing.title, description ?? existing.description, status ?? existing.status, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/tickets/:id
router.delete('/:id', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM tickets WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
