# 📦 LOGISTICS PRO — Guia Completo de Implantação

> **Tudo gratuito.** Nenhuma assinatura paga é necessária para rodar este projeto.
> Supabase Free · Vercel Hobby · Google Cloud Free Tier · GitHub Free

---

## 📁 Estrutura Final do Repositório

```
logistics-pro/
├── api/
│   ├── config.js            ← Entrega credenciais ao front-end com segurança
│   └── sync-sheets.js       ← Sincroniza chamados com o Google Sheets
├── css/
│   └── styles.css           ← Estilos globais + glass effect + login
├── js/
│   ├── auth.js              ← Autenticação Supabase + sessão + toasts
│   ├── permissions.js       ← Regras de acesso por nível (0/1/2/3)
│   └── app.js               ← Lógica principal do dashboard
├── pages/
│   ├── admin.html           ← Painel de gestão de usuários (nível 3)
│   └── reset-password.html  ← Redefinição de senha
├── supabase/
│   ├── 01_schema.sql        ← Tabelas e índices
│   ├── 02_rls.sql           ← Row Level Security (permissões no banco)
│   ├── 03_functions.sql     ← Triggers e funções SQL
│   └── 04_seed.sql          ← Dados de teste (só dev)
├── app.html                 ← Dashboard principal (protegido)
├── callback.html            ← Retorno do OAuth Google
├── index.html               ← Landing page pública
├── login.html               ← Página de login
├── package.json
├── vercel.json
└── .gitignore
```

---

## ETAPA 1 — Criar o Repositório no GitHub

### 1.1 Criar repositório
1. Acesse https://github.com → **New repository**
2. Nome: `logistics-pro`
3. Visibilidade: **Private** (recomendado)
4. **Não** marque "Add README" (já temos)
5. Clique em **Create repository**

### 1.2 Subir o projeto
Abra o terminal na pasta do projeto e execute:

```bash
git init
git add .
git commit -m "feat: projeto inicial Logistics Pro"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/logistics-pro.git
git push -u origin main
```

---

## ETAPA 2 — Configurar o Supabase

### 2.1 Criar projeto (gratuito)
1. Acesse https://supabase.com → **Sign Up** (conta gratuita)
2. Clique em **New Project**
3. Nome: `logistics-pro`
4. Escolha uma senha forte para o banco de dados (guarde em local seguro)
5. Região: **South America (São Paulo)** — menor latência no Brasil
6. Plano: **Free** (0 custo)
7. Aguarde 2-3 minutos para o projeto ser criado

### 2.2 Executar o schema do banco
1. No painel do Supabase, clique em **SQL Editor** (ícone de código na barra lateral)
2. Clique em **New query**
3. Copie e cole o conteúdo de `supabase/01_schema.sql`
4. Clique em **Run** (botão verde)
5. Repita para `supabase/02_rls.sql`
6. Repita para `supabase/03_functions.sql`
7. O arquivo `04_seed.sql` é opcional (só para testes)

> ✅ Você verá as tabelas `profiles`, `fretes`, `historico_fretes` e `configuracoes`
> em **Table Editor** após a execução.

### 2.3 Obter as credenciais
1. No painel do Supabase → **Settings** (engrenagem) → **API**
2. Anote:
   - **Project URL** → ex: `https://abcdef.supabase.co`
   - **anon/public** key → começa com `eyJ...`
   - **service_role** key → começa com `eyJ...` (⚠️ secreta, nunca exponha no front-end!)

### 2.4 Configurar autenticação de email
1. Supabase → **Authentication** → **Providers**
2. **Email** já vem habilitado por padrão
3. Em **Authentication** → **Email Templates** você pode personalizar os emails
4. Em **Authentication** → **URL Configuration**, adicione:
   - Site URL: `https://SEU-PROJETO.vercel.app`
   - Redirect URLs: `https://SEU-PROJETO.vercel.app/callback.html`

### 2.5 (Opcional) Configurar login com Google
> Gratuito via Google Cloud Console

1. Acesse https://console.cloud.google.com
2. Crie um projeto ou selecione um existente
3. Pesquise "OAuth 2.0" → **Credentials** → **Create Credentials** → **OAuth client ID**
4. Tipo: **Web application**
5. Authorized redirect URIs: `https://[SEU-PROJETO].supabase.co/auth/v1/callback`
6. Copie o **Client ID** e **Client Secret**
7. No Supabase → **Authentication** → **Providers** → **Google**
8. Cole o Client ID e Client Secret
9. Habilite e salve

