// ============================================================
// LOGISTICS PRO — Lógica Principal da Aplicação
// Arquivo: js/app.js
// ============================================================
// Depende de (carregar nesta ordem no HTML):
//   1. supabase-js     (CDN)
//   2. chart.js        (CDN)
//   3. js/auth.js
//   4. js/permissions.js
//   5. js/app.js       ← este arquivo
// ============================================================

// ------------------------------------------------------------
// CONFIGURAÇÃO DO GOOGLE SHEETS
// Planilha deve estar com compartilhamento público (leitura).
// Para ESCRITA, use a função serverless /api/sync-sheets.js
// ------------------------------------------------------------
const SPREADSHEET_ID = 'COLE_SEU_SPREADSHEET_ID_AQUI';
const SHEET_GID      = '0'; // Aba principal (0 = primeira aba)

// URL de leitura pública (CSV) — usado apenas para espelho no AppSheet
const SHEETS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

// ------------------------------------------------------------
// ESTADO DA APLICAÇÃO
// ------------------------------------------------------------
let _todosOsFretes   = [];    // cache local dos chamados
let _abaAtiva        = 'dashboard';
let _filtroStatus    = 'todos';
let _filtroTipo      = 'todos';
let _termoBusca      = '';
let _chartStatus     = null;  // instância do Chart.js
let _chartSemanal    = null;
let _intervaloAuto   = null;  // setInterval de atualização automática

const INTERVALO_ATUALIZACAO_MS = 30_000; // 30 segundos

// ------------------------------------------------------------
// INICIALIZAÇÃO
// Ponto de entrada — chamado quando o DOM está pronto.
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verificar autenticação (redireciona se não logado)
  const session = await requireAuth();
  if (!session) return;

  // 2. Aplicar permissões na UI
  aplicarPermissoesUI();

  // 3. Preencher dados do usuário no header
  _renderizarHeader();

  // 4. Configurar formulário de novo envio
  _configurarFormulario();

  // 5. Configurar busca e filtros
  _configurarFiltros();

  // 6. Carregar dados iniciais
  await carregarFretes();

  // 7. Iniciar atualização automática
  _intervaloAuto = setInterval(carregarFretes, INTERVALO_ATUALIZACAO_MS);

  // 8. Configurar listener em tempo real do Supabase
  _configurarRealtimeListener();

  console.log('[App] Iniciado com sucesso. Usuário nível:', getUserNivel());
});

// ------------------------------------------------------------
// HEADER — preenche nome, email e badge de nível
// ------------------------------------------------------------
function _renderizarHeader() {
  const profile = getCurrentProfile();
  if (!profile) return;

  const elNome  = document.getElementById('userNome');
  const elEmail = document.getElementById('userEmail');
  const elBadge = document.getElementById('userBadge');
  const elAvatar = document.getElementById('userAvatar');

  if (elNome)   elNome.textContent  = profile.nome  || 'Usuário';
  if (elEmail)  elEmail.textContent = profile.email || '';
  if (elBadge)  elBadge.innerHTML   = getBadgeNivel(profile.nivel);
  if (elAvatar) {
    // Iniciais do nome para avatar
    const iniciais = (profile.nome || 'U')
      .split(' ')
      .map(p => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    elAvatar.textContent = iniciais;
  }
}

// ------------------------------------------------------------
// ABAS DE NAVEGAÇÃO
// ------------------------------------------------------------
function mudarAba(aba) {
  _abaAtiva = aba;

  // Esconde todas as seções
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.add('hidden');
  });

  // Mostra a aba selecionada
  const secao = document.getElementById(`section-${aba}`);
  if (secao) secao.classList.remove('hidden');

  // Atualiza estado visual dos botões
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isAtivo = btn.getAttribute('data-tab') === aba;
    btn.classList.toggle('bg-white',         isAtivo);
    btn.classList.toggle('dark:bg-slate-700', isAtivo);
    btn.classList.toggle('text-slate-900',    isAtivo);
    btn.classList.toggle('dark:text-white',   isAtivo);
    btn.classList.toggle('shadow-sm',         isAtivo);
    btn.classList.toggle('text-slate-500',    !isAtivo);
  });

  // Renderiza gráficos ao entrar na aba Analytics
  if (aba === 'dados') {
    setTimeout(_renderizarGraficos, 100);
  }
}

