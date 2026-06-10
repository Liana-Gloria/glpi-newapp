// Phase 7 — synchronisation NewApp <-> GLPI.
//
//  GET  /api/sync/status  -> test the GLPI connection (no writes)
//  POST /api/sync/push    -> create NewApp items & tickets in GLPI
//  POST /api/sync/pull    -> reflect GLPI status changes back into NewApp
//
// All routes are admin-protected (x-admin-code). They open a single GLPI
// session, do the work, and always close it (withSession).
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const requireAdmin = require('../middleware/auth');
const config = require('../glpi/config');
const autosync = require('../glpi/autosync');
const { withSession, GlpiError } = require('../glpi/client');
const {
  itemtypeFor,
  SUPPORTED_ITEMTYPES,
  newappStatusToGlpi,
  glpiStatusToNewapp,
} = require('../glpi/mapping');

// Build an id -> name map of GLPI states (asset statuses) for a friendly label.
async function loadStates(client) {
  const states = await client.listAll('State');
  const map = {};
  for (const s of states) map[s.id] = s.name;
  return map;
}

function stateLabel(statesMap, statesId) {
  if (!statesId) return 'Sans statut';
  return statesMap[statesId] || `#${statesId}`;
}

// GET /api/sync/status — verify connectivity & report what would be synced.
router.get('/status', requireAdmin, async (req, res) => {
  try {
    const result = await withSession(async (client) => {
      const session = await client.getFullSession();
      const counts = {};
      for (const itemtype of SUPPORTED_ITEMTYPES) {
        counts[itemtype] = (await client.listAll(itemtype)).length;
      }
      return {
        glpiUser: session.glpiname || session.glpifriendlyname || 'glpi',
        glpiCounts: counts,
      };
    });

    const local = {
      items: db.prepare('SELECT COUNT(*) c FROM items').get().c,
      itemsSynced: db.prepare('SELECT COUNT(*) c FROM items WHERE glpi_id IS NOT NULL').get().c,
      tickets: db.prepare('SELECT COUNT(*) c FROM tickets').get().c,
      ticketsSynced: db.prepare('SELECT COUNT(*) c FROM tickets WHERE glpi_id IS NOT NULL').get().c,
    };

    res.json({ connected: true, apiUrl: config.apiUrl, ...result, local });
  } catch (err) {
    res.status(502).json({ connected: false, error: err.message });
  }
});

// GET /api/sync/journal — événements de synchronisation temps réel (lecture seule).
router.get('/journal', requireAdmin, (req, res) => {
  res.json({ journal: autosync.getJournal() });
});

// POST /api/sync/purge — supprime de GLPI tout ce que NewApp y a créé.
router.post('/purge', requireAdmin, async (req, res) => {
  try {
    const summary = await autosync.purgeGlpi();
    res.json(summary);
  } catch (err) {
    const status = err instanceof GlpiError && err.status === 401 ? 401 : 502;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/sync/push — push NewApp items + tickets to GLPI.
// Items already linked (glpi_id set) are skipped so the call is idempotent.
router.post('/push', requireAdmin, async (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM items WHERE glpi_id IS NULL').all();
    const tickets = db.prepare('SELECT * FROM tickets WHERE glpi_id IS NULL').all();

    const linkItem = db.prepare(
      "UPDATE items SET glpi_id = ?, glpi_itemtype = ?, glpi_synced_at = datetime('now') WHERE id = ?"
    );
    const linkTicket = db.prepare(
      "UPDATE tickets SET glpi_id = ?, glpi_synced_at = datetime('now') WHERE id = ?"
    );

    const summary = await withSession(async (client) => {
      const out = { itemsPushed: 0, ticketsPushed: 0, errors: [] };

      for (const item of items) {
        const itemtype = itemtypeFor(item.type);
        try {
          const glpiId = await client.createItem(itemtype, {
            name: item.name,
            serial: item.serial || '',
            comment: `Importé depuis NewApp (item #${item.id}, type "${item.type || '-'}")`,
          });
          linkItem.run(glpiId, itemtype, item.id);
          out.itemsPushed++;
        } catch (err) {
          out.errors.push(`Item #${item.id} (${item.name}): ${err.message}`);
        }
      }

      for (const ticket of tickets) {
        try {
          const glpiId = await client.createItem('Ticket', {
            name: ticket.title,
            content: ticket.description || ticket.title,
            status: newappStatusToGlpi(ticket.status),
          });
          linkTicket.run(glpiId, ticket.id);
          out.ticketsPushed++;
        } catch (err) {
          out.errors.push(`Ticket #${ticket.id} (${ticket.title}): ${err.message}`);
        }
      }

      return out;
    });

    res.json(summary);
  } catch (err) {
    const status = err instanceof GlpiError && err.status === 401 ? 401 : 502;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/sync/pull — read GLPI back and update NewApp.
//   - items:   refresh glpi_status from the GLPI asset state
//   - tickets: map the GLPI ticket status back onto the NewApp status
router.post('/pull', requireAdmin, async (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM items WHERE glpi_id IS NOT NULL').all();
    const tickets = db.prepare('SELECT * FROM tickets WHERE glpi_id IS NOT NULL').all();

    const updateItemStatus = db.prepare(
      "UPDATE items SET glpi_status = ?, glpi_synced_at = datetime('now') WHERE id = ?"
    );
    const unlinkItem = db.prepare('UPDATE items SET glpi_id = NULL WHERE id = ?');
    const updateTicketStatus = db.prepare(
      "UPDATE tickets SET status = ?, glpi_synced_at = datetime('now') WHERE id = ?"
    );
    const unlinkTicket = db.prepare('UPDATE tickets SET glpi_id = NULL WHERE id = ?');

    const summary = await withSession(async (client) => {
      const out = { itemsUpdated: 0, ticketsUpdated: 0, itemsMissing: 0, ticketsMissing: 0, errors: [] };
      const states = await loadStates(client);

      for (const item of items) {
        const itemtype = item.glpi_itemtype || itemtypeFor(item.type);
        try {
          const glpiItem = await client.getItem(itemtype, item.glpi_id);
          if (!glpiItem) {
            // Deleted in GLPI -> drop the link so a later push can recreate it.
            unlinkItem.run(item.id);
            out.itemsMissing++;
            continue;
          }
          const label = stateLabel(states, glpiItem.states_id);
          if (label !== item.glpi_status) {
            updateItemStatus.run(label, item.id);
            out.itemsUpdated++;
          }
        } catch (err) {
          out.errors.push(`Item #${item.id}: ${err.message}`);
        }
      }

      for (const ticket of tickets) {
        try {
          const glpiTicket = await client.getItem('Ticket', ticket.glpi_id);
          if (!glpiTicket) {
            unlinkTicket.run(ticket.id);
            out.ticketsMissing++;
            continue;
          }
          const newStatus = glpiStatusToNewapp(glpiTicket.status);
          if (newStatus !== ticket.status) {
            updateTicketStatus.run(newStatus, ticket.id);
            out.ticketsUpdated++;
          }
        } catch (err) {
          out.errors.push(`Ticket #${ticket.id}: ${err.message}`);
        }
      }

      return out;
    });

    res.json(summary);
  } catch (err) {
    const status = err instanceof GlpiError && err.status === 401 ? 401 : 502;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;
