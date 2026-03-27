-- ============================================================
-- LOGISTICS PRO — SCHEMA SUPABASE
-- Arquivo: supabase/01_schema.sql
-- Executar no painel: Supabase > SQL Editor > New Query
-- ============================================================
-- ORDEM DE EXECUÇÃO:
--   1. supabase/01_schema.sql   ← este arquivo
--   2. supabase/02_rls.sql
--   3. supabase/03_functions.sql
--   4. supabase/04_seed.sql     (opcional, dados de teste)
-- ============================================================

-- ------------------------------------------------------------
-- EXTENSÕES NECESSÁRIAS
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- geração de UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- funções criptográficas

-- ------------------------------------------------------------
-- TABELA: profiles
-- Armazena dados extras do usuário além do que o Supabase Auth guarda.
-- Criada automaticamente via trigger quando um usuário se registra.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT        NOT NULL DEFAULT '',
  email         TEXT        NOT NULL DEFAULT '',
  nivel         SMALLINT    NOT NULL DEFAULT 1
                            CHECK (nivel >= 0 AND nivel <= 3),
  -- 0 = Visualizador, 1 = Solicitante, 2 = Gestor, 3 = Admin

  ativo         BOOLEAN     NOT NULL DEFAULT TRUE,
  avatar_url    TEXT,
  telefone      TEXT,
  departamento  TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS
  'Perfis de usuário com nível de acesso. Sincronizado com auth.users via trigger.';
COMMENT ON COLUMN public.profiles.nivel IS
  '0=Visualizador | 1=Solicitante | 2=Gestor | 3=Admin';

-- ------------------------------------------------------------
-- TABELA: fretes
-- Cada linha é um chamado de coleta ou envio.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fretes (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Quem abriu
  solicitante_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  solicitante_nome TEXT       NOT NULL DEFAULT '',

  -- Tipo e urgência
  tipo            TEXT        NOT NULL CHECK (tipo IN ('coleta', 'envio')),
  urgente         BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Status do chamado
  status          TEXT        NOT NULL DEFAULT 'pendente'
                              CHECK (status IN (
                                'pendente',       -- aguardando motorista
                                'aceito',         -- motorista aceitou
                                'em_andamento',   -- em execução
                                'concluido',      -- finalizado com sucesso
                                'cancelado'       -- cancelado pelo solicitante/gestor
                              )),

  -- Dados do serviço
  descricao       TEXT        NOT NULL DEFAULT '',
  volume_kg       NUMERIC(10,2),
  quantidade      INTEGER,
  observacao      TEXT,

  -- Localização
  endereco        TEXT        NOT NULL DEFAULT '',
  link_maps       TEXT,       -- link do Google Maps

  -- Agendamento
  data_coleta     DATE        NOT NULL,
  horario_janela  TIME,

  -- Motorista (preenchido quando aceito)
  motorista_nome  TEXT,
  motorista_id    TEXT,       -- ID do motorista no AppSheet

  -- Controle de cancelamento
  cancelado_por   UUID        REFERENCES public.profiles(id),
  motivo_cancelamento TEXT,

  -- Timestamps
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aceito_em       TIMESTAMPTZ,
  concluido_em    TIMESTAMPTZ,

  -- Sync com Google Sheets
  sheets_row      INTEGER,    -- número da linha na planilha (para updates)
  synced_at       TIMESTAMPTZ -- última sincronização com Sheets
);

COMMENT ON TABLE public.fretes IS
  'Chamados de frete (coleta/envio). Fonte de verdade do sistema.';

-- ------------------------------------------------------------
-- TABELA: historico_fretes
-- Registro imutável de cada mudança de status.
-- Útil para auditoria e analytics futuros.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.historico_fretes (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  frete_id    UUID        NOT NULL REFERENCES public.fretes(id) ON DELETE CASCADE,
  usuario_id  UUID        REFERENCES public.profiles(id),
  status_de   TEXT,
  status_para TEXT        NOT NULL,
  observacao  TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.historico_fretes IS
  'Log imutável de mudanças de status. Não pode ser alterado após inserção.';

-- ------------------------------------------------------------
-- TABELA: configuracoes
-- Configurações gerais do sistema (editável apenas por nível 3).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave       TEXT        PRIMARY KEY,
  valor       TEXT        NOT NULL,
  descricao   TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por UUID     REFERENCES public.profiles(id)
);

COMMENT ON TABLE public.configuracoes IS
  'Configurações globais do sistema. Apenas Admin (nível 3) pode editar.';

-- Valores iniciais
INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
  ('sheets_sync_enabled', 'true',  'Habilita sincronização com Google Sheets'),
  ('notificacao_email',   'false', 'Envia e-mail ao motorista quando chamado criado'),
  ('auto_cancelar_horas', '48',    'Horas sem aceite para cancelamento automático'),
  ('versao_sistema',      '1.0.0', 'Versão atual do sistema')
ON CONFLICT (chave) DO NOTHING;

-- ------------------------------------------------------------
-- ÍNDICES — melhoram performance em consultas frequentes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_fretes_status          ON public.fretes(status);
CREATE INDEX IF NOT EXISTS idx_fretes_solicitante_id  ON public.fretes(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_fretes_data_coleta     ON public.fretes(data_coleta);
CREATE INDEX IF NOT EXISTS idx_fretes_criado_em       ON public.fretes(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_historico_frete_id     ON public.historico_fretes(frete_id);
CREATE INDEX IF NOT EXISTS idx_profiles_nivel         ON public.profiles(nivel);
