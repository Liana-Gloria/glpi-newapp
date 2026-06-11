// Synchronisation « temps réel » NewApp -> GLPI.
//
// Au lieu des boutons manuels push/pull, les routes appellent ici dès qu'un
// item ou un ticket est créé / modifié. Les écritures GLPI sont :
//   - sérialisées (une file unique) pour éviter les courses de session ;
//   - best-effort (une panne GLPI ne casse jamais la requête HTTP) ;
//   - tracées dans un journal mémoire que l'UI lit pour « vérifier en temps réel ».
const db = require('../db/database');
const { withSession } = require('./client');
const { itemtypeFor, newappStatusToGlpi, SUPPORTED_ITEMTYPES } = require('./mapping');

// Marqueur écrit dans GLPI (commentaire d'item / contenu de ticket) pour
// reconnaître et purger ce que NewApp a créé.
const NEWAPP_MARKER = '[NewApp]';

// --- Journal mémoire -------------------------------------------------------
const JOURNAL_MAX = 200;
const journal = [];
let seq = 0;

function record(entry) {
  journal.unshift({ id: ++seq, at: new Date().toISOString(), ...entry });
  if (journal.length > JOURNAL_MAX) journal.length = JOURNAL_MAX;
  return journal[0];
}

function getJournal() {
  return journal;
}

// --- File d'exécution sérialisée ------------------------------------------
let chain = Promise.resolve();
function enqueue(task) {
  // On enchaîne quoi qu'il arrive (succès ou échec du précédent).
  chain = chain.then(task, task);
  return chain;
}

// --- Construction des payloads GLPI ---------------------------------------
function itemInput(item) {
  return {
    name: item.name,
    serial: item.serial || '',
    comment: `${NEWAPP_MARKER} item #${item.id}${item.type ? ` (${item.type})` : ''}`,
  };
}

// `requesterId` n'est passé qu'à la CRÉATION : ajouter _users_id_requester à
// chaque update créerait un acteur demandeur en double à chaque sync.
function ticketInput(ticket, requesterId) {
  const base = ticket.description || ticket.title;
  const input = {
    name: ticket.title,
    content: `${base}\n\n${NEWAPP_MARKER} ticket #${ticket.id}`,
    status: newappStatusToGlpi(ticket.status),
  };
  if (requesterId) input._users_id_requester = requesterId;
  return input;
}

// --- Opérations unitaires (dans une session ouverte) ----------------------
const linkItem = db.prepare(
  "UPDATE items SET glpi_id = ?, glpi_itemtype = ?, glpi_synced_at = datetime('now') WHERE id = ?"
);
const linkTicket = db.prepare(
  "UPDATE tickets SET glpi_id = ?, glpi_synced_at = datetime('now') WHERE id = ?"
);

async function applyItem(client, item) {
  const itemtype = item.glpi_itemtype || itemtypeFor(item.type);
  if (item.glpi_id) {
    await client.updateItem(itemtype, item.glpi_id, itemInput(item));
    return record({ action: 'update-item', entity: 'item', localId: item.id, name: item.name, glpiId: item.glpi_id, itemtype, status: 'ok' });
  }
  const glpiId = await client.createItem(itemtype, itemInput(item));
  linkItem.run(glpiId, itemtype, item.id);
  return record({ action: 'create-item', entity: 'item', localId: item.id, name: item.name, glpiId, itemtype, status: 'ok' });
}

async function applyTicket(client, ticket) {
  if (ticket.glpi_id) {
    await client.updateItem('Ticket', ticket.glpi_id, ticketInput(ticket));
    return record({ action: 'update-ticket', entity: 'ticket', localId: ticket.id, name: ticket.title, glpiId: ticket.glpi_id, status: 'ok' });
  }
  const requesterId = await client.currentUserId();
  const glpiId = await client.createItem('Ticket', ticketInput(ticket, requesterId));
  linkTicket.run(glpiId, ticket.id);
  return record({ action: 'create-ticket', entity: 'ticket', localId: ticket.id, name: ticket.title, glpiId, status: 'ok' });
}

// --- API publique (fire-and-forget : non bloquant pour les routes) --------

// Pousse/MAJ un item suite à une création ou modification locale.
function syncItem(itemId) {
  return enqueue(async () => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
    if (!item) return;
    try {
      await withSession((client) => applyItem(client, item));
    } catch (err) {
      record({ action: 'sync-item', entity: 'item', localId: itemId, name: item.name, status: 'error', message: err.message });
    }
  });
}

// Pousse/MAJ un ticket suite à création, changement de statut ou édition.
function syncTicket(ticketId) {
  return enqueue(async () => {
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) return;
    try {
      await withSession((client) => applyTicket(client, ticket));
    } catch (err) {
      record({ action: 'sync-ticket', entity: 'ticket', localId: ticketId, name: ticket.title, status: 'error', message: err.message });
    }
  });
}

// Pousse tout ce qui n'est pas encore lié (après un import en masse) : 1 session.
function syncAllPending() {
  return enqueue(async () => {
    const items = db.prepare('SELECT * FROM items WHERE glpi_id IS NULL').all();
    const tickets = db.prepare('SELECT * FROM tickets WHERE glpi_id IS NULL').all();
    if (items.length === 0 && tickets.length === 0) return;
    try {
      await withSession(async (client) => {
        for (const item of items) {
          try { await applyItem(client, item); }
          catch (err) { record({ action: 'sync-item', entity: 'item', localId: item.id, name: item.name, status: 'error', message: err.message }); }
        }
        for (const ticket of tickets) {
          try { await applyTicket(client, ticket); }
          catch (err) { record({ action: 'sync-ticket', entity: 'ticket', localId: ticket.id, name: ticket.title, status: 'error', message: err.message }); }
        }
      });
    } catch (err) {
      record({ action: 'sync-all', status: 'error', message: `GLPI injoignable : ${err.message}` });
    }
  });
}