---

## ETAPA 3 — Deploy na Vercel

### 3.1 Criar conta (gratuita)
1. Acesse https://vercel.com → **Sign Up with GitHub** (conta gratuita)

### 3.2 Importar o projeto
1. No painel da Vercel → **Add New Project**
2. Selecione o repositório `logistics-pro`
3. Framework Preset: **Other** (não é Next.js, é HTML puro)
4. Clique em **Deploy** (ainda sem as variáveis — vamos adicionar)

### 3.3 Configurar variáveis de ambiente
1. No painel da Vercel → seu projeto → **Settings** → **Environment Variables**
2. Adicione cada variável abaixo, clicando em **Add**:

| Nome                         | Valor                                      | Onde pegar                        |
|------------------------------|--------------------------------------------|-----------------------------------|
| `SUPABASE_URL`               | `https://xxxx.supabase.co`                 | Supabase → Settings → API         |
| `SUPABASE_ANON_KEY`          | `eyJ...` (anon key)                        | Supabase → Settings → API         |
| `SUPABASE_SERVICE_ROLE_KEY`  | `eyJ...` (service_role key)                | Supabase → Settings → API         |
| `SPREADSHEET_ID`             | ID da sua planilha Google Sheets           | Ver etapa 4                       |
| `SHEET_NAME`                 | `Fretes` (ou nome da sua aba)              | Nome da aba na planilha           |
| `SHEET_RANGE`                | `Fretes!A:N`                               | Aba e colunas (ajuste se precisar)|
| `GOOGLE_SERVICE_ACCOUNT_JSON`| JSON completo da Service Account           | Ver etapa 4.2                     |
| `SYNC_SECRET`                | Qualquer string aleatória segura           | Você cria (ex: senha de 32 chars) |

3. Após adicionar todas → **Redeploy** no projeto

### 3.4 Conectar variáveis via CLI (alternativa)
```bash
npm i -g vercel
vercel login
vercel env add SUPABASE_URL
# (cole o valor e pressione Enter para cada variável)
```

---

## ETAPA 4 — Configurar o Google Sheets

### 4.1 Preparar a planilha
1. Abra sua planilha no Google Sheets
2. Renomeie a aba principal para **Fretes**
3. Na **linha 1**, crie os cabeçalhos nesta ordem:
   ```
   A: ID | B: Tipo | C: Status | D: Solicitante | E: Descrição |
   F: Endereço | G: Link Maps | H: Data Coleta | I: Horário |
   J: Urgente | K: Volume(kg) | L: Quantidade | M: Motorista | N: Criado em
   ```
