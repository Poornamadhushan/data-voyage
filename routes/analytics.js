'use strict';
const express = require('express');
const db = require('../config/db');

const router = express.Router();

function monthLabel(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { month: 'short' });
}

function monthKey(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function lastNMonths(n = 12) {
  const out = [];
  const now = new Date();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-GB', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth() + 1
    });
  }
  return out;
}

// Public dashboard analytics (used by /Dashboards)
router.get('/dashboard', (req, res) => {
  try {
    // 12-month approved papers trend
    const months = lastNMonths(12);
    const sinceKey = months[0].key;
    const rows = db.prepare(
      `SELECT created_at
       FROM papers
       WHERE status='approved'`
    ).all();

    const counts = new Map(months.map(m => [m.key, 0]));
    rows.forEach(r => {
      const k = monthKey(r.created_at);
      if (!k) return;
      if (k < sinceKey) return;
      counts.set(k, (counts.get(k) || 0) + 1);
    });

    const trend = months.map(m => ({
      key: m.key,
      label: m.label,
      value: counts.get(m.key) || 0
    }));

    // Domain distribution (approved papers)
    const domainRows = db.prepare(
      `SELECT domain, COUNT(*) AS c
       FROM papers
       WHERE status='approved'
       GROUP BY domain
       ORDER BY c DESC`
    ).all();

    const domainTotal = domainRows.reduce((a, r) => a + (r.c || 0), 0) || 1;
    const palette = ['#0901FA', '#3d35fb', '#00d4ff', '#7c3aed', '#0600c0', '#6366f1', '#22c55e', '#f59e0b'];
    const domains = domainRows.slice(0, 6).map((r, i) => ({
      label: r.domain || 'Other',
      count: r.c || 0,
      pct: (r.c || 0) / domainTotal,
      color: palette[i % palette.length]
    }));
    const otherCount = domainRows.slice(6).reduce((a, r) => a + (r.c || 0), 0);
    if (otherCount > 0) {
      domains.push({
        label: 'Other',
        count: otherCount,
        pct: otherCount / domainTotal,
        color: palette[6]
      });
    }

    // Engagement radar (normalized 0..1 based on current totals)
    const stats = {
      views: db.prepare(`SELECT COALESCE(SUM(views),0) c FROM papers WHERE status='approved'`).get().c,
      endorsements: db.prepare(`SELECT COUNT(*) c FROM endorsements`).get().c,
      badges: db.prepare(`SELECT COUNT(*) c FROM user_badges`).get().c,
      researchers: db.prepare(`SELECT COUNT(*) c FROM users WHERE is_active=1 AND role='researcher'`).get().c,
      papers: db.prepare(`SELECT COUNT(*) c FROM papers WHERE status='approved'`).get().c,
    };

    const maxes = {
      views: Math.max(stats.views, 1),
      endorsements: Math.max(stats.endorsements, 1),
      badges: Math.max(stats.badges, 1),
      researchers: Math.max(stats.researchers, 1),
      papers: Math.max(stats.papers, 1),
    };

    const radar = {
      axes: ['Views', 'Endorsements', 'Badges', 'Researchers', 'Papers'],
      values: [
        stats.views / maxes.views,
        stats.endorsements / maxes.endorsements,
        stats.badges / maxes.badges,
        stats.researchers / maxes.researchers,
        stats.papers / maxes.papers,
      ]
    };

    res.json({
      trend,
      domains,
      radar,
      totals: stats
    });
  } catch (e) {
    res.status(500).json({ error: 'Analytics unavailable' });
  }
});

module.exports = router;

