import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Browser-only simulation. No buyer account, order or entitlement is inserted into production.
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox']
});
const url = 'http://127.0.0.1:8765/portal/';
const resources = [
  {id:101,module_no:1,title:'Guia de teste não publicado',resource_kind:'pdf',
   storage_path:'test-only/documento.pdf',external_url:null,sort_order:1}
];
async function openWithStub(allowed, width) {
  const page = await browser.newPage({viewport:{width,height:890},reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/supabase\.min\.js/, route => route.fulfill({
    status:200,contentType:'application/javascript',
    body:`window.supabase={createClient:()=>({
      auth:{
        onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
        getSession:async()=>({data:{session:{user:{id:'test-user',email:'compradora.teste@example.com'}}}}),
        getUser:async()=>({data:{user:{id:'test-user',email:'compradora.teste@example.com'}}}),
        signOut:async()=>({error:null})
      },
      rpc:async()=>({data:${allowed},error:null}),
      from:()=>({select:()=>({eq:()=>({order:async()=>({data:${JSON.stringify(allowed?resources:[])},error:null})})})}),
      storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'/test-only'},error:null})})}
    })};`
  }));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForSelector('#portal-screen:not([hidden])',{timeout:10000});
  return {page,errors};
}
try {
  for(const width of [390,1440]) {
    const {page,errors}=await openWithStub(false,width);
    await page.locator('#access-denied').waitFor({state:'visible'});
    assert.equal(await page.locator('#member-library').isVisible(),false,'unpaid account must not see library');
    assert.equal(await page.locator('#module-detail').isVisible(),false,'unpaid account must not open module');
    assert.deepEqual(errors,[],'browser errors for unpaid account');
    console.log('PASS membership gate: '+width+'px');
    await page.close();
  }
  for(const width of [390,1440]) {
    const {page,errors}=await openWithStub(true,width);
    await page.locator('#member-library').waitFor({state:'visible'});
    assert.equal(await page.locator('.module[data-module]').count(),5);
    assert.equal(await page.locator('[data-resources="1"]').innerText(),'1 material disponível');
    for(let number=1;number<=5;number++){
      await page.locator('[data-open-module="'+number+'"]').click();
      await page.locator('#module-detail').waitFor({state:'visible'});
      assert.equal(await page.locator('#module-steps li').count(),3,'steps expected for each module');
      assert.equal(await page.locator('#detail-number').innerText(),String(number).padStart(2,'0'));
      if(number===1) assert.equal(await page.locator('#detail-resources button.resource-button').count(),1);
      else assert.equal(await page.locator('#detail-resources .resource-empty').count(),1);
      await page.locator('#module-back').click();
      assert.equal(await page.locator('#module-detail').isVisible(),false);
    }
    assert.deepEqual(errors,[],'browser errors for paid simulation');
    console.log('PASS modules 01-05 and back navigation: '+width+'px');
    await page.close();
  }
}finally{await browser.close()}
