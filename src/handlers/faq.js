import { restaurant } from '../config/restaurant.js';

export function getFaqAnswer(intent) {
  switch (intent) {
    case 'faq_hours':
      return `🕐 *Horarios de atención:*\n${restaurant.hours}\n\nSi tienes dudas puedes llamarnos al ${restaurant.phone}`;

    case 'faq_address':
      return `📍 *Nuestra ubicación:*\n${restaurant.address}\n\nPuedes llamarnos al ${restaurant.phone} para más detalles o indicaciones.`;

    case 'faq_payment':
      return `💳 *Métodos de pago disponibles:*\n• 💵 Efectivo (al recibir)\n• 📱 Nequi / Daviplata (transferencia)\n• 💳 Tarjeta débito/crédito (al recibir)\n\nPara pagos digitales te enviamos el número de cuenta al confirmar el pedido.`;

    case 'faq_delivery':
      return `🛵 *Información de domicilios:*\n• Tiempo estimado: 30-45 minutos\n• Cobertura: Consulta con nosotros por tu zona\n• Costo de envío: ${restaurant.deliveryFee || 'desde $3.000'}\n\nHaz tu pedido y te confirmamos disponibilidad.`;

    default:
      return null;
  }
}

export function getWelcomeMessage(name) {
  const greeting = name ? `¡Hola, ${name.split(' ')[0]}! 😊` : '¡Hola! 😊';
  return `${greeting} Bienvenido a *${restaurant.name}*\n\nSoy tu asistente virtual. ¿En qué puedo ayudarte?\n\n1️⃣ Ver el menú\n2️⃣ Hacer un pedido\n3️⃣ Estado de un pedido\n4️⃣ Horarios y dirección\n5️⃣ Hablar con un agente\n\nEscribe el número o dime qué necesitas 👇`;
}

export function getUnknownReply(attempts) {
  if (attempts >= 2) {
    return {
      reply: `Parece que no entendí bien. ¿Te conecto con un agente humano para ayudarte mejor?\n\nEscribe *sí* o *agente* para hacerlo, o /menu para ver nuestras opciones.`,
      suggestHandoff: true,
    };
  }
  return {
    reply: `No entendí bien tu mensaje 😅 Puedes:\n• Ver el *menú* escribiendo /menu\n• Hacer un *pedido*\n• Preguntar por horarios, dirección o pagos\n\n¿En qué te ayudo?`,
    suggestHandoff: false,
  };
}
