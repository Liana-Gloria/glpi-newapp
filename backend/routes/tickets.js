const express = require('express');
const router = express.Router();
const db = require('../db/database');
const requireAdmin = require('../middleware/auth');
const autosync = require('../glpi/autosync');
const { normalizeTicketStatus } = require('../glpi/mapping');

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

// POST /api/tickets — crée le ticket + associe les items (ticket_items)
router.post('/', (req, res) => {
  const { title, description, status, item_ids } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const ids = Array.isArray(item_ids) ? item_ids : [];

  const create = db.transaction(() => {
    const result = db
      .prepare('INSERT INTO tickets (title, description, status) VALUES (?, ?, ?)')
      .run(title, description || null, status || 'open');
    const ticketId = result.lastInsertRowid;
    const link = db.prepare(
      'INSERT OR IGNORE INTO ticket_items (ticket_id, item_id) VALUES (?, ?)'
    );
    for (const itemId of ids) link.run(ticketId, itemId);
    return ticketId;
  });

  try {
    const id = create();
    autosync.syncTicket(id); // temps réel -> GLPI
    res.status(201).json({ id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/tickets/:id/status — change le statut (drag Kanban).
// Body : { status, resolution? }. `resolution` est saisie dans la boîte de
// dialogue lors du passage en "done" (Vita). Le statut est normalisé sur les
// 3 clés du Kanban (open / in_progress / done).
router.patch('/:id/status', (req, res) => {
  const { status, resolution } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const canonical = normalizeTicketStatus(status);
  const result =
    resolution !== undefined
      ? db
          .prepare('UPDATE tickets SET status = ?, resolution = ? WHERE id = ?')
          .run(canonical, resolution || null, req.params.id)
      : db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run(canonical, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  autosync.syncTicket(req.params.id); // temps réel -> GLPI (statut Kanban)
  res.json({ ok: true });
});

// PUT /api/tickets/:id
router.put('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { title, description, status } = req.body;
  db.prepare(
    'UPDATE tickets SET title = ?, description = ?, status = ? WHERE id = ?'
  ).run(title ?? existing.title, description ?? existing.description, status ?? existing.status, req.params.id);
  autosync.syncTicket(req.params.id); // temps réel -> GLPI
  res.json({ ok: true });
});

// DELETE /api/tickets/:id
router.delete('/:id', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM tickets WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
