/* ==========================================================================
   Хранилище заказов.
   Драйвер выбирается автоматически:
     · Upstash Redis (REST) — если заданы UPSTASH_REDIS_REST_URL и ..._TOKEN
     · память процесса     — локальная разработка, данные живут до перезапуска
   Наружу — один интерфейс, чтобы потом можно было заменить на Postgres,
   не трогая обработчики.
   ========================================================================== */
'use strict';

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasRedis = Boolean(URL_ && TOKEN);

const mem = { data: new Map(), index: [] };

async function redis(command) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  if (!res.ok) throw new Error(`upstash ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.result;
}

const key = (id) => `order:${id}`;

/* ------------------------------------------------------------------ API -- */

async function put(order) {
  if (!hasRedis) {
    mem.data.set(String(order.id), order);
    if (!mem.index.includes(String(order.id))) mem.index.push(String(order.id));
    return order;
  }
  await redis(['SET', key(order.id), JSON.stringify(order)]);
  /* индекс по времени создания — чтобы выгружать историю по периодам */
  await redis(['ZADD', 'orders:index', String(order.created_ts), String(order.id)]);
  return order;
}

async function get(id) {
  if (!hasRedis) return mem.data.get(String(id)) || null;
  const raw = await redis(['GET', key(id)]);
  return raw ? JSON.parse(raw) : null;
}

async function patch(id, fields) {
  const order = await get(id);
  if (!order) return null;
  const next = { ...order, ...fields };
  await put(next);
  return next;
}

/* Атомарная «заявка»: true получает только первый вызов.
   Защищает от повторной выдачи ссылки, когда Robokassa ретраит ResultURL. */
async function claim(id, tag) {
  if (!hasRedis) {
    const k = `claim:${id}:${tag}`;
    if (mem.data.has(k)) return false;
    mem.data.set(k, 1);
    return true;
  }
  const res = await redis(['SET', `claim:${id}:${tag}`, '1', 'NX', 'EX', '86400']);
  return res === 'OK';
}

/* Выгрузка истории: from/to — миллисекунды, limit — сколько записей вернуть. */
async function list({ from = 0, to = Date.now(), limit = 500 } = {}) {
  if (!hasRedis) {
    return mem.index
      .map((id) => mem.data.get(id))
      .filter((o) => o && o.created_ts >= from && o.created_ts <= to)
      .slice(-limit)
      .reverse();
  }
  const ids = await redis(['ZRANGEBYSCORE', 'orders:index', String(from), String(to), 'LIMIT', '0', String(limit)]);
  if (!ids || !ids.length) return [];
  const raws = await redis(['MGET', ...ids.map(key)]);
  return raws.filter(Boolean).map((r) => JSON.parse(r)).reverse();
}

module.exports = { put, get, patch, claim, list, driver: hasRedis ? 'upstash' : 'memory' };
