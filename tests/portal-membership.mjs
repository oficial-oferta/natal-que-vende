import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Only mocked browser sessions; never creates purchases/users in production.
const browser = await chromium.launch({
  executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']
});
const source='http://127.0.0.1:8765/portal/';
const resources=[{id:101,module_no:1,title:'Guia fictício do teste',resource_kind:'pdf',
 storage_path:'ci/no-real-file.pdf',external_url:null,sort_order:1}];
async function openWithStub(allowed,width) {
  const page=await browser.newPage({viewport:{width,height:890},reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const mock=[
    'const finished=[];',
    'const allowed='+JSON.stringify(allowed)+';',
    'const resources='+JSON.stringify(resources)+';',
    'window.supabase={createClient:()=>({',
    'auth:{',
    'onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),',
    "getSession:async()=>({data:{session:{user:{id:'ci-user',email:'aluna-ci@example.com'}}}}),",
    "getUser:async()=>({data:{user:{id:'ci-user',email:'aluna-ci@example.com'}}}),",
    'signOut:async()=>({error:null})},',
    'rpc:async(name,args)=>{',
    "if(name==='has_natal_access')return {data:allowed,error:null};",
    "if(name==='complete_natal_module'){const n=args.p_module_no;",
    "if(n>1&&!finished.includes(n-1))return {data:null,error:{message:'blocked'}};",
    'if(!finished.includes(n))finished.push(n);return {data:{completed:true},error:null};}',
    "return {data:null,error:{message:'unknown rpc'}};},",
    "from:(name)=>({select:()=>({",
    "order:async()=>({data:name==='module_progress'?finished.map(module_no=>({module_no})):resources.filter(r=>r.module_no===1||finished.includes(r.module_no-1)),error:null}),",
    "eq:()=>({order:async()=>({data:resources.filter(r=>r.module_no===1||finished.includes(r.module_no-1)),error:null})})",
    '})}),',
    "storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'/fake-download'},error:null})})}",
    '})};'
  ].join('\n');
  await page.route(/supabase\.min\.js/,route=>route.fulfill({
    status:200,contentType:'application/javascript',body:mock
  }));
  await page.goto(source,{waitUntil:'networkidle'});
  await page.waitForSelector('#portal-screen:not([hidden])',{timeout:10000});
  return {page,errors};
}
try{
  for(const width of [390,1440]){
    const {page,errors}=await openWithStub(false,width);
    await page.locator('#access-denied').waitFor({state:'visible'});
    assert.equal(await page.locator('#member-library').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log('PASS unpaid members cannot view modules '+width+'px');
    await page.close();
  }
  for(const width of [390,1440]){
    const {page,errors}=await openWithStub(true,width);
    await page.locator('#member-library').waitFor({state:'visible'});
    assert.equal(await page.locator('.module').count(),5);
    assert.equal(await page.locator('#journey-progress-label').innerText(),'0 de 5 concluídos');
    assert.equal(await page.locator('[data-open-module="2"]').isDisabled(),true);
    for(let n=1;n<=5;n++){
      assert.equal(await page.locator('[data-open-module="'+n+'"]').isEnabled(),true);
      await page.locator('[data-open-module="'+n+'"]').click();
      await page.locator('#module-detail').waitFor({state:'visible'});
      assert.equal(await page.locator('#module-steps li').count(),3);
      assert.equal(await page.locator('#detail-number').innerText(),String(n).padStart(2,'0'));
      await page.locator('#module-completion-check').check();
      await page.waitForFunction(value=>document.querySelector('#journey-progress-label')?.textContent?.startsWith(value+' de 5'),n);
      assert.equal(await page.locator('#module-completion-check').isChecked(),true);
      assert.equal(await page.locator('#module-completion-check').isDisabled(),true);
      if(n<5){
        assert.equal(await page.locator('[data-open-module="'+(n+1)+'"]').isEnabled(),true);
        assert.equal(await page.locator('#next-module-btn').isVisible(),true);
      }
      await page.locator('#module-back').click();
    }
    assert.equal(await page.locator('#journey-progress-label').innerText(),'5 de 5 concluídos');
    assert.equal(await page.locator('.module--done').count(),5);
    assert.deepEqual(errors,[]);
    console.log('PASS sequential completion and persistence UI '+width+'px');
    await page.close();
  }
}finally{await browser.close()}
