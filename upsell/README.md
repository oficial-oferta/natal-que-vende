# Natal que Vende PRO — Página externa de Upsell

URL pública após deploy: https://oficial-oferta.github.io/natal-que-vende/upsell/

## O que foi criado

Página responsiva própria (GitHub Pages) na identidade oficial do Natal que Vende.
Apresenta o extra **Natal que Vende PRO — Presentes de Alto Valor** por **R$ 39,90**, com 8 kits premium e planilha de cálculo.
Imagens: utiliza apenas fotos já existentes no site principal (`assets/images`); sem materiais pagos expostos.
Não há depoimentos inventados, escassez falsa ou promessas de lucro.
Página com `noindex,nofollow` — feita para o fluxo pós-compra, não para tráfego orgânico.

## Atenção: os botões ainda NÃO processam pagamentos

**Integração oficial Cakto pendente.** Ambos os botões de prévia em `upsell/index.html` ficam com `disabled`. Isso é intencional: nunca simular aceite, recusa, cobrança ou confirmação de pagamento com JavaScript próprio.

1. Na Cakto, abra o **produto principal** Natal que Vende → **Upsell e Downsell**.
2. Habilite a página de obrigado personalizada/upsell e configure a URL acima no campo **Página de Vendas** (que corresponde à página do upsell, e não à landing page original).
3. Clique em **Gerador de Upsell**.
4. Selecione o produto **Natal que Vende PRO** e a oferta **R$ 39,90**. Personalize as frases de aceitar e recusar, respeitando o valor final e as condições de cobrança.
5. Use o comando **Gerar** e copie o **HTML/código oficial completo** dos botões que a Cakto fornece. Os botões de aceitar e recusar podem depender de scripts, parâmetros, sessão da compra e recursos hospedados pela Cakto.
6. Em `upsell/index.html`, substitua somente o conteúdo de `<div id="cakto-upsell-buttons"> ... </div>` pelo bloco oficial gerado. **Não reescreva os URLs/assinaturas nem use apenas o checkout normal como botão de upsell.**
7. Faça revisão das eventuais exigências de scripts externos em CSP, domínios e carregamento seguro. Remova o aviso `#integration-note` apenas após a integração.
8. Teste compra principal com cartão + upsell aceito, recusa e compra com Pix (que pode operar de outro modo), verificando o estado correto na Cakto e no Supabase.
9. Teste webhook por **ID real dos três produtos** e liberação independente; confira também estornos/chargebacks, antes de anunciar.

### Links úteis

- Manual oficial: https://ajuda.cakto.com.br/pt/article/como-configurar-upsell-e-diferentes-funis-na-cakto-1pd1eyo/
- Portal da compradora: https://oficial-oferta.github.io/natal-que-vende/portal/

### QA

O comando `node tests/upsell-smoke.mjs` testa o comportamento em sete larguras (320–1440 px), o preço, as imagens locais e o estado seguro dos botões provisórios. A automação foi adicionada ao workflow de qualidade. **Os testes do layout não são teste de pagamento real.**
