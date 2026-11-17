-- Clientes del bot
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,           -- 'whatsapp' | 'telegram'
  platform_id TEXT NOT NULL,        -- número de WhatsApp o chat_id de Telegram
  name TEXT,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform, platform_id)
);

-- Pedidos
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE, -- ej: "ORD-20260618-001"
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending | confirmed | preparing | ready | on_delivery | delivered | cancelled
  items TEXT NOT NULL,              -- JSON: [{product_id, name, qty, price}]
  total REAL NOT NULL DEFAULT 0,
  address TEXT,
  payment_method TEXT,              -- 'cash' | 'transfer' | 'card'
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sesiones de conversación (estado del flujo)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  state TEXT NOT NULL DEFAULT 'idle',
  -- idle | menu | ordering | awaiting_address | awaiting_payment | awaiting_confirm
  context TEXT,                     -- JSON: datos temporales del pedido en curso
  last_intent TEXT,
  failed_attempts INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id)
);

-- Historial de mensajes (últimos 50 por cliente)
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  direction TEXT NOT NULL,          -- 'in' | 'out'
  content TEXT NOT NULL,
  msg_type TEXT DEFAULT 'text',     -- 'text' | 'image' | 'menu'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_messages_customer ON messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_platform ON customers(platform, platform_id);
