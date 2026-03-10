'use client';

/**
 * Centralized Cart Management System
 * Handles cart state, localStorage synchronization, server synchronization, and cross-component communication
 * Uses ServerCartItem and ServerCartCollection types directly for consistency
 */

import {
	getCartItems,
	checkCartItemAvailability,
	updateCartItem,
	deleteCartItems,
	updateCartItemSelection,
	addToCart,
} from '@/apihandler/Cart';
import {
	CartAvailabilityCheck,
	ServerCartCollection,
	ServerCartItem,
} from '@/types/cart-types';
import { findServerCartItemById, findServerCartItemId } from './cart-utils';

// Re-export server types for convenience
export type CartItem = ServerCartItem;
export type CartCollection = ServerCartCollection;

class CartManager {
	private static instance: CartManager;
	private cart: ServerCartCollection[] = [];
	private listeners: Set<(cart: ServerCartCollection[]) => void> = new Set();
	private eventListeners: { type: string; listener: EventListener }[] = [];
	private debounceTimer: NodeJS.Timeout | null = null;
	private isInitialized = false;
	private isUpdatingFromStorage = false;

	private constructor() {
		this.initializeStorageListener();
	}

	public static getInstance(): CartManager {
		if (!CartManager.instance) {
			CartManager.instance = new CartManager();
		}
		return CartManager.instance;
	}

	/**
	 * Ensure cart is properly initialized as an array
	 */
	private ensureCartIsArray(): void {
		if (!Array.isArray(this.cart)) {
			console.warn('Cart was not an array, resetting to empty array');
			this.cart = [];
		}
	}

	/**
	 * Initialize cart with server-first approach
	 * Always fetches from server to ensure latest cart state, then updates sessionStorage
	 */
	public async initialize(
		walletAddress: string,
	): Promise<ServerCartCollection[]> {
		if (this.isInitialized) {
			this.ensureCartIsArray();
			return this.cart;
		}

		try {
			// Always fetch from server first to get the latest cart state
			if (walletAddress) {
				const serverCart = await getCartItems(walletAddress);
				this.cart = Array.isArray(serverCart) ? serverCart : [];

				// Update sessionStorage with fresh server data
				this.saveToStorage();
			} else {
				// No wallet address, try to load from sessionStorage as fallback
				const stored = sessionStorage.getItem('cart');
				if (stored) {
					const parsed = JSON.parse(stored);
					this.cart = Array.isArray(parsed) ? parsed : [];
				} else {
					this.cart = [];
				}
			}

			this.isInitialized = true;
			return this.cart;
		} catch (error) {
			console.error(
				'Error initializing cart from server, falling back to sessionStorage:',
				error,
			);

			// Fallback to sessionStorage if server fetch fails
			try {
				const stored = sessionStorage.getItem('cart');
				if (stored) {
					const parsed = JSON.parse(stored);
					this.cart = Array.isArray(parsed) ? parsed : [];
				} else {
					this.cart = [];
				}
			} catch (storageError) {
				console.error(
					'Error loading cart from sessionStorage:',
					storageError,
				);
				this.cart = [];
			}

			this.isInitialized = true;
			return this.cart;
		}
	}

	/**
	 * Get current cart collections
	 */
	public getCart(): ServerCartCollection[] {
		this.ensureCartIsArray();
		return [...this.cart];
	}

	/**
	 * Get cart items count (total items across all collections)
	 */
	public getCartCount(): number {
		this.ensureCartIsArray();

		if (!this.cart || this.cart.length === 0) {
			return 0;
		}

		return this.cart.reduce((total, collection) => {
			if (!collection || !Array.isArray(collection.items)) {
				return total;
			}
			return total + collection.items.length;
		}, 0);
	}

	/**
	 * Get cart total value
	 */
	public getCartTotal(): number {
		this.ensureCartIsArray();

		if (!this.cart || this.cart.length === 0) {
			return 0;
		}

		return this.cart.reduce((total, collection) => {
			if (!collection || !Array.isArray(collection.items)) {
				return total;
			}

			return (
				total +
				collection.items.reduce((collectionTotal, item) => {
					if (!item || !item.product || !item.product.price) {
						return collectionTotal;
					}
					return (
						collectionTotal +
						parseFloat(item.product.price || '0') * item.quantity
					);
				}, 0)
			);
		}, 0);
	}

