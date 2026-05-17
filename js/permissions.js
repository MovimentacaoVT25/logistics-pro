// ============================================================
// LOGISTICS PRO — Módulo de Permissões
// Versão: 3.0.0
// ============================================================
// Níveis:
//   1 = Visualizador  → só lê demandas, não interage
//   2 = Solicitante   → cria e cancela suas próprias solicitações
//   3 = Gestor        → vê tudo, acompanha em tempo real, insights
//   4 = Motorista     → aceita e executa fretes, pode resetar
//   5 = Admin         → acesso total
// ============================================================

const PERMISSIONS = {

  // ── Visualização ──────────────────────────────────────────
  verDemandas:        (n) => n >= 1 && n !== 4,
  verTodosOsChamados: (n) => n >= 1 && n !== 4,
  verAnalytics:       (n) => n >= 3 && n !== 4,
  verAcompanhamento:  (n) => n === 3 || n === 5,
  verInsights:        (n) => n === 3 || n === 5,

  // ── Chamados ──────────────────────────────────────────────
  abrirChamado:       (n) => n === 2 || n === 5,
  cancelarProprio:    (n) => n === 2 || n === 5,
  cancelarQualquer:   (n) => n === 3 || n === 5,
  alterarStatus:      (n) => n === 3 || n === 5,
  exportarDados:      (n) => n === 3 || n === 5,

  // ── Motorista ─────────────────────────────────────────────
  verFretesDisponiveis: (n) => n === 4,
  aceitarFrete:         (n) => n === 4,
  executarFrete:        (n) => n === 4,
  resetarFrete:         (n) => n === 4,   // volta frete a pendente
  enviarRastreio:       (n) => n === 4,

  // ── Administração ─────────────────────────────────────────
  verGestaoUsuarios:   (n) => n === 5,
  alterarNivelUsuario: (n) => n === 5,
  verConfiguracoes:    (n) => n === 5,
  editarConfiguracoes: (n) => n === 5,
  deletarChamado:      (n) => n === 5,
};

const ROTAS_POR_NIVEL = {
  1: '/app.html',
  2: '/app.html',
  3: '/app.html',
  4: '/motorista.html',
  5: '/app.html',
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
    const ok = PERMISSIONS[acao] ? PERMISSIONS[acao](nivel) : false;
    el.style.display = ok ? '' : 'none';
    if (ok) el.removeAttribute('disabled');
  });
  document.body.setAttribute('data-nivel', nivel);
  document.body.setAttribute('data-nivel-nome', getNomesNivel(nivel));
}

const _nomesNivel = {
  1: 'Visualizador',
  2: 'Solicitante',
  3: 'Gestor',
  4: 'Motorista',
  5: 'Admin',
};

const _coresNivel = {
  1: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  2: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  3: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  4: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  5: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

function getNomesNivel(nivel) { return _nomesNivel[nivel] ?? 'Desconhecido'; }

function getBadgeNivel(nivel) {
  const cor  = _coresNivel[nivel] ?? _coresNivel[1];
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
