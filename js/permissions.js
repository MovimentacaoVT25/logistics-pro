// ============================================================
// LOGISTICS PRO — Módulo de Permissões
// Arquivo: js/permissions.js
// ============================================================
// Centraliza TODAS as regras de o que cada nível pode fazer.
// Altere AQUI se precisar mudar uma permissão — não espalhado
// pelo código.
//
// Níveis:
//   0 = Visualizador   → só lê, não age
//   1 = Solicitante    → abre chamados, cancela os seus
//   2 = Gestor         → gestão da página e chamados
//   3 = Admin          → tudo + configurações de acesso
// ============================================================

const PERMISSIONS = {

  // Pode abrir um novo chamado?
  abrirChamado: (nivel) => nivel >= 1,

  // Pode cancelar um chamado PRÓPRIO (e apenas se pendente)?
  cancelarProprio: (nivel) => nivel >= 1,

  // Pode cancelar QUALQUER chamado?
  cancelarQualquer: (nivel) => nivel >= 2,

  // Pode alterar o status de um chamado (aceitar, concluir, etc.)?
  alterarStatus: (nivel) => nivel >= 2,

  // Pode ver a aba Analytics completa?
  verAnalytics: (nivel) => nivel >= 0, // todos veem, mas nível 0 não exporta

  // Pode exportar dados para CSV?
  exportarDados: (nivel) => nivel >= 2,

  // Pode ver o painel de gestão de usuários?
  verGestaoUsuarios: (nivel) => nivel >= 3,

  // Pode alterar o nível de acesso de outro usuário?
  alterarNivelUsuario: (nivel) => nivel >= 3,

  // Pode ver as configurações do sistema?
  verConfiguracoes: (nivel) => nivel >= 3,

  // Pode editar configurações do sistema?
  editarConfiguracoes: (nivel) => nivel >= 3,

  // Pode ver TODOS os chamados (não só os próprios)?
  verTodosOsChamados: (nivel) => nivel >= 0, // todos veem (o RLS filtra a escrita)

  // Pode forçar sincronização com Google Sheets?
  sincronizarSheets: (nivel) => nivel >= 2,

  // Pode deletar chamados permanentemente?
  deletarChamado: (nivel) => nivel >= 3,
};

// ------------------------------------------------------------
// FUNÇÃO PRINCIPAL: verifica se o usuário atual pode fazer X
// Uso: pode('abrirChamado') => true/false
// ------------------------------------------------------------
function pode(acao) {
  const nivel = getUserNivel(); // definido em auth.js
  if (!PERMISSIONS[acao]) {
    console.warn(`[Permissions] Ação desconhecida: "${acao}"`);
    return false;
  }
  return PERMISSIONS[acao](nivel);
}

// ------------------------------------------------------------
// APLICAR PERMISSÕES NA UI
// Esconde/mostra elementos baseado em data-permissao="acao"
//
// Uso no HTML:
//   <button data-permissao="abrirChamado">+ Novo Envio</button>
//   <div data-permissao="verGestaoUsuarios">Painel Admin</div>
// ------------------------------------------------------------
function aplicarPermissoesUI() {
  const nivel = getUserNivel();

  document.querySelectorAll('[data-permissao]').forEach(el => {
    const acao = el.getAttribute('data-permissao');
    const temPermissao = PERMISSIONS[acao] ? PERMISSIONS[acao](nivel) : false;

    if (temPermissao) {
      el.style.display = '';
      el.removeAttribute('disabled');
    } else {
      // Esconde ou desabilita dependendo do tipo de elemento
      if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
        el.style.display = 'none';
      } else {
        el.style.display = 'none';
      }
    }
  });

  // Aplica classe de nível no body para CSS condicional
  document.body.setAttribute('data-nivel', nivel);
  document.body.setAttribute('data-nivel-nome', _nomesNivel[nivel] || 'desconhecido');
}

// ------------------------------------------------------------
// BADGE DE NÍVEL — exibe o chip colorido na interface
// ------------------------------------------------------------
const _nomesNivel = {
  0: 'Visualizador',
  1: 'Solicitante',
  2: 'Gestor',
  3: 'Admin'
};

const _coresNivel = {
  0: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  1: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  2: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  3: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
};

function getNomesNivel(nivel) {
  return _nomesNivel[nivel] ?? 'Desconhecido';
}

function getBadgeNivel(nivel) {
  const cor  = _coresNivel[nivel] ?? _coresNivel[0];
  const nome = _nomesNivel[nivel] ?? 'N/A';
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cor}">
    ${nome}
  </span>`;
}

// Expor globalmente
window.pode               = pode;
window.aplicarPermissoesUI = aplicarPermissoesUI;
window.getBadgeNivel      = getBadgeNivel;
window.getNomesNivel      = getNomesNivel;
