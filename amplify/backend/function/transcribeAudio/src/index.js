// 📁 amplify/backend/function/transcribeAudio/src/index.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Buffer } = require('buffer');

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const audioBase64 = body.audioBase64;
    const fileName = body.fileName || 'audio.webm';

    // Guardar el archivo temporal
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const filePath = path.join(os.tmpdir(), fileName);
    fs.writeFileSync(filePath, audioBuffer);

    // Preparar form-data para OpenAI
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('model', 'whisper-1');
    form.append('language', 'es');

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
    });

    const transcript = response.data.text;

    // Extraer campos del texto
    const extractFields = (text) => {
      const datos = {
        item: '',
        precio_compra: '',
        moneda: '',
        cliente: '',
        transcript: text
      };

      const itemMatch = text.match(/(?:item|producto)[\s,:]+(.+?)[\s,:]+(?:precio|costo|valor)/i);
      if (itemMatch) datos.item = itemMatch[1].trim();

      const precioMatch = text.match(/(?:precio(?: de compra)?|costo|valor)\s*[,:]?\s*\$?\s*(\d+(?:[\.,]\d+)?)(?:\s+)?([a-zA-Z]+)/i);
      if (precioMatch) {
        datos.precio_compra = precioMatch[1].replace(',', '.');
        datos.moneda = precioMatch[2].toLowerCase();
      }

      const clienteMatch = text.match(/para\s+(el cliente\s+)?(.+?)[\.,]?$/i);
      if (clienteMatch) datos.cliente = clienteMatch[2].trim();

      return datos;
    };

    const datosExtraidos = extractFields(transcript);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(datosExtraidos)
    };

  } catch (error) {
    console.error('❌ Error en transcripción Lambda:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: 'Error en la función Lambda' })
    };
  }
};
