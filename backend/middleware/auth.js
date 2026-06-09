const ADMIN_CODE = 'ADMIN-2026';

function requireAdmin(req, res, next) {
  if (req.headers['x-admin-code'] !== ADMIN_CODE) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = requireAdmin;
