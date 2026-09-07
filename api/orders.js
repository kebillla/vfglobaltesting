/* ==========================================================================
   GET /api/orders?token=<ADMIN_TOKEN>&from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv
   Выгрузка истории: кто, когда, сколько заплатил, выдали ли ссылку.
   Доступ по токену из переменной окружения ADMIN_TOKEN.
   ========================================================================== */
'use strict';

const store = require('./_lib/store');

const FIELDS = ['id','status','created_at','paid_at','issued_at','name','email','phone','lang',
                'amount','currency','product','site','cta_source','utm_source','utm_medium',
                'utm_campaign','invite_link','invite_expires_at'];

function toCsv(rows) {
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const line = (o) => FIELDS.map((f) => esc(
    f.startsWith('utm_') ? (o.utm || {})[f] : o[f]
  )).join(',');
  return [FIELDS.join(','), ...rows.map(line)].join('\n');
}

module.exports = async function handler(req, res) {
  const admin = process.env.ADMIN_TOKEN || '';
  const q = req.query || {};
  if (!admin || String(q.token || '') !== admin) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const from = q.from ? Date.parse(q.from) : 0;
  const to = q.to ? Date.parse(q.to) + 86399999 : Date.now();
  const rows = await store.list({ from, to, limit: Number(q.limit || 1000) });

  const paid = rows.filter((o) => o.status === 'issued' || o.status === 'paid');
  const revenue = paid.reduce((s, o) => s + Number(o.amount || 0), 0);

  if (String(q.format || '') === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    return res.status(200).send('﻿' + toCsv(rows));
  }

  return res.status(200).json({
    ok: true,
    driver: store.driver,
    summary: { total: rows.length, paid: paid.length, revenue, currency: rows[0] ? rows[0].currency : 'KZT' },
    orders: rows
  });
};
