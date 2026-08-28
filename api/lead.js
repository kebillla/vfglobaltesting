/* ==========================================================================
   ЗАГЛУШКА. Приём лида до оплаты (Vercel Serverless Function, Node runtime).
   Включается, когда в assets/js/config.js укажут leads.endpoint = '/api/lead'.

   Что здесь останется доделать при запуске:
     1. Запись в Google Sheets (Service Account) или CRM — TODO ниже.
     2. Антиспам: honeypot-поле / rate limit по IP.
     3. Валидацию телефона под формат KZ.
   ========================================================================== */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const lead = req.body || {};
  if (!lead.name || !lead.email || !lead.phone) {
    res.status(400).json({ ok: false, error: 'missing_fields' });
    return;
  }

  // TODO: сохранить лид. Пока просто логируем — MVP-заглушка.
  console.log('[lead]', {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    lang: lead.lang,
    quiz: lead.quiz,
    utm: lead.utm,
    created_at: lead.created_at
  });

  res.status(200).json({ ok: true, stored: 'log_only' });
};
