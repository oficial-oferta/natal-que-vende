(() => {
'use strict';
const cfg=window.NQV_PORTAL||{};
const status=document.querySelector('#admin-auth');
const panel=document.querySelector('#admin-panel');
const list=document.querySelector('#upload-list');
const manifest=[
 {no:1,title:'Comece por Aqui',file:'Natal_Que_Vende_Guia_Principal(4).pdf',path:'01/guia-principal.pdf',accept:'.pdf',kind:'PDF · 39 páginas'},
 {no:2,title:'Os 5 Produtos de Natal',file:'Natal_Que_Vende_Produto_02_Os_5_Produtos_de_Natal_FINAL_REVISADO(4).pdf',path:'02/os-5-produtos-de-natal.pdf',accept:'.pdf',kind:'PDF · 64 páginas'},
 {no:3,title:'O Segredo das Encomendas',file:'Natal_Que_Vende_Produto_03_O_Segredo_das_Encomendas_FINAL_REVISADO(3).pdf',path:'03/o-segredo-das-encomendas.pdf',accept:'.pdf',kind:'PDF · 54 páginas'},
 {no:4,title:'Kit Natal que Vende — Canva',file:'guia-de-acesso-canva-final.pdf',path:'04/guia-de-acesso-canva.pdf',accept:'.pdf',kind:'PDF · aguarda links oficiais',pending:true},
 {no:5,title:'Controle Seu Lucro',file:'Natal_Que_Vende_Produto_05_Controle_Seu_Lucro_FINAL_APROVADO(3).xlsx',path:'05/controle-seu-lucro.xlsx',accept:'.xlsx',kind:'Planilha Excel · 5 abas'},
 {no:6,premiumSlug:'recheios-premium',title:'Segredos do Recheio Premium',file:'NQV_Extra_01_Segredos_do_Recheio_Premium_FINAL.pdf',path:'premium/recheios/segredos-do-recheio-premium.pdf',accept:'.pdf',kind:'Extra 01 · PDF com 12 receitas'},
 {no:7,premiumSlug:'kits-premium',title:'Natal que Vende PRO — Kits de Natal',file:'NQV_Extra_02_Presentes_de_Alto_Valor_FINAL.pdf',path:'premium/kits/presentes-de-alto-valor.pdf',accept:'.pdf',kind:'Extra 02 · PDF com 8 kits'},
 {no:8,premiumSlug:'kits-premium',title:'Calculadora de Kits Premium',file:'NQV_Extra_02_Calculadora_de_Kits_FINAL.xlsx',path:'premium/kits/calculadora-de-kits.xlsx',accept:'.xlsx',kind:'Extra 02 · Planilha complementar'}
];
function say(t){status.textContent=t;}
async function begin(){
 if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY||!window.supabase?.createClient){
   say('Conexão de autenticação indisponível. Volte ao portal.');return;
 }
 const client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
 });
 const {data:{user}={},error}=await client.auth.getUser();
 if(error||!user){say('Entre primeiro na área de membros e abra esta página novamente.');return;}
 const {data:owner,error:ownerError}=await client.rpc('is_nqv_admin');
 if(ownerError||!owner){say('Acesso negado. Esta central é reservada ao proprietário do projeto.');return;}
 status.hidden=true;panel.hidden=false;
 const {data:registered,error:registryError}=await client.from('resources')
   .select('module_no,title,storage_path,published').order('module_no',{ascending:true});
 if(registryError){say('Não foi possível consultar o catálogo.');status.hidden=false;panel.hidden=true;return;}
 const {data:premiumRegistered,error:premiumRegistryError}=await client.from('premium_resources')
   .select('offer_slug,title,storage_path,published').order('sort_order',{ascending:true});
 if(premiumRegistryError){say('Não foi possível carregar os materiais premium.');status.hidden=false;panel.hidden=true;return;}
 for(const item of manifest){
   const row=item.premiumSlug
     ? (premiumRegistered||[]).find(r=>r.storage_path===item.path)
     : (registered||[]).find(r=>Number(r.module_no)===item.no);
   const wrap=document.createElement('section');wrap.className='admin-upload-card';
   const head=document.createElement('div');head.className='admin-upload-heading';
   const lead=document.createElement('div');const label=document.createElement('small');label.textContent=(item.premiumSlug?'CONTEÚDO PREMIUM':'MÓDULO '+String(item.no).padStart(2,'0'))+' · '+item.kind;
   const title=document.createElement('h2');title.textContent=item.title;lead.append(label,title);
   const state=document.createElement('span');state.className='admin-upload-state';state.textContent=row?.published?'Publicado':'Ainda não publicado';
   head.append(lead,state);
   const hint=document.createElement('p');hint.className='admin-upload-hint';hint.textContent='Arquivo esperado: '+item.file;
   const path=document.createElement('code');path.className='admin-path';path.textContent=item.path;
   wrap.append(head,hint,path);
   const input=document.createElement('input');input.type='file';input.accept=item.accept;input.id='admin-file-'+item.no;
   const button=document.createElement('button');button.className='primary-button';button.type='button';button.textContent='Enviar e publicar material';
   const outcome=document.createElement('p');outcome.className='form-message';outcome.setAttribute('role','status');
   const form=document.createElement('div');form.className='admin-upload-action';
   if(item.pending){const warning=document.createElement('p');warning.className='admin-pending';warning.textContent='O guia comercial do Canva ainda não está validado. Não envie o modelo interno com links pendentes.';wrap.append(warning);input.disabled=true;button.disabled=true;}
   else if(row?.published){button.disabled=true;button.textContent='Material já publicado';}
   else if(!row){button.disabled=true;button.textContent='Registro ainda não configurado';}
   form.append(input,button);wrap.append(form,outcome);list.append(wrap);
   button.addEventListener('click',async()=>{
     const file=input.files?.[0];
     if(!file){outcome.textContent='Selecione o arquivo correspondente a este módulo.';return;}
     const extension=item.accept.slice(1);
     if(file.name.toLowerCase().split('.').pop()!==extension){outcome.textContent='Formato incorreto. Use '+item.accept;return;}
     if(file.size>30*1024*1024){outcome.textContent='Arquivo muito grande (limite deste painel: 30 MB).';return;}
     button.disabled=true;input.disabled=true;outcome.textContent='Enviando com segurança...';
     try {
       const mime=extension==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
       const {error:uploadError}=await client.storage.from('natal-pago').upload(item.path,file,{contentType:mime,upsert:false,cacheControl:'3600'});
       if(uploadError)throw uploadError;
       let change=client.from(item.premiumSlug?'premium_resources':'resources')
          .update({published:true});
       if(!item.premiumSlug)change=change.eq('module_no',item.no);
       const {data:published,error:publishError}=await change.eq('storage_path',item.path).select('id,published');
       if(publishError||!published?.length)throw publishError||new Error('Arquivo enviado, mas registro ainda não publicado. Contate suporte.');
       outcome.textContent=item.premiumSlug
        ? '✓ Arquivo publicado! Será visível apenas para quem comprou este extra e recebeu acesso autorizado.'
        : '✓ Publicação registrada! O acesso será liberado apenas após a conclusão da etapa anterior.';
       state.textContent='Publicado';button.textContent='Material já publicado';
     }catch(e){
       outcome.textContent='Não concluído: '+(e?.message||'falha desconhecida')+'. Confira antes de tentar novamente.';
       input.disabled=false;button.disabled=false;
     }
   });
 }
 // Product IDs and checkout URLs are public data. HMAC secret never belongs here.
 const {data:offers,error:offersError}=await client.from('natal_offers')
   .select('slug,kind,title,cakto_product_id,checkout_url,price_label')
   .order('sort_order',{ascending:true});
 const settings=document.querySelector('#cakto-product-settings');
 if(offersError){settings.textContent='Não foi possível consultar as ofertas da Cakto.';return;}
 for(const offer of offers||[]){
   const card=document.createElement('section');card.className='admin-upload-card';
   const header=document.createElement('h3');header.textContent=offer.title;
   const details=document.createElement('p');details.className='admin-upload-hint';
   details.textContent=offer.kind==='main'?'Oferta principal · '+offer.price_label:
    'Oferta extra independente · '+offer.price_label;
   const idLabel=document.createElement('label');idLabel.textContent='ID do produto na Cakto';
   const idInput=document.createElement('input');idInput.type='text';idInput.className='admin-setting-input';
   idInput.placeholder='Cole o ID real do produto';idInput.value=offer.cakto_product_id||'';
   const urlLabel=document.createElement('label');urlLabel.textContent='Link de checkout para compras posteriores (HTTPS)';
   const urlInput=document.createElement('input');urlInput.type='url';urlInput.className='admin-setting-input';
   urlInput.placeholder='https://...';urlInput.value=offer.checkout_url||'';
   const button=document.createElement('button');button.type='button';
   button.className='outline-button';button.textContent='Salvar informações desta oferta';
   const result=document.createElement('p');result.className='form-message';result.setAttribute('role','status');
   card.append(header,details,idLabel,idInput,urlLabel,urlInput,button,result);
   settings.append(card);
   button.addEventListener('click',async()=>{
     const productId=idInput.value.trim();
     const link=urlInput.value.trim();
     if(productId.length>180){result.textContent='ID muito longo. Confira o produto.';return;}
     if(link){
       try{if(new URL(link).protocol!=='https:')throw new Error('not HTTPS');}
       catch{result.textContent='Use um link HTTPS completo ou deixe vazio.';return;}
     }
     button.disabled=true;result.textContent='Salvando...';
     try {
       const {data,error}=await client.from('natal_offers')
          .update({cakto_product_id:productId||null,checkout_url:link||null})
          .eq('slug',offer.slug).select('slug,cakto_product_id');
       if(error||!data?.length)throw error||new Error('Sem autorização para alterar produto');
       result.textContent='✓ Informações salvas. O webhook ainda requer credenciais e teste de pagamento.';
     }catch(error){result.textContent='Não salvo: '+(error?.message||'erro de conexão');}
     finally{button.disabled=false;}
   });
 }
}
begin().catch(()=>say('Falha ao verificar permissões. Atualize a página.'));
})();