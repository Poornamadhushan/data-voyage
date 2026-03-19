'use strict';
/**
 * Reputation & XP Engine
 * ─────────────────────────────────────────────────────
 * XP thresholds per level (cumulative):
 *   Level 1:    0–199
 *   Level 2:  200–499
 *   Level 3:  500–999
 *   Level 4: 1000–1999
 *   Level 5: 2000+
 *
 * Points awarded:
 *   register           +10 rep  +50 xp
 *   paper_submit       +5  rep  +20 xp
 *   paper_approved     +50 rep  +150 xp
 *   paper_viewed       +1  rep  +2 xp   (per 10 views)
 *   paper_downloaded   +2  rep  +5 xp
 *   endorsed           +10 rep  +30 xp
 *   profile_complete   +15 rep  +75 xp
 */

const express = require('express');
const db      = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const router  = express.Router();

// ── XP LEVEL TABLE ────────────────────────────────────────────
const LEVELS = [0, 200, 500, 1000, 2000, 4000, 7000, 11000, 16000, 22000];

function calcLevel(xp) {
  let level = 1;
  for (let i = 1; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i]) level = i + 1;
    else break;
  }
  return level;
}

function xpToNextLevel(xp) {
  const level = calcLevel(xp);
  const next  = LEVELS[level] ?? null;
  const curr  = LEVELS[level - 1] ?? 0;
  if (!next) return { percent: 100, remaining: 0, nextLevel: null };
  const percent   = Math.floor(((xp - curr) / (next - curr)) * 100);
  const remaining = next - xp;
  return { percent, remaining, nextLevel: level + 1 };
}

