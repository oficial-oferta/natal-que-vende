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
      moduleFourPending: document.querySelector('[data-module-four-status]')?.textContent?.trim() === 'Em finalização',
      goalPresent: document.querySelector('#meta-10k')?.textContent?.includes('R$ 10.000'),
      heroBackground: getComputedStyle(document.querySelector('.hero-media')).backgroundImage,
      installmentText: document.querySelector('[data-installments-label]')?.textContent?.trim(),
      cashText: document.querySelector('.offer-cash-price')?.textContent?.trim(),
      stickyText: document.querySelector('[data-sticky-price]')?.textContent?.trim(),
      installmentDisclosure: document.querySelector('[data-installments-note]')?.textContent?.trim()
    }));
    assert.equal(state.horizontalOverflow, false, `Horizontal overflow at ${width}px`);
    assert.equal(state.imagesBroken.length, 0, `Broken images at ${width}px: ${state.imagesBroken}`);
    assert.ok(state.headline.includes('R$ 10.000'), 'Headline missing renda extra');
    assert.ok(state.navPresent, 'Wordmark missing');
    assert.equal(state.previewCards, 6, 'Missing preview cards');
    assert.equal(state.moduleFourPending, true, 'Module 04 unexpectedly marked ready');
    assert.equal(state.goalPresent, true, 'Illustrative R$10K goal section missing');
    assert.ok(state.heroBackground.includes(width <= 640 ? 'mesa-mobile.webp' : 'mesa.webp'), 'Wrong responsive hero image at ' + width);
    assert.equal(state.installmentText, 'Em até 4x no cartão', 'Unverified installment amount published');
    assert.ok(state.cashText.includes('R$ 19,90'), 'Missing cash price');
    assert.ok(state.stickyText.includes('R$ 19,90'), 'Missing mobile sticky cash price');
    assert.ok(state.installmentDisclosure.includes('checkout'), 'Missing installment fee disclosure');
    assert.equal(pageErrors.length, 0, `JS errors at ${width}px: ${pageErrors}`);
    if (width === 390 || width === 1440) {
      await page.locator('#previas').scrollIntoViewIfNeeded();
      for (let i = 0; i < 5; i++) {
        await page.locator('[data-preview-next]').click();
        await page.waitForTimeout(260);
      }
      assert.ok((await page.locator('[data-preview-count]').textContent()).includes('06 / 06'), 'Carousel did not reach its final preview');
      await page.locator('.preview-card [data-preview-zoom]').first().click();
      assert.equal(await page.locator('[data-preview-lightbox]').evaluate(el => el.open), true, 'Preview dialog not open');
      await page.locator('[data-lightbox-close]').click();
      assert.equal(await page.locator('[data-preview-lightbox]').evaluate(el => el.open), false, 'Preview dialog did not close');
      await page.locator('#video').scrollIntoViewIfNeeded();
      await page.locator('[data-video-play]').click();
      assert.ok((await page.locator('[data-toast]').textContent()).includes('em produção'), 'Missing video placeholder message');
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
