# Natal que Vende

Repositório oficial da landing page **Natal que Vende** — campanha Natal 2026.

## Status
- Repositório exclusivo: `oficial-oferta/natal-que-vende`
- Conta confirmada: `oficial-oferta`
- Branch principal: `main`
- Primeira versão funcional concluída e testada localmente.
- O pacote completo do projeto inclui HTML, CSS, JavaScript, imagens otimizadas, configuração central e relatório de testes.
- O envio automático dos binários ficou pendente porque a integração disponível nesta conversa aceita escrita textual no GitHub, mas não possui handoff direto dos arquivos binários gerados no ambiente de trabalho.

## Configurações centrais
O projeto possui `assets/js/config.js` para:
- `CHECKOUT_URL`
- `PRICE_LABEL`
- `VIDEO_URL`
- `VIDEO_POSTER`
- `META_PIXEL_ID`
- links legais
- suporte
- prazo promocional real
- ativação do Produto 04
- ativação de depoimentos reais

## Regras comerciais já implementadas
- Sem preço inventado.
- Sem checkout fictício.
- Sem depoimentos falsos.
- Sem evento Purchase disparado por simples clique.
- Produto 04 marcado como pendente de finalização.
- Vídeo em modo de prévia até existir URL real.
- CTA mobile fixo e responsivo.
- Consentimento preparado para Meta Pixel.
- Preferência `prefers-reduced-motion` respeitada.

## Hospedagem
O projeto é estático e pode ser publicado a partir deste repositório em serviço compatível com uso comercial. O pacote entregue inclui `netlify.toml` e instruções de publicação.

## Testes executados
Foram verificadas as larguras 320, 360, 390, 430, 768, 1024 e 1440 px, sem rolagem horizontal. Também foram testados FAQ, CTA em modo de prévia, player de vídeo configurável, carrossel, imagens lazy, ausência de erros JavaScript e estados pendentes do Produto 04/checkout.
