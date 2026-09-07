/* ==========================================================================
   GET|POST /api/robokassa/success — SuccessURL, сюда возвращается браузер.
   Подпись здесь считается паролем #1 и лишь подтверждает, что человек
   пришёл из Robokassa. Доступ не выдаётся: этим занимается ResultURL.
   ========================================================================== */
'use strict';

const store = require('./../_lib/store');
const rb = require('./../_lib/robokassa');

module.exports = async function handler(req, res) {
  const src = { ...(req.query || {}), ...(req.body || {}) };
  const outSum = String(src.OutSum || '');
  const invId = String(src.InvId || '');
  const signature = String(src.SignatureValue || '');
  const lang = src.Shp_lang === 'kk' ? 'kk' : 'ru';

  const ok = rb.configured() && rb.checkSuccess(outSum, invId, signature, rb.pickShp(src));
  if (!ok) return res.redirect(302, `/success.html?lang=${lang}&status=unverified`);

  const order = await store.get(invId);
  const token = order ? order.access_token : '';
  return res.redirect(302, `/success.html?order=${encodeURIComponent(invId)}&t=${encodeURIComponent(token)}&lang=${lang}`);
};