	/**
	 * Update item quantity
	 */
	public updateItemQuantity(itemId: number, quantity: number): void {
		this.ensureCartIsArray();

		for (const collection of this.cart) {
			if (!collection || !Array.isArray(collection.items)) continue;

			const itemIndex = collection.items.findIndex(
				(item) => item.id === itemId,
			);
			if (itemIndex >= 0) {
				if (quantity <= 0) {
					collection.items.splice(itemIndex, 1);
					// Remove collection if empty
					if (collection.items.length === 0) {
						const collectionIndex = this.cart.indexOf(collection);
						this.cart.splice(collectionIndex, 1);
					}
				} else {
					collection.items[itemIndex].quantity = quantity;
				}
				this.notifyListeners();
				this.debouncedSave();
				break;
			}
		}
	}

	/**
	 * Update item selection
	 */
	public updateItemSelection(itemId: number, isSelected: boolean): void {
		this.ensureCartIsArray();

		for (const collection of this.cart) {
			if (!collection || !Array.isArray(collection.items)) continue;

			const itemIndex = collection.items.findIndex(
				(item) => item.id === itemId,
			);
			if (itemIndex >= 0) {
				collection.items[itemIndex].isSelected = isSelected;

				this.notifyListeners();
				this.debouncedSave();
				break;
			}
		}
	}

	/**
	 * Remove item from cart
	 */
	public removeItem(itemId: number): void {
		this.ensureCartIsArray();

		for (const collection of this.cart) {
			if (!collection || !Array.isArray(collection.items)) continue;

			const itemIndex = collection.items.findIndex(
				(item) => item.id === itemId,
			);
			if (itemIndex >= 0) {
				collection.items.splice(itemIndex, 1);
				// Remove collection if empty
				if (collection.items.length === 0) {
					const collectionIndex = this.cart.indexOf(collection);
					this.cart.splice(collectionIndex, 1);
				}
				this.notifyListeners();
				this.debouncedSave();
				break;
			}
		}
	}

	/**
	 * Set entire cart (for bulk operations)
	 */
	public setCart(collections: ServerCartCollection[]): void {
		this.cart = Array.isArray(collections) ? [...collections] : [];
		this.notifyListeners();
		this.debouncedSave();
	}

	/**
	 * Update collections
	 */
	public updateCollections(collections: ServerCartCollection[]): void {
		this.cart = Array.isArray(collections) ? [...collections] : [];
		this.notifyListeners();
		this.debouncedSave();
	}

	/**
	 * Check if item exists in cart
	 */
	public hasItem(productId: number): boolean {
		this.ensureCartIsArray();

		return this.cart.some(
			(collection) =>
				collection &&
				Array.isArray(collection.items) &&
				collection.items.some(
					(item) => item && item.productId === productId,
				),
		);
	}

	/**
	 * Get specific item from cart by product ID
	 */
	public getItem(productId: number): ServerCartItem | undefined {
		this.ensureCartIsArray();

		for (const collection of this.cart) {
			if (!collection || !Array.isArray(collection.items)) continue;

			const item = collection.items.find(
				(item) => item && item.productId === productId,
			);
			if (item) return item;
		}
		return undefined;
	}

	/**
	 * Get specific item from cart by item ID
	 */
	public getItemById(itemId: number): ServerCartItem | undefined {
		this.ensureCartIsArray();

		for (const collection of this.cart) {
			if (!collection || !Array.isArray(collection.items)) continue;

			const item = collection.items.find(
				(item) => item && item.id === itemId,
			);
			if (item) return item;
		}
		return undefined;
	}

	/**
	 * Check cart item availability before adding
	 */
	public async checkItemAvailability(
		walletAddress: string,
		productId: number,
		quantity: number,
	): Promise<CartAvailabilityCheck> {
		try {
			return await checkCartItemAvailability(
				walletAddress,
				productId,
				quantity,
			);
		} catch (error) {
			console.error('Error checking item availability:', error);
			return {
				canAdd: false,
				reason: 'Failed to check availability',
				cartQuantity: 0,
				availableQuantity: 0,
			};
		}
	}

