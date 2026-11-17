import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { processMessage } from './router.js';

let waClient = null;

export function createWhatsAppBot() {
  waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: process.env.WHATSAPP_SESSION_PATH || './sessions' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });

  waClient.on('qr', (qr) => {
    console.log('\n📱 [WhatsApp] Escanea el QR con tu teléfono:\n');
    qrcode.generate(qr, { small: true });
    console.log('\nAbre WhatsApp → Dispositivos vinculados → Vincular dispositivo\n');
  });

  waClient.on('ready', () => {
    console.log('✅ [WhatsApp] Bot conectado y listo');
  });

  waClient.on('auth_failure', (msg) => {
    console.error('❌ [WhatsApp] Error de autenticación:', msg);
  });

  waClient.on('disconnected', (reason) => {
    console.warn('⚠️ [WhatsApp] Desconectado:', reason);
  });

  waClient.on('message', async (message) => {
    // Ignorar mensajes propios y de grupos
    if (message.fromMe) return;
    if (message.from.includes('@g.us')) return;

    const contact = await message.getContact();
    const platformId = message.from; // ej: "573001234567@c.us"
    const name = contact.pushname || contact.name || null;

    try {
      let msgPayload = {
        platform: 'whatsapp',
        platformId,
        name,
      };

      if (message.hasMedia && message.type === 'image') {
        const media = await message.downloadMedia();
        msgPayload.image = {
          base64: media.data,
          mediaType: media.mimetype,
        };
      } else if (message.body) {
        const body = message.body.trim();
        if (body.startsWith('/')) {
          msgPayload.command = body;
        } else {
          msgPayload.text = body;
        }
      } else {
        return; // tipo no soportado (audio, video, etc.)
      }

      const response = await processMessage(msgPayload);

      // Enviar respuesta con formato WhatsApp (soporta *negrita* e _itálica_)
      await message.reply(response.reply);

      // Si hay notificación para agente (escalada)
      if (response.agentNotification && process.env.HUMAN_AGENT_PHONE) {
        const agentId = `${process.env.HUMAN_AGENT_PHONE.replace(/\D/g, '')}@c.us`;
        await waClient.sendMessage(agentId, response.agentNotification);
      }
    } catch (err) {
      console.error('[WhatsApp] Error procesando mensaje:', err);
      await message.reply('⚠️ Ocurrió un error. Por favor intenta de nuevo.').catch(() => {});
    }
  });

  return waClient;
}

export function getWhatsAppClient() {
  return waClient;
}

export async function sendWhatsAppMessage(phone, text) {
  if (!waClient) throw new Error('WhatsApp client not initialized');
  const chatId = phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@c.us`;
  return waClient.sendMessage(chatId, text);
}
