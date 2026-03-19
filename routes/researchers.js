'use strict';
const express = require('express');
const db = require('../config/db');

const router = express.Router();

// GET /api/researchers?search=&department=&domain=
router.get('/', (req, res) => {
  const { search = '', department = '', domain = '' } = req.query;
  const params = [];

  let where = `WHERE u.is_active=1 AND u.role='researcher'`;

  if (search && String(search).trim()) {
    where += ` AND u.name LIKE ?`;
    params.push(`%${String(search).trim()}%`);
  }
  if (department && String(department).trim() && department !== 'all') {
    where += ` AND u.department = ?`;
    params.push(String(department).trim());
  }
  if (domain && String(domain).trim() && domain !== 'all') {
    where += ` AND EXISTS (SELECT 1 FROM papers p WHERE p.user_id=u.id AND p.status='approved' AND p.domain=?)`;
    params.push(String(domain).trim());
  }

  const users = db.prepare(
    `SELECT u.uuid, u.name, u.role, u.department, u.bio,
            u.avatar_url, u.reputation, u.xp, u.level,
            u.created_at,
            (SELECT COUNT(*) FROM papers WHERE user_id=u.id AND status='approved') AS paper_count,
            (SELECT COUNT(*) FROM user_badges WHERE user_id=u.id) AS badge_count,
            (SELECT COUNT(*) FROM endorsements WHERE to_user=u.id) AS endorse_count
     FROM users u
     ${where}
     ORDER BY u.reputation DESC, u.name`
  ).all(...params);

  res.json(users);
});

module.exports = router;

