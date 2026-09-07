/* ==========================================================================
   Письмо со ссылкой. Провайдер — Resend (нужен подтверждённый домен).
   Ключа нет -> письмо не шлётся, но оплата и выдача ссылки не ломаются:
   ссылка в любом случае показывается на странице успеха.
   ========================================================================== */
'use strict';

const KEY  = process.env.RESEND_API_KEY || '';
const FROM = process.env.MAIL_FROM || 'VolFix Global <noreply@example.com>';

const configured = () => Boolean(KEY);

const T = {
  ru: {
    subject: 'Доступ в закрытую группу VolFix Global',
    hi: (name) => `${name}, оплата получена.`,
    body: 'Ваша персональная ссылка-приглашение в закрытую группу:',
    note: (h) => `Ссылка одноразовая и действует ${h} часов. Не передавайте её другим.`,
    foot: 'Если ссылка не открылась — ответьте на это письмо, поможем.'
  },
  kk: {
    subject: 'VolFix Global жабық тобына қолжетімділік',
    hi: (name) => `${name}, төлем қабылданды.`,
    body: 'Жабық топқа арналған жеке шақыру сілтемеңіз:',
    note: (h) => `Сілтеме бір реттік және ${h} сағат жарамды. Басқаға бермеңіз.`,
    foot: 'Сілтеме ашылмаса — осы хатқа жауап жазыңыз, көмектесеміз.'
  }
};

async function sendInvite({ to, name, link, lang = 'ru', hours = 48 }) {
  if (!configured()) {
    console.warn('[mail] RESEND_API_KEY не задан, письмо не отправлено:', to);
    return { skipped: true };
  }
  const t = T[lang] || T.ru;
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;color:#1d1d1f;line-height:1.5">
      <p>${t.hi(name || '')}</p>
      <p>${t.body}</p>
      <p><a href="${link}" style="display:inline-block;background:#0071e3;color:#fff;padding:12px 22px;border-radius:980px;text-decoration:none">${link}</a></p>
      <p style="color:#6e6e73;font-size:14px">${t.note(hours)}</p>
      <p style="color:#6e6e73;font-size:14px">${t.foot}</p>
    </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject: t.subject, html })
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  return res.json();
}

module.exports = { configured, sendInvite };
