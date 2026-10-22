# Natal que Vende — Portal de membros (implementação inicial)

**Endereço:** https://oficial-oferta.github.io/natal-que-vende/portal/

O GitHub Pages serve **somente a interface**. Login, validação do pagamento e downloads são administrados por **Supabase Auth, RLS, Storage privado e Edge Function**.

## Estado atual

- [x] Interface responsiva de login, recuperação de senha e definição de senha no primeiro acesso.
- [x] Área exclusiva com os 5 módulos, sem links de arquivos públicos.
- [x] Código para ler materiais autorizados e obter URLs assinadas de 60 segundos.
- [x] Migração SQL com Row Level Security, recursos privados e acesso baseado em compras aprovadas.
- [x] Edge Function de webhook Cakto com validação HMAC, proteção contra repetição e revogação por reembolso/chargeback.
- [ ] Criar projeto Supabase e executar migração SQL.
- [ ] Configurar credenciais **públicas** de Supabase em `portal/config.js`.
- [ ] Fazer upload dos arquivos pagos no bucket **privado** `natal-pago`.
- [ ] Cadastrar recursos publicados em `public.resources`.
- [ ] Publicar a função e armazenar os segredos fora do repositório.
- [ ] Criar produto e checkout da Cakto; verificar campos de webhook real.
- [ ] Testar Pix aprovado, cartão, reembolso, chargeback e convite para e-mail.
- [ ] Configurar SMTP/limites de envio adequados antes de escalar.
- [ ] Validar os 30 links oficiais de modelo Canva e inserir o **guia final** do Módulo 04.

**Não está pronto para receber clientes até completar as etapas acima.** O portal não aceita senhas quando o Supabase não está configurado. Não existe "login de demonstração" que fure o acesso.

## 1. Configurar Supabase

1. Crie um projeto em https://supabase.com .
2. No SQL Editor, execute o conteúdo de `portal/supabase/schema.sql`.
3. Em Authentication, habilite e-mail/senha, configure confirmação de e-mail e **desabilite cadastros públicos**. Novos alunos entram apenas por convite.
4. Em Authentication → URL Configuration, use:
   - Site URL: `https://oficial-oferta.github.io/natal-que-vende/portal/`
   - Redirect URL: `https://oficial-oferta.github.io/natal-que-vende/portal/`
5. Ajuste a template de e-mail de **Invite user** com identidade Natal que Vende; convites Supabase permitem que a cliente escolha a própria senha.
6. Configure provedor SMTP dedicado para enviar convites em produção; limites padrão podem ser baixos.
7. Preencha **somente** os campos públicos do `portal/config.js`:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY` (chave pública, **nunca** secret / service_role)

## 2. Arquivos privados

No Storage, confirme que o bucket `natal-pago` está privado. Sugestão de caminhos:

- `01/comece-por-aqui.pdf`
- `02/os-5-produtos-de-natal.pdf`
- `03/o-segredo-das-encomendas.pdf`
- `04/guia-modelos-canva.pdf` (**somente quando o guia contiver os links oficiais de modelo**)
- `05/controle-seu-lucro.xlsx`

Cadastre os recursos através do SQL Editor (ou interface interna administrativa), depois de os arquivos existirem:

```sql
insert into public.resources
  (module_no, title, resource_kind, storage_path, published, sort_order)
values
  (1, 'Comece por Aqui', 'pdf', '01/comece-por-aqui.pdf', true, 1),
  (2, 'Os 5 Produtos de Natal', 'pdf', '02/os-5-produtos-de-natal.pdf', true, 1),
  (3, 'O Segredo das Encomendas', 'pdf', '03/o-segredo-das-encomendas.pdf', true, 1),
  (5, 'Controle Seu Lucro', 'xlsx', '05/controle-seu-lucro.xlsx', true, 1);
```

**Não** publique nenhum PDF/XLSX pago diretamente no GitHub. A simples URL de um arquivo público permitiria download sem login.

## 3. Webhook Cakto

1. Cadastre o produto `Natal que Vende` na Cakto com entrega **Área de membros externa** e preço definido na oferta.
2. No painel Cakto, localize o **ID real do produto** e crie um webhook limitado àquele produto com os eventos:
   - `purchase_approved`
   - `refund`
   - `chargeback`
3. Escolha um webhook V1 ou V2 (ambos são tratados pelo receptor). Salve a **chave secreta do webhook**. Nunca a coloque no JavaScript, GitHub Pages ou num prompt público.
4. A partir da raiz do repositório, entre na pasta do aplicativo (`cd portal`) e publique a Edge Function usando a CLI Supabase:
   `supabase functions deploy cakto-webhook --no-verify-jwt`
5. Defina os segredos pela gestão de Edge Function Secrets, e nunca no repositório:
   - `CAKTO_WEBHOOK_SECRET` = chave de assinatura do webhook Cakto
   - `CAKTO_PRODUCT_ID` = ID do produto pago da Cakto
   - `PORTAL_URL` = `https://oficial-oferta.github.io/natal-que-vende/portal/`
   - `SUPABASE_SECRET_KEY` = chave secreta de servidor (se não estiver usando o legado `SUPABASE_SERVICE_ROLE_KEY` fornecido pelo ambiente)
