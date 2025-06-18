const express = require('express');
const path = require('path');
const fs = require('fs'); // Módulo File System para salvar o arquivo
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '5mb' })); // Permite receber JSONs grandes
app.use(express.static(path.join(__dirname, 'public'))); // Se tiver uma pasta 'public'

// Rota GET para servir o JSON atual
app.get('/backend_cajuia.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'backend_cajuia.json'));
});

// NOVA ROTA POST PARA RECEBER E SALVAR OS DADOS
app.post('/atualizar-json', (req, res) => {
  const newData = req.body;
  const filePath = path.join(__dirname, 'backend_cajuia.json');

  // Converte o JSON recebido para uma string formatada
  const jsonString = JSON.stringify(newData, null, 2);

  // Escreve a nova string no arquivo, sobrescrevendo o conteúdo antigo
  fs.writeFile(filePath, jsonString, 'utf8', (err) => {
    if (err) {
      console.error("Erro ao salvar o arquivo:", err);
      return res.status(500).json({ success: false, message: 'Erro ao salvar os dados no servidor.' });
    }
    
    console.log("Arquivo backend_cajuia.json atualizado com sucesso!");
    res.status(200).json({ success: true, message: 'Dados salvos com sucesso!' });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
