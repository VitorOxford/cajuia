const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para servir arquivos estáticos (index.html, produtos.json, imagens, etc)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para receber dados JSON no corpo das requisições
app.use(express.json());

// Configuração do Multer (caso queira ativar upload no futuro)
const upload = multer({ dest: 'uploads/' });

// Endpoint opcional para verificar se o servidor está funcionando
app.get('/ping', (req, res) => {
  res.send('Servidor ativo e funcionando!');
});

// Endpoint para servir JSON dinâmico se quiser buscar de outro lugar
// Exemplo: fetch('https://render.com/api/produtos.json')
app.get('/api/produtos', async (req, res) => {
  try {
    const response = await fetch('https://cajuia.onrender.com/produtos.json');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
