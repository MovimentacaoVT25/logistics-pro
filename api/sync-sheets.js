// ============================================================
// LOGISTICS PRO — Função Serverless: Sincronização com Sheets
// Arquivo: api/sync-sheets.js
// ============================================================
// Executada pela Vercel como função serverless (Node.js).
// Chamada pelo front-end via POST /api/sync-sheets
// quando um chamado é criado ou atualizado.
//
// PRÉ-REQUISITOS (gratuitos):
//   1. Criar um projeto no Google Cloud Console (gratuito)
//   2. Habilitar a Google Sheets API
//   3. Criar uma Service Account
//   4. Baixar o JSON de credenciais
//   5. Adicionar as variáveis de ambiente na Vercel
//
// INSTRUÇÕES COMPLETAS: docs/04_setup_google_sheets.md
// ============================================================

const { createClient } = require('@supabase/supabase-js');

// Cliente Supabase com service_role (acesso total, sem RLS)
// ⚠️  NUNCA exponha SUPABASE_SERVICE_ROLE no front-end!
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ------------------------------------------------------------
// HANDLER PRINCIPAL
// ------------------------------------------------------------
module.exports = async function handler(req, res) {
  // Apenas POST é aceito
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Verificar token de autenticação interno
  // (opcional mas recomendado para não expor a rota publicamente)
  const authHeader = req.headers.authorization;
  if (process.env.SYNC_SECRET && authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const { freteId } = req.body;

  if (!freteId) {
    return res.status(400).json({ error: 'freteId é obrigatório' });
  }

  try {
    // 1. Buscar o chamado no Supabase
    const { data: frete, error: fetchError } = await supabase
      .from('fretes')
      .select('*')
      .eq('id', freteId)
      .single();

    if (fetchError || !frete) {
      throw new Error(`Chamado não encontrado: ${freteId}`);
    }

    // 2. Montar o token de acesso do Google
    const accessToken = await _getGoogleAccessToken();

    // 3. Verificar se o chamado já tem uma linha no Sheets
    if (frete.sheets_row) {
      // Atualizar linha existente
      await _atualizarLinhaSheets(frete, accessToken);
    } else {
      // Inserir nova linha
      const rowNumber = await _inserirLinhaSheets(frete, accessToken);

      // Salvar o número da linha no Supabase para updates futuros
      await supabase
        .from('fretes')
        .update({ sheets_row: rowNumber, synced_at: new Date().toISOString() })
        .eq('id', freteId);
    }

    return res.status(200).json({ ok: true, freteId });

  } catch (err) {
    console.error('[sync-sheets] Erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ------------------------------------------------------------
// GERAR TOKEN DE ACESSO DO GOOGLE (JWT → OAuth2)
// Usa as credenciais da Service Account para autenticar.
// ------------------------------------------------------------
async function _getGoogleAccessToken() {
  // As credenciais ficam numa variável de ambiente JSON
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

  const now  = Math.floor(Date.now() / 1000);
  const claim = {
    iss:   credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now
  };

  // Criar JWT assinado com a chave privada da Service Account
  const jwt = await _criarJWT(claim, credentials.private_key);

  // Trocar JWT por access_token
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt
    })
  });

  const data = await resp.json();
  if (!data.access_token) throw new Error('Falha ao obter access_token do Google');
  return data.access_token;
}

// Criação de JWT sem biblioteca externa (nativo Node.js crypto)
async function _criarJWT(payload, privateKeyPem) {
  const { createSign } = require('crypto');

  const header  = { alg: 'RS256', typ: 'JWT' };
  const encode  = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const input   = `${encode(header)}.${encode(payload)}`;
  const sign    = createSign('RSA-SHA256');
  sign.update(input);
  const sig = sign.sign(privateKeyPem, 'base64url');
  return `${input}.${sig}`;
}

// ------------------------------------------------------------
// INSERIR NOVA LINHA NA PLANILHA
// ------------------------------------------------------------
async function _inserirLinhaSheets(frete, token) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const range         = process.env.SHEET_RANGE || 'Fretes!A:N'; // ajuste conforme sua aba

  // Mapear campos do frete para as colunas da planilha
  // ⚠️  Ajuste a ORDEM das colunas conforme sua planilha real!
  const valores = [[
    frete.id.slice(0, 8).toUpperCase(),  // A: ID curto
    frete.tipo,                           // B: Tipo (coleta/envio)
    frete.status,                         // C: Status
    frete.solicitante_nome,               // D: Solicitante
    frete.descricao || '',                // E: Descrição
    frete.endereco  || '',                // F: Endereço
    frete.link_maps || '',                // G: Link Maps
    frete.data_coleta || '',              // H: Data Coleta
    frete.horario_janela || '',           // I: Horário
    frete.urgente ? 'Sim' : 'Não',        // J: Urgente
    frete.volume_kg   || '',              // K: Volume (kg)
    frete.quantidade  || '',              // L: Quantidade
    frete.motorista_nome || '',           // M: Motorista
    new Date(frete.criado_em).toLocaleString('pt-BR') // N: Criado em
  ]];

  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({ values: valores })
    }
  );

  const data = await resp.json();
  if (!resp.ok) throw new Error(`Sheets append error: ${JSON.stringify(data)}`);

  // Extrair o número da linha inserida da resposta
  const updatedRange = data.updates?.updatedRange || '';
  const match        = updatedRange.match(/:([A-Z]+)(\d+)$/);
  return match ? parseInt(match[2]) : null;
}

// ------------------------------------------------------------
// ATUALIZAR LINHA EXISTENTE NA PLANILHA
// ------------------------------------------------------------
async function _atualizarLinhaSheets(frete, token) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName     = process.env.SHEET_NAME || 'Fretes';
  const row           = frete.sheets_row;

  // Só atualiza status e motorista (colunas C, M)
  // Ajuste os ranges conforme as colunas reais
  const batchUpdate = {
    valueInputOption: 'USER_ENTERED',
    data: [
      {
        range:  `${sheetName}!C${row}`,       // Status
        values: [[frete.status]]
      },
      {
        range:  `${sheetName}!M${row}`,       // Motorista
        values: [[frete.motorista_nome || '']]
      }
    ]
  };

  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify(batchUpdate)
    }
  );

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(`Sheets update error: ${JSON.stringify(err)}`);
  }
}
