import { getProductById, searchProduct, formatProductCard } from './menu.js';
import { createOrder, getOrder, getCustomerOrders, updateSession, resetSession } from '../db/database.js';
import { formatPrice, STATUS_LABELS, restaurant } from '../config/restaurant.js';

// Retorna el siguiente mensaje del flujo de pedido según el estado de la sesión
export async function handleOrderFlow(session, input, customerId) {
  const ctx = session.context || {};

  switch (session.state) {

    case 'ordering': {
      // El usuario ha indicado qué quiere pedir — buscar el producto
      const found = searchProduct(input);
      if (!found.length) {
        return {
          reply: `😕 No encontré ese producto en el menú. Puedes:\n• Escribir el nombre exacto\n• Ver el *menú completo* con /menu\n• Enviar una foto del plato`,
          newState: 'ordering',
          newContext: ctx,
        };
      }
      if (found.length === 1) {
        ctx.currentProduct = found[0];
        return {
          reply: formatProductCard(found[0]),
          newState: 'awaiting_product_confirm',
          newContext: ctx,
        };
      }
      // Múltiples resultados
      const list = found.slice(0, 5).map((p, i) => `${i + 1}. *${p.name}* — ${formatPrice(p.price)}`).join('\n');
      ctx.searchResults = found.slice(0, 5);
      return {
        reply: `Encontré varias opciones:\n${list}\n\nEscribe el número del que quieres.`,
        newState: 'awaiting_product_selection',
        newContext: ctx,
      };
    }

    case 'awaiting_product_selection': {
      const num = parseInt(input.trim());
      const results = ctx.searchResults || [];
      if (isNaN(num) || num < 1 || num > results.length) {
        return {
          reply: `Por favor escribe el número del producto (1 al ${results.length}).`,
          newState: 'awaiting_product_selection',
          newContext: ctx,
        };
      }
      ctx.currentProduct = results[num - 1];
      return {
        reply: formatProductCard(ctx.currentProduct),
        newState: 'awaiting_product_confirm',
        newContext: ctx,
      };
    }

    case 'awaiting_product_confirm': {
      const yes = /^(s[íi]|yes|ok|dale|claro|perfecto|listo|1|quiero|agregar)/i.test(input);
      const no = /^(no|cancel|otro|diferente)/i.test(input);
      if (yes) {
        ctx.cart = ctx.cart || [];
        // Pedir cantidad
        return {
          reply: `¿Cuántas unidades de *${ctx.currentProduct.name}* quieres? (escribe solo el número)`,
          newState: 'awaiting_quantity',
          newContext: ctx,
        };
      }
      if (no) {
        return {
          reply: `Sin problema. ¿Qué más te gustaría pedir? Puedes buscar un plato o ver el /menu`,
          newState: 'ordering',
          newContext: ctx,
        };
      }
      return {
        reply: `Responde *sí* para agregar o *no* para buscar otro plato.`,
        newState: 'awaiting_product_confirm',
        newContext: ctx,
      };
    }

    case 'awaiting_quantity': {
      const qty = parseInt(input.trim());
      if (isNaN(qty) || qty < 1 || qty > 20) {
        return {
          reply: 'Ingresa una cantidad válida (entre 1 y 20).',
          newState: 'awaiting_quantity',
          newContext: ctx,
        };
      }
      ctx.cart = ctx.cart || [];
      const existing = ctx.cart.find(i => i.product_id === ctx.currentProduct.id);
      if (existing) {
        existing.qty += qty;
      } else {
        ctx.cart.push({ product_id: ctx.currentProduct.id, name: ctx.currentProduct.name, qty, price: ctx.currentProduct.price });
      }
      const subtotal = ctx.cart.reduce((s, i) => s + i.price * i.qty, 0);
      const cartLines = ctx.cart.map(i => `• ${i.name} x${i.qty} = ${formatPrice(i.price * i.qty)}`).join('\n');

      return {
        reply: `✅ Agregado!\n\n🛒 *Tu pedido:*\n${cartLines}\n\n💰 Subtotal: *${formatPrice(subtotal)}*\n\n¿Deseas agregar algo más? Escribe *confirmar pedido* cuando estés listo, o sigue buscando platos.`,
        newState: 'ordering',
        newContext: ctx,
      };
    }

    case 'awaiting_address': {
      if (input.length < 10) {
        return {
          reply: 'Por favor escribe una dirección de entrega completa (calle, número, barrio).',
          newState: 'awaiting_address',
          newContext: ctx,
        };
      }
      ctx.address = input;
      return {
        reply: `📍 Dirección: *${input}*\n\n¿Cómo vas a pagar?\n1️⃣ Efectivo\n2️⃣ Transferencia/Nequi/Daviplata\n3️⃣ Tarjeta (pago al entregar)`,
        newState: 'awaiting_payment',
        newContext: ctx,
      };
    }

    case 'awaiting_payment': {
      let paymentMethod;
      if (/^(1|efectivo|cash)/i.test(input)) paymentMethod = 'cash';
      else if (/^(2|transfer|nequi|daviplata|digital)/i.test(input)) paymentMethod = 'transfer';
      else if (/^(3|tarjeta|card|cr[eé]dito|d[eé]bito)/i.test(input)) paymentMethod = 'card';
      else {
        return {
          reply: 'Por favor elige una opción de pago:\n1️⃣ Efectivo\n2️⃣ Transferencia/Nequi\n3️⃣ Tarjeta',
          newState: 'awaiting_payment',
          newContext: ctx,
        };
      }
      ctx.paymentMethod = paymentMethod;
      const payLabels = { cash: '💵 Efectivo', transfer: '📱 Transferencia/Nequi', card: '💳 Tarjeta' };
      const total = ctx.cart.reduce((s, i) => s + i.price * i.qty, 0);
      const cartLines = ctx.cart.map(i => `• ${i.name} x${i.qty} — ${formatPrice(i.price * i.qty)}`).join('\n');

      return {
        reply: `📋 *Resumen del pedido:*\n\n${cartLines}\n\n📍 Dirección: ${ctx.address}\n💳 Pago: ${payLabels[paymentMethod]}\n💰 *Total: ${formatPrice(total)}*\n\n¿Confirmas el pedido? Escribe *sí* para confirmar o *no* para cancelar.`,
        newState: 'awaiting_confirm',
        newContext: ctx,
      };
    }

    case 'awaiting_confirm': {
      if (/^(s[íi]|yes|confirmar|ok|dale|listo)/i.test(input)) {
        const orderNumber = createOrder(
          customerId,
          ctx.cart,
          ctx.address,
          ctx.paymentMethod,
          ctx.notes
        );
        resetSession(customerId);
        const total = ctx.cart.reduce((s, i) => s + i.price * i.qty, 0);
        return {
          reply: `🎉 *¡Pedido confirmado!*\n\n🔖 Tu número de pedido: *${orderNumber}*\n💰 Total: ${formatPrice(total)}\n\nPuedes consultar el estado escribiendo:\n_"estado de mi pedido ${orderNumber}"_\n\n⏱️ Tiempo estimado de entrega: 30-45 minutos\n\n¡Gracias por elegir ${restaurant.name}! 😊`,
          newState: 'idle',
          newContext: {},
          orderNumber,
        };
      }
      if (/^(no|cancelar|cancel)/i.test(input)) {
        resetSession(customerId);
        return {
          reply: `Pedido cancelado. ¿En qué más te puedo ayudar? Escribe /menu para ver el menú.`,
          newState: 'idle',
          newContext: {},
        };
      }
      return {
        reply: 'Responde *sí* para confirmar o *no* para cancelar.',
        newState: 'awaiting_confirm',
        newContext: ctx,
      };
    }

    default:
      return null;
  }
}

export function startOrderFlow(cart = []) {
  return {
    reply: `¿Qué te gustaría pedir? Puedes:\n• Escribir el nombre del plato\n• Enviar una foto\n• Escribir /menu para ver todas las opciones`,
    newState: 'ordering',
    newContext: { cart },
  };
}

export function initiateCheckout(cart) {
  if (!cart || !cart.length) {
    return { reply: 'Tu carrito está vacío. ¿Qué plato quieres pedir?', newState: 'ordering', newContext: {} };
  }
  return {
    reply: `📍 Para continuar, ¿cuál es tu dirección de entrega?`,
    newState: 'awaiting_address',
    newContext: { cart },
  };
}

export function formatOrderStatus(order) {
  const items = order.items.map(i => `• ${i.name} x${i.qty}`).join('\n');
  return [
    `📦 *Pedido ${order.order_number}*`,
    `Estado: ${STATUS_LABELS[order.status] || order.status}`,
    ``,
    `🛒 Items:\n${items}`,
    `💰 Total: ${formatPrice(order.total)}`,
    `📍 Dirección: ${order.address || 'N/A'}`,
    `📅 Fecha: ${new Date(order.created_at).toLocaleString('es-CO')}`,
  ].join('\n');
}
