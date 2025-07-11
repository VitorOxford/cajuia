const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const fetch = require('node-fetch'); // npm install node-fetch

const app = express();
const PORT = process.env.PORT || 3000;

// Pagar.me credentials
const PAGARME_API_KEY = 'sk_5353caff454c4f2eb6388ddcd06713e9';

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
      console.error("[ERRO] Falha ao salvar backend_cajuia.json:", err);
      return res.status(500).json({ success: false, message: 'Erro ao salvar os dados no servidor.' });
    }
    console.log("[INFO] backend_cajuia.json atualizado com sucesso!");
    res.status(200).json({ success: true, message: 'Dados salvos com sucesso!' });
  });
});

// Rota para criar link de pagamento Pagar.me com logs detalhados
app.post('/criar-link-pagarme', async (req, res) => {
  console.log("========== NOVA REQUISIÇÃO /criar-link-pagarme ==========");
  console.log("[REQUEST] Body recebido:", JSON.stringify(req.body, null, 2));

  const { valor, descricao, cliente, itens } = req.body;

  // Validação básica dos campos
  if (!valor || typeof valor !== 'number' || valor <= 0) {
    console.error("[VALIDAÇÃO] Valor inválido:", valor);
    return res.status(400).json({ error: 'Valor inválido para pagamento.' });
  }
  if (!cliente || !cliente.nome || !cliente.email) {
    console.error("[VALIDAÇÃO] Dados do cliente ausentes ou incompletos:", cliente);
    return res.status(400).json({ error: 'Dados do cliente ausentes ou incompletos.' });
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    console.error("[VALIDAÇÃO] Nenhum item informado:", itens);
    return res.status(400).json({ error: 'Nenhum item informado para pagamento.' });
  }

  // Monta o payload para o Pagar.me
  const payload = {
    amount: Math.round(valor * 100), // valor em centavos
    payment_methods: ['credit_card', 'pix'],
    customer: {
      name: cliente.nome,
      email: cliente.email,
      type: 'individual'
    },
    items: itens.map(item => ({
      name: item.nome,
      quantity: item.quantidade,
      value: Math.round(item.preco * 100)
    })),
    // redirect_url: "https://seusite.com/obrigado"
  };

  // Log do payload
  console.log("[PAYLOAD] Enviado para Pagar.me:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch('https://api.pagar.me/core/v5/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAGARME_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    // Log do status HTTP
    console.log("[HTTP] Status da resposta Pagar.me:", response.status);

    // Tenta ler o corpo da resposta
    let data;
    try {
      data = await response.json();
    } catch (jsonErr) {
      console.error("[ERRO] Falha ao fazer parse do JSON de resposta:", jsonErr);
      return res.status(500).json({ error: 'Erro ao interpretar resposta da Pagar.me.' });
    }

    // Log do corpo da resposta
    console.log("[RESPONSE] Corpo da resposta Pagar.me:", JSON.stringify(data, null, 2));

    // Checa se veio o link de checkout
    if (response.ok && data.checkout && data.checkout.url) {
      console.log("[SUCESSO] Link de checkout gerado:", data.checkout.url);
      res.json({ url: data.checkout.url });
    } else if (response.ok && data.checkout_url) {
      console.log("[SUCESSO] Link de checkout gerado:", data.checkout_url);
      res.json({ url: data.checkout_url });
    } else {
      // Log de erro detalhado
      console.error("[ERRO] Falha ao criar link de pagamento:", data);
      res.status(400).json({ error: data });
    }
  } catch (err) {
    // Log de erro de conexão ou inesperado
    console.error("[ERRO] Erro inesperado ao conectar com Pagar.me:", err);
    res.status(500).json({ error: err.message });
  }
});

// Middleware para capturar erros não tratados
app.use((err, req, res, next) => {
  console.error("[ERRO NÃO TRATADO]", err.stack || err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// Log de inicialização
app.listen(PORT, () => {
  console.log("==========================================================");
  console.log(`[INFO] Servidor rodando em http://localhost:${PORT}`);
  console.log(`[INFO] Data/Hora: ${new Date().toISOString()}`);
  console.log("==========================================================");
});
