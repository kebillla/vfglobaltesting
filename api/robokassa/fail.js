/* ==========================================================================
   GET|POST /api/robokassa/fail — FailURL: человек отменил оплату или она
   не прошла. Помечаем заказ и возвращаем на лендинг.
   ========================================================================== */
'use strict';

const store = require('./../_lib/store');

module.exports = async function handler(req, res) {
  const src = { ...(req.query || {}), ...(req.body || {}) };
  const invId = String(src.InvId || '');
  const lang = src.Shp_lang === 'kk' ? 'kk' : 'ru';

  if (invId) {
    const order = await store.get(invId);
    if (order && order.status === 'created') {
      await store.patch(invId, { status: 'failed', failed_at: new Date().toISOString() });
    }
  }
  return res.redirect(302, `/?lang=${lang}&payment=failed`);
};
