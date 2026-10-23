(() => {
  'use strict';
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  // Cakto owns the payment confirmation and accept/reject interactions.
  // We never implement simulated upsell payments or redirect on click here.
  const cdn = document.querySelector('script[src="https://caktoscripts.nyc3.cdn.digitaloceanspaces.com/upsell.js"]');
  const note = document.getElementById('integration-note');
  if (!cdn || !note) return;
  cdn.addEventListener('error', () => {
    note.textContent = 'Não foi possível carregar os botões da Cakto. Atualize a página e tente novamente. Nenhuma compra adicional foi registrada aqui.';
    note.setAttribute('role','alert');
  });
})();
