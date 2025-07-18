require('dotenv').config(); // Carrega as variáveis do arquivo .env para process.env
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const fetch = require('node-fetch');
const axios = require('axios');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CREDENCIAIS E CHAVES DE API (LIDAS DAS VARIÁVEIS DE AMBIENTE) --- 
const PAGARME_API_KEY = process.env.PAGARME_API_KEY;
const MELHORENVIO_TOKEN = process.env.MELHORENVIO_TOKEN;
const CEP_ORIGEM = '18532-044';

// --- CONFIGURAÇÃO DA OPENAI ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

if (!OPENAI_API_KEY || !ASSISTANT_ID) {
    console.error("[ERRO CRÍTICO] Chaves OPENAI_API_KEY e ASSISTANT_ID devem ser configuradas nas variáveis de ambiente.");
}
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTAS DE UTILIDADES ---
app.get('/backend_cajuia.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'backend_cajuia.json'));
});

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

// --- ROTA DE PAGAMENTO (PAGAR.ME) ---
app.post('/criar-link-pagarme', async (req, res) => {
  console.log("========== NOVA REQUISIÇÃO /criar-link-pagarme ==========");
  console.log("[REQUEST] Body recebido:", JSON.stringify(req.body, null, 2));

  const { cliente, itens, valor_frete } = req.body;

  if (!cliente || !itens || !itens.length) {
    return res.status(400).json({ error: { message: "Dados do cliente ou itens ausentes." } });
  }
  if (valor_frete === undefined || valor_frete === null || valor_frete < 0) {
      return res.status(400).json({ error: { message: "Valor do frete ausente ou inválido." } });
  }
  if (!cliente.logradouro || !cliente.numero || !cliente.bairro || !cliente.cidade || !cliente.uf || !cliente.cep) {
    return res.status(400).json({ error: { message: "Endereço do cliente incompleto." } });
  }
  if (!cliente.cnpj) {
      return res.status(400).json({ error: { message: "CPF/CNPJ do cliente é obrigatório." } });
  }

  const documentoLimpo = cliente.cnpj.replace(/\D/g, '');
  
  const payload = {
    customer: {
      name: cliente.nome,
      email: cliente.email,
      document: documentoLimpo,
      document_type: documentoLimpo.length === 11 ? 'CPF' : 'CNPJ',
      type: 'individual',
      phones: {
        mobile_phone: {
          country_code: "55",
          area_code: cliente.telefone.replace(/\D/g, '').substring(0, 2),
          number: cliente.telefone.replace(/\D/g, '').substring(2)
        }
      },
      address: {
        line_1: `${cliente.logradouro}, ${cliente.numero}`,
        line_2: cliente.bairro,
        zip_code: cliente.cep.replace(/\D/g, ''),
        city: cliente.cidade,
        state: cliente.uf,
        country: "BR"
      }
    },
    items: itens.map(item => ({
      description: item.nome,
      amount: Math.round(item.preco * 100),
      quantity: item.quantidade
    })),
    
    shipping: {
        amount: Math.round(valor_frete * 100),
        description: "Custo de Envio",
        recipient_name: cliente.nome,
        recipient_phone: cliente.telefone,
        address: { 
            line_1: `${cliente.logradouro}, ${cliente.numero}`,
            line_2: cliente.bairro,
            zip_code: cliente.cep.replace(/\D/g, ''),
            city: cliente.cidade,
            state: cliente.uf,
            country: "BR"
        }
    },
    payments: [{
      payment_method: "checkout",
      checkout: {
        expires_in: 3600,
        accepted_payment_methods: ["credit_card", "pix"],
        success_url: "https://www.google.com/search?q=Pagamento+realizado+com+sucesso",
        pix: { expires_in: 86400 }
      }
    }]
  };

  console.log("[PAYLOAD] Enviado para Pagar.me:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch('https://api.pagar.me/core/v5/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${PAGARME_API_KEY}:`).toString('base64')}`
      },
      body: JSON.stringify(payload)
    });

    const responseBody = await response.json();
    console.log("[HTTP] Status da resposta Pagar.me:", response.status);
    console.log("[RESPONSE] Corpo da resposta Pagar.me:", JSON.stringify(responseBody, null, 2));

    if (response.ok && responseBody.checkouts && responseBody.checkouts.length > 0) {
      const checkoutUrl = responseBody.checkouts[0].payment_url;
      console.log("[SUCESSO] Link de checkout gerado:", checkoutUrl);
      res.json({ url: checkoutUrl });
    } else {
      console.error("[ERRO] Falha ao criar pedido:", responseBody.message || responseBody.error || responseBody);
      res.status(response.status).json({ error: responseBody, payload });
    }
  } catch (err) {
    console.error("[ERRO] Erro inesperado ao conectar com Pagar.me:", err);
    res.status(500).json({ error: 'Erro de conexão com o gateway de pagamento.' });
  }
});