// Purge GLPI de TOUT ce que NewApp y a créé (éléments liés + orphelins marqués).
// Renvoie un résumé ; vide aussi les liens glpi_id locaux.
function purgeGlpi() {
  return enqueue(async () => {
    const summary = { itemsDeleted: 0, ticketsDeleted: 0, byType: {}, errors: [] };
    const deleted = new Set(); // clés "itemtype#id" déjà supprimées

    const linkedItems = db.prepare('SELECT id, glpi_id, glpi_itemtype, type FROM items WHERE glpi_id IS NOT NULL').all();
    const linkedTickets = db.prepare('SELECT id, glpi_id FROM tickets WHERE glpi_id IS NOT NULL').all();

    await withSession(async (client) => {
      // 1. Éléments explicitement liés côté NewApp (même sans marqueur).
      for (const it of linkedItems) {
        const itemtype = it.glpi_itemtype || itemtypeFor(it.type);
        const key = `${itemtype}#${it.glpi_id}`;
        try {
          await client.deleteItem(itemtype, it.glpi_id);
          deleted.add(key);
          summary.itemsDeleted++;
          summary.byType[itemtype] = (summary.byType[itemtype] || 0) + 1;
        } catch (err) { summary.errors.push(`${key}: ${err.message}`); }
      }
      for (const tk of linkedTickets) {
        const key = `Ticket#${tk.glpi_id}`;
        try { await client.deleteItem('Ticket', tk.glpi_id); deleted.add(key); summary.ticketsDeleted++; }
        catch (err) { summary.errors.push(`${key}: ${err.message}`); }
      }

      // 2. Orphelins : tout objet GLPI portant le marqueur NewApp.
      for (const itemtype of SUPPORTED_ITEMTYPES) {
        let all = [];
        try { all = await client.listAll(itemtype); }
        catch (err) { summary.errors.push(`list ${itemtype}: ${err.message}`); continue; }
        for (const obj of all) {
          if (!/newapp/i.test(String(obj.comment || ''))) continue;
          const key = `${itemtype}#${obj.id}`;
          if (deleted.has(key)) continue;
          try {
            await client.deleteItem(itemtype, obj.id);
            deleted.add(key);
            summary.itemsDeleted++;
            summary.byType[itemtype] = (summary.byType[itemtype] || 0) + 1;
          } catch (err) { summary.errors.push(`${key}: ${err.message}`); }
        }
      }
      let allTickets = [];
      try { allTickets = await client.listAll('Ticket'); }
      catch (err) { summary.errors.push(`list Ticket: ${err.message}`); }
      for (const t of allTickets) {
        if (!/newapp/i.test(String(t.content || '') + String(t.name || ''))) continue;
        const key = `Ticket#${t.id}`;
        if (deleted.has(key)) continue;
        try { await client.deleteItem('Ticket', t.id); deleted.add(key); summary.ticketsDeleted++; }
        catch (err) { summary.errors.push(`${key}: ${err.message}`); }
      }
    });

    // 3. Liens locaux remis à zéro (les objets GLPI n'existent plus).
    db.prepare("UPDATE items SET glpi_id = NULL, glpi_itemtype = NULL, glpi_status = NULL, glpi_synced_at = NULL WHERE glpi_id IS NOT NULL").run();
    db.prepare("UPDATE tickets SET glpi_id = NULL, glpi_synced_at = NULL WHERE glpi_id IS NOT NULL").run();

    record({
      action: 'purge',
      status: summary.errors.length ? 'error' : 'ok',
      message: `GLPI purgé : ${summary.itemsDeleted} item(s), ${summary.ticketsDeleted} ticket(s)`,
    });
    return summary;
  });
}

// --- Réconciliation périodique (filet de sécurité) ------------------------
// La sync temps réel est best-effort : si GLPI est injoignable à l'instant T,
// le ticket/item reste glpi_id=NULL sans relance. Cette boucle pousse
// régulièrement tout ce qui n'a pas encore été lié, ce qui rattrape
// automatiquement les échecs transitoires (Apache éteint, hoquet réseau…).
let reconcileTimer = null;
function startAutoSync(intervalMs = 60000) {
  if (reconcileTimer) return reconcileTimer; // idempotent
  const tick = () => {
    const pendingItems = db.prepare('SELECT COUNT(*) c FROM items WHERE glpi_id IS NULL').get().c;
    const pendingTickets = db.prepare('SELECT COUNT(*) c FROM tickets WHERE glpi_id IS NULL').get().c;
    if (pendingItems + pendingTickets > 0) syncAllPending();
  };
  tick(); // une passe au démarrage
  reconcileTimer = setInterval(tick, intervalMs);
  if (reconcileTimer.unref) reconcileTimer.unref(); // n'empêche pas l'arrêt du process
  return reconcileTimer;
}

function stopAutoSync() {
  if (reconcileTimer) { clearInterval(reconcileTimer); reconcileTimer = null; }
}

module.exports = {
  NEWAPP_MARKER,
  getJournal,
  syncItem,
  syncTicket,
  syncAllPending,
  purgeGlpi,
  startAutoSync,
  stopAutoSync,
};
