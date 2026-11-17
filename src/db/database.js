import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || './data/chatbot.db';

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = readFileSync(join(__dir, 'schema.sql'), 'utf8');
db.exec(schema);

// ---- Customers ----

export function upsertCustomer(platform, platformId, name) {
  const existing = db.prepare(
    'SELECT id FROM customers WHERE platform = ? AND platform_id = ?'
  ).get(platform, platformId);

  if (existing) {
    db.prepare('UPDATE customers SET last_seen = CURRENT_TIMESTAMP, name = COALESCE(?, name) WHERE id = ?')
      .run(name || null, existing.id);
    return existing.id;
  }

  const result = db.prepare(
    'INSERT INTO customers (platform, platform_id, name) VALUES (?, ?, ?)'
  ).run(platform, platformId, name || null);
  return result.lastInsertRowid;
}

export function getCustomer(platform, platformId) {
  return db.prepare('SELECT * FROM customers WHERE platform = ? AND platform_id = ?')
    .get(platform, platformId);
}

// ---- Sessions ----

export function getSession(customerId) {
  let session = db.prepare('SELECT * FROM sessions WHERE customer_id = ?').get(customerId);
  if (!session) {
    db.prepare('INSERT INTO sessions (customer_id) VALUES (?)').run(customerId);
    session = db.prepare('SELECT * FROM sessions WHERE customer_id = ?').get(customerId);
  }
  return {
    ...session,
    context: session.context ? JSON.parse(session.context) : {},
  };
}

export function updateSession(customerId, state, context, intent) {
  db.prepare(`
    UPDATE sessions
    SET state = ?, context = ?, last_intent = ?, failed_attempts = 0, updated_at = CURRENT_TIMESTAMP
    WHERE customer_id = ?
  `).run(state, JSON.stringify(context || {}), intent || null, customerId);
}

export function incrementFailedAttempts(customerId) {
  db.prepare('UPDATE sessions SET failed_attempts = failed_attempts + 1 WHERE customer_id = ?')
    .run(customerId);
  return db.prepare('SELECT failed_attempts FROM sessions WHERE customer_id = ?')
    .get(customerId).failed_attempts;
}

export function resetSession(customerId) {
  db.prepare('UPDATE sessions SET state = ?, context = ?, failed_attempts = 0 WHERE customer_id = ?')
    .run('idle', '{}', customerId);
}

// ---- Orders ----

function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at) = date('now')").get().c + 1;
  return `ORD-${date}-${String(count).padStart(3, '0')}`;
}

export function createOrder(customerId, items, address, paymentMethod, notes) {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const orderNumber = generateOrderNumber();
  db.prepare(`
    INSERT INTO orders (order_number, customer_id, items, total, address, payment_method, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(orderNumber, customerId, JSON.stringify(items), total, address, paymentMethod, notes || null);
  return orderNumber;
}

export function getOrder(orderNumber) {
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
  if (!order) return null;
  return { ...order, items: JSON.parse(order.items) };
}

export function getCustomerOrders(customerId) {
  return db.prepare("SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 5")
    .all(customerId)
    .map(o => ({ ...o, items: JSON.parse(o.items) }));
}

export function updateOrderStatus(orderNumber, status) {
  db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?')
    .run(status, orderNumber);
}

export function getPendingOrders() {
  return db.prepare("SELECT o.*, c.name, c.platform, c.platform_id FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.status IN ('pending','confirmed','preparing') ORDER BY o.created_at")
    .all()
    .map(o => ({ ...o, items: JSON.parse(o.items) }));
}

// ---- Messages ----

export function saveMessage(customerId, direction, content, msgType = 'text') {
  db.prepare('INSERT INTO messages (customer_id, direction, content, msg_type) VALUES (?, ?, ?, ?)')
    .run(customerId, direction, content, msgType);
  // Mantener solo los últimos 100 mensajes por cliente
  db.prepare(`
    DELETE FROM messages WHERE id NOT IN (
      SELECT id FROM messages WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100
    ) AND customer_id = ?
  `).run(customerId, customerId);
}

export function getRecentMessages(customerId, limit = 10) {
  return db.prepare('SELECT * FROM messages WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(customerId, limit)
    .reverse();
}

export default db;
