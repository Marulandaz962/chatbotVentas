# Guía de Instalación - ChatBot de Ventas

## Requisitos previos
- Node.js 20 o superior → https://nodejs.org
- Cuenta en Anthropic (Claude AI) → https://console.anthropic.com
- Para WhatsApp: el teléfono con WhatsApp instalado

---

## Paso 1 — Instalar dependencias

```bash
npm install
```

> Nota: `whatsapp-web.js` descarga Chromium (~170MB). La primera vez tarda varios minutos.

---

## Paso 2 — Configurar el .env

```bash
# Copia el archivo de ejemplo
copy .env.example .env
```

Edita `.env` y completa:

| Variable | Valor |
|----------|-------|
| `ANTHROPIC_API_KEY` | Tu clave de Anthropic (empieza con `sk-ant-`) |
| `TELEGRAM_BOT_TOKEN` | Token de @BotFather |
| `RESTAURANT_NAME` | Nombre de tu restaurante |
| `RESTAURANT_ADDRESS` | Dirección |
| `RESTAURANT_HOURS` | Horarios |
| `HUMAN_AGENT_PHONE` | Tu número de WhatsApp para escaladas |

### Obtener el token de Telegram (gratis, 2 minutos)
1. Abre Telegram y busca **@BotFather**
2. Escribe `/newbot`
3. Ponle un nombre (ej: "Mi Sabor Bot")
4. Ponle un username que termine en "bot" (ej: "misaborco_bot")
5. Copia el token que aparece

---

## Paso 3 — Personalizar el menú

Edita `src/config/products.json` para poner tus platos reales.

Cada producto tiene:
```json
{
  "id": "unico-id",
  "category": "principales",
  "name": "Nombre del plato",
  "description": "Descripción corta",
  "price": 25000,
  "available": true,
  "tags": ["carne", "colombiano"]
}
```

---

## Paso 4 — Iniciar el bot

```bash
# Ambos bots (Telegram + WhatsApp)
npm start

# Solo Telegram (más fácil para probar)
npm run telegram

# Solo WhatsApp
npm run whatsapp
```

Para WhatsApp: al iniciar aparece un **código QR en la terminal**.
Ábrelo con tu teléfono: WhatsApp → Dispositivos vinculados → Vincular dispositivo.
La sesión se guarda y no tendrás que escanear de nuevo.

---

## Panel de administrador

```bash
node index.js --admin
```

Desde el panel puedes:
- Ver todos los pedidos activos en tiempo real
- Actualizar estados (confirmado → preparando → en camino → entregado)
- El bot notifica al cliente automáticamente cuando cambias el estado

---

## Comandos del bot (para clientes)

| Comando / Texto | Acción |
|-----------------|--------|
| `/menu` o "ver menú" | Ver la carta completa |
| `/pedido` o "quiero pedir" | Iniciar un pedido |
| `/estado ORD-20260618-001` | Ver estado de un pedido |
| `/agente` o "hablar con humano" | Escalar a agente |
| `/cancelar` | Cancelar pedido en curso |
| [Enviar foto de un plato] | Identificar el plato con IA |

---

## Solución de problemas

**Error: ANTHROPIC_API_KEY no configurado**
→ Verifica que el `.env` tiene la clave correcta.

**WhatsApp: QR no aparece o no escanea**
→ Elimina la carpeta `sessions/` y reinicia.

**WhatsApp: Error de puppeteer en Windows**
→ Si falla el Chromium integrado, instala: `npm install puppeteer` y ajusta la ruta en `whatsapp.js`.

**Telegram: "Unauthorized"**
→ El token del bot es incorrecto. Ve a @BotFather y revisa el token.