// ------------------------------------------------------------
// CARREGAR FRETES DO SUPABASE
// ------------------------------------------------------------
async function carregarFretes() {
  try {
    _mostrarIndicadorCarregamento(true);

    const { data, error } = await supabase
      .from('fretes')
      .select(`
        *,
        profiles:solicitante_id ( nome, email )
      `)
      .order('criado_em', { ascending: false });

    if (error) throw error;

    _todosOsFretes = data || [];

    // Atualiza todas as seções visíveis
    _renderizarDashboard();
    _renderizarListaFretes();
    _atualizarContadorStatus();

  } catch (err) {
    console.error('[App] Erro ao carregar fretes:', err.message);
    showToast('Erro ao carregar dados. Tentando novamente...', 'error');
  } finally {
    _mostrarIndicadorCarregamento(false);
  }
}

// ------------------------------------------------------------
// DASHBOARD — cards de métricas
// ------------------------------------------------------------
async function _renderizarDashboard() {
  try {
    // Busca estatísticas via RPC (função SQL criada em 03_functions.sql)
    const { data: stats, error } = await supabase.rpc('get_dashboard_stats');

    if (error) throw error;

    // Atualizar cards
    _setCard('card-total',        stats.total        || 0);
    _setCard('card-pendentes',    stats.pendentes     || 0);
    _setCard('card-andamento',    stats.em_andamento  || 0);
    _setCard('card-concluidos',   stats.concluidos    || 0);
    _setCard('card-cancelados',   stats.cancelados    || 0);
    _setCard('card-urgentes',     stats.urgentes      || 0);
    _setCard('card-hoje',         stats.hoje          || 0);
    _setCard('card-semana',       stats.esta_semana   || 0);

  } catch (err) {
    console.error('[App] Erro ao buscar estatísticas:', err.message);
    // Fallback: calcula localmente se o RPC falhar
    _calcularStatsLocal();
  }
}

function _setCard(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}

function _calcularStatsLocal() {
  const f = _todosOsFretes;
  _setCard('card-total',      f.length);
  _setCard('card-pendentes',  f.filter(x => x.status === 'pendente').length);
  _setCard('card-andamento',  f.filter(x => ['aceito','em_andamento'].includes(x.status)).length);
  _setCard('card-concluidos', f.filter(x => x.status === 'concluido').length);
  _setCard('card-cancelados', f.filter(x => x.status === 'cancelado').length);
  _setCard('card-urgentes',   f.filter(x => x.urgente && x.status === 'pendente').length);
}

