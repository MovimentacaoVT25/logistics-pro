$login = @"
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Sistema de Fretes</title>
  <link rel="stylesheet" href="/css/styles.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body class="login-page">
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="url(#gradient)"/>
            <path d="M24 12L34 24L24 36L14 24L24 12Z" fill="white" opacity="0.9"/>
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="48" y2="48">
                <stop offset="0%" stop-color="#667eea"/>
                <stop offset="100%" stop-color="#764ba2"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1>Bem-vindo</h1>
        <p>Sistema de Gestão de Fretes</p>
      </div>
      <form id="loginForm" class="login-form">
        <div class="tab-buttons">
          <button type="button" class="tab-btn active" data-tab="login">Login</button>
          <button type="button" class="tab-btn" data-tab="register">Cadastro</button>
        </div>
        <div id="tab-login" class="tab-content active">
          <div class="input-group">
            <label for="loginEmail">E-mail</label>
            <input type="email" id="loginEmail" placeholder="seu@email.com" required>
          </div>
          <div class="input-group">
            <label for="loginPassword">Senha</label>
            <input type="password" id="loginPassword" placeholder="••••••••" required>
          </div>
          <button type="submit" class="btn-primary btn-block" id="loginBtn">Entrar</button>
        </div>
        <div id="tab-register" class="tab-content">
          <div class="input-group">
            <label for="registerName">Nome completo</label>
            <input type="text" id="registerName" placeholder="Seu nome" required>
          </div>
          <div class="input-group">
            <label for="registerEmail">E-mail</label>
            <input type="email" id="registerEmail" placeholder="seu@email.com" required>
          </div>
          <div class="input-group">
            <label for="registerPassword">Senha</label>
            <input type="password" id="registerPassword" placeholder="Mínimo 6 caracteres" required>
          </div>
          <div class="input-group">
            <label for="registerPasswordConfirm">Confirmar senha</label>
            <input type="password" id="registerPasswordConfirm" placeholder="Digite novamente" required>
          </div>
          <button type="button" class="btn-primary btn-block" id="registerBtn">Cadastrar</button>
        </div>
        <div id="errorMessage" class="error-message" style="display: none;"></div>
        <div id="successMessage" class="success-message" style="display: none;"></div>
      </form>
    </div>
  </div>
  <script>
    const SUPABASE_URL = 'https://mytiqqfsmglzmqxfnerc.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15dGlxcWZzbWdsem1xeGZuZXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NTA4MDksImV4cCI6MjA5MDIyNjgwOX0.RYZI6J3KcyAPsfFzczsbpod-mWvslJIXLIKVUAl4TII';
    const { createClient } = supabase;
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true }});
    function showError(msg) { document.getElementById('errorMessage').textContent = msg; document.getElementById('errorMessage').style.display = 'block'; }
    function showSuccess(msg) { document.getElementById('successMessage').textContent = msg; document.getElementById('successMessage').style.display = 'block'; }
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      try {
        const { error } = await authClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/app.html';
      } catch (error) { showError(error.message); }
    });
    document.getElementById('registerBtn').addEventListener('click', async () => {
      const name = document.getElementById('registerName').value.trim();
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value;
      const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
      if (password.length < 6) { showError('Senha deve ter 6+ caracteres'); return; }
      if (password !== passwordConfirm) { showError('Senhas não coincidem'); return; }
      try {
        const { error } = await authClient.auth.signUp({ email, password, options: { data: { name }}});
        if (error) throw error;
        showSuccess('Cadastro OK!');
        setTimeout(() => { window.location.href = '/app.html'; }, 2000);
      } catch (error) { showError(error.message); }
    });
  </script>
</body>
</html>
"@

$callback = @"
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Autenticando...</title><script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script></head><body><h2>Autenticando...</h2><script>const SUPABASE_URL='https://mytiqqfsmglzmqxfnerc.supabase.co';const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15dGlxcWZzbWdsem1xeGZuZXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NTA4MDksImV4cCI6MjA5MDIyNjgwOX0.RYZI6J3KcyAPsfFzczsbpod-mWvslJIXLIKVUAl4TII';const{createClient}=supabase;const client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,detectSessionInUrl:true}});(async()=>{const{data:{session}}=await client.auth.getSession();if(session)window.location.href='/app.html';else window.location.href='/login.html';})();</script></body></html>
"@

Set-Content -Path "login.html" -Value $login -Encoding UTF8
Set-Content -Path "callback.html" -Value $callback -Encoding UTF8
Write-Host "Arquivos criados!" -ForegroundColor Green
