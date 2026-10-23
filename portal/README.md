# Natal que Vende — Portal de membros (implementação inicial)

**Endereço:** https://oficial-oferta.github.io/natal-que-vende/portal/

O GitHub Pages serve **somente a interface**. Login, validação do pagamento e downloads são administrados por **Supabase Auth, RLS, Storage privado e Edge Function**.

## Decisão operacional — e-mails e custo mínimo (22/10/2026)

**Escolha aprovada:** começar **sem comprar domínio**, usando uma **conta Gmail exclusiva para o Natal que Vende** como SMTP do Supabase para convites de primeiro acesso, links de entrada e recuperação de senha.

**Conta Gmail criada:** `acesso.natalquevende@gmail.com` (somente o endereço público, nenhuma credencial compartilhada). Remetente planejado: **Natal que Vende — Acesso**. Esta é uma solução **provisória, de baixo volume**, para testes e lançamento inicial; configurar autenticação em duas etapas e senha de aplicativo. Nunca registrar credenciais, senha de aplicativo nem tokens no GitHub.

**Pendências para ativar:** habilitar verificação em duas etapas no Gmail criado, gerar senha de aplicativo, configurar SMTP no Supabase diretamente com a senha de aplicativo, instalar os modelos HTML de e-mail existentes e testar recebimento, spam, convite, definição de senha e recuperação. Não salvar ou compartilhar a senha de aplicativo no GitHub ou chat. Não conectar vendas reais sem testes concluídos.

**LEMBRETE DE MIGRAÇÃO FUTURA — NÃO ESQUECER:** assim que a quantidade de vendas/e-mails crescer, **migrar do Gmail para um serviço transacional profissional (preferência inicial: Resend) com domínio próprio validado (SPF/DKIM)**. Revisar essa necessidade **antes de escalar anúncios** ou antes se ocorrerem atrasos, bloqueios, spam, falhas de entrega ou aproximação dos limites de envio. A troca deve preservar a conta Supabase, o acesso das compradoras e o portal já existente. Monitorar taxa de entrega, bounces e falhas.

## Diagnóstico de envio — 23/10/2026 (verificado)

Foi realizado um convite único real via `supabase.auth.admin.inviteUserByEmail` para `acesso.natalquevende@gmail.com`, usando uma Edge Function temporária com autorização forte. **O envio falhou** com HTTP 500 no Supabase Auth e mensagem SMTP do Google **`535 5.7.8 Username and Password not accepted`**. O PostgreSQL confirmou **0 usuários criados, 0 pedidos**, ou seja, nenhum acesso foi liberado. A Edge Function temporária foi **desativada e substituída por um handler que só retorna 410**, com validação JWT habilitada (versão 2). Não reutilizar o endpoint.