// ------------------------------------------------------------
// LISTA DE FRETES — tabela/cards com filtros
// ------------------------------------------------------------
function _renderizarListaFretes() {
  const container = document.getElementById('listaFretes');
  if (!container) return;

  let fretes = [..._todosOsFretes];

  // Aplicar filtros
  if (_filtroStatus !== 'todos') {
    fretes = fretes.filter(f => f.status === _filtroStatus);
  }
  if (_filtroTipo !== 'todos') {
    fretes = fretes.filter(f => f.tipo === _filtroTipo);
  }
  if (_termoBusca) {
    const termo = _termoBusca.toLowerCase();
    fretes = fretes.filter(f =>
      f.solicitante_nome?.toLowerCase().includes(termo) ||
      f.descricao?.toLowerCase().includes(termo)       ||
      f.endereco?.toLowerCase().includes(termo)        ||
      f.id?.toLowerCase().includes(termo)
    );
  }

  if (fretes.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 text-slate-400 dark:text-slate-500">
        <svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
        <p class="font-medium">Nenhum chamado encontrado</p>
        <p class="text-sm mt-1">Tente ajustar os filtros ou abrir um novo chamado.</p>
      </div>`;
    return;
  }

  container.innerHTML = fretes.map(f => _templateCard(f)).join('');
}

// Template HTML para cada card de frete
function _templateCard(f) {
  const nivel    = getUserNivel();
  const ehMeu    = f.solicitante_id === getCurrentUser()?.id;
  const podeCancelarEste = (
    (pode('cancelarProprio') && ehMeu && f.status === 'pendente') ||
    pode('cancelarQualquer')
  );
  const podeAlterarStatus = pode('alterarStatus');

  const badgeStatus = {
    pendente:     'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    aceito:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    em_andamento: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    concluido:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    cancelado:    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
  };

  const labelStatus = {
    pendente:     'Pendente',
    aceito:       'Aceito',
    em_andamento: 'Em andamento',
    concluido:    'Concluído',
    cancelado:    'Cancelado'
  };

  const dataFormatada = f.data_coleta
    ? new Date(f.data_coleta + 'T00:00:00').toLocaleDateString('pt-BR')
    : '—';

  return `
    <div class="card-frete bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg transition-all duration-200 ${f.urgente ? 'border-l-4 border-l-amber-500' : ''}">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-mono text-slate-400 dark:text-slate-500">#${f.id.slice(0, 8).toUpperCase()}</span>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeStatus[f.status] || ''}">
            ${labelStatus[f.status] || f.status}
          </span>
          ${f.urgente ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">⚡ Urgente</span>' : ''}
          <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            ${f.tipo === 'coleta' ? '📦 Coleta' : '🚚 Envio'}
          </span>
        </div>
        <button onclick="abrirModal('${f.id}')"
          class="flex-shrink-0 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          title="Ver detalhes">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
        </button>
      </div>

      <div class="space-y-2">
        <div class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          <span class="font-medium">${f.solicitante_nome}</span>
        </div>
        <div class="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
          <svg class="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          </svg>
          <span class="truncate">${f.descricao || f.endereco || '—'}</span>
        </div>
        <div class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <span>${dataFormatada}${f.horario_janela ? ' às ' + f.horario_janela.slice(0,5) : ''}</span>
        </div>
      </div>

      ${(podeCancelarEste || podeAlterarStatus) ? `
      <div class="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
        ${podeAlterarStatus && f.status === 'pendente' ? `
          <button onclick="alterarStatus('${f.id}', 'em_andamento')"
            class="flex-1 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-xs font-medium transition-colors">
            Iniciar
          </button>` : ''}
        ${podeAlterarStatus && f.status === 'em_andamento' ? `
          <button onclick="alterarStatus('${f.id}', 'concluido')"
            class="flex-1 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium transition-colors">
            Concluir
          </button>` : ''}
        ${podeCancelarEste && !['cancelado','concluido'].includes(f.status) ? `
          <button onclick="cancelarFrete('${f.id}')"
            class="flex-1 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 text-xs font-medium transition-colors">
            Cancelar
          </button>` : ''}
      </div>` : ''}
    </div>`;
}

// ------------------------------------------------------------
// MODAL DE DETALHES
// ------------------------------------------------------------
async function abrirModal(freteId) {
  const frete = _todosOsFretes.find(f => f.id === freteId);
  if (!frete) return;

  const modal     = document.getElementById('modalDetalhes');
  const conteudo  = document.getElementById('conteudoModal');
  const subtitulo = document.getElementById('modalSubtitle');

  subtitulo.textContent = `ID: #${frete.id.slice(0, 8).toUpperCase()} · ${frete.tipo === 'coleta' ? 'Coleta' : 'Envio'}`;

  // Buscar histórico
  const { data: historico } = await supabase
    .from('historico_fretes')
    .select('*')
    .eq('frete_id', freteId)
    .order('criado_em', { ascending: true });

  const dataFormatada = frete.data_coleta
    ? new Date(frete.data_coleta + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  const criadoEm = new Date(frete.criado_em).toLocaleString('pt-BR');

  conteudo.innerHTML = `
    <div class="space-y-6">
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="space-y-1">
          <p class="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Solicitante</p>
          <p class="text-slate-900 dark:text-white font-medium">${frete.solicitante_nome}</p>
        </div>
        <div class="space-y-1">
          <p class="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Criado em</p>
          <p class="text-slate-900 dark:text-white">${criadoEm}</p>
        </div>
        <div class="space-y-1">
          <p class="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Data da Coleta</p>
          <p class="text-slate-900 dark:text-white">${dataFormatada}</p>
        </div>
        <div class="space-y-1">
          <p class="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Horário</p>
          <p class="text-slate-900 dark:text-white">${frete.horario_janela?.slice(0,5) || '—'}</p>
        </div>
        ${frete.volume_kg ? `
        <div class="space-y-1">
          <p class="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Volume</p>
          <p class="text-slate-900 dark:text-white">${frete.volume_kg} kg</p>
        </div>` : ''}
        ${frete.quantidade ? `
        <div class="space-y-1">
          <p class="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Quantidade</p>
          <p class="text-slate-900 dark:text-white">${frete.quantidade} volumes</p>
        </div>` : ''}
      </div>

      ${frete.descricao ? `
      <div class="space-y-1">
        <p class="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Descrição</p>
        <p class="text-slate-700 dark:text-slate-300">${frete.descricao}</p>
      </div>` : ''}

      ${frete.observacao ? `
      <div class="space-y-1">
        <p class="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Observações</p>
        <p class="text-slate-700 dark:text-slate-300">${frete.observacao}</p>
      </div>` : ''}

      ${frete.link_maps ? `
      <div class="space-y-2">
        <p class="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Localização</p>
        <a href="${frete.link_maps}" target="_blank" rel="noopener"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          </svg>
          Abrir no Google Maps
        </a>
        <p class="text-xs text-slate-400 dark:text-slate-500 truncate">${frete.endereco || frete.link_maps}</p>
      </div>` : ''}

      ${frete.motorista_nome ? `
      <div class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
        <p class="text-xs text-emerald-700 dark:text-emerald-400 font-medium uppercase tracking-wide mb-1">Motorista responsável</p>
        <p class="text-emerald-900 dark:text-emerald-300 font-semibold">${frete.motorista_nome}</p>
        ${frete.aceito_em ? `<p class="text-xs text-emerald-600 dark:text-emerald-500 mt-1">Aceito em ${new Date(frete.aceito_em).toLocaleString('pt-BR')}</p>` : ''}
      </div>` : ''}

      ${(historico && historico.length > 0) ? `
      <div class="space-y-2">
        <p class="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Histórico</p>
        <div class="space-y-2">
          ${historico.map(h => `
            <div class="flex items-center gap-3 text-sm">
              <span class="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 flex-shrink-0"></span>
              <span class="text-slate-500 dark:text-slate-400 text-xs">${new Date(h.criado_em).toLocaleString('pt-BR')}</span>
              <span class="text-slate-700 dark:text-slate-300">${h.status_de || '—'} → <strong>${h.status_para}</strong></span>
            </div>`).join('')}
        </div>
      </div>` : ''}
    </div>`;

  modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
  document.getElementById('modalContent')?.classList.remove('scale-95');
}

function fecharModal() {
  const modal = document.getElementById('modalDetalhes');
  modal.classList.add('opacity-0', 'pointer-events-none');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

// ------------------------------------------------------------
// CRIAR NOVO CHAMADO
// ------------------------------------------------------------
function _configurarFormulario() {
  const form = document.getElementById('formNovoEnvio');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!pode('abrirChamado')) {
      showToast('Você não tem permissão para abrir chamados.', 'error');
      return;
    }

    const dados = Object.fromEntries(new FormData(form));
    const profile = getCurrentProfile();

    const novoChamado = {
      solicitante_id:   getCurrentUser().id,
      solicitante_nome: profile.nome,
      tipo:             dados.tipo_servico || 'envio',
      urgente:          dados.urgencia === 'Sim',
      descricao:        dados.descricao || '',
      volume_kg:        dados.volume_kg ? parseFloat(dados.volume_kg) : null,
      quantidade:       dados.quantidade ? parseInt(dados.quantidade) : null,
      endereco:         dados.endereco || '',
      link_maps:        dados.endereco?.startsWith('http') ? dados.endereco : null,
      data_coleta:      dados.data_coleta,
      horario_janela:   dados.horario_janela || null,
      observacao:       dados.observacao || null,
      status:           'pendente'
    };

    showLoading(true);

    const { data, error } = await supabase
      .from('fretes')
      .insert(novoChamado)
      .select()
      .single();

    showLoading(false);

    if (error) {
      console.error('[App] Erro ao criar chamado:', error.message);
      showToast('Erro ao criar chamado. Tente novamente.', 'error');
      return;
    }

    showToast('Chamado criado com sucesso!', 'success');
    form.reset();
    mudarAba('todas');

    // Sincronizar com Google Sheets em background
    _sincronizarComSheets(data.id);

    await carregarFretes();
  });
}

// ------------------------------------------------------------
// ALTERAR STATUS DE UM CHAMADO
// ------------------------------------------------------------
async function alterarStatus(freteId, novoStatus) {
  if (!pode('alterarStatus')) {
    showToast('Sem permissão para alterar status.', 'error');
    return;
  }

  const updates = { status: novoStatus };

  if (novoStatus === 'em_andamento') updates.aceito_em     = new Date().toISOString();
  if (novoStatus === 'concluido')    updates.concluido_em  = new Date().toISOString();

  const { error } = await supabase
    .from('fretes')
    .update(updates)
    .eq('id', freteId);

  if (error) {
    showToast('Erro ao atualizar status.', 'error');
    return;
  }

  showToast(`Status alterado para "${novoStatus}".`, 'success');
  await carregarFretes();
  _sincronizarComSheets(freteId);
}

// ------------------------------------------------------------
// CANCELAR CHAMADO
// ------------------------------------------------------------
async function cancelarFrete(freteId) {
  const frete = _todosOsFretes.find(f => f.id === freteId);
  if (!frete) return;

  const ehMeu = frete.solicitante_id === getCurrentUser()?.id;
  const temPermissao =
    (pode('cancelarProprio') && ehMeu && frete.status === 'pendente') ||
    pode('cancelarQualquer');

  if (!temPermissao) {
    showToast('Você não pode cancelar este chamado.', 'error');
    return;
  }

  if (!confirm('Tem certeza que deseja cancelar este chamado?')) return;

  const { error } = await supabase
    .from('fretes')
    .update({
      status:       'cancelado',
      cancelado_por: getCurrentUser().id
    })
    .eq('id', freteId);

  if (error) {
    showToast('Erro ao cancelar chamado.', 'error');
    return;
  }

  showToast('Chamado cancelado.', 'warning');
  await carregarFretes();
  _sincronizarComSheets(freteId);
}

// ------------------------------------------------------------
// SINCRONIZAÇÃO COM GOOGLE SHEETS
// Chama a função serverless /api/sync-sheets.js
// que usa a Google Sheets API para escrever na planilha.
// ------------------------------------------------------------
async function _sincronizarComSheets(freteId) {
  try {
    const resp = await fetch('/api/sync-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ freteId })
    });

    if (!resp.ok) {
      const err = await resp.json();
      console.warn('[Sheets] Sync falhou:', err.error);
    } else {
      console.log('[Sheets] Sincronizado com sucesso:', freteId);
    }
  } catch (err) {
    // Não bloqueia o usuário se o Sheets estiver fora
    console.warn('[Sheets] Erro de rede ao sincronizar:', err.message);
  }
}

