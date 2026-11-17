import { detectIntent } from '../ai/claude.js';
import { handleImageMessage } from '../handlers/vision.js';
import { getFullMenu, getCategoryMenu, getMenuSummary } from '../handlers/menu.js';
import { handleOrderFlow, startOrderFlow, initiateCheckout, formatOrderStatus } from '../handlers/order.js';
import { getFaqAnswer, getWelcomeMessage, getUnknownReply } from '../handlers/faq.js';
import { initiateHandoff } from '../handlers/handoff.js';
import {
  upsertCustomer, getSession, updateSession, incrementFailedAttempts,
  resetSession, saveMessage, getOrder, getCustomerOrders
} from '../db/database.js';

/**
 * Procesa un mensaje entrante y devuelve la respuesta.
 * Funciona igual para WhatsApp y Telegram.
 *
 * @param {object} msg
 * @param {string} msg.platform     - 'whatsapp' | 'telegram'
 * @param {string} msg.platformId   - ID único del chat en la plataforma
 * @param {string} msg.name         - Nombre del contacto (puede ser null)
 * @param {string} [msg.text]       - Texto del mensaje
 * @param {object} [msg.image]      - { base64, mediaType } si es imagen
 * @param {string} [msg.command]    - Comando /menu, /pedido, etc.
 * @returns {Promise<{reply: string, newState?: string, newContext?: object}>}
 */
export async function processMessage(msg) {
  const { platform, platformId, name, text, image, command } = msg;

  // Registrar/actualizar cliente
  const customerId = upsertCustomer(platform, platformId, name);
  const session = getSession(customerId);

  // Guardar mensaje entrante
  saveMessage(customerId, 'in', text || '[imagen]', image ? 'image' : 'text');

  let response;

  try {
    // ---- Comandos directos (/menu, /pedido, /estado) ----
    if (command || (text && text.startsWith('/'))) {
      response = await handleCommand(command || text, customerId, session, platform, platformId, name);
    }

    // ---- Imagen ----
    else if (image) {
      const visionResult = await handleImageMessage(image.base64, image.mediaType, session);
      if (visionResult.newState) {
        updateSession(customerId, visionResult.newState, visionResult.newContext, 'vision');
      }
      response = { reply: visionResult.reply };
    }

    // ---- Flujos de pedido activos ----
    else if (isInOrderFlow(session.state) && text) {
      // Detectar si el usuario quiere cancelar o confirmar el pedido
      if (/confirmar pedido|finalizar|checkout/i.test(text) && session.state === 'ordering') {
        const cart = session.context?.cart || [];
        const checkoutResult = initiateCheckout(cart);
        updateSession(customerId, checkoutResult.newState, checkoutResult.newContext, 'checkout');
        response = { reply: checkoutResult.reply };
      } else {
        const flowResult = await handleOrderFlow(session, text, customerId);
        if (flowResult) {
          updateSession(customerId, flowResult.newState, flowResult.newContext, 'order_flow');
          response = { reply: flowResult.reply };
        } else {
          response = await handleFreeText(text, customerId, session, platform, platformId, name);
        }
      }
    }

    // ---- Texto libre ----
    else if (text) {
      response = await handleFreeText(text, customerId, session, platform, platformId, name);
    }

    else {
      response = { reply: 'No pude procesar tu mensaje. Intenta con texto o una imagen.' };
    }
  } catch (err) {
    console.error('[Router Error]', err);
    response = { reply: '⚠️ Tuve un problema procesando tu mensaje. Por favor intenta de nuevo.' };
  }

  // Guardar respuesta saliente
  saveMessage(customerId, 'out', response.reply, 'text');

  return response;
}

function isInOrderFlow(state) {
  return ['ordering', 'awaiting_product_confirm', 'awaiting_product_selection',
    'awaiting_quantity', 'awaiting_address', 'awaiting_payment', 'awaiting_confirm'].includes(state);
}