// --- ROTA DE CÁLCULO DE FRETE (MELHOR ENVIO) ---
app.post('/calcular-frete', async (req, res) => {
    const { cepDestino, itens } = req.body;
    if (!cepDestino) {
        return res.status(400).json({ error: 'CEP de destino não informado.' });
    }
    if (!Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ error: 'Itens não informados.' });
    }

    const item = itens[0] || {};
    const payload = {
        from: { postal_code: CEP_ORIGEM },
        to: { postal_code: cepDestino.replace(/\D/g, '') },
        products: [{
            width: item.largura || 15,
            height: item.altura || 10,
            length: item.comprimento || 20,
            weight: item.peso || 0.5,
            quantity: item.quantity || 1,
            insurance_value: item.valor || item.preco || 0
        }],
        services: "1,2,3,4",
        options: { receipt: false, own_hand: false, collect: false }
    };

    console.log("[FRETE] Payload enviado para MelhorEnvio:", payload);

    try {
        const response = await axios.post(
            'https://www.melhorenvio.com.br/api/v2/me/shipment/calculate',
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${MELHORENVIO_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Cajuia App (cajuiabrasil3@gmail.com)'
                }
            }
        );
        console.log("[FRETE] Resposta do MelhorEnvio:", response.data);
        res.json(response.data.filter(option => !option.error));
    } catch (err) {
        console.error("[ERRO] Falha ao consultar MelhorEnvio:", err.response?.data || err.message);
        res.status(500).json({ error: 'Erro ao calcular frete via MelhorEnvio.', details: err.response?.data || err.message });
    }
});

// --- NOVA ROTA PARA O ASSISTENTE DE IA ---
app.post('/ask-ia', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Nenhuma mensagem fornecida.' });
    }

    try {
        const thread = await openai.beta.threads.create();

        await openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: message,
        });

        const run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: ASSISTANT_ID,
        });

        let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        while (runStatus.status !== "completed") {
            await new Promise((resolve) => setTimeout(resolve, 300));
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

            if (["failed", "cancelled", "expired"].includes(runStatus.status)) {
                throw new Error(`A execução falhou com o status: ${runStatus.status}`);
            }
        }

        const messages = await openai.beta.threads.messages.list(thread.id);
        const aiResponse = messages.data.find(msg => msg.role === 'assistant');

        if (aiResponse && aiResponse.content[0].type === 'text') {
            res.json({ reply: aiResponse.content[0].text.value });
        } else {
            throw new Error("O assistente não forneceu uma resposta em texto.");
        }

    } catch (error) {
        console.error("[ERRO NA ROTA DA IA]", error);
        res.status(500).json({ error: "Ocorreu um erro ao comunicar com o assistente." });
    }
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, () => {
  console.log("==========================================================");
  console.log(`[INFO] Servidor Cajuia rodando na porta ${PORT}`);
  console.log(`[INFO] Data/Hora: ${new Date().toLocaleString('pt-BR')}`);
  console.log("==========================================================");
});
