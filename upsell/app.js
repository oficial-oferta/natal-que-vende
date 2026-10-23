(() => {
  'use strict';
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  // A Cakto é responsável por aceitar/recusar o upsell pós-compra.
  // Sem o código oficial do "Gerador de Upsell", os botões de prévia
  // ficam desabilitados. Nunca simular aprovação ou cobrança no navegador.
  const actions = document.getElementById('cakto-upsell-buttons');
  if (!actions) return;
  const previewButtons = [...actions.querySelectorAll('button[disabled]')];
  // Este painel de integração é removido manualmente somente ao inserir
  // os botões gerados e validar pagamento e recusa em um teste real.
  if (previewButtons.length !== 2) {
    const note = document.getElementById('integration-note');
    if (note) note.hidden = true;
  }
})();