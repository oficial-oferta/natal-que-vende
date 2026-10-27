/* Natal que Vende — mensuração de eventos em português (GA4).
 * Consentimento básico: nenhuma tag de análise é carregada antes do aceite.
 * Não enviamos dados pessoais de compradoras, e-mail ou valores de compras fictícias.
 */
(() => {
  'use strict';

  const cfg = window.NQV_CONFIG || {};
  const gaId = String(cfg.GA4_MEASUREMENT_ID || '').trim();
  const pixelId = String(cfg.META_PIXEL_ID || '').trim();
  const banner = document.querySelector('[data-cookie-banner]');
  const allow = document.querySelector('[data-consent-accept]');
  const deny = document.querySelector('[data-consent-reject]');
  const preferences = document.querySelector('[data-open-cookie-preferences]');
  const storageKey = 'nqv_tracking_consent';
  let consented = false;
  let gaReady = false;

  const getSavedConsent = () => {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  };
  const saveConsent = (value) => {
    try { localStorage.setItem(storageKey, value); } catch { /* navegador restrito */ }
  };
  const showBanner = () => { if (banner) banner.hidden = false; };
  const hideBanner = () => { if (banner) banner.hidden = true; };

  function startGoogleAnalytics() {
    if (!gaId || gaReady) return;
    gaReady = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    // Consent Mode v2 — apenas analytics_storage; publicidade segue negada.
    window.gtag('consent', 'default', {
      ad_storage: 'denied', ad_user_data: 'denied',
      ad_personalization: 'denied', analytics_storage: 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('config', gaId, { send_page_view: true });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
    script.setAttribute('data-ga4-script', '');
    document.head.appendChild(script);
  }

  function startMetaPixel() {
    if (!pixelId || typeof window.fbq === 'function') return;
    !(function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)})
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
  }

  function track(name, data = {}) {
    if (!consented || !gaId || !gaReady || typeof window.gtag !== 'function') return;
    // Event names: Portuguese without accents/spaces, per GA4 naming rules.
    window.gtag('event', name, {
      ...data,
      origem_pagina: 'pagina_de_vendas',
      transport_type: 'beacon'
    });
  }

  function grant() {
    consented = true;
    saveConsent('granted');
    hideBanner();
    startGoogleAnalytics();
    startMetaPixel();
    track('consentimento_aceito');
  }

  function reject() {
    consented = false;
    saveConsent('denied');
    hideBanner();
    // Se houver mudança de ideia após um aceite na mesma aba, interromper
    // novos eventos; a nova escolha fica em vigor ao recarregar a página.
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: 'denied' });
    }
  }

  if (allow) allow.addEventListener('click', grant);
  if (deny) deny.addEventListener('click', reject);
  if (preferences) preferences.addEventListener('click', showBanner);
  if (gaId || pixelId) {
    const saved = getSavedConsent();
    if (saved === 'granted') grant();
    else if (saved !== 'denied') showBanner();
  }

  // Não interfere no redirecionamento para a Cakto.
  document.addEventListener('click', (ev) => {
    const button = ev.target.closest('.js-checkout');
    if (!button) return;
    const posicao = button.closest('.site-header') ? 'cabecalho' :
      button.closest('.watch-checkout') ? 'abaixo_do_video' :
      button.closest('.mobile-sticky') ? 'botao_fixo_celular' :
      button.closest('#oferta') ? 'secao_de_oferta' : 'outra_secao';
    track('clique_checkout', { posicao_botao: posicao });
  }, true);

  const video = document.querySelector('[data-vsl-video]');
  if (video) {
    let started = false;
    let completed = false;
    let pauseCount = 0;
    let lastTime = null;
    let watchedSeconds = 0;
    let outOfViewSent = false;
    const sent = new Set();
    const videoData = () => ({
      titulo_video: 'VSL Natal que Vende',
      duracao_video: Math.round(Number(video.duration) || 0),
      posicao_segundos: Math.floor(Number(video.currentTime) || 0)
    });
    const once = (name, data = {}) => {
      if (sent.has(name)) return;
      if (!consented) return;
      sent.add(name);
      track(name, { ...videoData(), ...data });
    };
    video.addEventListener('play', () => {
      started = true;
      completed = false;
      lastTime = Number(video.currentTime) || 0;
      once('video_iniciado');
    });
    video.addEventListener('seeking', () => { lastTime = null; });
    video.addEventListener('timeupdate', () => {
      if (!started || video.seeking || video.paused || !consented) return;
      const position = Number(video.currentTime) || 0;
      if (lastTime !== null && position >= lastTime && position - lastTime <= 2) {
        watchedSeconds += position - lastTime;
      }
      lastTime = position;
      if (watchedSeconds >= 10) once('video_assistiu_10s');
      const duration = Number(video.duration) || 0;
      if (duration > 0) {
        const progress = (position / duration) * 100;
        [25, 50, 75].forEach((pct) => {
          if (progress >= pct) once('video_' + pct + '_porcento', { percentual_video: pct });
        });
      }
    });
    video.addEventListener('pause', () => {
      if (!started || completed || video.ended || video.seeking || !consented) return;
      if (Number(video.currentTime) > 1 && pauseCount < 5) {
        pauseCount++;
        track('video_pausado', { ...videoData(), quantidade_pausas: pauseCount });
      }
    });
    video.addEventListener('ended', () => {
      completed = true;
      once('video_concluido', { percentual_video: 100 });
    });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        if (started && !completed && !entry.isIntersecting && !video.paused && !outOfViewSent) {
          outOfViewSent = true;
          once('video_saiu_da_tela');
        }
      }, { threshold: 0.12 });
      observer.observe(video);
    }
    window.addEventListener('pagehide', () => {
      if (started && !completed && consented) {
        once('video_abandonado');
      }
    });
  }

  // Tempo de permanência real com aba ativa: não conta minutos em segundo plano.
  let visibleSeconds = 0;
  const dwell = new Set();
  if (gaId) window.setInterval(() => {
    if (!consented || document.hidden) return;
    visibleSeconds++;
    for (const milestone of [30, 60, 120]) {
      if (visibleSeconds >= milestone && !dwell.has(milestone)) {
        dwell.add(milestone);
        track('tempo_' + milestone + '_segundos', { segundos_na_pagina: milestone });
      }
    }
  }, 1000);

  const scrollSent = new Set();
  let scrollScheduled = false;
  const checkScroll = () => {
    scrollScheduled = false;
    if (!consented || document.hidden) return;
    const full = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const available = Math.max(1, full - window.innerHeight);
    const percent = Math.round((window.scrollY / available) * 100);
    [25, 50, 75, 90].forEach((pct) => {
      if (percent >= pct && !scrollSent.has(pct)) {
        scrollSent.add(pct);
        track('rolagem_' + pct + '_porcento', { porcentagem_rolagem: pct });
      }
    });
  };
  window.addEventListener('scroll', () => {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(checkScroll);
  }, { passive: true });

  const offer = document.querySelector('[data-offer-section]');
  if (offer && 'IntersectionObserver' in window) {
    let offerSent = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && consented && !offerSent) {
        offerSent = true;
        track('oferta_visualizada');
        observer.disconnect();
      }
    }, { threshold: 0.4 });
    observer.observe(offer);
  }

  // Apoio de diagnóstico no console do navegador; não envia eventos fictícios.
  window.NQV_ANALYTICS = Object.freeze({
    medicacao: gaId,
    consentimento: () => consented,
    registrar: track
  });
})();
