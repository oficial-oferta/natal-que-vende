import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser=await chromium.launch({
  executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
  headless:true,args:['--no-sandbox']
});
try{
  for (const width of [320,360,390,430,768,1024,1440]){
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    await page.goto('http://127.0.0.1:8765/upsell/',{waitUntil:'networkidle'});
    const result=await page.evaluate(()=>({
      title:document.querySelector('h1')?.textContent,
      product:document.querySelector('#offer-title')?.textContent,
      price:document.querySelector('.price-line strong')?.textContent,
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      missingImages:[...document.images].filter(img=>img.complete&&img.naturalWidth===0).map(img=>img.src),
      previewButtons:[...document.querySelectorAll('#cakto-upsell-buttons button')].map(b=>({disabled:b.disabled,text:b.textContent})),
      mainProductPortalLinks:[...document.querySelectorAll('a[href]')].some(a=>a.getAttribute('href')==='../portal/'),
      fauxPayments:document.querySelectorAll('form[action*="cakto"],a[href*="pay.cakto"]').length,
      noIndex:document.querySelector('meta[name="robots"]')?.content.includes('noindex')
    }));
    assert.equal(result.overflow,false,'Horizontal overflow '+width);
    assert.deepEqual(result.missingImages,[],'Missing images '+width);
    assert.match(result.title||'',/presentes/i);
    assert.match(result.product||'',/Natal que Vende PRO/);
    assert.equal(result.price,'R$ 39,90');
    assert.equal(result.previewButtons.length,2);
    assert.ok(result.previewButtons.every(x=>x.disabled),'No fake accept/refuse buttons');
    assert.equal(result.mainProductPortalLinks,true,'Member portal link');
    assert.equal(result.fauxPayments,0,'No invented checkout / one-click actions');
    assert.equal(result.noIndex,true);
    assert.deepEqual(errors,[],'JS errors '+width);
    if(width===390||width===1440) {
      await page.locator('.hero-jump').click();
      assert.equal(new URL(page.url()).hash,'#oferta');
      await page.locator('.faq-items summary').first().click();
      assert.equal(await page.locator('.faq-items details').first().getAttribute('open'),'');
    }
    console.log('UPSELL PASS '+width+'px · assets, visibility, pricing and payment safety');
    await page.close();
  }
}finally{await browser.close()}
