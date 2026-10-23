(() => {
  'use strict';
  const cfg = window.NQV_PORTAL || {};
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const authScreen = $('#auth-screen');
  const portalScreen = $('#portal-screen');
  const message = $('#auth-message');
  const pendingBox = $('[data-unconfigured]');
  const loginForm = $('#login-form');
  const recoveryForm = $('#recovery-form');
  const accessDenied = $('#access-denied');
  const library = $('#member-library');
  const accessNotice = $('#access-notice');
  const passwordCard = $('#set-password-card');
  const setPasswordForm = $('#set-password-form');
  const logoutButton = $('[data-logout]');
  $('[data-year]').textContent = String(new Date().getFullYear());

  const moduleDetail = $('#module-detail');
  const memberHeading = $('.member-heading');
  const moduleGrid = $('#modules-grid');
  const libraryIntro = $('#library-intro');
  const bottomAdvice = $('.bottom-advice');
  const modulePlans = Object.freeze({
    1: {
      tag: 'MÓDULO 01 · PRIMEIROS PASSOS', title: 'Comece por Aqui',
      lead: 'Entenda o caminho completo antes de começar. O guia inicial apresenta o método e ajuda você a planejar sua produção e suas vendas.',
      steps: ['Leia o guia principal e identifique as etapas do método.', 'Defina sua rotina de produção, público e primeiros objetivos.', 'Anote suas decisões e avance para os produtos do Módulo 02.']
    },
    2: {
      tag: 'MÓDULO 02 · RECEITAS', title: 'Os 5 Produtos de Natal',
      lead: 'Aprenda a planejar seu cardápio com cinco opções natalinas: chocotone recheado, brigadeiros, biscoitos amanteigados, brownie e cupcakes.',
      steps: ['Escolha o produto que combina com sua estrutura e orçamento.', 'Leia as orientações e faça testes de preparo antes de anunciar.', 'Registre seus custos e planeje quantas unidades poderá produzir.']
    },
    3: {
      tag: 'MÓDULO 03 · PEDIDOS E VENDAS', title: 'O Segredo das Encomendas',
      lead: 'Organize sua comunicação e o atendimento para transformar interesse em encomendas confirmadas.',
      steps: ['Prepare uma apresentação clara dos produtos e dos prazos.', 'Estude as orientações para receber e confirmar os pedidos.', 'Defina como acompanhar pagamentos e combinar as entregas.']
    },
    4: {
      tag: 'MÓDULO 04 · MATERIAIS EDITÁVEIS', title: 'Kit Natal que Vende',
      lead: 'Seu kit de comunicação no Canva: cardápios, catálogo, posts, Stories, ofertas, tags e orçamentos. Os links oficiais de cópia precisam ser publicados e validados antes da entrega.',
      steps: ['Abra o guia de acesso quando ele estiver disponível nesta página.', 'Use os links oficiais de modelo para criar sua própria cópia no Canva.', 'Personalize os layouts com produtos, preços, fotos e dados do seu negócio.']
    },
    5: {
      tag: 'MÓDULO 05 · ORGANIZAÇÃO FINANCEIRA', title: 'Controle Seu Lucro',
      lead: 'Use a planilha para organizar custos, encomendas, recebimentos e resultados.',
      steps: ['Abra a planilha e leia as instruções de preenchimento.', 'Insira seus custos e estimativas antes de definir preços.', 'Acompanhe pagamentos, valores recebidos e resultados reais.']
    }
  });
  let publishedResources = [];

  let client = null;
  let currentUserId = null;
  let isChecking = false;
  let needsPasswordSetup = ['invite', 'recovery'].includes(new URLSearchParams(location.hash.substring(1)).get('type'));

  function say(element, text) {
    if (element) element.textContent = text || '';
  }
  function toggle(element, on) {
    if (element) element.hidden = !on;
  }
  function busy(form, active) {
    const btn = form?.querySelector('[type="submit"]');
    if (btn) btn.disabled = active;
  }
  function isReady() {
    try {
      return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.SUPABASE_URL) &&
        typeof cfg.SUPABASE_PUBLISHABLE_KEY === 'string' &&
        cfg.SUPABASE_PUBLISHABLE_KEY.length > 24 &&
        !!window.supabase?.createClient;
    } catch { return false; }
  }
  function showAuth() {
    toggle(authScreen, true);
    toggle(portalScreen, false);
    toggle(logoutButton, false);
    currentUserId = null;
    toggle(passwordCard, false);
    toggle(library, false);
    toggle(accessDenied, false);
  }
  function showPortal(email) {
    toggle(authScreen, false);
    toggle(portalScreen, true);
    toggle(logoutButton, true);
    say($('[data-welcome-email]'), 'Conta: ' + email);
    toggle(passwordCard, needsPasswordSetup);
  }
  function showAccessNotice(text) {
    say(accessNotice, text);
    toggle(accessNotice, Boolean(text));
  }
  async function signedResourceUrl(row) {
    if (row.resource_kind === 'canva') {
      const raw = String(row.external_url || '');
      let url;
      try { url = new URL(raw); } catch { throw new Error('Link do Canva ainda não publicado.'); }
      if (url.protocol !== 'https:' || !/(^|\.)canva\.com$/.test(url.hostname)) {
        throw new Error('Link do Canva inválido. Solicite suporte.');
      }
      return url.href;
    }
    if (!row.storage_path) throw new Error('Arquivo ainda não está disponível.');
    const { data, error } = await client.storage
      .from('natal-pago').createSignedUrl(row.storage_path, 60);
    if (error || !data?.signedUrl) throw new Error('Não foi possível abrir o arquivo. Tente novamente.');
    return data.signedUrl;
  }
  function createResourceButton(row) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'resource-button';
    const title = document.createElement('span');
    title.textContent = row.title || 'Abrir material';
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    button.append(title, arrow);
    button.addEventListener('click', async () => {
      // Abrir a aba no clique (antes do await), reduz bloqueios de pop-up.
      const tab = window.open('about:blank', '_blank');
      if (tab) { tab.opener = null; tab.document.title = 'Abrindo material protegido'; }
      button.disabled = true;
      try {
        // O backend ainda verifica a compra em cada pedido de URL assinada.
        const href = await signedResourceUrl(row);
        if (tab && !tab.closed) tab.location.replace(href);
        else window.location.assign(href);
      } catch (error) {
        if (tab && !tab.closed) tab.close();
        showAccessNotice(error?.message || 'Não foi possível abrir o conteúdo.');
      } finally {
        button.disabled = false;
      }
    });
    return button;
  }
  function showOverview() {
    toggle(moduleGrid, true);
    toggle(memberHeading, true);
    toggle(libraryIntro, true);
    toggle(bottomAdvice, true);
    toggle(moduleDetail, false);
  }
  function openModule(number) {
    const plan = modulePlans[number];
    if (!plan || library.hidden || !currentUserId) return;
    say($('#detail-eyebrow'), plan.tag);
    say($('#detail-title'), plan.title);
    say($('#detail-lead'), plan.lead);
    say($('#detail-number'), String(number).padStart(2, '0'));
    const steps = $('#module-steps');
    steps.replaceChildren();
    for (const step of plan.steps) {
      const li = document.createElement('li');
      li.textContent = step;
      steps.append(li);
    }
    const downloads = $('#detail-resources');
    downloads.replaceChildren();
    const rows = publishedResources.filter(row => Number(row.module_no) === number);
    if (rows.length) {
      for (const row of rows) downloads.append(createResourceButton(row));
    } else {
      const placeholder = document.createElement('p');
      placeholder.className = 'resource-empty';
      placeholder.textContent = number === 4
        ? 'Os arquivos e links oficiais do Canva estão sendo preparados para publicação segura. Eles aparecerão aqui quando estiverem disponíveis.'
        : 'Este módulo já tem sua estrutura pronta. Os arquivos serão disponibilizados aqui quando forem publicados.';
      downloads.append(placeholder);
    }
    toggle(moduleGrid, false);
    toggle(memberHeading, false);
    toggle(libraryIntro, false);
    toggle(bottomAdvice, false);
    toggle(moduleDetail, true);
    moduleDetail.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  function renderResources(rows) {
    publishedResources = Array.isArray(rows) ? rows : [];
    for (let number = 1; number <= 5; number++) {
      const container = $('[data-resources="' + number + '"]');
      if (!container) continue;
      container.replaceChildren();
      const count = publishedResources.filter(row => Number(row.module_no) === number).length;
      const element = document.createElement('span');
      element.className = count ? 'module-file-count' : 'empty-resources';
      element.textContent = count
        ? count + (count === 1 ? ' material disponível' : ' materiais disponíveis')
        : 'Materiais em preparação';
      container.append(element);
    }
    say($('[data-resource-count]'), '5 módulos · ' + publishedResources.length +
      (publishedResources.length === 1 ? ' arquivo publicado' : ' arquivos publicados'));
  }
  for (const button of $$('[data-open-module]')) {
    button.addEventListener('click', () => openModule(Number(button.dataset.openModule)));
  }
  $('#module-back').addEventListener('click', () => {
    showOverview();
    memberHeading.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  async function refreshAccess() {
    if (!client || isChecking) return;
    isChecking = true;
    showAccessNotice('Verificando sua compra e os materiais disponíveis...');
    try {
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData?.user) {
        showAuth();
        return;
      }
      const user = authData.user;
      currentUserId = user.id;
      showPortal(user.email || 'conta confirmada');
      const { data: allowed, error: accessError } = await client.rpc('has_natal_access');
      if (accessError) throw new Error('Não foi possível verificar a compra. Tente novamente.');
      if (!allowed) {
        toggle(library, false);
        toggle(accessDenied, true);
        showAccessNotice('');
        return;
      }
      const { data: files, error: filesError } = await client.from('resources')
        .select('id,module_no,title,resource_kind,storage_path,external_url,sort_order')
        .eq('published', true)
        .order('sort_order', { ascending: true });
      if (filesError) throw new Error('Não foi possível carregar os materiais. Atualize a página.');
      renderResources(files || []);
      showOverview();
      toggle(accessDenied, false);
      toggle(library, true);
      showAccessNotice('');
    } catch (error) {
      showAccessNotice(error?.message || 'Falha na conexão. Tente novamente.');
    } finally {
      isChecking = false;
    }
  }
  loginForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    say(message, '');
    if (!client) { say(message, 'O login ainda não está disponível.'); return; }
    busy(loginForm, true);
    try {
      const email = $('#login-email').value.trim().toLowerCase();
      const password = $('#login-password').value;
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error('E-mail ou senha inválidos. Confira os dados e tente novamente.');
      $('#login-password').value = '';
      await refreshAccess();
    } catch (e) { say(message, e.message); }
    finally { busy(loginForm, false); }
  });
  $('[data-show-recovery]').addEventListener('click', () => {
    toggle(loginForm, false);
    toggle($('[data-show-recovery]'), false);
    toggle(recoveryForm, true);
    say(message, '');
    $('#recovery-email').focus();
  });
  $('[data-back-login]').addEventListener('click', () => {
    toggle(recoveryForm, false);
    toggle(loginForm, true);
    toggle($('[data-show-recovery]'), true);
    say(message, '');
    $('#login-email').focus();
  });
  recoveryForm.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!client) { say(message, 'A recuperação ainda não está disponível.'); return; }
    busy(recoveryForm, true);
    try {
      const { error } = await client.auth.resetPasswordForEmail($('#recovery-email').value.trim(), {
        redirectTo: new URL('./', location.href).href
      });
      if (error) throw error;
      say(message, 'Se o e-mail estiver cadastrado, você receberá instruções para recuperar o acesso.');
    } catch {
      say(message, 'Não foi possível enviar agora. Tente novamente mais tarde.');
    } finally { busy(recoveryForm, false); }
  });
  setPasswordForm.addEventListener('submit', async ev => {
    ev.preventDefault();
    const field = $('#new-password');
    const password = field.value;
    if (!client || password.length < 10) {
      say($('#set-password-message'), 'A senha deve ter pelo menos 10 caracteres.');
      return;
    }
    busy(setPasswordForm, true);
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      field.value = '';
      needsPasswordSetup = false;
      toggle(passwordCard, false);
      showAccessNotice('Senha definida com sucesso. Seu acesso está protegido.');
      await refreshAccess();
    } catch {
      say($('#set-password-message'), 'Não foi possível salvar. Verifique a senha e tente novamente.');
    } finally { busy(setPasswordForm, false); }
  });
  logoutButton.addEventListener('click', async () => {
    if (client) await client.auth.signOut();
    needsPasswordSetup = false;
    showAuth();
  });
  $('[data-check-again]').addEventListener('click', () => refreshAccess());

  if (!isReady()) {
    toggle(pendingBox, true);
    loginForm.querySelectorAll('input,button').forEach(element => { element.disabled = true; });
    $('[data-show-recovery]').disabled = true;
    showAuth();
    return;
  }
  try {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { showAuth(); return; }
      if (event === 'PASSWORD_RECOVERY') needsPasswordSetup = true;
      if (session?.user && currentUserId !== session.user.id) {
        setTimeout(() => refreshAccess(), 0);
      } else if (session?.user && needsPasswordSetup) {
        showPortal(session.user.email || 'conta confirmada');
      }
    });
    client.auth.getSession().then(({ data }) => {
      if (data?.session) refreshAccess();
      else showAuth();
    }).catch(() => {
      showAuth();
      say(message, 'Não foi possível iniciar a autenticação.');
    });
  } catch {
    showAuth();
    say(message, 'Não foi possível conectar à autenticação.');
  }
})();
