/* ==========================================================================
   VolFix Landing — логика: i18n, цена из конфига, UTM, квиз, форма, оплата.
   Зависимости: config.js, i18n.js (грузятся раньше), analytics.js (window.track).
   ========================================================================== */
(function () {
  'use strict';

  var CFG  = window.SITE_CONFIG;
  var DICT = window.I18N;
  var LS_LANG = 'vf_lang', LS_UTM = 'vf_utm', LS_LEADS = 'vf_leads', LS_LEAD = 'vf_lead';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var noop = function () {};
  var track = function () { (window.track || noop).apply(null, arguments); };

  /* ======================================================================
     1. Язык
     ====================================================================== */
  function detectLang() {
    /* Приоритет: ?lang= в ссылке (для таргета/рассылок) -> выбор юзера -> браузер. */
    var q = new URLSearchParams(location.search).get('lang');
    if (q && DICT[q]) return q;

    var saved = null;
    try { saved = localStorage.getItem(LS_LANG); } catch (e) {}
    if (saved && DICT[saved]) return saved;

    var nav = (navigator.language || '').toLowerCase();
    if (nav.indexOf('kk') === 0 || nav.indexOf('kz') === 0) return 'kk';
    return CFG.i18n.default;
  }

  var lang = detectLang();

  /* ======================================================================
     2. Цена и подстановки
     ====================================================================== */
  function fmtNumber(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function priceStr() {
    return fmtNumber(CFG.price.amount) + ' ' + CFG.price.currency;
  }
  function oldPriceStr() {
    return CFG.price.oldAmount ? fmtNumber(CFG.price.oldAmount) + ' ' + CFG.price.currency : '';
  }
  function periodStr() {
    /* Напрямую из словаря, без t() — иначе t() -> vars() -> periodStr() -> t(). */
    var k = 'period.' + CFG.price.period;
    var d = DICT[lang] || DICT.ru;
    return d[k] || DICT.ru[k] || CFG.price.period;
  }

  function vars() {
    return {
      weeks: CFG.volfixBonusWeeks,
      price: priceStr(),
      period: periodStr(),
      currency: CFG.price.currency,
      left: CFG.seats ? CFG.seats.left : '',
      total: CFG.seats ? CFG.seats.total : ''
    };
  }

  function t(key, extra) {
    var d = DICT[lang] || DICT.ru;
    var s = d[key];
    if (s == null) s = (DICT.ru[key] != null ? DICT.ru[key] : key);
    var v = vars();
    if (extra) Object.keys(extra).forEach(function (k) { v[k] = extra[k]; });
    return s.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; });
  }

  /* ======================================================================
     3. Применение перевода к DOM
     ====================================================================== */
  function applyLang(next, silent) {
    if (next) lang = next;
    try { localStorage.setItem(LS_LANG, lang); } catch (e) {}
    document.documentElement.setAttribute('lang', lang === 'kk' ? 'kk' : 'ru');

    $$('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });

    $$('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var p = pair.split(':');
        if (p.length === 2) el.setAttribute(p[0].trim(), t(p[1].trim()));
      });
    });

    $$('.lang__btn').forEach(function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-lang') === lang);
    });

    renderPrice();
    renderQuizMeta();
    if (!silent) track('LangSwitch', { lang: lang });
  }

  function renderPrice() {
    $$('[data-price-inline]').forEach(function (el) {
      el.textContent = priceStr() + ' / ' + periodStr();
    });
    $$('[data-price-amount]').forEach(function (el) { el.textContent = priceStr(); });
    $$('[data-price-period]').forEach(function (el) { el.textContent = t('price.per'); });
    $$('[data-price-old]').forEach(function (el) {
      var s = oldPriceStr();
      el.textContent = s;
      el.hidden = !s;
    });
    $$('[data-form-total]').forEach(function (el) { el.textContent = t('form.total'); });

    var seats = $('[data-seats]');
    if (seats) {
      var ok = CFG.seats && CFG.seats.left != null;
      seats.hidden = !ok;
      if (ok) seats.textContent = t('price.seats');
    }
  }

  /* ======================================================================
     4. UTM / источники трафика (first-touch, живёт до конца сессии браузера)
     ====================================================================== */
  function captureUtm() {
    var keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','ttclid','gclid'];
    var q = new URLSearchParams(location.search);
    var found = {};
    keys.forEach(function (k) { if (q.get(k)) found[k] = q.get(k); });

    var stored = {};
    try { stored = JSON.parse(localStorage.getItem(LS_UTM) || '{}'); } catch (e) {}

    if (Object.keys(found).length) {
      found.landing_page = location.pathname;
      found.referrer = document.referrer || '';
      found.first_seen = new Date().toISOString();
      try { localStorage.setItem(LS_UTM, JSON.stringify(found)); } catch (e) {}
      return found;
    }
    return stored;
  }
  var UTM = captureUtm();

  /* ======================================================================
     5. Мелкая динамика страницы
     ====================================================================== */
  function decorate() {
    var y = $('[data-year]');
    if (y) y.textContent = new Date().getFullYear();

    var since = $('[data-since]');
    if (since) since.textContent = new Date().getFullYear() - parseInt(since.getAttribute('data-since'), 10);

    /* внешние ссылки из конфига */
    $$('[data-link]').forEach(function (a) {
      var url = CFG.links[a.getAttribute('data-link')];
      if (url) a.setAttribute('href', url);
    });

    /* volume profile: столбцы разной длины, акцентный кластер по центру */
    var rows = $('.viz__rows');
    if (rows) {
      var w = [18,26,34,29,42,55,71,88,100,84,66,49,58,44,33,27,21,16];
      rows.innerHTML = w.map(function (v, i) {
        var dim = (i < 6 || i > 11) ? ' class="dim"' : '';
        return '<i' + dim + ' style="width:' + v + '%"></i>';
      }).join('');
    }
  }

  function scrollUi() {
    var hdr = $('#hdr');
    var sticky = $('#sticky');
    var hero = $('.hero');
    var onScroll = function () {
      var y = window.pageYOffset;
      if (hdr) hdr.classList.toggle('is-stuck', y > 8);
      if (sticky && hero) sticky.hidden = y < hero.offsetHeight * 0.6;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ======================================================================
     6. Модальное окно: квиз → форма → оплата
     ====================================================================== */
  var modal = $('#modal');
  var flow = [];
  var idx = 0;
  var answers = {};
  var ctaSource = '';

  function buildFlow() {
    flow = CFG.quizEnabled ? ['quiz1', 'quiz2', 'form', 'pay'] : ['form', 'pay'];
  }

  function quizTotal() { return CFG.quizEnabled ? 2 : 0; }

  function renderQuizMeta() {
    $$('[data-quiz-meta]').forEach(function (el, i) {
      el.textContent = t('quiz.step', { n: i + 1, total: quizTotal() });
    });
  }

  function showStep(i) {
    idx = Math.max(0, Math.min(i, flow.length - 1));
    var name = flow[idx];
    $$('.mstep', modal).forEach(function (s) {
      s.hidden = s.getAttribute('data-step') !== name;
    });
    var bar = $('[data-progress]', modal);
    if (bar) bar.style.width = Math.round(((idx + 1) / flow.length) * 100) + '%';

    var first = $('.mstep:not([hidden]) input, .mstep:not([hidden]) .opt', modal);
    if (first && window.innerWidth > 760) first.focus();
  }

  function openModal(source) {
    if (!modal) return;
    ctaSource = source || 'unknown';
    buildFlow();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    showStep(0);
    track('InitiateCheckout', {
      source: ctaSource, lang: lang,
      value: CFG.price.amount, currency: 'KZT', content_name: 'group_access'
    });
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  function bindModal() {
    if (!modal) return;

    $$('.js-cta').forEach(function (b) {
      b.addEventListener('click', function () { openModal(b.getAttribute('data-cta')); });
    });

    $$('[data-close]', modal).forEach(function (b) {
      b.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    $$('.opt', modal).forEach(function (b) {
      b.addEventListener('click', function () {
        var q = b.getAttribute('data-q');
        answers[q] = b.getAttribute('data-v');
        $$('.opt[data-q="' + q + '"]', modal).forEach(function (o) { o.classList.remove('is-on'); });
        b.classList.add('is-on');
        track('QuizStep', { question: q, answer: answers[q], lang: lang });
        setTimeout(function () { showStep(idx + 1); }, 140);
      });
    });

    var back = $('[data-back]', modal);
    if (back) back.addEventListener('click', function () { showStep(idx - 1); });

    var payBtn = $('[data-pay-continue]', modal);
    if (payBtn) payBtn.addEventListener('click', function () {
      /* Заглушка оплаты. Когда подключат эквайринг — здесь редирект на payUrl. */
      track('Purchase', { value: CFG.price.amount, currency: 'KZT', stub: true, lang: lang });
      location.href = 'success.html?lang=' + lang + '&demo=1';
    });

    bindForm();
  }

  /* ======================================================================
     7. Форма лида
     ====================================================================== */
  function setErr(input, key) {
    var fld = input.closest('.fld');
    if (fld) fld.classList.add('is-err');
    var em = fld ? $('.err', fld) : null;
    if (em) em.textContent = t(key);
  }
  function clearErr(form) {
    $$('.fld', form).forEach(function (f) { f.classList.remove('is-err'); });
    $$('.err', form).forEach(function (e) { e.classList.remove('is-on'); });
  }

  function validate(form) {
    clearErr(form);
    var ok = true;
    var el = form.elements;
    var name = el.name, phone = el.phone, email = el.email;

    if (!name.value.trim() || name.value.trim().length < 2) { setErr(name, 'form.err.name'); ok = false; }

    var digits = phone.value.replace(/\D/g, '');
    if (digits.length < 10) { setErr(phone, 'form.err.phone'); ok = false; }

    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.value.trim())) { setErr(email, 'form.err.email'); ok = false; }

    if (!el.consent.checked) {
      var em = $('[data-err="consent"]', form);
      if (em) { em.textContent = t('form.err.consent'); em.classList.add('is-on'); }
      ok = false;
    }
    return ok;
  }

  function saveLead(lead) {
    if (CFG.leads.storeLocally) {
      try {
        var all = JSON.parse(localStorage.getItem(LS_LEADS) || '[]');
        all.push(lead);
        localStorage.setItem(LS_LEADS, JSON.stringify(all));
        localStorage.setItem(LS_LEAD, JSON.stringify(lead));
      } catch (e) {}
    }
    if (!CFG.leads.endpoint) {
      console.info('[lead] endpoint не задан, лид сохранён локально:', lead);
      return Promise.resolve();
    }
    return fetch(CFG.leads.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
      keepalive: true
    }).catch(function (err) { console.warn('[lead] отправка не удалась:', err); });
  }

  function bindForm() {
    var form = $('#lead-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(form)) return;

      var btn = $('[data-submit]', form);
      var label = btn ? $('span', btn) : null;
      if (btn) { btn.disabled = true; if (label) label.textContent = t('form.sending'); }

      var lead = {
        name: form.elements.name.value.trim(),
        phone: form.elements.phone.value.trim(),
        email: form.elements.email.value.trim(),
        lang: lang,
        quiz: answers,
        cta_source: ctaSource,
        price: CFG.price.amount,
        currency: 'KZT',
        utm: UTM,
        page: location.href,
        created_at: new Date().toISOString()
      };

      track('Lead', {
        value: CFG.price.amount, currency: 'KZT', lang: lang,
        source: ctaSource, experience: answers.experience || '', budget: answers.budget || ''
      });

      saveLead(lead).then(function () {
        if (btn) { btn.disabled = false; if (label) label.textContent = t('form.submit'); }

        /* Реальная платёжка (когда появится юрлицо) — редирект на payUrl. */
        if (CFG.payment.provider !== 'stub' && CFG.payment.payUrl) {
          location.href = CFG.payment.payUrl +
            (CFG.payment.payUrl.indexOf('?') > -1 ? '&' : '?') +
            'email=' + encodeURIComponent(lead.email) + '&lang=' + lang;
          return;
        }
        showStep(idx + 1);   /* заглушка оплаты */
      });
    });
  }

  /* ======================================================================
     8. Страница успеха (success.html использует тот же скрипт)
     ====================================================================== */
  function successPage() {
    var box = $('[data-success]');
    if (!box) return;

    var link = $('[data-invite]');
    var copy = $('[data-copy]');
    if (copy && link) {
      copy.addEventListener('click', function () {
        var txt = link.textContent.trim();
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () {
          copy.textContent = t('success.copied');
          setTimeout(function () { copy.textContent = t('success.copy'); }, 1800);
        }).catch(noop);
      });
    }
    track('PurchaseSuccessView', { lang: lang, demo: /demo=1/.test(location.search) });
  }

  /* ======================================================================
     9. Старт
     ====================================================================== */
  function init() {
    $$('.lang__btn').forEach(function (b) {
      b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang')); });
    });
    decorate();
    applyLang(lang, true);
    buildFlow();
    bindModal();
    scrollUi();
    successPage();
    track('ViewContent', { lang: lang, utm_source: UTM.utm_source || 'direct' });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
