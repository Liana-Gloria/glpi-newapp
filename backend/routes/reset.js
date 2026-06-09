const express = require('express');
const router = express.Router();
const db = require('../db/database');
const requireAdmin = require('../middleware/auth');

// DELETE /api/reset — vide toutes les tables de données (protégé)
router.delete('/', requireAdmin, (req, res) => {
  const wipe = db.transaction(() => {
    db.prepare('DELETE FROM ticket_items').run();
    db.prepare('DELETE FROM tickets').run();
    db.prepare('DELETE FROM items').run();
    // Reset AUTOINCREMENT counters if the table exists.
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('items','tickets')").run();
  });
  try {
    wipe();
  } catch (err) {
    return res.status(500).json({ error: 'Reset échoué: ' + err.message });
  }
  res.json({ ok: true });
});

module.exports = router;
