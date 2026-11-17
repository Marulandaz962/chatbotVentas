import { analyzeProductImage } from '../ai/claude.js';
import { getProductById, formatProductCard } from './menu.js';

export async function handleImageMessage(imageBase64, mediaType = 'image/jpeg', session) {
  const result = await analyzeProductImage(imageBase64, mediaType);

  if (!result.found || result.confidence < 0.5) {
    return {
      reply: `🔍 Vi la imagen pero no pude identificar un plato de nuestro menú.\n\n_Lo que veo:_ ${result.description}\n\nPuedes ver nuestro menú con /menu o describir el plato que buscas.`,
      identified: false,
    };
  }

  const product = getProductById(result.product_id);
  if (!product) {
    return {
      reply: `Reconocí *${result.product_name}* pero no está disponible ahora mismo. ¿Te puedo ofrecer algo similar?`,
      identified: false,
    };
  }

  return {
    reply: `📸 ¡Reconocí el plato!\n\n${formatProductCard(product)}`,
    identified: true,
    product,
    newState: 'awaiting_product_confirm',
    newContext: { ...(session?.context || {}), currentProduct: product },
  };
}
