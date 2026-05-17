// ============================================================
// LOGISTICS PRO — Módulo de Permissões
// Arquivo: js/permissions.js
// Versão: 2.0.0 — Motoristas nativos (nivel=4)
// ============================================================
// Níveis:
//   0 = Visualizador  → só lê, não age
//   1 = Solicitante   → abre chamados, cancela os seus
//   2 = Gestor        → gestão de chamados e equipe
//   3 = Admin         → tudo + configurações de acesso
//   4 = Motorista     → vê chamados disponíveis, aceita, executa
// ============================================================

const PERMISSIONS = {

  // ── Chamados ──────────────────────────────────────────────
  abrirChamado:       (nivel) => nivel >= 1 && nivel !== 4,
  cancelarProprio:    (nivel) => nivel >= 1 && nivel !== 4,
  cancelarQualquer:   (nivel) => nivel === 2 || nivel === 3,
  alterarStatus:      (nivel) => nivel === 2 || nivel === 3,

  // ── Motorista ─────────────────────────────────────────────
  verFretesDisponiveis: (nivel) => nivel === 4,
  aceitarFrete:         (nivel) => nivel === 4,
  executarFrete:        (nivel) => nivel === 4,
  enviarRastreio:       (nivel) => nivel === 4,

  // ── Dados & Analytics ─────────────────────────────────────
  verAnalytics:       (nivel) => nivel >= 0 && nivel !== 4,
  exportarDados:      (nivel) => nivel === 2 || nivel === 3,

  // ── Administração ─────────────────────────────────────────
  verGestaoUsuarios:   (nivel) => nivel === 3,
  alterarNivelUsuario: (nivel) => nivel === 3,
  verConfiguracoes:    (nivel) => nivel === 3,
  editarConfiguracoes: (nivel) => nivel === 3,
  deletarChamado:      (nivel) => nivel === 3,
  verTodosOsChamados:  (nivel) => nivel >= 0 && nivel !== 4,
};

// Rota correta para cada nível após login
const ROTAS_POR_NIVEL = {
  0: '/app.html',
  1: '/app.html',
  2: '/app.html',
  3: '/app.html',
  4: '/motorista.html',
};

function getRotaParaNivel(nivel) {
  return ROTAS_POR_NIVEL[nivel] ?? '/app.html';
}

function pode(acao) {
  const nivel = getUserNivel();
  if (!PERMISSIONS[acao]) {
    console.warn(`[Permissions] Ação desconhecida: "${acao}"`);
    return false;
  }
  return PERMISSIONS[acao](nivel);
}

function aplicarPermissoesUI() {
  const nivel = getUserNivel();
  document.querySelectorAll('[data-permissao]').forEach(el => {
    const acao = el.getAttribute('data-permissao');
    const temPermissao = PERMISSIONS[acao] ? PERMISSIONS[acao](nivel) : false;
    el.style.display = temPermissao ? '' : 'none';
    if (temPermissao) el.removeAttribute('disabled');
  });
  document.body.setAttribute('data-nivel', nivel);
  document.body.setAttribute('data-nivel-nome', getNomesNivel(nivel));
}

const _nomesNivel = {
  0: 'Visualizador',
  1: 'Solicitante',
  2: 'Gestor',
  3: 'Admin',
  4: 'Motorista',
};

const _coresNivel = {
  0: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  1: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  2: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  3: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  4: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

function getNomesNivel(nivel) { return _nomesNivel[nivel] ?? 'Desconhecido'; }

function getBadgeNivel(nivel) {
  const cor  = _coresNivel[nivel] ?? _coresNivel[0];
  const nome = _nomesNivel[nivel] ?? 'N/A';
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cor}">${nome}</span>`;
}

async function requireNivel(nivelMinimo, nivelMaximo = nivelMinimo) {
  const session = await requireAuth();
  if (!session) return;
  const nivel = getUserNivel();
  if (nivel < nivelMinimo || nivel > nivelMaximo) {
    window.location.href = getRotaParaNivel(nivel);
  }
}

window.pode                = pode;
window.aplicarPermissoesUI = aplicarPermissoesUI;
window.getBadgeNivel       = getBadgeNivel;
window.getNomesNivel       = getNomesNivel;
window.getRotaParaNivel    = getRotaParaNivel;
window.requireNivel        = requireNivel;
