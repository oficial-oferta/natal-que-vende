(() => {
  'use strict';

  const config = window.NQV_CONFIG || {};
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const toast = qs('[data-toast]');
  let toastTimer;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4200);
  }

  function captureUtm() {
    const params = new URLSearchParams(window.location.search);
    const utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'].forEach((key) => {
      const value = params.get(key);
      if (value) utm[key] = value;
    });
    try {
      if (Object.keys(utm).length) sessionStorage.setItem('nqv_utm', JSON.stringify(utm));
      return JSON.parse(sessionStorage.getItem('nqv_utm') || '{}');
    } catch {
      // Private browsing and restrictive browser settings may block storage.
      // Keep the current URL's campaign parameters without crashing navigation.
      return utm;
    }
  }
  const utmData = captureUtm();

  function withTrackingParams(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url, window.location.href);
      Object.entries(utmData).forEach(([key, value]) => {
        if (!parsed.searchParams.has(key)) parsed.searchParams.set(key, value);
      });
      return parsed.href;
    } catch {
      return url;
    }
  }

  qsa('[data-current-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  qsa('[data-price-label]').forEach((el) => { el.textContent = config.PRICE_LABEL || 'Preço à vista a confirmar'; });
  qsa('[data-price-note]').forEach((el) => { el.textContent = config.PRICE_NOTE || ''; });
  const installments = Math.max(1, Math.min(12, Number(config.INSTALLMENTS_COUNT) || 4));
  // No installment price can be invented: show "4x de R$ X" only when confirmed
  // at the actual checkout. An empty INSTALLMENTS_PRICE retains truthful wording.
  const quotedInstallmentPrice = /^R\$\s?\d+[.,]\d{2}$/.test(String(config.INSTALLMENTS_PRICE || '').trim())
    ? String(config.INSTALLMENTS_PRICE).trim()
    : '';
  const installmentLabel = quotedInstallmentPrice
    ? `${installments}x de ${quotedInstallmentPrice} no cartão`
    : `Em até ${installments}x no cartão`;
  qsa('[data-installments-label]').forEach((el) => { el.textContent = installmentLabel; });
  qsa('[data-installments-note]').forEach((el) => {
    el.textContent = config.INSTALLMENTS_NOTE || 'O valor final das parcelas será confirmado no checkout.';
  });
  qsa('[data-sticky-price]').forEach((el) => {
    el.textContent = (config.PRICE_LABEL || 'Preço à vista a confirmar') + ' à vista';
  });

  function trackPixelEvent(name, params = {}) {
    if (typeof window.fbq === 'function') window.fbq('trackCustom', name, params);
  }

  qsa('.js-checkout').forEach((button) => {
    button.addEventListener('click', () => {
      trackPixelEvent('CheckoutIntent', { source: 'landing_page', ...utmData });
      if (config.CHECKOUT_URL) {
        window.location.href = withTrackingParams(config.CHECKOUT_URL);
        return;
      }
      const offer = qs('#oferta');
      if (offer && !button.closest('#oferta')) offer.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      showToast('Checkout ainda não configurado. Este site está em modo de prévia.');
    });
  });

  // Scroll reveal, disabled for reduced motion.
  const revealEls = qsa('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
    revealEls.forEach((el) => revealObserver.observe(el));
  }

  // Mobile sticky CTA appears after the hero.
  const hero = qs('.hero');
  const sticky = qs('[data-mobile-sticky]');
  if (hero && sticky && 'IntersectionObserver' in window) {
    const stickyObserver = new IntersectionObserver(([entry]) => {
      const show = !entry.isIntersecting;
      sticky.classList.toggle('is-visible', show);
      sticky.setAttribute('aria-hidden', String(!show));
    }, { threshold: 0.05 });
    stickyObserver.observe(hero);
  }

  // Horizontal carousel buttons work for sweets and any future scroll tracks.
  qsa('[data-scroll-prev]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const track = document.getElementById(btn.dataset.scrollPrev);
      if (track) track.scrollBy({ left: -Math.min(track.clientWidth * 0.82, 420), behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });
  qsa('[data-scroll-next]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const track = document.getElementById(btn.dataset.scrollNext);
      if (track) track.scrollBy({ left: Math.min(track.clientWidth * 0.82, 420), behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  // Video component: no broken player when URL is absent.
  const videoPlay = qs('[data-video-play]');
  const videoPoster = qs('[data-video-poster]');
  const videoFrame = qs('[data-video-frame]');
  if (videoPoster && config.VIDEO_POSTER) videoPoster.style.backgroundImage = `linear-gradient(180deg, rgba(3,28,20,.14), rgba(3,28,20,.78)), url("${config.VIDEO_POSTER}")`;

  function normalizeVideoUrl(raw) {
    if (!raw) return '';
    try {
      const url = new URL(raw);
      if (url.hostname.includes('youtube.com')) {
        const id = url.searchParams.get('v');
        return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0` : '';
      }
      if (url.hostname === 'youtu.be') {
        const id = url.pathname.replace('/', '');
        return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0` : '';
      }
      if (url.hostname.includes('vimeo.com')) {
        const id = url.pathname.split('/').filter(Boolean).pop();
        return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : '';
      }
      if (url.origin === window.location.origin && url.pathname.endsWith('.mp4')) return url.pathname.replace(/^\/natal-que-vende\//, '');
      return '';
    } catch { return ''; }
  }

  if (videoPlay) {
    videoPlay.addEventListener('click', () => {
      const src = normalizeVideoUrl(config.VIDEO_URL);
      if (!src) {
        showToast('O vídeo oficial ainda está em produção. A área já está pronta para receber o link.');
        return;
      }
      if (src.endsWith('.mp4')) {
        const video = document.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.autoplay = true;
        video.preload = 'none';
        video.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;background:#000';
        const source = document.createElement('source');
        source.src = src;
        source.type = 'video/mp4';
        video.appendChild(source);
        videoFrame.replaceChildren(video);
      } else {
      videoFrame.innerHTML = `<iframe src="${src}" title="Vídeo demonstrativo do Natal que Vende" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
      }
      videoPoster.hidden = true;
      videoFrame.hidden = false;
    });
  }

  // Product 04: visual stays available but remains explicitly pending until configured.
  if (config.PRODUCT_04_READY) {
    const status = qs('[data-module-four-status]');
    const offerLabel = qs('[data-offer-module-four]');
    if (status) { status.textContent = 'Disponível'; status.classList.add('is-ready'); }
    if (offerLabel) offerLabel.textContent = 'Materiais comerciais editáveis no Canva.';
  }

  // Optional real testimonials only.
  if (config.ENABLE_TESTIMONIALS && Array.isArray(config.TESTIMONIALS) && config.TESTIMONIALS.length) {
    const section = qs('[data-testimonials-section]');
    const grid = qs('[data-testimonials-grid]');
    if (section && grid) {
      grid.innerHTML = config.TESTIMONIALS.map((item) => `<figure class="testimonial-card"><blockquote>${escapeHtml(item.quote || '')}</blockquote><figcaption><strong>${escapeHtml(item.name || '')}</strong><span>${escapeHtml(item.context || '')}</span></figcaption></figure>`).join('');
      section.hidden = false;
    }
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
  }

  // Legal/support links only appear when configured.
  const legal = config.LEGAL_LINKS || {};
  qsa('[data-legal]').forEach((link) => {
    const href = legal[link.dataset.legal];
    if (href) { link.href = href; link.hidden = false; }
  });
  const support = qs('[data-support-link]');
  if (support && config.SUPPORT_URL) { support.href = config.SUPPORT_URL; support.hidden = false; }

  // Countdown only activates with an explicit real deadline.
  const countdownEl = qs('[data-countdown]');
  if (config.ENABLE_COUNTDOWN && config.CAMPAIGN_DEADLINE && countdownEl) {
    const deadline = new Date(config.CAMPAIGN_DEADLINE);
    if (!Number.isNaN(deadline.getTime()) && deadline.getTime() > Date.now()) {
      countdownEl.hidden = false;
      const renderCountdown = () => {
        const diff = deadline.getTime() - Date.now();
        if (diff <= 0) { countdownEl.textContent = 'Prazo promocional encerrado.'; return; }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        countdownEl.textContent = `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}min para o encerramento real da condição.`;
      };
      renderCountdown();
      setInterval(renderCountdown, 60000);
    }
  }

  // Offer view event (only sends if Pixel is loaded and consented).
  const offerSection = qs('[data-offer-section]');
  if (offerSection && 'IntersectionObserver' in window) {
    let sent = false;
    const offerObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !sent) {
        sent = true;
        trackPixelEvent('OfferView', { ...utmData });
      }
    }, { threshold: 0.45 });
    offerObserver.observe(offerSection);
  }

  // Meta Pixel loads only after explicit consent and only when an ID exists.
  const cookieBanner = qs('[data-cookie-banner]');
  const consentAccept = qs('[data-consent-accept]');
  const consentReject = qs('[data-consent-reject]');
  const consentKey = 'nqv_tracking_consent';

  function installMetaPixel() {
    if (!config.META_PIXEL_ID || window.fbq) return;
    /* Meta Pixel bootstrap, kept dormant until a real ID and consent exist. */
    !(function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)})(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', String(config.META_PIXEL_ID));
    window.fbq('track', 'PageView');
  }

  if (config.META_PIXEL_ID && cookieBanner) {
    const consent = localStorage.getItem(consentKey);
    if (consent === 'granted') installMetaPixel();
    else if (consent !== 'denied') cookieBanner.hidden = false;
  }
  if (consentAccept) consentAccept.addEventListener('click', () => {
    localStorage.setItem(consentKey, 'granted');
    if (cookieBanner) cookieBanner.hidden = true;
    installMetaPixel();
  });
  if (consentReject) consentReject.addEventListener('click', () => {
    localStorage.setItem(consentKey, 'denied');
    if (cookieBanner) cookieBanner.hidden = true;
  });
  // Large previews: accessible carousel with a full-size lightbox.
  const previewGallery = qs('[data-preview-gallery]');
  const previewCards = previewGallery ? qsa('.preview-card', previewGallery) : [];
  const previewCount = qs('[data-preview-count]');
  let previewIndex = 0;

  function updatePreviewCounter() {
    if (!previewGallery || !previewCards.length) return;
    const galleryLeft = previewGallery.getBoundingClientRect().left;
    let nearest = 0;
    let closest = Infinity;
    previewCards.forEach((card, index) => {
      const distance = Math.abs(card.getBoundingClientRect().left - galleryLeft);
      if (distance < closest) { closest = distance; nearest = index; }
    });
    previewIndex = nearest;
    if (previewCount) previewCount.textContent =
      String(nearest + 1).padStart(2, '0') + ' / ' + String(previewCards.length).padStart(2, '0');
    const prev = qs('[data-preview-prev]');
    const next = qs('[data-preview-next]');
    if (prev) prev.disabled = nearest === 0;
    if (next) next.disabled = nearest === previewCards.length - 1;
  }

  function jumpPreview(direction) {
    if (!previewGallery || !previewCards.length) return;
    const index = Math.max(0, Math.min(previewCards.length - 1, previewIndex + direction));
    const card = previewCards[index];
    const left = previewGallery.scrollLeft +
      card.getBoundingClientRect().left - previewGallery.getBoundingClientRect().left;
    previewGallery.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
    previewIndex = index;
    if (previewCount) previewCount.textContent =
      String(index + 1).padStart(2, '0') + ' / ' + String(previewCards.length).padStart(2, '0');
  }
  if (previewGallery) {
    const prev = qs('[data-preview-prev]');
    const next = qs('[data-preview-next]');
    if (prev) prev.addEventListener('click', () => jumpPreview(-1));
    if (next) next.addEventListener('click', () => jumpPreview(1));
    let pendingScroll = false;
    previewGallery.addEventListener('scroll', () => {
      if (!pendingScroll) {
        pendingScroll = true;
        requestAnimationFrame(() => { pendingScroll = false; updatePreviewCounter(); });
      }
    }, { passive: true });
    previewGallery.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); jumpPreview(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); jumpPreview(-1); }
    });
    updatePreviewCounter();
  }

  const lightbox = qs('[data-preview-lightbox]');
  const lightboxImage = qs('[data-lightbox-image]');
  const lightboxTitle = qs('[data-lightbox-title]');
  qsa('[data-preview-zoom]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const src = btn.dataset.previewZoom || '';
      if (!src.startsWith('assets/images/')) return;
      if (!lightbox || typeof lightbox.showModal !== 'function') {
        window.open(src, '_blank', 'noopener,noreferrer');
        return;
      }
      lightboxImage.src = src;
      lightboxImage.alt = btn.dataset.previewTitle || 'Prévia real ampliada';
      lightboxTitle.textContent = btn.dataset.previewTitle || 'Prévia ampliada';
      lightbox.showModal();
    });
  });
  const lightboxClose = qs('[data-lightbox-close]');
  if (lightboxClose) lightboxClose.addEventListener('click', () => lightbox.close());
  if (lightbox) lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) lightbox.close();
  });

})();
