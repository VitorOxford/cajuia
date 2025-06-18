const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const multer = require('multer');
const cors = require('cors'); // Importe o pacote cors

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para habilitar CORS
// Isso deve vir ANTES de suas rotas e do 'express.static'
app.use(cors());

// Middleware para servir arquivos estáticos (backend_cajuia.json, imagens, etc)
// O ideal é colocar seus arquivos públicos dentro de uma pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para receber dados JSON no corpo das requisições
app.use(express.json());

// Configuração do Multer (caso queira ativar upload no futuro)
const upload = multer({ dest: 'uploads/' });

// Endpoint opcional para verificar se o servidor está funcionando
app.get('/ping', (req, res) => {
  res.send('Servidor ativo e funcionando!');
});

// Endpoint para servir o JSON local diretamente
app.get('/backend_cajuia.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'backend_cajuia.json'));
});


app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
