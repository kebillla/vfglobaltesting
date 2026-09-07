/* ==========================================================================
   Telegram: персональная ссылка-приглашение в закрытый канал.
   Бот должен быть администратором канала с правом «Пригласительные ссылки».
   member_limit: 1 -> ссылкой может воспользоваться ровно один человек.
   ========================================================================== */
'use strict';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT  = process.env.TELEGRAM_CHAT_ID || '';
const TTL_H = Number(process.env.TELEGRAM_INVITE_TTL_HOURS || 48);

const configured = () => Boolean(TOKEN && CHAT);

async function call(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description || res.status}`);
  return json.result;
}

async function createInvite(orderId) {
  const expire = Math.floor(Date.now() / 1000) + TTL_H * 3600;
  const res = await call('createChatInviteLink', {
    chat_id: CHAT,
    name: `order-${orderId}`.slice(0, 32),
    member_limit: 1,
    expire_date: expire
  });
  return { link: res.invite_link, expires_at: new Date(expire * 1000).toISOString() };
}

/* Пригодится на втором этапе — отзыв доступа у тех, кто не продлил. */
async function kick(userId) {
  return call('banChatMember', { chat_id: CHAT, user_id: userId, revoke_messages: false });
}

module.exports = { configured, createInvite, kick, call };
