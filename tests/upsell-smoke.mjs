import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Mock ONLY the external widget's visual shell. No payment method is simulated.
const browser=await chromium.launch({
  executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
  headless:true,args:['--no-sandbox']
});
const caktoscript='https://caktoscripts.nyc3.cdn.digitaloceanspaces.com/upsell.js';
const finalUrl='https://oficial-oferta.github.io/natal-que-vende/obrigado/';
try{
  for (const width of [320,360,390,430,768,1024,1440]){
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route(caktoscript,route=>route.fulfill({
      status:200,
      contentType:'application/javascript',
      body:`customElements.define('cakto-upsell-accept',class extends HTMLElement{
        connectedCallback(){this.attachShadow({mode:'open'}).innerHTML='<button part="button" type="button">'+this.textContent+'</button>';}
      });
      customElements.define('cakto-upsell-reject',class extends HTMLElement{
        connectedCallback(){this.attachShadow({mode:'open'}).innerHTML='<button part="button" type="button">'+this.textContent+'</button>';}
      });`
    }));
    await page.goto('http://127.0.0.1:8765/upsell/',{waitUntil:'networkidle'});
    const result=await page.evaluate(()=>({
      title:document.querySelector('h1')?.textContent,
      product:document.querySelector('#offer-title')?.textContent,
      price:document.querySelector('.price-line strong')?.textContent,
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      missingImages:[...document.images].filter(img=>img.complete&&img.naturalWidth===0).map(img=>img.src),
      originalFakeButtons:document.querySelectorAll('#cakto-upsell-buttons button[disabled]').length,
      accepts:document.querySelectorAll('cakto-upsell-accept').length,
      rejects:document.querySelectorAll('cakto-upsell-reject').length,
      offerId:document.querySelector('cakto-upsell-accept')?.getAttribute('offer-id'),
      offerType:document.querySelector('cakto-upsell-accept')?.getAttribute('offer-type'),
      bg:document.querySelector('cakto-upsell-accept')?.getAttribute('bg-color'),
      appBase:document.querySelector('cakto-upsell-accept')?.getAttribute('app-base-url'),
      acceptDestination:document.querySelector('cakto-upsell-accept')?.getAttribute('upsell-accept-url'),
      rejectDestination:document.querySelector('cakto-upsell-reject')?.getAttribute('upsell-reject-url'),
      rejectDestinationInAccept:document.querySelector('cakto-upsell-accept')?.getAttribute('upsell-reject-url'),
      loadedScript:document.querySelectorAll('script[src="https://caktoscripts.nyc3.cdn.digitaloceanspaces.com/upsell.js"]').length,
      renderedButtons:[...document.querySelectorAll('cakto-upsell-accept,cakto-upsell-reject')].filter(e=>e.shadowRoot?.querySelector('button')).length,
      memberPortalLink:[...document.querySelectorAll('a[href]')].some(a=>a.getAttribute('href')==='../portal/'),
      noIndex:document.querySelector('meta[name="robots"]')?.content.includes('noindex')
    }));
    assert.equal(result.overflow,false,'Upsell horizontal overflow '+width);
    assert.deepEqual(result.missingImages,[],'Missing upsell image '+width);
    assert.match(result.title||'',/presentes/i);
    assert.match(result.product||'',/Natal que Vende PRO/);
    assert.equal(result.price,'R$ 39,90');
    assert.equal(result.originalFakeButtons,0,'Temporary disabled buttons must be removed');
    assert.equal(result.accepts,1);
    assert.equal(result.rejects,1);
    assert.equal(result.offerId,'5ymryom','Preserve actual Cakto offer ID');
    assert.equal(result.offerType,'upsell');
    assert.equal(result.appBase,'https://app.cakto.com.br');
    assert.equal(result.bg,'#13780fff');
    assert.equal(result.acceptDestination,finalUrl);
    assert.equal(result.rejectDestination,finalUrl);
    assert.equal(result.rejectDestinationInAccept,finalUrl);
    assert.equal(result.loadedScript,1);
    assert.equal(result.renderedButtons,2,'Widget custom-element mounting');
    assert.equal(result.memberPortalLink,true);
    assert.equal(result.noIndex,true);
    assert.deepEqual(errors,[],'JS errors '+width);

    if (width===390||width===1440) {
      await page.locator('.hero-jump').click();
      assert.equal(new URL(page.url()).hash,'#oferta');
      await page.locator('.faq-items summary').first().click();
      assert.equal(await page.locator('.faq-items details').first().getAttribute('open'),'');
    }
    console.log('UPSELL PASS '+width+'px: Cakto widget integration + responsive layout');
    await page.goto('http://127.0.0.1:8765/obrigado/',{waitUntil:'networkidle'});
    const thanks=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      missingImages:[...document.images].filter(img=>img.complete&&img.naturalWidth===0).length,
      portalLink:!!document.querySelector('a[href="../portal/"]'),
      heading:document.querySelector('h1')?.textContent,
      noIndex:document.querySelector('meta[name="robots"]')?.content.includes('noindex')
    }));
    assert.equal(thanks.overflow,false,'Thanks horizontal overflow '+width);
    assert.equal(thanks.missingImages,0,'Thanks broken image '+width);
    assert.equal(thanks.portalLink,true);
    assert.match(thanks.heading||'',/Natal/);
    assert.equal(thanks.noIndex,true);
    await page.close();
  }
}finally{await browser.close()}
