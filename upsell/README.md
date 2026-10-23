# Natal que Vende PRO — Página externa de Upsell

URL: https://oficial-oferta.github.io/natal-que-vende/upsell/

## Código oficial Cakto integrado em 23/10/2026

O usuário forneceu o HTML real do **Gerador de Upsell** da Cakto, e este foi integrado ao bloco `#cakto-upsell-buttons` da página. Preservados:

- `offer-id="5ymryom"` — **ID da OFERTA**, não o ID do PRODUTO para o webhook
- `app-base-url="https://app.cakto.com.br"`
- `offer-type="upsell"`
- `bg-color="#13780fff"`
- Script oficial: `https://caktoscripts.nyc3.cdn.digitaloceanspaces.com/upsell.js` (carregado uma vez no final da página)
- Elementos `cakto-upsell-accept`, `cakto-upsell-reject` e seu invólucro oficial
- Textos de aceite e recusa adaptados à oferta real de R$ 39,90

**Único ajuste funcional intencional:** o Gerador Cakto havia informado `upsell-accept-url="members_area"` e `upsell-reject-url="members_area"`. Como usamos uma área própria, os três atributos de destino passaram para `https://oficial-oferta.github.io/natal-que-vende/obrigado/`, página de próximos passos criada neste repositório. Ela explica como entrar em `/portal/` com o e-mail da compra, sem afirmar que a compra do extra foi aprovada quando for recusado. Os URLs são destinos configuráveis conforme a documentação oficial. **Confirmar com teste real** se o script os respeita nos dois fluxos.

A aparência é personalizada em `upsell/styles.css` por `::part(button)` quando o componente expõe essa parte do Shadow DOM. Todo o processamento do pagamento permanece responsabilidade da Cakto; não existe lógica de simulação de compra no nosso JavaScript.

## Testes indispensáveis antes dos anúncios

1. No produto PRINCIPAL dentro da Cakto, conferir a opção de página personalizada de upsell ATIVA e o campo Página de Vendas igual à URL acima. Salvar o produto.
2. Verificar no painel que a oferta `5ymryom` é do produto correto **Natal que Vende PRO** e custa R$ 39,90. Se a oferta for diferente, gerar novo código; não inventar um ID.
3. Navegar com uma compra aprovada do principal até a página de upsell; testar **aceite** (compra do extra realmente cobrada) e **recusa** (sem cobrança do extra), com cartão. Conferir Pix separadamente.
4. Confirmar que cada caminho redireciona para `/obrigado/` e de lá para `/portal/`, sem deixar a cliente em página de membros da Cakto.
5. Configurar o **ID do produto** do principal, bump e upsell em `portal/upload.html` e validar o webhook Cakto → Supabase. O ID de oferta `5ymryom` **não substitui** o ID do produto para a liberação do módulo premium. Confirmar no evento real se os dois identificadores estão presentes.
6. Testar compra do principal com order bump, compra do upsell, reembolso, pagamento negado, repetição de webhook e envio de convite. Só então ativar os anúncios.

## QA

O workflow `tests/upsell-smoke.mjs` cobre sete larguras de tela para upsell e obrigado, imagens reais, script oficial incluído, ID da oferta e URLs de ambos os destinos. Durante o CI, a **parte visual** do script externo é simulada apenas para conferir os componentes; não há testagem de pagamento real. A documentação oficial: https://ajuda.cakto.com.br/pt/article/como-configurar-upsell-e-diferentes-funis-na-cakto-1pd1eyo/

**Regra:** nunca salvar chave privada, token da Cakto, segredo de webhook ou dado de cartão em arquivos públicos do GitHub.