// ── CORE AWARD FUNCTION (exported for use in other routes) ────
function awardPoints(userId, action, points, xp, refId = null, note = null) {
  if (!userId || points === 0) return;

  // Update user totals
  db.prepare(
    `UPDATE users
     SET reputation = reputation + ?,
         xp = xp + ?,
         level = ?,
         last_active = datetime('now'),
         updated_at  = datetime('now')
     WHERE id = ?`
  ).run(
    points, xp,
    calcLevel((db.prepare('SELECT xp FROM users WHERE id=?').get(userId)?.xp || 0) + xp),
    userId
  );

  // Log it
  db.prepare(
    `INSERT INTO reputation_log (user_id, action, points, xp, ref_id, note)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, action, points, xp, refId, note);

  // Check and award any newly unlocked badges
  checkAndAwardBadges(userId);
}

// ── BADGE CHECK ENGINE ────────────────────────────────────────
function checkAndAwardBadges(userId) {
  const user     = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (!user) return;

  const approvedCount = db.prepare(
    `SELECT COUNT(*) c FROM papers WHERE user_id=? AND status='approved'`
  ).get(userId).c;

  const totalViews = db.prepare(
    `SELECT COALESCE(SUM(views),0) c FROM papers WHERE user_id=?`
  ).get(userId).c;

  const endorseCount = db.prepare(
    `SELECT COUNT(*) c FROM endorsements WHERE to_user=?`
  ).get(userId).c;

  const domainCount = db.prepare(
    `SELECT COUNT(DISTINCT domain) c FROM papers WHERE user_id=? AND status='approved'`
  ).get(userId).c;

  const totalUsers = db.prepare('SELECT COUNT(*) c FROM users').get().c;

  const hasBadge = (slug) => !!db.prepare(
    `SELECT 1 FROM user_badges ub JOIN badges b ON ub.badge_id=b.id
     WHERE ub.user_id=? AND b.slug=?`
  ).get(userId, slug);

  const grantBadge = (slug) => {
    const badge = db.prepare('SELECT * FROM badges WHERE slug=?').get(slug);
    if (!badge || hasBadge(slug)) return;
    db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?,?)').run(userId, badge.id);
    // Award the badge's XP bonus
    if (badge.xp_reward > 0) {
      db.prepare(
        `UPDATE users SET xp=xp+?, reputation=reputation+?, updated_at=datetime('now') WHERE id=?`
      ).run(badge.xp_reward, Math.floor(badge.xp_reward / 3), userId);
      db.prepare(
        `INSERT INTO reputation_log (user_id,action,points,xp,note)
         VALUES (?,?,?,?,?)`
      ).run(userId, 'badge_earned', Math.floor(badge.xp_reward / 3), badge.xp_reward, `Badge: ${badge.name}`);
    }
  };

  // Check each badge condition
  if (approvedCount >= 1)  grantBadge('first_upload');
  if (approvedCount >= 3)  grantBadge('papers_3');
  if (approvedCount >= 10) grantBadge('papers_10');
  if (approvedCount >= 25) grantBadge('papers_25');
  if (totalViews  >= 100)  grantBadge('views_100');
  if (totalViews  >= 1000) grantBadge('views_1000');
  if (endorseCount >= 5)   grantBadge('endorsed_5');
  if (endorseCount >= 20)  grantBadge('endorsed_20');
  if (domainCount  >= 3)   grantBadge('multi_domain');
  if (user.streak_days >= 7)  grantBadge('streak_7');
  if (user.streak_days >= 30) grantBadge('streak_30');
  if (totalUsers <= 20)    grantBadge('early_adopter');

  // Profile complete badge
  if (user.bio && user.department && user.avatar_url) grantBadge('profile_complete');

  // Recalculate level after potential XP gain from badges
  const freshXP = db.prepare('SELECT xp FROM users WHERE id=?').get(userId)?.xp || 0;
  db.prepare('UPDATE users SET level=? WHERE id=?').run(calcLevel(freshXP), userId);
}

// ── ROUTES ────────────────────────────────────────────────────

// GET /api/reputation/leaderboard
router.get('/leaderboard', (req, res) => {
  const users = db.prepare(
    `SELECT u.uuid, u.name, u.department, u.avatar_url,
            u.reputation, u.xp, u.level,
            (SELECT COUNT(*) FROM papers WHERE user_id=u.id AND status='approved') AS papers,
            (SELECT COUNT(*) FROM user_badges WHERE user_id=u.id) AS badge_count
     FROM users u
     WHERE u.is_active=1 AND u.role='researcher'
     ORDER BY u.reputation DESC, u.xp DESC
     LIMIT 20`
  ).all();
  res.json(users);
});

// GET /api/reputation/:uuid — full profile stats
router.get('/:uuid', (req, res) => {
  const user = db.prepare(
    `SELECT u.uuid, u.name, u.department, u.avatar_url,
            u.reputation, u.xp, u.level, u.streak_days, u.created_at
     FROM users u WHERE u.uuid=?`
  ).get(req.params.uuid);
  if (!user) return res.status(404).json({ error: 'Not found' });

  const badges = db.prepare(
    `SELECT b.slug, b.name, b.description, b.icon, b.color, b.tier, ub.earned_at
     FROM user_badges ub JOIN badges b ON ub.badge_id=b.id
     WHERE ub.user_id=(SELECT id FROM users WHERE uuid=?)
     ORDER BY ub.earned_at DESC`
  ).all(req.params.uuid);

  const log = db.prepare(
    `SELECT action, points, xp, note, created_at
     FROM reputation_log
     WHERE user_id=(SELECT id FROM users WHERE uuid=?)
     ORDER BY created_at DESC LIMIT 20`
  ).all(req.params.uuid);

  const xpInfo = xpToNextLevel(user.xp);
  res.json({ ...user, badges, log, ...xpInfo });
});

// GET /api/reputation/me/stats — own stats
router.get('/me/stats', requireLogin, (req, res) => {
  const user = db.prepare(
    'SELECT reputation, xp, level, streak_days FROM users WHERE id=?'
  ).get(req.session.userId);

  const badges = db.prepare(
    `SELECT b.slug, b.name, b.description, b.icon, b.color, b.tier, ub.earned_at
     FROM user_badges ub JOIN badges b ON ub.badge_id=b.id
     WHERE ub.user_id=?
     ORDER BY ub.earned_at DESC`
  ).all(req.session.userId);

  const log = db.prepare(
    `SELECT action, points, xp, note, created_at
     FROM reputation_log WHERE user_id=?
     ORDER BY created_at DESC LIMIT 10`
  ).all(req.session.userId);

  res.json({ ...user, badges, log, ...xpToNextLevel(user?.xp || 0) });
});

// POST /api/reputation/endorse/:paperUuid — endorse a paper/author
router.post('/endorse/:paperUuid', requireLogin, (req, res) => {
  const paper = db.prepare(
    `SELECT id, user_id FROM papers WHERE uuid=? AND status='approved'`
  ).get(req.params.paperUuid);

  if (!paper) return res.status(404).json({ error: 'Paper not found' });
  if (paper.user_id === req.session.userId)
    return res.status(400).json({ error: "You can't endorse your own work" });

  try {
    db.prepare(
      `INSERT INTO endorsements (from_user, to_user, paper_id) VALUES (?,?,?)`
    ).run(req.session.userId, paper.user_id, paper.id);

    // Award rep to the paper author
    awardPoints(paper.user_id, 'endorsed', 10, 30, req.params.paperUuid, `Endorsed by user ${req.session.userId}`);

    const count = db.prepare('SELECT COUNT(*) c FROM endorsements WHERE to_user=?').get(paper.user_id).c;
    res.json({ ok: true, total: count });
  } catch {
    res.status(409).json({ error: 'Already endorsed' });
  }
});

module.exports = { router, awardPoints, checkAndAwardBadges, calcLevel };
