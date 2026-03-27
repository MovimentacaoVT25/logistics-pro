-- ============================================================
-- LOGISTICS PRO — ROW LEVEL SECURITY (RLS)
-- Arquivo: supabase/02_rls.sql
-- Executar APÓS 01_schema.sql
-- ============================================================
-- O RLS garante que cada usuário só vê/altera o que o seu
-- nível de acesso permite, mesmo que alguém tente burlar
-- via API direta. É a camada de segurança no banco de dados.
-- ============================================================

-- ------------------------------------------------------------
-- FUNÇÃO AUXILIAR: pegar o nível do usuário logado
-- Usada dentro das policies para não repetir a query.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_nivel()
RETURNS SMALLINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT nivel FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ------------------------------------------------------------
-- HABILITAR RLS EM TODAS AS TABELAS
-- ------------------------------------------------------------
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fretes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_fretes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES: profiles
-- ============================================================

-- Usuário lê seu próprio perfil
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Nível 2+ vê todos os perfis
CREATE POLICY "profiles_select_gestor"
  ON public.profiles FOR SELECT
  USING (public.get_user_nivel() >= 2);

-- Usuário atualiza apenas seus próprios dados (nome, telefone, avatar)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- nível não pode ser alterado pelo próprio usuário
    AND nivel = (SELECT nivel FROM public.profiles WHERE id = auth.uid())
  );

-- Apenas Admin (nível 3) pode alterar o nível de qualquer usuário
CREATE POLICY "profiles_update_nivel_admin"
  ON public.profiles FOR UPDATE
  USING (public.get_user_nivel() = 3);

-- INSERT é feito pelo trigger (não pelo usuário diretamente)
CREATE POLICY "profiles_insert_trigger"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- POLICIES: fretes
-- ============================================================

-- LEITURA: todos os níveis veem todos os chamados
CREATE POLICY "fretes_select_all"
  ON public.fretes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERÇÃO: apenas nível 1, 2 e 3 podem abrir chamados
CREATE POLICY "fretes_insert"
  ON public.fretes FOR INSERT
  WITH CHECK (
    public.get_user_nivel() >= 1
    AND auth.uid() = solicitante_id  -- só pode abrir em seu próprio nome
  );

-- CANCELAMENTO PRÓPRIO: nível 1 cancela apenas seus chamados pendentes
CREATE POLICY "fretes_cancel_own"
  ON public.fretes FOR UPDATE
  USING (
    public.get_user_nivel() = 1
    AND auth.uid() = solicitante_id
    AND status = 'pendente'        -- só pode cancelar se ainda não foi aceito
  )
  WITH CHECK (
    status = 'cancelado'           -- só pode mudar para cancelado
  );

-- GESTÃO COMPLETA: nível 2 e 3 atualizam qualquer chamado
CREATE POLICY "fretes_update_gestor"
  ON public.fretes FOR UPDATE
  USING (public.get_user_nivel() >= 2);

-- DELEÇÃO: apenas Admin (nível 3) pode deletar chamados
CREATE POLICY "fretes_delete_admin"
  ON public.fretes FOR DELETE
  USING (public.get_user_nivel() = 3);

-- ============================================================
-- POLICIES: historico_fretes
-- ============================================================

-- Todos os usuários logados podem LER o histórico
CREATE POLICY "historico_select_all"
  ON public.historico_fretes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Apenas o sistema (via funções) insere no histórico
-- Em produção, use service_role na função serverless para inserir
CREATE POLICY "historico_insert_system"
  ON public.historico_fretes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Histórico é IMUTÁVEL: ninguém pode atualizar ou deletar
-- (não criar policies de UPDATE/DELETE = proibido por padrão com RLS ativo)

-- ============================================================
-- POLICIES: configuracoes
-- ============================================================

-- Todos os usuários logados LEEM as configurações
CREATE POLICY "config_select_all"
  ON public.configuracoes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Apenas Admin (nível 3) pode alterar configurações
CREATE POLICY "config_update_admin"
  ON public.configuracoes FOR UPDATE
  USING (public.get_user_nivel() = 3);

CREATE POLICY "config_insert_admin"
  ON public.configuracoes FOR INSERT
  WITH CHECK (public.get_user_nivel() = 3);
