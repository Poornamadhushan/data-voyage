'use strict';

function requireLogin(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.xhr || req.path.startsWith('/api/'))
    return res.status(401).json({ error: 'Not authenticated' });
  res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') return next();
  if (req.xhr || req.path.startsWith('/api/'))
    return res.status(403).json({ error: 'Forbidden' });
  res.status(403).send('403 Forbidden – Admin access required.');
}

module.exports = { requireLogin, requireAdmin };