	/**
	 * Add item to cart with server synchronization and validation
	 */
	public async addToCart(data: {
		walletAddress: string;
		productId: number;
		quantity: number;
		checkoutAction: string;
		assetId?: number | undefined;
	}): Promise<{ success: boolean; error?: string; item?: ServerCartItem }> {
		try {
			// Create new item on server
			const res = await addToCart(data);

			// Refresh cart from server to get updated state
			const updatedCart = await getCartItems(data.walletAddress);
			this.setCart(updatedCart);

			return { success: true };
		} catch (error) {
			console.error('Error adding to cart:', error);
			return { success: false, error: (error as Error).message };
		}
	}

	/**
	 * Update item quantity with server synchronization
	 */
	public async updateItemQuantityWithSync(
		walletAddress: string,
		itemId: number,
		quantity: number,
		checkoutAction: 'BuyAndMint' | 'BuyAndTransfer' = 'BuyAndMint',
	): Promise<{ success: boolean; error?: string }> {
		try {
			const serverItemId = findServerCartItemById(this.cart, itemId);

			if (!serverItemId) {
				return {
					success: false,
					error: 'Item not found in server cart',
				};
			}

			if (quantity <= 0) {
				// Delete item from server
				await deleteCartItems(walletAddress, [serverItemId]);
				this.removeItem(itemId);
			} else {
				// Update item on server
				await updateCartItem(
					serverItemId,
					walletAddress,
					quantity,
					checkoutAction,
				);
				this.updateItemQuantity(itemId, quantity);
			}

			return { success: true };
		} catch (error) {
			console.error('Error updating item quantity with sync:', error);
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: 'Failed to update item quantity',
			};
		}
	}

	/**
	 * Update item selection with server synchronization
	 */
	public async updateItemSelectionWithSync(
		walletAddress: string,
		itemId: number,
		isSelected: boolean,
	): Promise<{ success: boolean; error?: string }> {
		try {
			await updateCartItemSelection(itemId, walletAddress, isSelected);
			this.updateItemSelection(itemId, isSelected);

			return { success: true };
		} catch (error) {
			console.error('Error updating item quantity with sync:', error);
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: 'Failed to update item quantity',
			};
		}
	}

	/**
	 * Remove item with server synchronization
	 */
	public async removeItemWithSync(
		walletAddress: string,
		itemId: number,
	): Promise<{ success: boolean; error?: string }> {
		try {
			await deleteCartItems(walletAddress, [itemId]);
			this.removeItem(itemId);

			return { success: true };
		} catch (error) {
			console.error('Error removing item with sync:', error);
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: 'Failed to remove item',
			};
		}
	}

	/**
	 * Sync cart with server
	 */
	public async syncWithServer(
		walletAddress: string,
	): Promise<{ success: boolean; error?: string }> {
		try {
			const serverCart = await getCartItems(walletAddress);
			this.setCart(serverCart);
			return { success: true };
		} catch (error) {
			console.error('Error syncing with server:', error);
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: 'Failed to sync with server',
			};
		}
	}

	/**
	 * Validate cart with server
	 */
	public async validateFromServer(
		walletAddress: string,
		selectedItems: ServerCartItem[],
	): Promise<boolean> {
		try {
			const serverCart = await getCartItems(walletAddress);

			// Flatten server items into a map for fast lookup
			const serverItemsMap = new Map<string, ServerCartItem>();

			serverCart.forEach((col) => {
				col.items.forEach((item) => {
					// Unique key: productId + (optional) assetId or voucherId
					const key = `${item.productId}-${
						item.product?.voucher?.id ?? item.assetId ?? ''
					}`;
					serverItemsMap.set(key, item);
				});
			});

			const invalidItems: ServerCartItem[] = [];

			for (const selected of selectedItems) {
				const key = `${selected.productId}-${selected.product?.voucher?.id ?? ''}`;

				const serverItem = serverItemsMap.get(key);

				if (
					!serverItem ||
					serverItem.product.consumerAction !==
						selected.product.consumerAction ||
					serverItem.product.price !== selected.product.price ||
					serverItem.product.currencySymbol !==
						selected.product.currencySymbol ||
					serverItem.product.availableQuantity !==
						selected.product.availableQuantity ||
					(serverItem.product.asset.find(
						(asset) => asset.id === selected.assetId,
					)?.availableQuantity ?? null) !==
						(selected.product.asset.find(
							(asset) => asset.id === selected.assetId,
						)?.availableQuantity ?? null)
				) {
					invalidItems.push(selected);
					continue;
				}
			}

			if (invalidItems.length > 0) {
				return false;
			}

			return true;
		} catch (error) {
			console.error('Error validate with server:', error);
			throw error;
		}
	}

	/**
	 * Subscribe to cart changes
	 */
	public subscribe(
		listener: (cart: ServerCartCollection[]) => void,
	): () => void {
		this.listeners.add(listener);

		// Return unsubscribe function
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Notify all listeners of cart changes
	 */
	private notifyListeners(): void {
		this.ensureCartIsArray();
		const cartCopy = [...this.cart];
		this.listeners.forEach((listener) => {
			try {
				listener(cartCopy);
			} catch (error) {
				console.error('Error in cart listener:', error);
			}
		});
	}

	/**
	 * Debounced save to sessionStorage to prevent excessive writes
	 */
	private debouncedSave(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(() => {
			this.saveToStorage();
		}, 150); // 150ms debounce
	}

	/**
	 * Save cart to sessionStorage
	 */
	private saveToStorage(): void {
		if (this.isUpdatingFromStorage) {
			return; // Prevent circular updates
		}

		try {
			this.ensureCartIsArray();
			const cartString = JSON.stringify(this.cart);
			const currentStored = sessionStorage.getItem('cart');

			// Only update if cart actually changed
			if (currentStored !== cartString) {
				sessionStorage.setItem('cart', cartString);

				// Dispatch custom event for same-tab synchronization
				window.dispatchEvent(
					new CustomEvent('cartUpdated', {
						detail: this.cart,
					}),
				);
			}
		} catch (error) {
			console.error('Error saving cart to sessionStorage:', error);
		}
	}

	/**
	 * Initialize storage event listener for cross-tab synchronization
	 */
	private initializeStorageListener(): void {
		if (typeof window === 'undefined') return;

		// Listen for storage changes from other tabs
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key === 'cart' && e.newValue !== null) {
				try {
					this.isUpdatingFromStorage = true;
					const newCart = JSON.parse(e.newValue);
					this.cart = Array.isArray(newCart) ? newCart : [];
					this.notifyListeners();
				} catch (error) {
					console.error('Error parsing cart from storage:', error);
					this.cart = [];
				} finally {
					this.isUpdatingFromStorage = false;
				}
			}
		};

		// Listen for custom cart events from same tab
		const handleCartUpdate = (e: CustomEvent) => {
			// Prevent circular updates by checking if this manager triggered the event
			if (this.isUpdatingFromStorage) return;

			try {
				this.isUpdatingFromStorage = true;
				const cartData = e.detail || [];
				this.cart = Array.isArray(cartData) ? cartData : [];
				this.notifyListeners();
			} catch (error) {
				console.error('Error handling cart update event:', error);
				this.cart = [];
			} finally {
				this.isUpdatingFromStorage = false;
			}
		};

		window.addEventListener('storage', handleStorageChange);
		window.addEventListener(
			'cartUpdated',
			handleCartUpdate as EventListener,
		);

		// Store event listeners for cleanup
		this.eventListeners.push(
			{ type: 'storage', listener: handleStorageChange as EventListener },
			{
				type: 'cartUpdated',
				listener: handleCartUpdate as EventListener,
			},
		);
	}

	/**
	 * Reset initialization state to force fresh server sync on next initialize call
	 */
	public resetInitialization(): void {
		this.isInitialized = false;
	}

	/**
	 * Clean up event listeners and timers
	 */
	public cleanup(): void {
		// Clear timers
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		// Remove event listeners
		if (typeof window !== 'undefined') {
			this.eventListeners.forEach(({ type, listener }) => {
				window.removeEventListener(type, listener);
			});
			this.eventListeners = [];
		}

		// Clear listeners
		this.listeners.clear();

		// Reset state
		this.isInitialized = false;
	}
}

// Export singleton instance
export const cartManager = CartManager.getInstance();

// Export hook for React components
export function useCart() {
	return cartManager;
}
