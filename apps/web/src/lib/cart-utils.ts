import { ServerCartCollection } from "../types/cart-types";

/**
 * Find server cart item ID by product ID
 */
export const findServerCartItemId = (
  serverCollections: ServerCartCollection[],
  productId: number
): number | null => {
  for (const collection of serverCollections) {
    const item = collection.items.find((item) => item.productId === productId);
    if (item) {
      return item.id;
    }
  }
  return null;
};

/**
 * Find server cart item ID by item ID (returns the same ID if found)
 */
export const findServerCartItemById = (
  serverCollections: ServerCartCollection[],
  itemId: number
): number | null => {
  for (const collection of serverCollections) {
    const item = collection.items.find((item) => item.id === itemId);
    if (item) {
      return item.id;
    }
  }
  return null;
};