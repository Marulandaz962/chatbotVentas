import 'dotenv/config';
import { createTelegramBot, setupKeyboardHandlers } from './src/bot/telegram.js';
import { createWhatsAppBot } from './src/bot/whatsapp.js';
import { startAdminDashboard } from './src/admin/dashboard.js';

const args = process.argv.slice(2);
const onlyFlag = args.find(a => a.startsWith('--only='))?.replace('--only=', '');
const adminMode = args.includes('--admin');

const enableTelegram = onlyFlag ? onlyFlag === 'telegram' : process.env.ENABLE_TELEGRAM !== 'false';
const enableWhatsApp = onlyFlag ? onlyFlag === 'whatsapp' : process.env.ENABLE_WHATSAPP !== 'false';

console.log('');
console.log('🤖 ============================================');
console.log('   ChatBot de Ventas - Restaurante');
console.log('   Iniciando...');
console.log('===============================================');
console.log('');

if (adminMode) {
  console.log('👑 Modo admin activado\n');
  const { startAdminDashboard } = await import('./src/admin/dashboard.js');

  if (enableWhatsApp) {
    const waBot = createWhatsAppBot();
    await waBot.initialize();
  }
  if (enableTelegram) {
    const tgBot = createTelegramBot();
    setupKeyboardHandlers(tgBot);
    tgBot.launch().catch(err => console.error('[Telegram] Error al lanzar:', err));
  }

  await startAdminDashboard();
  process.exit(0);
}

// ---- Modo normal (bot activo) ----

if (enableTelegram) {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.warn('⚠️  TELEGRAM_BOT_TOKEN no configurado — Telegram desactivado');
    } else {
      const tgBot = createTelegramBot();
      setupKeyboardHandlers(tgBot);

      process.once('SIGINT', () => tgBot.stop('SIGINT'));
      process.once('SIGTERM', () => tgBot.stop('SIGTERM'));

      await tgBot.launch();
      console.log('✅ Telegram: Bot activo');
      console.log(`   Nombre: @${(await tgBot.telegram.getMe()).username}`);
    }
  } catch (err) {
    console.error('❌ Error iniciando Telegram:', err.message);
  }
}

if (enableWhatsApp) {
  try {
    const waBot = createWhatsAppBot();
    await waBot.initialize();
    // El evento 'ready' en whatsapp.js confirma la conexión
  } catch (err) {
    console.error('❌ Error iniciando WhatsApp:', err.message);
  }
}

console.log('');
console.log('💡 Comandos disponibles para clientes:');
console.log('   /menu    — Ver carta completa');
console.log('   /pedido  — Iniciar un pedido');
console.log('   /estado  — Ver estado de pedido');
console.log('   /agente  — Hablar con humano');
console.log('   /cancelar — Cancelar pedido en curso');
console.log('');
console.log('💡 Para el panel de admin: node index.js --admin');
console.log('');
