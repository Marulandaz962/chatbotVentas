import { restaurant } from '../config/restaurant.js';
import { getRecentMessages } from '../db/database.js';

export async function initiateHandoff(customerId, platform, platformId, customerName) {
  const recent = getRecentMessages(customerId, 10);
  const history = recent.map(m => `${m.direction === 'in' ? '👤' : '🤖'} ${m.content}`).join('\n');

  const agentMessage = [
    `🔔 *Cliente necesita atención humana*`,
    ``,
    `👤 Cliente: ${customerName || 'Desconocido'}`,
    `📱 Plataforma: ${platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'}`,
    `🆔 ID: ${platformId}`,
    ``,
    `📝 *Últimos mensajes:*`,
    history,
  ].join('\n');

  return {
    clientReply: `🤝 Te conectaré con un agente humano.\n\nMientras tanto puedes contactarnos directamente:\n📞 ${restaurant.phone}\n\nUn agente te responderá en breve. ¡Gracias por tu paciencia!`,
    agentNotification: agentMessage,
  };
}