// Botão manual de sincronização (para nível 2+)
async function sincronizarTodos() {
  if (!pode('sincronizarSheets')) {
    showToast('Sem permissão para sincronizar.', 'error');
    return;
  }

  showLoading(true);
  let ok = 0, erro = 0;

  for (const f of _todosOsFretes) {
    try {
      await _sincronizarComSheets(f.id);
      ok++;
    } catch {
      erro++;
    }
  }

  showLoading(false);
  showToast(`Sincronização concluída: ${ok} ok, ${erro} erro(s).`, erro > 0 ? 'warning' : 'success');
}

// ------------------------------------------------------------
// REALTIME — atualizações em tempo real via Supabase Channels
// Gratuito — incluído no plano free do Supabase
// ------------------------------------------------------------
function _configurarRealtimeListener() {
  supabase
    .channel('fretes-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'fretes' },
      async (payload) => {
        console.log('[Realtime] Mudança detectada:', payload.eventType);
        await carregarFretes();
      }
    )
    .subscribe((status) => {
      console.log('[Realtime] Status:', status);
    });
}

// ------------------------------------------------------------
// FILTROS E BUSCA
// ------------------------------------------------------------
function _configurarFiltros() {
  const inputBusca = document.getElementById('inputBusca');
  if (inputBusca) {
    inputBusca.addEventListener('input', (e) => {
      _termoBusca = e.target.value.trim();
      _renderizarListaFretes();
    });
  }
}

