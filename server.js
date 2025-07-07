const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const fetch = require('node-fetch'); // npm install node-fetch

const app = express();
const PORT = process.env.PORT || 3000;

// Stone credentials
const STONE_CODE = '340457949';
const SAAK = '31743219';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rota GET para servir o JSON atual
app.get('/backend_cajuia.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'backend_cajuia.json'));
});

// Rota POST para atualizar o JSON
app.post('/atualizar-json', (req, res) => {
  const newData = req.body;
  const filePath = path.join(__dirname, 'backend_cajuia.json');
  const jsonString = JSON.stringify(newData, null, 2);

  fs.writeFile(filePath, jsonString, 'utf8', (err) => {
    if (err) {
      console.error("Erro ao salvar o arquivo:", err);
      return res.status(500).json({ success: false, message: 'Erro ao salvar os dados no servidor.' });
    }
    console.log("Arquivo backend_cajuia.json atualizado com sucesso!");
    res.status(200).json({ success: true, message: 'Dados salvos com sucesso!' });
  });
});

// Rota para criar link de pagamento Stone com logs detalhados
app.post('/criar-link-stone', async (req, res) => {
  const { valor, descricao, cliente, itens } = req.body;

  // Log do corpo recebido
  console.log('--- [Stone] Requisição recebida ---');
  console.log('Body recebido:', JSON.stringify(req.body, null, 2));

  // Validação básica dos campos
  if (!valor || typeof valor !== 'number' || valor <= 0) {
    console.error('[Stone] Valor inválido:', valor);
    return res.status(400).json({ error: 'Valor inválido para pagamento.' });
  }
  if (!cliente || !cliente.nome || !cliente.email) {
    console.error('[Stone] Dados do cliente ausentes ou incompletos:', cliente);
    return res.status(400).json({ error: 'Dados do cliente ausentes ou incompletos.' });
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    console.error('[Stone] Nenhum item informado:', itens);
    return res.status(400).json({ error: 'Nenhum item informado para pagamento.' });
  }

  // Monta o payload para a Stone
  const payload = {
    amount: Math.round(valor * 100),
    description: descricao || 'Pedido Cajuia',
    payment_methods: ['credit_card', 'pix'],
    customer: {
      name: cliente.nome,
      email: cliente.email
    },
    items: itens.map(item => ({
      name: item.nome,
      quantity: item.quantidade,
      unit_price: Math.round(item.preco * 100)
    }))
  };

  // Log do payload que será enviado para a Stone
  console.log('--- [Stone] Payload enviado para Stone ---');
  console.log(JSON.stringify(payload, null, 2));

  try {
    const response = await fetch('https://api.stone.com.br/link/v3/charge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'merchant_id': STONE_CODE,
        'saak': SAAK
      },
      body: JSON.stringify(payload)
    });

    // Log do status da resposta HTTP
    console.log('[Stone] Status HTTP da resposta:', response.status);

    // Tenta ler o corpo da resposta
    let data;
    try {
      data = await response.json();
    } catch (jsonErr) {
      console.error('[Stone] Erro ao fazer parse do JSON de resposta:', jsonErr);
      return res.status(500).json({ error: 'Erro ao interpretar resposta da Stone.' });
    }

    // Log do corpo da resposta da Stone
    console.log('--- [Stone] Resposta da Stone ---');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok && data.payment_link_url) {
      res.json({ url: data.payment_link_url });
    } else {
      // Log de erro detalhado
      console.error('[Stone] Erro ao criar link:', data);
      res.status(400).json({ error: data });
    }
  } catch (err) {
    // Log de erro de conexão ou inesperado
    console.error('[Stone] Erro inesperado:', err);
    res.status(500).json({ error: err.message });
  }
});

// Log de inicialização
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