**Ação do proprietário:** gerar uma **nova senha de aplicativo do Google** na conta remetente (verificação em duas etapas ativa), abrir o [SMTP do projeto](https://supabase.com/dashboard/project/dvpmypjeabbzfvdzalow/auth/smtp) e substituir exclusivamente a senha, verificando que o usuário é `acesso.natalquevende@gmail.com`. Host: `smtp.gmail.com`, porta: `465` SSL ou `587` STARTTLS conforme campo. Nunca usar senha normal do Gmail e nunca compartilhar a senha de aplicativo no chat ou repositório. Confirmar e então refazer um único convite via dashboard ou por mecanismo seguro de backend. Consulte [Ajuda Google — Senhas de app](https://support.google.com/accounts/answer/185833?hl=pt-BR).

## Estratégia de entregabilidade dos convites (23/10/2026)

**Decisão:** manter e-mails de autenticação simples, transacionais e estáveis. **Não implementar rotação aleatória de assunto ou corpo para tentar contornar filtros antispam.** A documentação do Supabase recomenda alterar modelos com pouca frequência e manter autenticação separada de campanhas de marketing. Três alternativas de **convite inicial** foram preparadas para revisão/experimentos futuros, mas **nenhuma foi aplicada automaticamente** nem substitui o convite ativo:

| Alternativa | Assunto sugerido | HTML arquivado |
| --- | --- | --- |
| A (objetiva) | Ative seu acesso ao Natal que Vende | `portal/supabase/email-templates/invite-alternatives/invite-a.html` |
| B (acolhedora) | Convite de acesso \| Natal que Vende | `portal/supabase/email-templates/invite-alternatives/invite-b.html` |
| C (passo a passo) | Natal que Vende: crie sua senha de acesso | `portal/supabase/email-templates/invite-alternatives/invite-c.html` |

O Supabase Auth hospedado permite um template por tipo de mensagem, por exemplo `Invite user`, `Magic link` e `Recovery`. Para alternar dinamicamente cada mensagem seria necessária outra arquitetura (por exemplo, custom Send Email Hook). **Não há necessidade de fazê-lo neste lançamento.** Os três templates funcionais por evento já estão guardados em `portal/supabase/email-templates/`.

**Boas práticas de envio legítimo:**
- Convites somente após compra confirmada ou para testes explicitamente autorizados; sem disparos em massa para listas desconhecidas.
- Um convite automático por compra/conta quando necessário, com controle de repetição/reenvio; não bombardear o cliente com mensagens iguais.
- Corpo claro, único botão para o link seguro `{{ .ConfirmationURL }}`, assunto objetivo, sem promoções, anexos ou excesso de links/imagens.
- Monitorar erros no Supabase Auth, devoluções e reclamações, testar recebimento em mais de um provedor. Não presumir que HTTP 200 equivale a mensagem recebida na caixa principal.
- Checar limite inicial do Supabase (30 e-mails/h com custom SMTP conforme documentação) **e** limites/risco de bloqueio do Gmail pessoal. Migrar para SMTP transacional com domínio próprio antes de aumentar significativamente os anúncios.
- A troca de template deve ser deliberada, com testes e período de avaliação; não fazer alterações a cada compra.

Referências oficiais: https://supabase.com/docs/guides/auth/auth-smtp e https://supabase.com/docs/guides/auth/auth-email-templates

## Evolução da área de membros — 23/10/2026

A biblioteca foi ampliada: cinco cartões clicáveis, cinco páginas internas individuais dentro do mesmo portal, um roteiro prático por módulo e uma área de recursos protegidos com links temporários. O login continua exigindo Supabase Auth; abrir qualquer módulo exige também `has_natal_access()` igual a `true`.

**Banco preparado, arquivos ainda NÃO entregues:** cinco linhas de `public.resources` foram criadas, **todas com `published=false`**. São apenas os metadados/caminhos pretendidos; o Storage privado ainda precisa receber os PDFs/XLSX originais e o guia de modelos do Canva. Não altere `published` para `true` antes de testar o arquivo real e a permissão de download.

| Módulo | Caminho previsto no bucket privado `natal-pago` |
| --- | --- |
| 01 — Guia Principal | `01/guia-principal.pdf` |
| 02 — Os 5 Produtos de Natal | `02/os-5-produtos-de-natal.pdf` |
| 03 — O Segredo das Encomendas | `03/o-segredo-das-encomendas.pdf` |
| 04 — Guia final de links Canva | `04/guia-de-acesso-canva.pdf` |
| 05 — Controle Seu Lucro | `05/controle-seu-lucro.xlsx` |

O Módulo 04 depende da emissão/validação dos **30 links oficiais de template do Canva**. Nunca publique a pasta editável interna ou link de edição do proprietário como link de comprador.

**Fluxo de acesso (produção futura):** pagamento Cakto aprovado → webhook assinado e validado → `public.access_orders.status = 'paid'` por pedido → convite enviado ao e-mail da compra → cliente define senha → Supabase Auth identifica o usuário → RPC `public.has_natal_access()` verifica o e-mail autenticado em `auth.users` contra pedidos aprovados → portal busca `resources` publicados e Storage emite URLs assinadas com validade curta. Sem registro de pedido aprovado, entrar na conta NÃO libera o material.

**Testes da interface:** `tests/portal-smoke.mjs` valida 7 tamanhos de tela sem login; `tests/portal-membership.mjs` injeta um Supabase *simulado somente no navegador do CI*, confirmando bloqueio de usuário sem pagamento e as cinco páginas internas para usuário simulado autorizado em celular e desktop. **Isso não substitui o teste de checkout real ou a validação do webhook da Cakto**.

### Comunicação automática

- Três versões A/B/C de convite estão guardadas em `portal/supabase/email-templates/invite-alternatives/` para seleção **manual e planejada**. Não habilitar alternância aleatória para contornar spam.
- Também existem templates separados de **convite**, **link de acesso** e **recuperação de senha**. A configuração ativa do Supabase permite um modelo por evento; os HTMLs arquivados no GitHub não são implantados automaticamente no painel.
- Evite conteúdo promocional, convites repetidos sem motivo e mudanças frequentes de copy. Migre do Gmail para serviço transacional com domínio verificado antes de aumentar o volume.

## Jornada premium e arquivos finais — 23/10/2026

### Progresso e liberação sequencial

- O Módulo 01 começa liberado quando o comprador tem autorização de acesso.
- A aluna marca **Concluí este módulo e quero continuar**; o RPC autenticado `complete_natal_module` grava a conclusão em `public.module_progress`.
- Cada etapa seguinte só fica liberada depois de registrada a conclusão anterior; `public.can_access_natal_module` controla a autorização nos recursos e nas políticas de `storage.objects`. **Não é apenas bloqueio visual em JavaScript.**
- A conclusão é uma declaração da própria aluna, não uma prova de que leu todo o material; é idempotente e fica salva entre dispositivos.
- O dashboard mostra 0–5 etapas concluídas, barra de progresso, estado de cada módulo e continuação automática.

### Materiais recebidos e mapeados

Os anexos finais recebidos nesta conversa foram inspecionados e catalogados em `public.resources`; **nenhum conteúdo pago foi colocado no repositório público**:

| Módulo | Material recebido | Destino previsto |
|---|---|---|
| 01 | Guia Principal, PDF de 39 páginas | `01/guia-principal.pdf` |
| 02 | Os 5 Produtos de Natal FINAL REVISADO, PDF de 64 páginas | `02/os-5-produtos-de-natal.pdf` |
| 03 | O Segredo das Encomendas FINAL REVISADO, PDF de 54 páginas | `03/o-segredo-das-encomendas.pdf` |
| 04 | Pasta Canva de 30 designs; guia ainda pré-publicação com links pendentes | `04/guia-de-acesso-canva.pdf` **somente após validar 30 links** |
| 05 | Controle Seu Lucro FINAL APROVADO, XLSX de 5 abas | `05/controle-seu-lucro.xlsx` |

**Atenção:** o conector atual Supabase não permite transferir arquivos binários enviados ao chat diretamente para Storage. Foi implementada uma central de publicação segura, **`portal/upload.html`**, para o proprietário selecionar os quatro arquivos em seu computador e publicá-los diretamente no bucket privado. Ela exige login, RPC `is_nqv_admin` e políticas de Storage específicas para os caminhos previamente declarados. Ao terminar um upload, ativa a linha correspondente de `public.resources`. A conta proprietária tem papel administrativo fixo em `nqv_internal.owner_accounts`, e os compradores não podem enviar ou publicar arquivos. Uploads não concluídos ou falhos não devem ser descritos como publicação pronta.

**Módulo 03:** o PDF continua intitulado `O Segredo das Encomendas`. A chamada comercial no site foi aprimorada para vendas e metas; "até R$ 3.000 por semana" é meta ilustrativa de **faturamento**, não promessa de vendas, lucro ou resultado comprovado pelo material.

## Estado atual

- [x] Interface responsiva de login, recuperação de senha e definição de senha no primeiro acesso.
- [x] Área exclusiva com os 5 módulos, sem links de arquivos públicos.
- [x] Código para ler materiais autorizados e obter URLs assinadas de 60 segundos.
- [x] Migração SQL com Row Level Security, recursos privados e acesso baseado em compras aprovadas.
- [x] Edge Function de webhook Cakto com validação HMAC, proteção contra repetição e revogação por reembolso/chargeback.
- [x] Criar projeto Supabase em São Paulo e executar migração SQL.
- [x] Configurar credenciais **públicas** de Supabase em `portal/config.js`.
- [ ] Fazer upload dos arquivos pagos no bucket **privado** `natal-pago`.
- [ ] Cadastrar recursos publicados em `public.resources`.
- [x] Publicar Edge Function receptora da Cakto no Supabase.
- [ ] Configurar os segredos reais da Cakto no Supabase (sem expor no repositório).
- [ ] Criar produto e checkout da Cakto; verificar campos de webhook real.
- [ ] Testar Pix aprovado, cartão, reembolso, chargeback e convite para e-mail.
- [ ] Configurar SMTP/limites de envio adequados antes de escalar.
- [ ] Validar os 30 links oficiais de modelo Canva e inserir o **guia final** do Módulo 04.

**Ainda não está pronto para receber clientes até completar as etapas acima.** O Supabase já está conectado ao portal, mas convites e permissões comerciais dependem de SMTP configurado, credenciais reais da Cakto e testes ponta a ponta. Não existe "login de demonstração" que fure o acesso.

## Verificação do SMTP Gmail — 22/10/2026

Remetente configurado pelo proprietário: `acesso.natalquevende@gmail.com`. O projeto Supabase mostrou nos registros de autenticação que o limite de envio foi alterado de **2/h para 30/h**, compatível com habilitação de SMTP próprio. **Isso não equivale a um e-mail enviado com sucesso**; ainda não existe usuário de autenticação nem um convite entregue.

### Teste controlado de primeiro acesso

1. No painel Supabase, configure **Authentication → URL Configuration**:
   - **Site URL:** `https://oficial-oferta.github.io/natal-que-vende/portal/`
   - **Redirect URLs:** adicione esse mesmo endereço.
2. Em **Authentication → Email Templates → Invite user**, personalize o assunto para `Seu acesso ao Natal que Vende chegou!` e cole o HTML salvo em `portal/supabase/email-templates/invite.html` (preservando `{{ .ConfirmationURL }}`). Faça o mesmo, quando conveniente, para `Recovery` e `Magic Link`.
3. Em **Authentication → Users → Invite user**, convide `acesso.natalquevende@gmail.com` **uma única vez**. É uma conta de teste interna, não cliente pago. Não envie senha ao convidado: o convite cria fluxo de definição de senha.
4. Abra a caixa de entrada do Gmail, inclusive spam, clique no convite e confirme se o portal exibe a definição de senha. Após entrar, **é esperado encontrar bloqueio da biblioteca** ("Estamos conferindo seu acesso"), porque não há compras aprovadas ainda; isso verifica a separação entre login e autorização.
5. Depois do teste, verificar erros do Auth nos logs e somente então realizar um teste de compra com webhook Cakto. Não registrar pedidos falsos de clientes reais para forçar liberação.

As telas administrativas de SMTP, URL Configuration e Email Templates não podem ser alteradas pelo conector Supabase atualmente disponível; o administrador faz isso diretamente no painel, sem compartilhar senhas de aplicativo ou tokens no chat.

## 1. Configurar Supabase

1. Crie um projeto em https://supabase.com .
2. No SQL Editor, execute o conteúdo de `portal/supabase/schema.sql`.
3. Em Authentication, habilite e-mail/senha, configure confirmação de e-mail e **desabilite cadastros públicos**. Novos alunos entram apenas por convite.
4. Em Authentication → URL Configuration, use:
   - Site URL: `https://oficial-oferta.github.io/natal-que-vende/portal/`
   - Redirect URL: `https://oficial-oferta.github.io/natal-que-vende/portal/`
5. Ajuste a template de e-mail de **Invite user** com identidade Natal que Vende; convites Supabase permitem que a cliente escolha a própria senha.
6. Configure provedor SMTP dedicado para enviar convites em produção. Segundo a documentação atual do Supabase, o remetente padrão **só envia mensagens para endereços autorizados da equipe**; sem SMTP próprio, não é possível atender compradores reais.
   - Já estão no GitHub os modelos de mensagem da marca Natal que Vende:
     - `portal/supabase/email-templates/invite.html` → primeiro acesso e definição da senha;
     - `portal/supabase/email-templates/magic_link.html` → cliente que já possui uma conta;
     - `portal/supabase/email-templates/recovery.html` → recuperação de senha.
   - Configure o remetente e as credenciais SMTP apenas no Dashboard, nunca no repositório. Em Authentication → Email Templates, utilize os templates e mantenha a variável `{{ .ConfirmationURL }}`.
   - Faça teste de recebimento real (inclusive spam) e configure domínio com SPF/DKIM antes de ativar o checkout.
7. Preencha **somente** os campos públicos do `portal/config.js`:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY` (chave pública, **nunca** secret / service_role)


### Configuração Gmail SMTP (opção temporária, sem domínio próprio)

No Gmail `acesso.natalquevende@gmail.com`, ative a **verificação em duas etapas** e gere a **senha de aplicativo** em https://myaccount.google.com/apppasswords (opção pode não estar disponível em determinadas contas). Faça isso **diretamente na conta Google**.

No painel Supabase do projeto `dvpmypjeabbzfvdzalow`, em **Authentication → SMTP Settings**, configure:

| Campo | Valor |
| --- | --- |
| Enable custom SMTP | Ativado |
| Sender email | `acesso.natalquevende@gmail.com` |
| Sender name | `Natal que Vende — Acesso` |
| Host | `smtp.gmail.com` |
| Port | `465` (SSL) ou `587` (STARTTLS) |
| Username | `acesso.natalquevende@gmail.com` |
| Password | **Senha de aplicativo** (16 caracteres, inserir exclusivamente no painel) |

Depois confira **Authentication → URL Configuration**, com a URL do portal `https://oficial-oferta.github.io/natal-que-vende/portal/`, e instale os HTMLs preparados em **Authentication → Email Templates**.

**Teste antes de ativar compras reais:** enviar um convite para endereço de teste autorizado, aceitar o link, criar senha, entrar e recuperar senha. Analisar mensagens de erro e limite de envio. Esta configuração **ainda não foi aplicada** no Supabase: requer a senha privada inserida pelo dono da conta no dashboard.

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
