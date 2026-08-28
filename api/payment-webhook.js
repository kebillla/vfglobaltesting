/* ==========================================================================
   ЗАГЛУШКА. Вебхук платёжной системы -> выдача доступа в закрытую группу.
   Активировать после того, как выберут эквайринг (Robokassa / Prodamus / ...)
   и оформят юрлицо.

   Полный сценарий, который здесь нужно собрать:
     1. Проверить подпись вебхука (секрет из ENV) — БЕЗ этого эндпоинт открыт.
     2. Найти лид по email/order_id.
     3. Создать персональную ссылку через Telegram Bot API:
          POST https://api.telegram.org/bot<TOKEN>/createChatInviteLink
          { chat_id: TG_GROUP_ID, member_limit: 1, expire_date: now + 24h }
        member_limit=1 -> ссылка одноразовая, expire_date -> живёт сутки.
     4. Отдать ссылку фронту (страница success.html) + продублировать
        на email (SMTP/Resend) и в SMS (Mobizon/SMSC — канал уже используется).
     5. Активировать бонус VolFix на 2 месяца (ручная выдача или API партнёра).

   ENV, которые понадобятся:
     TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_ID, PAYMENT_WEBHOOK_SECRET,
     MAIL_API_KEY, SMS_API_KEY
   ========================================================================== */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  // TODO: verifySignature(req) — обязательно до выхода в прод.

  console.log('[payment-webhook] stub payload:', req.body);

  // Заглушка вместо реальной ссылки из Telegram Bot API:
  res.status(200).json({
    ok: true,
    stub: true,
    invite_link: 'https://t.me/+DEMO_INVITE_LINK_PLACEHOLDER'
  });
};
