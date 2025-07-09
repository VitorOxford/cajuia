const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const fetch = require('node-fetch'); // npm install node-fetch

const app = express();
const PORT = process.env.PORT || 3000;

// Pagar.me credentials
const PAGARME_API_KEY = 'sk_test_26a99d100c24493bb4680e98578363af';

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

// Nova rota para criar link de pagamento Pagar.me
app.post('/criar-link-pagarme', async (req, res) => {
  const { valor, descricao, cliente, itens } = req.body;

  // Validação básica dos campos
  if (!valor || typeof valor !== 'number' || valor <= 0) {
    return res.status(400).json({ error: 'Valor inválido para pagamento.' });
  }
  if (!cliente || !cliente.nome || !cliente.email) {
    return res.status(400).json({ error: 'Dados do cliente ausentes ou incompletos.' });
  }
  if (!Array.isArray(itens) || itens.length === 0) {
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
    // Opcional: redirect_url para onde o cliente será enviado após o pagamento
    // redirect_url: "https://seusite.com/obrigado"
  };

  try {
    const response = await fetch('https://api.pagar.me/core/v5/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': PAGARME_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // O campo correto para o link de checkout pode variar conforme o tipo de integração.
    // Para o checkout Pagar.me, normalmente é data.checkout.url ou data.checkout_url.
    // Ajuste conforme a resposta real da API.
    if (response.ok && data.checkout && data.checkout.url) {
      res.json({ url: data.checkout.url });
    } else if (response.ok && data.checkout_url) {
      res.json({ url: data.checkout_url });
    } else {
      res.status(400).json({ error: data });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log de inicialização
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
