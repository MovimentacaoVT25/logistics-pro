-- ============================================================
-- LOGISTICS PRO — DADOS DE TESTE (SEED)
-- Arquivo: supabase/04_seed.sql
-- ⚠️  EXECUTAR APENAS EM AMBIENTE DE DESENVOLVIMENTO
-- ⚠️  NÃO executar em produção
-- ============================================================
-- Para usar: crie os usuários manualmente no painel
-- Authentication > Users > Invite User, e depois cole os UUIDs
-- gerados nos INSERTs abaixo, substituindo os UUIDs de exemplo.
-- ============================================================

-- Após criar usuários via Authentication > Users,
-- atualize os níveis aqui conforme necessário:

-- Exemplo: promover um usuário para Admin (nível 3)
-- UPDATE public.profiles SET nivel = 3
-- WHERE email = 'admin@suaempresa.com.br';

-- Exemplo: promover para Gestor (nível 2)
-- UPDATE public.profiles SET nivel = 2
-- WHERE email = 'gestor@suaempresa.com.br';

-- Inserir alguns fretes de teste (após ter pelo menos 1 usuário)
-- Substitua o UUID abaixo pelo ID real de um usuário criado:

-- INSERT INTO public.fretes (
--   solicitante_id, solicitante_nome, tipo, descricao,
--   status, endereco, data_coleta, urgente
-- ) VALUES (
--   'UUID-DO-USUARIO-AQUI',
--   'Usuário Teste',
--   'coleta',
--   'Caixas de papelaria, 3 volumes',
--   'pendente',
--   'https://maps.google.com/?q=Rua+Exemplo+123',
--   CURRENT_DATE + 1,
--   FALSE
-- );

SELECT 'Seed file carregado. Descomente os INSERTs após criar usuários.' AS info;
