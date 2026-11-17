import Anthropic from '@anthropic-ai/sdk';
import catalog from '../config/products.json' assert { type: 'json' };
import { restaurant } from '../config/restaurant.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres el asistente virtual de ${restaurant.name}, un restaurante colombiano.
Tu rol es ayudar a los clientes con:
- Información del menú y precios
- Tomar pedidos paso a paso
- Responder preguntas frecuentes
- Identificar productos en imágenes

Reglas:
- Habla siempre en español, de forma amigable y concisa
- Los precios están en COP (pesos colombianos)
- Si no entiendes algo dos veces seguidas, ofrece conectar con un agente humano
- Nunca inventes productos que no están en el menú
- Cuando identifiques una intención, responde SOLO con un JSON siguiendo el formato indicado

Formato de respuesta para clasificación de intención:
{
  "intent": "greeting|menu|order|order_status|faq_hours|faq_address|faq_payment|human|unknown",
  "confidence": 0.0-1.0,
  "extracted": { ...datos relevantes... },
  "reply": "texto de respuesta al cliente"
}`;

export async function detectIntent(text, sessionContext = {}) {
  const catalogSummary = catalog.products
    .filter(p => p.available)
    .map(p => `${p.id}: ${p.name} - $${p.price.toLocaleString('es-CO')}`)
    .join('\n');

  const prompt = `Menú disponible:\n${catalogSummary}\n\nContexto de sesión: ${JSON.stringify(sessionContext)}\n\nMensaje del cliente: "${text}"\n\nResponde SOLO con el JSON de intención.`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    const raw = msg.content[0].text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    return { intent: 'unknown', confidence: 0, reply: text, extracted: {} };
  }
}

export async function analyzeProductImage(base64Image, mediaType = 'image/jpeg') {
  const catalogText = catalog.products
    .filter(p => p.available)
    .map(p => `- ${p.name} (${p.id}): ${p.description}`)
    .join('\n');

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Image },
          },
          {
            type: 'text',
            text: `Analiza esta imagen y determina si corresponde a alguno de estos productos del menú:\n${catalogText}\n\nResponde SOLO con JSON:\n{"found": true/false, "product_id": "id o null", "product_name": "nombre o null", "confidence": 0.0-1.0, "description": "descripción breve de lo que ves"}`,
          },
        ],
      },
    ],
  });

  try {
    const raw = msg.content[0].text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    return { found: false, product_id: null, product_name: null, confidence: 0, description: 'No pude analizar la imagen' };
  }
}

export async function generateFreeReply(userMessage, context = '') {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: `${SYSTEM_PROMPT}\n\nContexto adicional: ${context}`,
    messages: [{ role: 'user', content: userMessage }],
  });
  return msg.content[0].text.trim();
}