function filtrarPorStatus(status) {
  _filtroStatus = status;

  // Atualizar botões de filtro
  document.querySelectorAll('[data-filtro-status]').forEach(btn => {
    const isAtivo = btn.getAttribute('data-filtro-status') === status;
    btn.classList.toggle('bg-primary-600', isAtivo);
    btn.classList.toggle('text-white',     isAtivo);
    btn.classList.toggle('border-transparent', isAtivo);
  });

  _renderizarListaFretes();
}

function filtrarPorTipo(tipo) {
  _filtroTipo = tipo;
  _renderizarListaFretes();
}

// ------------------------------------------------------------
// CONTADOR DE STATUS (badges nos botões de filtro)
// ------------------------------------------------------------
function _atualizarContadorStatus() {
  const contadores = {
    todos:       _todosOsFretes.length,
    pendente:    _todosOsFretes.filter(f => f.status === 'pendente').length,
    em_andamento: _todosOsFretes.filter(f => ['aceito','em_andamento'].includes(f.status)).length,
    concluido:   _todosOsFretes.filter(f => f.status === 'concluido').length,
    cancelado:   _todosOsFretes.filter(f => f.status === 'cancelado').length
  };

  Object.entries(contadores).forEach(([status, count]) => {
    const el = document.getElementById(`count-${status}`);
    if (el) el.textContent = count;
  });
}

