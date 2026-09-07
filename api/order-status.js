/* ==========================================================================
   GET /api/order-status?order=<InvId>&t=<access_token>
   Страница успеха забирает ссылку по одноразовому токену из заказа.
   Без токена ничего не отдаём — иначе ссылку получил бы любой, кто
   подставит чужой номер заказа.
   ========================================================================== */
'use strict';

const store = require('./_lib/store');

module.exports = async function handler(req, res) {
  const id = String((req.query || {}).order || '');
  const token = String((req.query || {}).t || '');
  if (!id || !token) return res.status(400).json({ ok: false, error: 'missing_params' });

  const order = await store.get(id);
  if (!order || order.access_token !== token) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  return res.status(200).json({
    ok: true,
    status: order.status,                       // created | paid | issued | failed | ...
    invite_link: order.invite_link || null,
    invite_expires_at: order.invite_expires_at || null,
    email: order.email
  });
};
