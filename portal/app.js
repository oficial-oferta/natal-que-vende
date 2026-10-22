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
  function renderResources(rows) {
    for (let number = 1; number <= 5; number++) {
      const container = $('[data-resources="' + number + '"]');
      if (!container) continue;
      container.replaceChildren();
      const resources = rows.filter(row => Number(row.module_no) === number);
      if (!resources.length) {
        const empty = document.createElement('span');
        empty.className = 'empty-resources';
        empty.textContent = 'Arquivos deste módulo em preparação.';
        container.append(empty);
        continue;
      }
      for (const row of resources) {
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
          button.disabled = true;
          try {
            const href = await signedResourceUrl(row);
            // Browser opens only links returned after verified membership, never public source files.
            window.open(href, '_blank', 'noopener,noreferrer');
          } catch (error) {
            showAccessNotice(error?.message || 'Não foi possível abrir o conteúdo.');
          } finally {
            button.disabled = false;
          }
        });
        container.append(button);
      }
    }
  }
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
