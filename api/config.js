// ============================================================
// LOGISTICS PRO — API: Configuração Segura do Supabase
// Arquivo: api/config.js
// ============================================================
// Fornece as credenciais do Supabase ao front-end de forma
// segura — as chaves ficam nas variáveis de ambiente da Vercel
// e nunca são commitadas no repositório.
//
// Chamada pelo front-end: GET /api/config
// Retorna apenas a URL e a ANON KEY (seguras para o client).
// ============================================================

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const supabaseUrl     = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[config] Variáveis de ambiente não configuradas!');
    return res.status(500).json({
      error: 'Configuração do servidor incompleta. Verifique as variáveis de ambiente na Vercel.'
    });
  }

  // Retorna apenas as chaves públicas (anon key é segura para o client)
  res.setHeader('Cache-Control', 'public, max-age=300'); // cache de 5 min
  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey
  });
};
