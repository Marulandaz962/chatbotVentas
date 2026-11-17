import { Telegraf, Markup } from 'telegraf';
import { processMessage } from './router.js';
import { getCategoryButtons, getCategoryMenu, getFullMenu } from '../handlers/menu.js';
import { restaurant } from '../config/restaurant.js';

let bot = null;

export function createTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN no configurado en .env');

  bot = new Telegraf(token);

  // ---- Comandos ----

  bot.start(async (ctx) => {
    const name = ctx.from.first_name;
    const response = await processMessage({
      platform: 'telegram',
      platformId: String(ctx.chat.id),
      name,
      command: '/start',
    });
    await ctx.replyWithMarkdown(response.reply, buildMainKeyboard());
  });

  bot.command('menu', async (ctx) => {
    await ctx.replyWithMarkdown('¿Qué categoría quieres ver?', buildCategoryKeyboard());
  });

  bot.command('pedido', async (ctx) => {
    const response = await processMessage({
      platform: 'telegram',
      platformId: String(ctx.chat.id),
      name: ctx.from.first_name,
      command: '/pedido',
    });
    await ctx.replyWithMarkdown(response.reply);
  });

  bot.command('estado', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1).join(' ');
    const response = await processMessage({
      platform: 'telegram',
      platformId: String(ctx.chat.id),
      name: ctx.from.first_name,
      command: args ? `/estado ${args}` : '/estado',
    });
    await ctx.replyWithMarkdown(response.reply);
  });

  bot.command('agente', async (ctx) => {
    const response = await processMessage({
      platform: 'telegram',
      platformId: String(ctx.chat.id),
      name: ctx.from.first_name,
      command: '/agente',
    });
    await ctx.replyWithMarkdown(response.reply);
    if (response.agentNotification) await notifyAgent(response.agentNotification);
  });

  bot.command('cancelar', async (ctx) => {
    const response = await processMessage({
      platform: 'telegram',
      platformId: String(ctx.chat.id),
      name: ctx.from.first_name,
      command: '/cancelar',
    });
    await ctx.replyWithMarkdown(response.reply, buildMainKeyboard());
  });

  // ---- Callback de botones de categoría ----
  bot.action(/^cat_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const categoryId = ctx.match[1];
    const menu = getCategoryMenu(categoryId);
    if (menu) {
      await ctx.replyWithMarkdown(menu, Markup.inlineKeyboard([
        [Markup.button.callback('🛒 Hacer pedido de esta categoría', `order_cat_${categoryId}`)],
        [Markup.button.callback('🔙 Ver todas las categorías', 'show_categories')],
      ]));
    }
  });

  bot.action('show_categories', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown('¿Qué categoría quieres ver?', buildCategoryKeyboard());
  });

  bot.action(/^order_cat_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const response = await processMessage({
      platform: 'telegram',
      platformId: String(ctx.chat.id),
      name: ctx.from.first_name,
      command: '/pedido',
    });
    await ctx.replyWithMarkdown(response.reply);
  });

  // ---- Imágenes ----
  bot.on('photo', async (ctx) => {
    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1]; // mayor resolución
      const fileLink = await ctx.telegram.getFileLink(photo.file_id);
      const resp = await fetch(fileLink.href);
      const buffer = await resp.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      const response = await processMessage({
        platform: 'telegram',
        platformId: String(ctx.chat.id),
        name: ctx.from.first_name,
        image: { base64, mediaType: 'image/jpeg' },
      });

      await ctx.replyWithMarkdown(response.reply);
    } catch (err) {
      console.error('[Telegram] Error procesando imagen:', err);
      await ctx.reply('No pude procesar la imagen. Por favor intenta de nuevo.');
    }
  });

  // ---- Texto libre ----
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return; // comandos ya manejados

    try {
      const response = await processMessage({
        platform: 'telegram',
        platformId: String(ctx.chat.id),
        name: ctx.from.first_name,
        text,
      });

      await ctx.replyWithMarkdown(response.reply);
      if (response.agentNotification) await notifyAgent(response.agentNotification);
    } catch (err) {
      console.error('[Telegram] Error procesando texto:', err);
      await ctx.reply('⚠️ Error procesando tu mensaje. Intenta de nuevo.');
    }
  });

  bot.catch((err, ctx) => {
    console.error('[Telegram] Error global:', err);
  });

  return bot;
}

function buildMainKeyboard() {
  return Markup.keyboard([
    ['📋 Ver Menú', '🛒 Hacer Pedido'],
    ['📦 Estado de Pedido', '🕐 Horarios'],
    ['👤 Hablar con agente'],
  ]).resize();
}

function buildCategoryKeyboard() {
  const buttons = getCategoryButtons();
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2).map(b => Markup.button.callback(b.text, b.callback)));
  }
  return Markup.inlineKeyboard(rows);
}

async function notifyAgent(message) {
  const agentToken = process.env.HUMAN_AGENT_TELEGRAM;
  if (!agentToken || !bot) return;
  // Si empieza con @, buscar por username no es posible directamente con Telegraf
  // Debe ser un chat_id numérico o un canal
  const chatId = agentToken.replace('@', '');
  try {
    await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch {
    console.warn('[Telegram] No se pudo notificar al agente:', agentToken);
  }
}

export function getTelegramBot() {
  return bot;
}

// Responder mensajes de teclado principal (Reply Keyboard)
export function setupKeyboardHandlers(botInstance) {
  botInstance.hears('📋 Ver Menú', async (ctx) => {
    await ctx.replyWithMarkdown('¿Qué categoría quieres ver?', buildCategoryKeyboard());
  });
  botInstance.hears('🛒 Hacer Pedido', async (ctx) => {
    const response = await processMessage({
      platform: 'telegram',
      platformId: String(ctx.chat.id),
      name: ctx.from.first_name,
      command: '/pedido',
    });
    await ctx.replyWithMarkdown(response.reply);
  });
  botInstance.hears('📦 Estado de Pedido', async (ctx) => {
    const response = await processMessage({
      platform: 'telegram',
      platformId: String(ctx.chat.id),
      name: ctx.from.first_name,
      command: '/estado',
    });
    await ctx.replyWithMarkdown(response.reply);
  });
  botInstance.hears('🕐 Horarios', async (ctx) => {
    const response = await processMessage({
      platform: 'telegram',
      platformId: String(ctx.chat.id),
      name: ctx.from.first_name,
      text: 'horarios',
    });
    await ctx.replyWithMarkdown(response.reply);
  });
  botInstance.hears('👤 Hablar con agente', async (ctx) => {
    const response = await processMessage({
      platform: 'telegram',
      platformId: String(ctx.chat.id),
      name: ctx.from.first_name,
      command: '/agente',
    });
    await ctx.replyWithMarkdown(response.reply);
    if (response.agentNotification) await notifyAgent(response.agentNotification);
  });
}
