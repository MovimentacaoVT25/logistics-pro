// ============================================================
// LOGISTICS PRO — Módulo de Autenticação
// Arquivo: js/auth.js
// ============================================================
// Este arquivo é carregado em TODAS as páginas protegidas.
// Responsabilidades:
//   1. Inicializar o cliente Supabase
//   2. Gerenciar login / logout / OAuth
//   3. Proteger rotas (redirecionar se não autenticado)
//   4. Expor o perfil e nível do usuário para o app.js
// ============================================================

// ------------------------------------------------------------
// CONFIGURAÇÃO DO SUPABASE
// ⚠️  Em produção, essas variáveis devem vir do servidor
//     via /api/config.js para não expor no HTML.
//     Para começar, coloque direto aqui mesmo.
// ------------------------------------------------------------
const SUPABASE_URL      = 'COLE_SUA_SUPABASE_URL_AQUI';
const SUPABASE_ANON_KEY = 'COLE_SUA_SUPABASE_ANON_KEY_AQUI';

// Inicializa o cliente (disponível globalmente como `supabase`)
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persiste sessão no localStorage do navegador
    persistSession: true,
    // Detecta token na URL (necessário para OAuth e magic link)
    detectSessionInUrl: true,
    // URL de retorno após login OAuth
    redirectTo: window.location.origin + '/callback.html'
  }
});

// ------------------------------------------------------------
// ESTADO GLOBAL DO USUÁRIO
// Acessível em qualquer arquivo após `auth.js` ser carregado.
// ------------------------------------------------------------
let _currentUser    = null;   // objeto auth.user do Supabase
let _currentProfile = null;   // linha da tabela profiles

// Getters públicos — use esses em app.js
function getCurrentUser()    { return _currentUser; }
function getCurrentProfile() { return _currentProfile; }
function getUserNivel()      { return _currentProfile?.nivel ?? -1; }
function getUserNome()       { return _currentProfile?.nome  ?? 'Usuário'; }

// ------------------------------------------------------------
// PROTEÇÃO DE ROTA
// Chame no início de cada página protegida.
// Redireciona para login.html se não houver sessão ativa.
// ------------------------------------------------------------
async function requireAuth() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
    return null;
  }

  _currentUser = session.user;
  await _loadProfile(session.user.id);
  return session;
}

// Carrega o perfil do banco e preenche _currentProfile
async function _loadProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Auth] Erro ao carregar perfil:', error.message);
    return;
  }

  _currentProfile = data;
}

// ------------------------------------------------------------
// LOGIN COM EMAIL E SENHA
// ------------------------------------------------------------
async function loginWithEmail(email, password) {
  showLoading(true);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  showLoading(false);

  if (error) {
    showError(_traduzirErroAuth(error.message));
    return false;
  }

  // Redireciona para onde o usuário tentou acessar, ou para o app
  const params   = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect') || '/app.html';
  window.location.href = redirect;
  return true;
}

// ------------------------------------------------------------
// LOGIN COM GOOGLE (OAuth)
// Gratuito — requer configurar o provider no painel Supabase
// Authentication > Providers > Google
// ------------------------------------------------------------
async function loginWithGoogle() {
  showLoading(true);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/callback.html'
    }
  });

  if (error) {
    showLoading(false);
    showError('Erro ao conectar com Google: ' + error.message);
  }
  // O navegador será redirecionado automaticamente pelo Supabase
}

// ------------------------------------------------------------
// CADASTRO DE NOVO USUÁRIO
// Nível padrão (1 = Solicitante) é definido pelo trigger SQL.
// Admin pode alterar depois via painel de gestão.
// ------------------------------------------------------------
async function registerUser(email, password, metadata = {}) {
  showLoading(true);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: metadata.name || email.split('@')[0]
      }
    }
  });

  showLoading(false);

  if (error) {
    showError(_traduzirErroAuth(error.message));
    return false;
  }

  // Se o Supabase pede confirmação de email
  if (data.user && !data.session) {
    showToast('Verifique seu email para confirmar o cadastro!', 'info');
    return true;
  }

  // Se está com confirmação desabilitada, já redireciona
  window.location.href = '/app.html';
  return true;
}

