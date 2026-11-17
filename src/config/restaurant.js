export const restaurant = {
  name: process.env.RESTAURANT_NAME || 'Restaurante Mi Sabor',
  phone: process.env.RESTAURANT_PHONE || '+57 300 123 4567',
  address: process.env.RESTAURANT_ADDRESS || 'Calle 123 #45-67, Bogotá',
  hours: process.env.RESTAURANT_HOURS || 'Lunes a Sábado 11am-10pm, Domingos 12pm-8pm',
  currency: process.env.CURRENCY_SYMBOL || '$',
  currencyCode: process.env.CURRENCY_CODE || 'COP',
  humanAgent: process.env.HUMAN_AGENT_TELEGRAM || '@admin',
  humanPhone: process.env.HUMAN_AGENT_PHONE || '',
};

export function formatPrice(amount) {
  return `${restaurant.currency}${Number(amount).toLocaleString('es-CO')}`;
}

export const STATUS_LABELS = {
  pending: '⏳ Pendiente de confirmar',
  confirmed: '✅ Confirmado',
  preparing: '👨‍🍳 En preparación',
  ready: '🛍️ Listo para recoger/entrega',
  on_delivery: '🛵 En camino',
  delivered: '✔️ Entregado',
  cancelled: '❌ Cancelado',
};
