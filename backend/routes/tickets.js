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

// GET /api/tickets/couts-par-item — coût total réparti par item.
// ⚠️ Doit rester AVANT router.get('/:id') (sinon "couts-par-item" = id).
// Coût d'un ticket = SUM(time_cost + fixed_cost) de ses lignes ticket_costs.
// Part d'un item = coût du ticket / nombre d'items du ticket.
router.get('/couts-par-item', (req, res) => {
  const rows = db
    .prepare(
      `WITH ticket_totals AS (
         SELECT ticket_id,
                SUM(CASE WHEN source = 'kanban' THEN 0
                         ELSE COALESCE(time_cost, 0) + COALESCE(fixed_cost, 0) END) AS cout_glpi,
                SUM(CASE WHEN source = 'kanban' THEN COALESCE(fixed_cost, 0)
                         ELSE 0 END) AS cout_kanban
         FROM ticket_costs
         GROUP BY ticket_id
       ),
       ticket_nb_items AS (
         SELECT ticket_id, COUNT(*) AS nb_items
         FROM ticket_items
         GROUP BY ticket_id
       )
       -- On part de ticket_items : tout item lié à un ticket apparaît, même si
       -- le ticket n'a aucun coût (LEFT JOIN -> coûts à 0). Le coût du ticket
       -- est réparti à parts égales entre ses items (/ nb_items).
       SELECT i.id          AS item_id,
              i.name        AS item_name,
              i.type        AS item_type,
              t.id          AS ticket_id,
              t.title       AS ticket_title,
              COALESCE(tt.cout_glpi, 0)                       AS cout_glpi,
              COALESCE(tt.cout_kanban, 0)                     AS cout_kanban,
              tn.nb_items                                     AS nb_items,
              COALESCE(tt.cout_glpi, 0)   * 1.0 / tn.nb_items AS part_glpi,
              COALESCE(tt.cout_kanban, 0) * 1.0 / tn.nb_items AS part_kanban
       FROM ticket_items ti
       JOIN items i            ON i.id = ti.item_id
       JOIN tickets t          ON t.id = ti.ticket_id
       JOIN ticket_nb_items tn ON tn.ticket_id = ti.ticket_id
       LEFT JOIN ticket_totals tt ON tt.ticket_id = ti.ticket_id
       ORDER BY i.id`
    )
    .all();

  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  // Regroupe les lignes (item × ticket) par item.
  const byItem = new Map();
  for (const r of rows) {
    let entry = byItem.get(r.item_id);
    if (!entry) {
      entry = {
        item_id: r.item_id,
        item_name: r.item_name,
        item_type: r.item_type,
        cout_glpi: 0,
        cout_kanban: 0,
        cout_total: 0,
        tickets: [],
      };
      byItem.set(r.item_id, entry);
    }
    entry.cout_glpi += r.part_glpi;
    entry.cout_kanban += r.part_kanban;
    entry.cout_total += r.part_glpi + r.part_kanban;
    entry.tickets.push({
      ticket_id: r.ticket_id,
      ticket_title: r.ticket_title,
      cout_glpi: round2(r.cout_glpi),
      cout_kanban: round2(r.cout_kanban),
      nb_items: r.nb_items,
      part_glpi: round2(r.part_glpi),
      part_kanban: round2(r.part_kanban),
    });
  }

  const result = Array.from(byItem.values())
    .map((e) => ({
      ...e,
      cout_glpi: round2(e.cout_glpi),
      cout_kanban: round2(e.cout_kanban),
      cout_total: round2(e.cout_total),
    }))
    .sort((a, b) => b.cout_total - a.cout_total);

  res.json(result);
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
  const { title, description, status, priority, item_ids } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const ids = Array.isArray(item_ids) ? item_ids : [];

  const create = db.transaction(() => {
    const result = db
      .prepare('INSERT INTO tickets (title, description, status, priority) VALUES (?, ?, ?, ?)')
      .run(title, description || null, status || 'open', priority || null);
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
  const { status, resolution, cout } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const canonical = normalizeTicketStatus(status);
  const result =
    resolution !== undefined
      ? db
          .prepare('UPDATE tickets SET status = ?, resolution = ? WHERE id = ?')
          .run(canonical, resolution || null, req.params.id)
      : db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run(canonical, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  if (cout !== undefined && cout !== null && Number(cout) > 0){
    db.prepare(
      "INSERT INTO ticket_costs (ticket_id, fixed_cost, source) VALUES (?, ?, 'kanban')"
    ).run(req.params.id, Number(cout));
  }
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