4. A URL da planilha tem o formato:
   `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
5. Anote o `SPREADSHEET_ID`

### 4.2 Criar Service Account no Google Cloud
> Isso permite que o sistema ESCREVA na planilha automaticamente.

1. Acesse https://console.cloud.google.com
2. Menu → **APIs & Services** → **Enable APIs**
3. Procure **Google Sheets API** → **Enable**
4. Menu → **APIs & Services** → **Credentials**
5. **Create Credentials** → **Service Account**
6. Nome: `logistics-pro-sync`
7. Clique em **Create and continue** → **Done**
8. Clique na service account criada → **Keys** → **Add Key** → **JSON**
9. O arquivo JSON será baixado automaticamente — **guarde com segurança!**
10. Abra o JSON e copie o conteúdo inteiro
11. Cole como valor da variável `GOOGLE_SERVICE_ACCOUNT_JSON` na Vercel

### 4.3 Compartilhar a planilha com a Service Account
1. No arquivo JSON baixado, encontre o campo `"client_email"`
   Exemplo: `logistics-pro-sync@seu-projeto.iam.gserviceaccount.com`
2. No Google Sheets → **Compartilhar**
3. Cole o email da service account
4. Permissão: **Editor**
5. Clique em **Enviar**

> ✅ Agora o sistema pode ler E escrever na planilha automaticamente!

---

## ETAPA 5 — Configurar Credenciais no Código

### 5.1 Atualizar js/auth.js
Abra o arquivo `js/auth.js` e substitua as linhas 19-20:

```javascript
const SUPABASE_URL      = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'sua-anon-key-aqui';
```

> **Dica de segurança**: Em vez de hardcodar no arquivo, faça o front-end
> buscar de `/api/config` ao iniciar. Exemplo em `auth.js`:
> ```javascript
> const cfg = await fetch('/api/config').then(r => r.json());
> const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
> ```

### 5.2 Atualizar js/app.js
Abra `js/app.js` e substitua a linha 19:

```javascript
const SPREADSHEET_ID = 'SEU_SPREADSHEET_ID_AQUI';
```

### 5.3 Commit e push
```bash
git add js/auth.js js/app.js
git commit -m "config: credenciais Supabase e Sheets"
git push
```
A Vercel fará o redeploy automaticamente em ~1 minuto.

---

## ETAPA 6 — Criar o Primeiro Admin

Após o deploy, você precisa criar o primeiro usuário Admin:

1. Acesse seu site → **Login** → **Cadastre-se**
2. Crie uma conta com seu email
3. Acesse o **Supabase → Table Editor → profiles**
4. Encontre seu usuário e altere o campo `nivel` de `1` para `3`
5. A partir de agora, você pode criar outros admins pela página `/pages/admin.html`

---

## ETAPA 7 — Testar Tudo

### Checklist de verificação:

- [ ] Landing page (`/index.html`) carrega corretamente
- [ ] Login com email e senha funciona
- [ ] Redirecionamento para `/app.html` após login
- [ ] Dashboard exibe os cards de estatísticas
- [ ] Criar um novo chamado (botão "+ Novo Envio")
- [ ] Chamado aparece na lista
- [ ] Chamado aparece na planilha Google Sheets em ~5 segundos
- [ ] Cancelar chamado próprio (nível 1)
- [ ] Alterar status funciona (nível 2+)
- [ ] Painel Admin `/pages/admin.html` acessível (nível 3)
- [ ] Alterar nível de outro usuário funciona

---

## 🔮 EXPANSÕES FUTURAS

O projeto foi estruturado para facilitar as seguintes melhorias:

### Notificações por email
- Usar **Resend** (100 emails/dia gratuitos) ou **SendGrid** (100/dia grátis)
- Criar `/api/notify.js` que dispara ao criar chamado
- Configurar em `configuracoes` (já existe a chave `notificacao_email`)

### Notificações push no celular
- **Supabase Edge Functions** + **Web Push API** (gratuito)
- Motoristas recebem push quando novo chamado é criado

### Cancelamento automático
- Supabase tem **pg_cron** (gratuito) para rodar jobs agendados
- Criar job que cancela chamados `pendente` após N horas
- N configurável em `configuracoes.auto_cancelar_horas`

### Relatórios mensais em PDF
- Função serverless que gera CSV ou PDF
- Disparado via botão no painel Admin

### App Mobile nativo
- O AppSheet já cobre os motoristas
- Para solicitantes: pode criar PWA (Progressive Web App) com o próprio HTML
  adicionando `manifest.json` e service worker

### Multi-empresa / Multi-tenant
- Adicionar tabela `empresas` e coluna `empresa_id` em `profiles` e `fretes`
- RLS atualizado para filtrar por empresa
- Estrutura já preparada para isso (UUIDs em tudo)

---

## 🐛 Solução de Problemas

### "Supabase credentials not configured"
→ Verifique as variáveis de ambiente na Vercel e faça redeploy.

### Login não funciona / "Invalid login credentials"
→ Verifique se o email foi confirmado (cheque a caixa de spam).
→ Em Supabase → Authentication → Settings, desabilite "Confirm email" para testes.

### Chamado criado mas não aparece no Sheets
→ Verifique se a service account tem permissão de Editor na planilha.
→ Verifique os logs em Vercel → Functions → sync-sheets.
→ Confirme que `SPREADSHEET_ID` e `SHEET_NAME` estão corretos.

### Página fica em branco após login
→ Abra o console do navegador (F12) e veja o erro.
→ Provavelmente as credenciais do Supabase em `js/auth.js` estão erradas.

### RLS bloqueando operações
→ No Supabase → Authentication, verifique se o usuário tem o nível correto.
→ No SQL Editor, teste: `SELECT * FROM profiles WHERE id = auth.uid();`

---

## 📞 Links Úteis

| Serviço         | Link                                       | Plano gratuito |
|-----------------|--------------------------------------------|----------------|
| Supabase        | https://supabase.com                       | 500MB DB, 50k users |
| Vercel          | https://vercel.com                         | 100GB bandwidth |
| GitHub          | https://github.com                         | Repositórios ilimitados |
| Google Cloud    | https://console.cloud.google.com           | Sheets API: ilimitado |
| AppSheet        | https://appsheet.com                       | 10 usuários grátis |

---

*Logistics Pro v1.0 — Documentação gerada automaticamente.*
