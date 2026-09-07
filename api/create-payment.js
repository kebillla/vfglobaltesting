/* ==========================================================================
   POST /api/create-payment
   Принимает лид, заводит заказ и отдаёт ссылку на платёжную форму Robokassa.
   Если ключи магазина ещё не заданы — отвечает {stub:true}, и фронт
   показывает демо-экран. Так лендинг работает и до подключения оплаты.
   ========================================================================== */
'use strict';

const store = require('./_lib/store');
const rb = require('./_lib/robokassa');
const crypto = require('crypto');

const PRICE = Number(process.env.PRICE_AMOUNT || 10000);
const CURRENCY = process.env.PRICE_CURRENCY || 'KZT';
const PRODUCT = process.env.PRODUCT_CODE || 'group_access';

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v || '').trim());

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const b = req.body || {};
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim();
  const phone = String(b.phone || '').trim();

  if (name.length < 2 || !isEmail(email) || phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ ok: false, error: 'invalid_fields' });
  }

  /* InvId должен быть числом. Секунды с эпохи + 3 случайные цифры:
     монотонно растёт, читается глазом, влезает в допустимый диапазон. */
  const invId = Number(String(Math.floor(Date.now() / 1000)) + String(Math.floor(Math.random() * 900) + 100));
  const now = Date.now();

  const order = {
    id: invId,
    status: 'created',            // created -> paid -> issued (| failed)
    /* --- кто --- */
    name, email, phone,
    lang: b.lang === 'kk' ? 'kk' : 'ru',
    /* --- сколько --- */
    amount: PRICE,
    currency: CURRENCY,
    product: PRODUCT,
    /* --- откуда --- */
    site: b.site || req.headers.host || '',
    cta_source: b.cta_source || '',
    quiz: b.quiz || {},
    utm: b.utm || {},
    referrer: b.referrer || '',
    user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
    ip: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim(),
    /* --- когда --- */
    created_at: new Date(now).toISOString(),
    created_ts: now,
    paid_at: null,
    issued_at: null,
    /* --- что выдали --- */
    invite_link: null,
    invite_expires_at: null,
    /* одноразовый ключ, по которому страница успеха забирает ссылку */
    access_token: crypto.randomBytes(16).toString('hex')
  };

  await store.put(order);

  if (!rb.configured()) {
    return res.status(200).json({ ok: true, stub: true, order_id: invId, access_token: order.access_token });
  }

  const url = rb.payUrl({
    outSum: PRICE,
    invId,
    description: process.env.PRODUCT_TITLE || 'Доступ в закрытую группу VolFix Global',
    email,
    lang: order.lang,
    shp: { Shp_lang: order.lang }
  });

  return res.status(200).json({ ok: true, pay_url: url, order_id: invId, access_token: order.access_token });
};
