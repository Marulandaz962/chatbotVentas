import { getPendingOrders, updateOrderStatus } from '../db/database.js';
import { STATUS_LABELS, formatPrice } from '../config/restaurant.js';
import { sendWhatsAppMessage } from '../bot/whatsapp.js';
import { getTelegramBot } from '../bot/telegram.js';
import readline from 'readline';

const STATUS_OPTIONS = ['pending', 'confirmed', 'preparing', 'ready', 'on_delivery', 'delivered', 'cancelled'];

function printOrders() {
  const orders = getPendingOrders();
  console.clear();
  console.log('═══════════════════════════════════════════════════');
  console.log('         PANEL DE ADMIN - PEDIDOS ACTIVOS');
  console.log('═══════════════════════════════════════════════════');

  if (!orders.length) {
    console.log('\n  No hay pedidos activos.\n');
  } else {
    orders.forEach((order, i) => {
      const items = order.items.map(it => `    • ${it.name} x${it.qty}`).join('\n');
      console.log(`\n[${i + 1}] ${order.order_number} — ${order.name || 'Cliente'} (${order.platform})`);
      console.log(`    Estado: ${STATUS_LABELS[order.status]}`);
      console.log(`    Items:\n${items}`);
      console.log(`    Total: ${formatPrice(order.total)}`);
      console.log(`    Dirección: ${order.address || 'N/A'}`);
      console.log(`    Hora: ${new Date(order.created_at).toLocaleTimeString('es-CO')}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('Comandos: [número] para actualizar estado | [r] refrescar | [q] salir');
}

async function notifyCustomer(order, newStatus) {
  const statusMsg = `📦 *Actualización de tu pedido ${order.order_number}*\n\nNuevo estado: ${STATUS_LABELS[newStatus]}\n\n${newStatus === 'on_delivery' ? '🛵 Tu pedido está en camino!' : ''}${newStatus === 'delivered' ? '✅ ¡Pedido entregado! Gracias por elegirnos.' : ''}`;

  try {
    if (order.platform === 'whatsapp') {
      await sendWhatsAppMessage(order.platform_id, statusMsg);
    } else if (order.platform === 'telegram') {
      const tgBot = getTelegramBot();
      if (tgBot) await tgBot.telegram.sendMessage(order.platform_id, statusMsg, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error('No se pudo notificar al cliente:', err.message);
  }
}

export async function startAdminDashboard() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  printOrders();

  rl.on('line', async (input) => {
    const trimmed = input.trim().toLowerCase();

    if (trimmed === 'q') { rl.close(); process.exit(0); }
    if (trimmed === 'r') { printOrders(); return; }

    const idx = parseInt(trimmed) - 1;
    const orders = getPendingOrders();

    if (isNaN(idx) || idx < 0 || idx >= orders.length) {
      console.log('Comando inválido');
      return;
    }

    const order = orders[idx];
    console.log(`\nActualizar pedido ${order.order_number}`);
    console.log('Estado actual:', STATUS_LABELS[order.status]);
    console.log('\nNuevo estado:');
    STATUS_OPTIONS.forEach((s, i) => console.log(`  ${i + 1}. ${STATUS_LABELS[s]}`));

    rl.question('\nElige (número): ', async (ans) => {
      const si = parseInt(ans.trim()) - 1;
      if (isNaN(si) || si < 0 || si >= STATUS_OPTIONS.length) {
        console.log('Opción inválida');
      } else {
        const newStatus = STATUS_OPTIONS[si];
        updateOrderStatus(order.order_number, newStatus);
        await notifyCustomer(order, newStatus);
        console.log(`✅ Estado actualizado a: ${STATUS_LABELS[newStatus]}`);
        setTimeout(printOrders, 1000);
      }
    });
  });
}