// ------------------------------------------------------------
// LOGOUT
// ------------------------------------------------------------
async function logout() {
  await supabase.auth.signOut();
  _currentUser    = null;
  _currentProfile = null;
  window.location.href = '/login.html';
}

// ------------------------------------------------------------
// RECUPERAÇÃO DE SENHA
// Envia email com link para redefinir a senha.
// ------------------------------------------------------------
async function resetPassword(email) {
  showLoading(true);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/pages/reset-password.html'
  });

  showLoading(false);

  if (error) {
    showError('Erro ao enviar email: ' + error.message);
    return false;
  }

  showToast('Email de recuperação enviado! Verifique sua caixa de entrada.', 'success');
  return true;
}

// ------------------------------------------------------------
// LISTENER DE MUDANÇA DE SESSÃO
// Reage a login, logout e refresh de token automaticamente.
// ------------------------------------------------------------
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    _currentUser = session.user;
    await _loadProfile(session.user.id);
  }

  if (event === 'SIGNED_OUT') {
    _currentUser    = null;
    _currentProfile = null;
  }

  if (event === 'TOKEN_REFRESHED') {
    // Token foi renovado silenciosamente — nada a fazer
    console.log('[Auth] Token renovado automaticamente.');
  }

  if (event === 'PASSWORD_RECOVERY') {
    // Usuário clicou no link de redefinição de senha
    window.location.href = '/pages/reset-password.html';
  }
});

// ------------------------------------------------------------
// FUNÇÕES DE UI — usadas pela página de login
// ------------------------------------------------------------
function showLoading(visible) {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  if (visible) {
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
  } else {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  }
}

function showError(message) {
  const el = document.getElementById('errorMessage');
  if (!el) {
    showToast(message, 'error');
    return;
  }
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

// ------------------------------------------------------------
// SISTEMA DE TOAST (notificações flutuantes)
// Chamado de qualquer página: showToast('Mensagem', 'success')
// Tipos: 'success' | 'error' | 'warning' | 'info'
// ------------------------------------------------------------
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const colors = {
    success: 'bg-emerald-500',
    error:   'bg-rose-500',
    warning: 'bg-amber-500',
    info:    'bg-sky-500'
  };

  const icons = {
    success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    error:   '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    warning: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>',
    info:    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
  };

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg transform translate-x-0 transition-all duration-300 ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icons[type]}</svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.style.opacity = '1');

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ------------------------------------------------------------
// TRADUÇÃO DE ERROS DO SUPABASE → Português
// ------------------------------------------------------------
function _traduzirErroAuth(msg) {
  const erros = {
    'Invalid login credentials':        'Email ou senha incorretos.',
    'Email not confirmed':              'Confirme seu email antes de entrar.',
    'User already registered':          'Este email já está cadastrado.',
    'Password should be at least 6':    'A senha deve ter pelo menos 6 caracteres.',
    'Unable to validate email address': 'Email inválido.',
    'Email rate limit exceeded':        'Muitas tentativas. Aguarde alguns minutos.',
    'Invalid email or password':        'Email ou senha incorretos.'
  };

  for (const [en, pt] of Object.entries(erros)) {
    if (msg.includes(en)) return pt;
  }

  return 'Erro inesperado. Tente novamente.';
}

// Expor globalmente para uso nos HTMLs inline
window.loginWithEmail   = loginWithEmail;
window.loginWithGoogle  = loginWithGoogle;
window.registerUser     = registerUser;
window.logout           = logout;
window.resetPassword    = resetPassword;
window.showToast        = showToast;
window.getCurrentUser   = getCurrentUser;
window.getCurrentProfile = getCurrentProfile;
window.getUserNivel     = getUserNivel;
window.getUserNome      = getUserNome;
