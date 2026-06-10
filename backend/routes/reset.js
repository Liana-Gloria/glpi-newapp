const express = require('express');
const router = express.Router();
const db = require('../db/database');
const requireAdmin = require('../middleware/auth');
const { withSession, GlpiError } = require('../glpi/client');
const { itemtypeFor } = require('../glpi/mapping');

// DELETE /api/reset — vide toutes les tables de données (protégé).
// Body optionnel : { syncGlpi: true }  -> supprime aussi dans GLPI les
// enregistrements déjà poussés (force_purge), pour garder les deux côtés alignés.
router.delete('/', requireAdmin, async (req, res) => {
  const syncGlpi = req.body?.syncGlpi !== false; // défaut : true

  // 1. Photographie de ce qui va être supprimé (pour le journal).
  const count = (sql) => db.prepare(sql).get().c;
  const deleted = {
    items: count('SELECT COUNT(*) c FROM items'),
    tickets: count('SELECT COUNT(*) c FROM tickets'),
    ticket_items: count('SELECT COUNT(*) c FROM ticket_items'),
    ticket_costs: count('SELECT COUNT(*) c FROM ticket_costs'),
  };

  // Enregistrements liés à GLPI, à purger côté GLPI avant le wipe local.
  const syncedItems = db
    .prepare('SELECT id, name, glpi_id, glpi_itemtype, type FROM items WHERE glpi_id IS NOT NULL')
    .all();
  const syncedTickets = db
    .prepare('SELECT id, title, glpi_id FROM tickets WHERE glpi_id IS NOT NULL')
    .all();

  // 2. Suppression côté GLPI (best-effort : on n'empêche pas le reset local).
  const glpi = {
    attempted: syncGlpi && (syncedItems.length > 0 || syncedTickets.length > 0),
    itemsTargeted: syncedItems.length,
    ticketsTargeted: syncedTickets.length,
    itemsDeleted: 0,
    ticketsDeleted: 0,
    errors: [],
  };

  if (glpi.attempted) {
    try {
      await withSession(async (client) => {
        for (const item of syncedItems) {
          const itemtype = item.glpi_itemtype || itemtypeFor(item.type);
          try {
            await client.deleteItem(itemtype, item.glpi_id);
            glpi.itemsDeleted++;
          } catch (err) {
            glpi.errors.push(`Item #${item.id} (${item.name}) -> GLPI ${itemtype}/${item.glpi_id}: ${err.message}`);
          }
        }
        for (const ticket of syncedTickets) {
          try {
            await client.deleteItem('Ticket', ticket.glpi_id);
            glpi.ticketsDeleted++;
          } catch (err) {
            glpi.errors.push(`Ticket #${ticket.id} (${ticket.title}) -> GLPI Ticket/${ticket.glpi_id}: ${err.message}`);
          }
        }
      });
    } catch (err) {
      // Connexion GLPI impossible : on signale mais on poursuit le reset local.
      const reason = err instanceof GlpiError ? err.message : String(err.message || err);
      glpi.errors.push(`Connexion GLPI impossible : ${reason}. Suppression GLPI ignorée.`);
    }
  }

  // 3. Wipe local (transaction).
  const wipe = db.transaction(() => {
    db.prepare('DELETE FROM ticket_costs').run();
    db.prepare('DELETE FROM ticket_items').run();
    db.prepare('DELETE FROM tickets').run();
    db.prepare('DELETE FROM items').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('items','tickets','ticket_costs')").run();
  });
  try {
    wipe();
  } catch (err) {
    return res.status(500).json({ error: 'Reset échoué: ' + err.message });
  }

  res.json({ ok: true, deleted, glpi });
});

module.exports = router;
