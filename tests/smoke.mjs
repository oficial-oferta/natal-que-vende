import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';

// Maintain predictable mobile download budgets after future marketing updates.
for (const [path, limit] of [
  ['assets/images/logo-natal-que-vende-v2.webp', 40000],
  ['assets/images/mesa-mobile.webp', 135000],
  ['assets/images/mesa.webp', 250000],
  ['assets/css/styles.css', 65000],
  ['assets/js/app.js', 25000],
]) {
  const bytes = statSync(path).size;
  assert.ok(bytes <= limit, `Asset budget exceeded: ${path} (${bytes} > ${limit})`);
  console.log(`ASSET BUDGET PASS: ${path} ${Math.round(bytes/1024)} KiB`);
}

const executablePath = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 850 }, reducedMotion: 'reduce' });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
    const state = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      headline: document.querySelector('#hero-title')?.textContent || '',
      imagesBroken: [...document.images].filter(image => image.hasAttribute('src') && image.getAttribute('src') && image.complete && image.naturalWidth === 0).map(image => image.src),
      navPresent: !!document.querySelector('.brand-wordmark'),
      previewCards: document.querySelectorAll('.preview-card').length,
      moduleFourBuilt: document.querySelector('[data-module-four-status]')?.textContent?.trim() === 'Disponível',
      moduleFourReady: window.NQV_CONFIG?.PRODUCT_04_READY === true,
      canvaLinksPublic: document.querySelectorAll('a[href*="canva.com"]').length,
      moduleFourVisualPresent: !!document.querySelector('.preview-canva-kit .module-four-preview-art'),
      goalPresent: document.querySelector('#meta-10k')?.textContent?.includes('R$ 10.000'),
      heroBackground: getComputedStyle(document.querySelector('.hero-media')).backgroundImage,
      installmentText: document.querySelector('[data-installments-label]')?.textContent?.trim(),
      cashText: document.querySelector('.offer-cash-price')?.textContent?.trim(),
      stickyText: document.querySelector('[data-sticky-price]')?.textContent?.trim(),
      installmentDisclosure: document.querySelector('[data-installments-note]')?.textContent?.trim(),
      checkoutDestination: window.NQV_CONFIG?.CHECKOUT_URL,
      checkoutButtons: document.querySelectorAll('.js-checkout').length,
      vslBeforeDetails: document.querySelector('#video')?.compareDocumentPosition(document.querySelector('#materiais')) & Node.DOCUMENT_POSITION_FOLLOWING,
      playerAspect: (() => { const el=document.querySelector('[data-video-poster]');return el ? getComputedStyle(el).aspectRatio : '' })(),
      vslPurchaseBelowVideo: (() => {const s=document.querySelector('#video');return !!s?.querySelector('.watch-checkout .js-checkout') && s.querySelector('.watch-checkout').getBoundingClientRect().top >= s.querySelector('.watch-player').getBoundingClientRect().bottom-1})(),
      moduleFourDisclosure: document.querySelector('.offer-pending')?.textContent?.trim()
    }));
    assert.equal(state.horizontalOverflow, false, `Horizontal overflow at ${width}px`);
    assert.equal(state.imagesBroken.length, 0, `Broken images at ${width}px: ${state.imagesBroken}`);
    assert.ok(state.headline.includes('vender doces neste Natal'), 'Watch-first headline missing');
    assert.ok(state.navPresent, 'Wordmark missing');
    assert.equal(state.previewCards, 7, 'Missing Product 04 carousel preview');
    assert.equal(state.moduleFourBuilt, true, 'Product 04 design inventory not reflected on site');
    assert.equal(state.moduleFourReady, true, 'Product 04 should remain marked as ready');
    assert.equal(state.canvaLinksPublic, 0, 'Private Canva designs must not be publicly linked');
    assert.equal(state.moduleFourVisualPresent, true, 'Product 04 visual showcase missing');
    assert.equal(state.goalPresent, true, 'Illustrative R$10K goal section missing');
    assert.ok(state.heroBackground.includes(width <= 640 ? 'mesa-mobile.webp' : 'mesa.webp'), 'Wrong responsive hero image at ' + width);
    assert.equal(state.installmentText, '4x de R$ 5,63 no cartão', 'Confirmed installment amount must match the Cakto checkout');
    assert.ok(state.cashText.includes('R$ 19,90'), 'Missing cash price');
    assert.ok(state.stickyText.includes('R$ 19,90'), 'Missing mobile sticky cash price');
    assert.ok(state.installmentDisclosure.includes('R$ 22,52') && state.installmentDisclosure.includes('R$ 19,90') && state.installmentDisclosure.includes('R$ 2,62'), 'Missing total financed, cash price or added installment cost');
    assert.equal(state.checkoutDestination, 'https://pay.cakto.com.br/5ymryom_1235383', 'Official Cakto checkout must be configured');
    assert.ok(state.checkoutButtons >= 4, 'All primary CTAs must be wired to same Cakto URL');
    assert.ok(state.vslBeforeDetails, 'VSL must appear before long-form page details');
    assert.equal(state.playerAspect, '9 / 16', 'Player must use a vertical VSL format');
    assert.ok(state.vslPurchaseBelowVideo, 'Checkout button must be immediately below video');
    assert.ok(state.moduleFourDisclosure?.includes('30 modelos'), 'Must clearly disclose Canva model delivery');
    assert.equal(pageErrors.length, 0, `JS errors at ${width}px: ${pageErrors}`);
    if (width === 390 || width === 1440) {
      await page.locator('#previas').scrollIntoViewIfNeeded();
      for (let i = 0; i < 6; i++) {
        await page.locator('[data-preview-next]').click();
        await page.waitForTimeout(260);
      }
      assert.ok((await page.locator('[data-preview-count]').textContent()).includes('07 / 07'), 'Carousel did not reach its final preview');
      await page.locator('.preview-card [data-preview-zoom]').first().click();
      assert.equal(await page.locator('[data-preview-lightbox]').evaluate(el => el.open), true, 'Preview dialog not open');
      await page.locator('[data-lightbox-close]').click();
      assert.equal(await page.locator('[data-preview-lightbox]').evaluate(el => el.open), false, 'Preview dialog did not close');
      await page.locator('#video').scrollIntoViewIfNeeded();
      await page.locator('[data-video-play]').click();
      assert.ok((await page.locator('[data-video-frame] video source').getAttribute('src')).endsWith('/assets/video/natal-que-vende-vsl-v1-optimized.mp4'), 'Published VSL should load on click');
      assert.equal(await page.locator('[data-video-frame] video').count(), 1, 'Video player must appear after click');
      // Mock ONLY the network response from the checkout to validate the browser navigation.
      // This does not simulate a successful payment or record a purchase.
      await page.route('https://pay.cakto.com.br/**', route => route.fulfill({
        status:200,contentType:'text/html',body:'<!doctype html><title>Checkout Cakto — resposta simulada no CI</title>'
      }));
      await page.locator('.js-checkout:visible').first().click({timeout:8000});
      await page.waitForURL('https://pay.cakto.com.br/5ymryom_1235383');
      assert.equal(page.url(), 'https://pay.cakto.com.br/5ymryom_1235383');
    }
    console.log(`PASS: ${width}px • no overflow, all images loaded, no JS errors, gallery OK`);
    await page.close();
  }
} catch (error) {
  errors.push(error);
} finally {
  await browser.close();
}
if (errors.length) { console.error(errors[0]); process.exit(1); }
