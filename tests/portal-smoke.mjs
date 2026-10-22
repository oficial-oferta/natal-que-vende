import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
  for(const width of [320,360,390,430,768,1024,1440]){
    const page=await browser.newPage({viewport:{width,height:850},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8765/portal/',{waitUntil:'networkidle'});
    const a=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>window.innerWidth+1,
      missingImage:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src),
      gateNotice:!document.querySelector('[data-unconfigured]').hidden,
      noAuth:!document.querySelector('#auth-screen').hidden,
      protectedPortal:document.querySelector('#portal-screen').hidden,
      loginDisabled:document.querySelector('#login-submit').disabled,
      moduleCount:document.querySelectorAll('.module[data-module]').length,
      noPublicPaidLinks:document.querySelectorAll('a[href$=".pdf"],a[href$=".xlsx"],a[href*="canva.com"]').length===0
    }));
    assert.equal(a.overflow,false,'Portal horizontal overflow: '+width);
    assert.deepEqual(a.missingImage,[],'Broken portal image: '+width);
    assert.equal(a.noAuth,true,'Login screen missing: '+width);
    assert.equal(a.gateNotice,false,'Configured portal should not show setup warning: '+width);
    assert.equal(a.protectedPortal,true,'Library must stay hidden without login: '+width);
    assert.equal(a.loginDisabled,false,'Configured portal should enable Supabase sign-in: '+width);
    assert.equal(a.moduleCount,5,'Exactly five module containers expected: '+width);
    assert.equal(a.noPublicPaidLinks,true,'Do not publish editable files in frontend: '+width);
    assert.deepEqual(errors,[],'Browser errors: '+width);
    console.log('PORTAL PASS '+width+'px: connected login, no unauthenticated library, five modules, no file leaks');
    await page.close();
  }
}finally{await browser.close()}
