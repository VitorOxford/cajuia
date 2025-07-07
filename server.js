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

// NOVA ROTA POST PARA RECEBER E SALVAR OS DADOS
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

// NOVA ROTA PARA CRIAR LINK DE PAGAMENTO STONE
app.post('/criar-link-stone', async (req, res) => {
  const { valor, descricao, cliente, itens } = req.body;
  try {
    const response = await fetch('https://api.stone.com.br/link/v3/charge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'merchant_id': STONE_CODE,
        'saak': SAAK
      },
      body: JSON.stringify({
        amount: Math.round(valor * 100),
        description: descricao || 'Pedido Cajuia',
        payment_methods: ['credit_card', 'pix'],
        customer: {
          name: cliente?.nome || "Cliente Cajuia",
          email: cliente?.email || "cliente@cajuia.com.br"
        },
        items: (itens || []).map(item => ({
          name: item.nome,
          quantity: item.quantidade,
          unit_price: Math.round(item.preco * 100)
        }))
      })
    });
    const data = await response.json();
    if (data.payment_link_url) {
      res.json({ url: data.payment_link_url });
    } else {
      res.status(400).json({ error: data });
      console.log('Erro Stone:', data);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
