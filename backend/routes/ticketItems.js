const express = require('express');
const router = express.Router();
const db = require('../db/database');
const requireAdmin = require('../middleware/auth');

// POST /api/ticket-items  { ticket_id, item_id }
router.post('/', requireAdmin, (req, res) => {
  const { ticket_id, item_id } = req.body;
  if (!ticket_id || !item_id) return res.status(400).json({ error: 'ticket_id and item_id required' });
  try {
    db.prepare('INSERT INTO ticket_items (ticket_id, item_id) VALUES (?, ?)').run(ticket_id, item_id);
    res.status(201).json({ ok: true });
  } catch {
    res.status(409).json({ error: 'Association already exists or invalid ids' });
  }
});

// DELETE /api/ticket-items  { ticket_id, item_id }
router.delete('/', requireAdmin, (req, res) => {
  const { ticket_id, item_id } = req.body;
  if (!ticket_id || !item_id) return res.status(400).json({ error: 'ticket_id and item_id required' });
  const result = db.prepare(
    'DELETE FROM ticket_items WHERE ticket_id = ? AND item_id = ?'
  ).run(ticket_id, item_id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
