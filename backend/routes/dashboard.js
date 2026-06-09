const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/dashboard — compte items par type + tickets par statut
router.get('/', (req, res) => {
  const itemsByType = db
    .prepare(
      "SELECT COALESCE(type, 'Inconnu') AS type, COUNT(*) AS count FROM items GROUP BY type ORDER BY count DESC"
    )
    .all();

  const ticketsByStatus = db
    .prepare(
      'SELECT status, COUNT(*) AS count FROM tickets GROUP BY status'
    )
    .all();

  const totalItems = db.prepare('SELECT COUNT(*) AS c FROM items').get().c;
  const totalTickets = db.prepare('SELECT COUNT(*) AS c FROM tickets').get().c;

  res.json({
    totalItems,
    totalTickets,
    itemsByType,
    ticketsByStatus,
  });
});

module.exports = router;