async function handleCommand(cmd, customerId, session, platform, platformId, name) {
  const normalized = cmd.toLowerCase().replace('/', '').trim();

  if (normalized === 'menu' || normalized === 'carta') {
    resetSession(customerId);
    return { reply: getFullMenu() };
  }

  if (normalized === 'pedido' || normalized === 'pedir' || normalized === 'ordenar') {
    const start = startOrderFlow(session.context?.cart || []);
    updateSession(customerId, start.newState, start.newContext, 'start_order');
    return { reply: start.reply };
  }

  if (normalized.startsWith('estado')) {
    const parts = normalized.split(/\s+/);
    const orderNum = parts.find(p => p.startsWith('ord-'))?.toUpperCase();
    if (orderNum) {
      const order = getOrder(orderNum);
      if (!order) return { reply: `No encontré el pedido *${orderNum}*. Verifica el número.` };
      return { reply: formatOrderStatus(order) };
    }
    const orders = getCustomerOrders(customerId);
    if (!orders.length) return { reply: 'No tienes pedidos registrados aún. ¡Haz tu primer pedido con /pedido!' };
    const last = orders[0];
    return { reply: `Tu último pedido:\n\n${formatOrderStatus(last)}` };
  }

  if (normalized === 'agente' || normalized === 'humano' || normalized === 'help') {
    const handoff = await initiateHandoff(customerId, platform, platformId, name);
    return { reply: handoff.clientReply, agentNotification: handoff.agentNotification };
  }

  if (normalized === 'inicio' || normalized === 'start' || normalized === 'hola') {
    resetSession(customerId);
    return { reply: getWelcomeMessage(name) };
  }

  if (normalized === 'cancelar') {
    resetSession(customerId);
    return { reply: '❌ Pedido cancelado. ¿En qué más puedo ayudarte? Escribe /menu para ver nuestras opciones.' };
  }

  return { reply: getWelcomeMessage(name) };
}

async function handleFreeText(text, customerId, session, platform, platformId, name) {
  // Detectar estado del pedido por número
  const orderMatch = text.match(/ORD-\d{8}-\d{3}/i);
  if (orderMatch) {
    const order = getOrder(orderMatch[0].toUpperCase());
    if (order) return { reply: formatOrderStatus(order) };
  }

  // Usar Claude para detectar la intención
  const intentResult = await detectIntent(text, session.context);
  const { intent, confidence, extracted, reply } = intentResult;

  if (intent === 'greeting') {
    resetSession(customerId);
    return { reply: getWelcomeMessage(name) };
  }

  if (intent === 'menu' && confidence > 0.6) {
    resetSession(customerId);
    // Filtrar por categoría si la detectó
    if (extracted?.category) {
      const catMenu = getCategoryMenu(extracted.category);
      if (catMenu) return { reply: catMenu };
    }
    return { reply: getFullMenu() };
  }

  if (intent === 'order' && confidence > 0.6) {
    const start = startOrderFlow(session.context?.cart || []);
    updateSession(customerId, start.newState, { ...start.newContext, initialQuery: extracted?.product }, 'start_order');
    // Si ya detectó el producto, avanzar directamente
    if (extracted?.product) {
      const { handleOrderFlow: flowFn } = await import('../handlers/order.js');
      const flowResult = await flowFn({ ...session, state: 'ordering', context: start.newContext }, extracted.product, customerId);
      if (flowResult) {
        updateSession(customerId, flowResult.newState, flowResult.newContext, 'order_flow');
        return { reply: flowResult.reply };
      }
    }
    return { reply: start.reply };
  }

  if (intent === 'order_status') {
    const orders = getCustomerOrders(customerId);
    if (!orders.length) return { reply: 'No tienes pedidos registrados. ¡Haz tu primer pedido escribiendo /pedido!' };
    const last = orders[0];
    return { reply: formatOrderStatus(last) };
  }

  if (intent?.startsWith('faq_')) {
    const faqReply = getFaqAnswer(intent);
    if (faqReply) return { reply: faqReply };
  }

  if (intent === 'human') {
    const handoff = await initiateHandoff(customerId, platform, platformId, name);
    return { reply: handoff.clientReply, agentNotification: handoff.agentNotification };
  }

  // Intención desconocida
  const attempts = incrementFailedAttempts(customerId);
  const unknown = getUnknownReply(attempts);

  if (unknown.suggestHandoff && /^(s[íi]|yes|agente|ok)/i.test(text)) {
    const handoff = await initiateHandoff(customerId, platform, platformId, name);
    return { reply: handoff.clientReply, agentNotification: handoff.agentNotification };
  }

  return { reply: unknown.reply };
}
