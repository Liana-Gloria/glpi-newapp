const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/auth');

// GET /api/auth/check — valide le code admin (header x-admin-code)
router.get('/check', requireAdmin, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
