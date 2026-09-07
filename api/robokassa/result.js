/* ==========================================================================
   POST /api/robokassa/result   — ResultURL, сервер-серверный колбэк.
   ЕДИНСТВЕННОЕ место, где выдаётся доступ: только здесь есть подпись,
   посчитанная паролем #2, который знают лишь Robokassa и наш сервер.
   Возврат браузера (SuccessURL) доступ не выдаёт — его легко подделать.
   Robokassa повторяет запрос до получения ответа «OK<InvId>», поэтому
   выдача защищена атомарной заявкой: ссылка создаётся ровно один раз.
   ========================================================================== */
'use strict';

const store = require('./../_lib/store');
const rb = require('./../_lib/robokassa');
const tg = require('./../_lib/telegram');
const mail = require('./../_lib/mail');

module.exports = async function handler(req, res) {
  const src = req.method === 'POST' ? { ...(req.query || {}), ...(req.body || {}) } : (req.query || {});
  const outSum = String(src.OutSum || src.outSum || '');
  const invId = String(src.InvId || src.inv_id || '');
  const signature = String(src.SignatureValue || src.signatureValue || '');

  if (!outSum || !invId || !signature) return res.status(400).send('bad request');

  if (!rb.checkResult(outSum, invId, signature, rb.pickShp(src))) {
    console.warn('[robokassa] неверная подпись, InvId=', invId);
    return res.status(403).send('bad sign');
  }

  const order = await store.get(invId);
  if (!order) {
    console.warn('[robokassa] заказ не найден, InvId=', invId);
    return res.status(200).send(`OK${invId}`);   // не заставляем ретраить
  }

  /* Сверяем сумму: подпись верна, но платёж должен быть на нужную сумму. */
  if (Math.abs(Number(outSum) - Number(order.amount)) > 0.01) {
    console.error('[robokassa] сумма не совпала', { invId, outSum, expected: order.amount });
    await store.patch(invId, { status: 'amount_mismatch', paid_amount: Number(outSum) });
    return res.status(200).send(`OK${invId}`);
  }

  const first = await store.claim(invId, 'issue');
  if (!first) return res.status(200).send(`OK${invId}`);   // повтор — уже выдали

  await store.patch(invId, { status: 'paid', paid_at: new Date().toISOString(), paid_ts: Date.now() });

  try {
    const invite = await tg.createInvite(invId);
    await store.patch(invId, {
      status: 'issued',
      issued_at: new Date().toISOString(),
      invite_link: invite.link,
      invite_expires_at: invite.expires_at
    });

    try {
      await mail.sendInvite({
        to: order.email, name: order.name, link: invite.link,
        lang: order.lang, hours: Number(process.env.TELEGRAM_INVITE_TTL_HOURS || 48)
      });
      await store.patch(invId, { mail_sent_at: new Date().toISOString() });
    } catch (e) {
      console.error('[mail] не отправлено:', e.message);   // ссылка уже есть на сайте
      await store.patch(invId, { mail_error: e.message });
    }
  } catch (e) {
    console.error('[telegram] ссылка не создана:', e.message);
    await store.patch(invId, { status: 'paid_invite_failed', invite_error: e.message });
  }

  return res.status(200).send(`OK${invId}`);
};
