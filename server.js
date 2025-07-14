const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const fetch = require('node-fetch');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CREDENCIAIS E CHAVES DE API ---
const PAGARME_API_KEY = 'sk_87e497b912294b16bf6a5f372744ffef';
const MELHORENVIO_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiNGVlYmIzYzk0OTE0M2Q0MTA4OTk4M2IyMTE4MzY1YzhhYWM2MzlmZjY0NWUyMDlkZTlmNDc5YWM4YjMwMDg2ZWJhM2YxMjExYjdkN2FjOGMiLCJpYXQiOjE3NTI0OTE2OTMuNDcyNjMxLCJuYmYiOjE3NTI0OTE2OTMuNDcyNjMzLCJleHAiOjE3ODQwMjc2OTMuNDYxOTQ1LCJzdWIiOiI5ZjVkOWE0Yi04NzYxLTQwOGYtOTQzMS03MDI5YTFlZGI5MWQiLCJzY29wZXMiOlsiY2FydC1yZWFkIiwiY2FydC13cml0ZSIsImNvbXBhbmllcy1yZWFkIiwiY29tcGFuaWVzLXdyaXRlIiwiY291cG9ucy1yZWFkIiwiY291cG9ucy13cml0ZSIsIm5vdGlmaWNhdGlvbnMtcmVhZCIsIm9yZGVycy1yZWFkIiwicHJvZHVjdHMtcmVhZCIsInByb2R1Y3RzLWRlc3Ryb3kiLCJwcm9kdWN0cy13cml0ZSIsInB1cmNoYXNlcy1yZWFkIiwic2hpcHBpbmctY2FsY3VsYXRlIiwic2hpcHBpbmctY2FuY2VsIiwic2hpcHBpbmctY2hlY2tvdXQiLCJzaGlwcGluZy1jb21wYW5pZXMiLCJzaGlwcGluZy1nZW5lcmF0ZSIsInNoaXBwaW5nLXByZXZpZXciLCJzaGlwcGluZy1wcmludCIsInNoaXBwaW5nLXNoYXJlIiwic2hpcHBpbmctdHJhY2tpbmciLCJlY29tbWVyY2Utc2hpcHBpbmciLCJ0cmFuc2FjdGlvbnMtcmVhZCIsInVzZXJzLXJlYWQiLCJ1c2Vycy13cml0ZSIsIndlYmhvb2tzLXJlYWQiLCJ3ZWJob29rcy13cml0ZSIsIndlYmhvb2tzLWRlbGV0ZSIsInRkZWFsZXItd2ViaG9vayJdfQ.dR-J9Op1CiqYO1wnZyqK6QLbsb1URLoe7CqTYECbaMyZR1mxghY6DMGnAfl0z_JUkIbHNHw8b0AUqceMtcH9u50WnexA_4AZ8K5x-l0nUERg3fhUTQQhrlwMAIFgcgJfD0rBEed_wEplQw-yR-xozIaf7WP9vFHE-Tn7JwmItQYay55ICGiW-AVGRKnBfvTWdeVlar6BGpuSKDeLKuVY9P631dDV-UUNrtZBCIpzP_JkDw0U6pgBYmkvf3Io1qYpc4TwMPyQDg0KGiaJupL4RMXhM1X7NuJDIr-G-CkUd55kH_a4GBCO1MG2ezbBQO0KId31YOw6GAIr2eYw1fojpusjUDXVNHJxuB94PEgh6oEhhBudPuJ5Teucblhj6bNCH1ufkLcPWGriFlCBCil-iAN5rll_Dr06ug-JgnfbWS-MoYR4ctz79zvDBDnqKN3EBLEUcUWpduGOwX9vyvxqbiD8AjdQrC4p5gn2wOjHePnNLdcfLU7Mp49SuIbcjduytDnbK38yN3PL9-lvanSr80psaL2rZAicye84m6TdJdzW0PUu-6_xUiwcVPy52xrQ_A4XJ-izD-opqnvOWhtMPStVMEqC7b55C-OJ7PfYBouxFSiFBrRruRc9DJzWYnrxUOOizswTxs91s5OF-1r7rSMVRgLzxdaXOdsRVHivPDQ';
const CEP_ORIGEM = '18532-044';

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

  // Recebe todos os dados do corpo da requisição
  const { cliente, itens, valor_frete } = req.body;

  // --- VALIDAÇÃO DOS DADOS RECEBIDOS ---
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
    
    // Objeto de frete adicionado ao pedido
    shipping: {
        amount: Math.round(valor_frete * 100), // Convertendo o frete para centavos
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

// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, () => {
  console.log("==========================================================");
  console.log(`[INFO] Servidor Cajuia rodando em http://localhost:${PORT}`);
  console.log(`[INFO] Data/Hora: ${new Date().toLocaleString('pt-BR')}`);
  console.log("==========================================================");
});
