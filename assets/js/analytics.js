/* Natal que Vende — GA4: tag padrão instalada no cabeçalho.
 * Os eventos de interação permanecem em português.
 * A tag é inicializada uma vez por visita, sem pop-up de cookies.
 */
(() => {
  'use strict';
  const cfg = window.NQV_CONFIG || {};
  const gaId = String(cfg.GA4_MEASUREMENT_ID || '').trim();

  // google tag (gtag.js) carregado async no <head>, sem bloquear a renderização.
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  if (gaId) {
    window.gtag('js', new Date());
    window.gtag('config', gaId, { send_page_view: true });
  }

  function track(name, data = {}) {
    if (!gaId || typeof window.gtag !== 'function') return;
    window.gtag('event', name, {
      ...data,
      origem_pagina: 'pagina_de_vendas',
      transport_type: 'beacon'
    });
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
      if (!started || video.seeking || video.paused) return;
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
      if (!started || completed || video.ended || video.seeking) return;
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
      if (started && !completed) {
        once('video_abandonado');
      }
    });
  }

  // Tempo de permanência real com aba ativa: não conta minutos em segundo plano.
  let visibleSeconds = 0;
  const dwell = new Set();
  if (gaId) window.setInterval(() => {
    if (document.hidden) return;
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
    if (document.hidden) return;
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
      if (entry.isIntersecting && !offerSent) {
        offerSent = true;
        track('oferta_visualizada');
        observer.disconnect();
      }
    }, { threshold: 0.4 });
    observer.observe(offer);
  }

  // Apoio de diagnóstico no console do navegador; não envia eventos fictícios.
  window.NQV_ANALYTICS = Object.freeze({
    medicao: gaId,
    ativo: () => Boolean(gaId),
    registrar: track
  });
})();
