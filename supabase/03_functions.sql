-- ============================================================
-- LOGISTICS PRO — FUNÇÕES E TRIGGERS
-- Arquivo: supabase/03_functions.sql
-- Executar APÓS 02_rls.sql
-- ============================================================

-- ------------------------------------------------------------
-- TRIGGER: criar perfil automaticamente ao registrar usuário
-- Quando alguém faz signup no Supabase Auth, esse trigger
-- cria a linha correspondente em public.profiles.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, nivel)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    1  -- nível padrão: Solicitante
       -- Admin pode elevar depois em /pages/admin.html
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Registrar o trigger na tabela de auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- TRIGGER: atualizar campo updated_at automaticamente
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_fretes_updated_at ON public.fretes;
CREATE TRIGGER set_fretes_updated_at
  BEFORE UPDATE ON public.fretes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- TRIGGER: registrar histórico a cada mudança de status
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_status_frete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Só registra quando o status efetivamente muda
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.historico_fretes (
      frete_id,
      usuario_id,
      status_de,
      status_para
    ) VALUES (
      NEW.id,
      auth.uid(),
      OLD.status,
      NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_frete_status ON public.fretes;
CREATE TRIGGER log_frete_status
  AFTER UPDATE ON public.fretes
  FOR EACH ROW EXECUTE FUNCTION public.log_status_frete();

-- ------------------------------------------------------------
-- FUNÇÃO: estatísticas do dashboard (chamada via RPC)
-- Retorna os números para os cards do dashboard de uma vez só,
-- evitando múltiplas queries do front-end.
-- Uso: supabase.rpc('get_dashboard_stats')
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total',         COUNT(*),
    'pendentes',     COUNT(*) FILTER (WHERE status = 'pendente'),
    'em_andamento',  COUNT(*) FILTER (WHERE status IN ('aceito', 'em_andamento')),
    'concluidos',    COUNT(*) FILTER (WHERE status = 'concluido'),
    'cancelados',    COUNT(*) FILTER (WHERE status = 'cancelado'),
    'urgentes',      COUNT(*) FILTER (WHERE urgente = TRUE AND status = 'pendente'),
    'hoje',          COUNT(*) FILTER (WHERE data_coleta = CURRENT_DATE),
    'esta_semana',   COUNT(*) FILTER (WHERE data_coleta BETWEEN
                       DATE_TRUNC('week', CURRENT_DATE) AND
                       DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')
  )
  INTO result
  FROM public.fretes;

  RETURN result;
END;
$$;

-- ------------------------------------------------------------
-- FUNÇÃO: buscar fretes de um usuário específico (para nível 1)
-- Uso: supabase.rpc('get_meus_fretes', { uid: 'uuid' })
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_meus_fretes(uid UUID)
RETURNS SETOF public.fretes
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT * FROM public.fretes
  WHERE solicitante_id = uid
  ORDER BY criado_em DESC;
$$;

-- ------------------------------------------------------------
-- FUNÇÃO: promover/rebaixar usuário (apenas Admin nível 3)
-- Uso: supabase.rpc('set_user_nivel', { target_id: uuid, novo_nivel: 2 })
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_nivel(target_id UUID, novo_nivel SMALLINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verifica se quem está chamando é Admin
  IF public.get_user_nivel() < 3 THEN
    RAISE EXCEPTION 'Permissão negada: apenas Admin pode alterar níveis';
  END IF;

  -- Garante que o valor é válido
  IF novo_nivel < 0 OR novo_nivel > 3 THEN
    RAISE EXCEPTION 'Nível inválido: deve ser entre 0 e 3';
  END IF;

  UPDATE public.profiles
  SET nivel = novo_nivel
  WHERE id = target_id;

  RETURN FOUND;
END;
$$;