// ------------------------------------------------------------
// GRÁFICOS (Chart.js) — aba Analytics
// ------------------------------------------------------------
function _renderizarGraficos() {
  _renderizarGraficoStatus();
  _renderizarGraficoSemanal();
}

function _renderizarGraficoStatus() {
  const canvas = document.getElementById('graficoStatus');
  if (!canvas) return;

  const dados = {
    pendente:    _todosOsFretes.filter(f => f.status === 'pendente').length,
    em_andamento: _todosOsFretes.filter(f => ['aceito','em_andamento'].includes(f.status)).length,
    concluido:   _todosOsFretes.filter(f => f.status === 'concluido').length,
    cancelado:   _todosOsFretes.filter(f => f.status === 'cancelado').length
  };

  if (_chartStatus) _chartStatus.destroy();

  _chartStatus = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Pendente', 'Em andamento', 'Concluído', 'Cancelado'],
      datasets: [{
        data:            [dados.pendente, dados.em_andamento, dados.concluido, dados.cancelado],
        backgroundColor: ['#F59E0B', '#3B82F6', '#10B981', '#EF4444'],
        borderWidth:     0,
        hoverOffset:     8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      },
      cutout: '65%'
    }
  });
}

function _renderizarGraficoSemanal() {
  const canvas = document.getElementById('graficoSemanal');
  if (!canvas) return;

  // Agrupa por dia da semana (últimos 7 dias)
  const hoje   = new Date();
  const labels = [];
  const dados  = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - i);
    const key = d.toISOString().split('T')[0];
    labels.push(d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }));
    dados.push(_todosOsFretes.filter(f => f.criado_em?.startsWith(key)).length);
  }

  if (_chartSemanal) _chartSemanal.destroy();

  _chartSemanal = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Chamados abertos',
        data: dados,
        backgroundColor: 'rgba(14, 165, 233, 0.8)',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}

// ------------------------------------------------------------
// EXPORTAR CSV
// ------------------------------------------------------------
function exportarCSV() {
  if (!pode('exportarDados')) {
    showToast('Sem permissão para exportar dados.', 'error');
    return;
  }

  const cabecalho = [
    'ID','Tipo','Status','Solicitante','Descrição',
    'Endereço','Data Coleta','Urgente','Motorista','Criado em'
  ];

  const linhas = _todosOsFretes.map(f => [
    f.id.slice(0,8).toUpperCase(),
    f.tipo,
    f.status,
    f.solicitante_nome,
    f.descricao || '',
    f.endereco  || '',
    f.data_coleta || '',
    f.urgente ? 'Sim' : 'Não',
    f.motorista_nome || '',
    new Date(f.criado_em).toLocaleString('pt-BR')
  ].map(v => `"${String(v).replace(/"/g, '""')}"`));

  const csv     = [cabecalho, ...linhas].map(r => r.join(',')).join('\n');
  const blob    = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM para Excel
  const url     = URL.createObjectURL(blob);
  const link    = document.createElement('a');
  link.href     = url;
  link.download = `fretes_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------
// DARK MODE
// ------------------------------------------------------------
function toggleDarkMode() {
  const html = document.documentElement;
  html.classList.toggle('dark');
  localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
}

// Aplicar tema salvo ao carregar
(function aplicarTemaSalvo() {
  const tema = localStorage.getItem('theme');
  if (tema === 'dark' || (!tema && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
})();

// ------------------------------------------------------------
// INDICADOR DE CARREGAMENTO DA LISTA
// ------------------------------------------------------------
function _mostrarIndicadorCarregamento(visible) {
  const el = document.getElementById('loadingLista');
  if (!el) return;
  el.style.display = visible ? 'flex' : 'none';
}

// Expor funções globais para uso nos HTMLs
window.mudarAba        = mudarAba;
window.abrirModal      = abrirModal;
window.fecharModal     = fecharModal;
window.alterarStatus   = alterarStatus;
window.cancelarFrete   = cancelarFrete;
window.filtrarPorStatus = filtrarPorStatus;
window.filtrarPorTipo  = filtrarPorTipo;
window.exportarCSV     = exportarCSV;
window.toggleDarkMode  = toggleDarkMode;
window.carregarFretes  = carregarFretes;
window.sincronizarTodos = sincronizarTodos;
