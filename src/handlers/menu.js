import catalog from '../config/products.json' assert { type: 'json' };
import { formatPrice, restaurant } from '../config/restaurant.js';

export function getFullMenu() {
  const lines = [`🍴 *Menú de ${restaurant.name}*\n`];

  for (const cat of catalog.categories) {
    const items = catalog.products.filter(p => p.category === cat.id && p.available);
    if (!items.length) continue;
    lines.push(`*${cat.name}*`);
    for (const item of items) {
      lines.push(`  • *${item.name}* — ${formatPrice(item.price)}`);
      lines.push(`    _${item.description}_`);
    }
    lines.push('');
  }

  lines.push(`💬 Escribe el nombre del plato para pedirlo o\n👉 Envía una foto del plato para identificarlo`);
  return lines.join('\n');
}

export function getCategoryMenu(categoryId) {
  const cat = catalog.categories.find(c => c.id === categoryId);
  if (!cat) return null;
  const items = catalog.products.filter(p => p.category === categoryId && p.available);
  const lines = [`${cat.emoji} *${cat.name}*\n`];
  for (const item of items) {
    lines.push(`*${item.name}* — ${formatPrice(item.price)}`);
    lines.push(`_${item.description}_\n`);
  }
  return lines.join('\n');
}

export function getCategoryButtons() {
  return catalog.categories.map(c => ({ text: c.name, callback: `cat_${c.id}` }));
}

export function searchProduct(query) {
  const q = query.toLowerCase();
  return catalog.products.filter(p =>
    p.available && (
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.includes(q))
    )
  );
}

export function getProductById(id) {
  return catalog.products.find(p => p.id === id && p.available) || null;
}

export function formatProductCard(product) {
  return [
    `*${product.name}*`,
    `_${product.description}_`,
    `💰 Precio: *${formatPrice(product.price)}*`,
    ``,
    `¿Lo agregas a tu pedido? Responde *sí* o *no*`,
  ].join('\n');
}

export function getMenuSummary() {
  return catalog.categories.map(cat => {
    const count = catalog.products.filter(p => p.category === cat.id && p.available).length;
    return `${cat.emoji} ${cat.name} (${count} opciones)`;
  }).join('\n');
}
