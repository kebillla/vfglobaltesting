/* ==========================================================================
   Аналитика. Скрипты грузятся только если ID заданы в config.js.
   Единая точка отправки событий: track('EventName', {..}).
   События: PageView, Lead (форма отправлена), InitiateCheckout (клик по CTA),
            Purchase (заглушка оплаты), QuizStep.
   ========================================================================== */
(function () {
  var A = (window.SITE_CONFIG && window.SITE_CONFIG.analytics) || {};

  function inject(src, attrs) {
    var s = document.createElement('script');
    s.async = true; s.src = src;
    Object.keys(attrs || {}).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    document.head.appendChild(s);
    return s;
  }

  /* -------------------------------- GTM ---------------------------------- */
  window.dataLayer = window.dataLayer || [];
  if (A.gtmId) {
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    inject('https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(A.gtmId));
  }

  /* -------------------------------- GA4 ---------------------------------- */
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  if (A.ga4Id && !A.gtmId) {
    inject('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(A.ga4Id));
    gtag('js', new Date());
    gtag('config', A.ga4Id);
  }

  /* ----------------------------- Meta Pixel ------------------------------ */
  if (A.metaPixelId) {
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', A.metaPixelId);
    window.fbq('track', 'PageView');
  }

  /* ---------------------------- TikTok Pixel ----------------------------- */
  if (A.tiktokPixelId) {
    /* eslint-disable */
    !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(e,n){e[n]=function(){e.push([n].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(e){for(var n=ttq._i[e]||[],i=0;i<ttq.methods.length;i++)ttq.setAndDefer(n,ttq.methods[i]);return n};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
    ttq.load(A.tiktokPixelId);ttq.page();
    }(window,document,'ttq');
    /* eslint-enable */
  }

  /* ------------------------ Единая отправка события ---------------------- */
  var STANDARD = { Lead: 1, InitiateCheckout: 1, Purchase: 1, ViewContent: 1, CompleteRegistration: 1 };

  window.track = function (name, params) {
    params = params || {};
    try { window.dataLayer.push(Object.assign({ event: name }, params)); } catch (e) {}
    try {
      if (window.fbq) window.fbq(STANDARD[name] ? 'track' : 'trackCustom', name, params);
    } catch (e) {}
    try {
      if (window.ttq) window.ttq.track(name, params);
    } catch (e) {}
    if (!window.SITE_CONFIG.analytics.gtmId && !window.SITE_CONFIG.analytics.metaPixelId) {
      console.info('[track]', name, params);
    }
  };
})();