6. URL do webhook no painel Cakto: `https://SEU_PROJETO.supabase.co/functions/v1/cakto-webhook`.
7. Faça um **evento de teste** sem compradores reais. Confira o payload para validar onde está o ID do produto. A função rejeita eventos sem ID de produto válido; não remova essa validação para contornar erros de configuração.
8. Só depois teste compra aprovada de ponta a ponta, email de convite, cadastro da senha e acesso ao recurso privado.
9. Confirme que eventos `refund` e `chargeback` interrompem acesso e que reenviar `purchase_approved` antigo não reativa uma compra reembolsada.
10. **Falhas precisam de acompanhamento no Dashboard de Webhooks.** Segundo a documentação da Cakto, HTTP não-2xx respondido pelo seu servidor fica marcado como falha e **não gera reenvio automático**; retentativas automáticas ocorrem principalmente em falhas sem resposta ou timeout. Confira os alertas e reenvie manualmente os eventos que falharem. Para alto volume, implemente uma fila durável e monitoramento adicional antes do lançamento.

### Sobre o e-mail do comprador

**Não é a Cakto quem cria senha do nosso portal.** A compra aprovada é recebida pela Edge Function; ela convida o e-mail do comprador via Supabase Auth. O usuário define sua própria senha. Um cliente que já possua conta pode entrar com senha existente ou recuperar pelo portal.

É possível configurar também o e-mail de "Pagamento Confirmado" da Cakto para apontar para o endereço do portal, conforme a configuração da entrega escolhida.

## 4. Segurança e limites

- A interface pública do GitHub **não é** uma barreira de segurança. A proteção real fica nas políticas RLS e no Storage privado do Supabase.
- Não habilite cadastro público irrestrito.
- A chave `service_role` ou `sb_secret_...` **nunca** pode ser enviada ao navegador.
- O webhook valida HMAC SHA-256 do corpo cru com timestamp de até 5 minutos.
- Pedidos são identificados por `order_id`, com proteção de reenvio e revogação por reembolso/chargeback.
- O acesso ao banco depende do e-mail autenticado no Supabase e da presença de ao menos um pedido pago não reembolsado.
- Links temporários de arquivos expiram em 60 segundos. Uma URL já emitida continua válida até expirar.
- **Links oficiais de modelo do Canva são compartilháveis:** se forem reenviados, quem receber o link poderá acessar a cópia. Mantenha esses links apenas dentro da área paga, mas não prometa DRM ou proteção perfeita contra repasse.
- Não anuncie a entrega do Módulo 04 como finalizada enquanto os 30 links e o guia estiverem pendentes.
- Para e-mails de clientes reais, configure a política de privacidade/LGPD e canais de suporte antes da ativação comercial.

## 5. Testes mínimos pré-lançamento

- Login bloqueado enquanto o Supabase não estiver configurado.
- Usuário sem compra aprovada não vê nem baixa os materiais.
- Comprador recebe convite e define senha.
- Reenviar webhook da mesma compra não duplica acesso.
- Reembolso / chargeback revoga download imediatamente para novas URLs.
- Navegação e download funcionam em celulares e desktop.
- A página de vendas e o portal permanecem separados, mesmo no mesmo repositório.
- Após criar o checkout Cakto, atualizar `assets/js/config.js` com seu link real.

## 6. Futuro domínio

Podemos migrar de `.../natal-que-vende/portal/` para `alunos.seudominio.com.br` depois, mas primeiro teremos que configurar DNS, hospedagem, URLs de retorno do Supabase e URLs da Cakto. Não configure domínio privado sem registros reais.

### Fontes técnicas de referência

- Cakto: https://www.cakto.com.br/blog/o-que-e-webhook
- Supabase Auth: https://supabase.com/docs/guides/auth/users
- Supabase Storage: https://supabase.com/docs/guides/storage/buckets/fundamentals
