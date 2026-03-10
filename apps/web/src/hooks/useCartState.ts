'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { cartManager } from '@/lib/CartManager';
import { createCheckout, getCheckoutById, getCheckoutStatus } from '@/apihandler/Cart';
import {
	ServerCartCollection,
	ServerCartItem,
	PaymentType,
	OrderStatus,
	CartAvailabilityCheck,
	GetCheckoutByIdResponse,
	CreateCheckoutRequest,
	CheckoutStatus,
} from '@/types/cart-types';
import { VoucherMetadata, WalletBalanceResponse } from '@/types';
import { ToastMessage } from '@/components/ToastMessage';
import { fetchCurrency } from '@/apihandler/Admin';
import { Currency } from '../types';
import { getWalletBalance } from '@/apihandler/Wallet';

// Shared initialization state to prevent race conditions
const initializationState = new Map<string, Promise<ServerCartCollection[]>>();

/**
 * Cleanup initialization state for a wallet address
 */
function cleanupInitializationState(walletAddress: string): void {
	initializationState.delete(walletAddress);
}

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Masks 500 / internal server error messages so we don't expose them to the user.
 */
function maskServerError(message: string | undefined | null): string {
	if (message == null || typeof message !== 'string') return GENERIC_ERROR_MESSAGE;
	const lower = message.toLowerCase();
	if (lower.includes('500') || lower.includes('internal server error')) {
		return GENERIC_ERROR_MESSAGE;
	}
	return message;
}

/**
 * Shared initialization function to prevent race conditions
 * Always ensures fresh server data on initialization
 */
async function getSharedInitialization(walletAddress: string): Promise<ServerCartCollection[]> {
	if (!walletAddress) {
		return [];
	}

	// Always create a new initialization promise to ensure server sync on every page reload
	// This ensures that server-side cart updates are always reflected
	const initPromise = cartManager.initialize(walletAddress);
	initializationState.set(walletAddress, initPromise);

	// Clean up after initialization completes
	initPromise.finally(() => {
		setTimeout(() => cleanupInitializationState(walletAddress), 5000); // Cleanup after 5 seconds
	});

	return initPromise;
}

/**
 * React hook for cart state management with localStorage persistence
 * Provides cart collections and management functions using ServerCartCollection types
 */
export function useCartState(walletAddress: string) {
	const [collections, setCollections] = useState<ServerCartCollection[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isInitialized, setIsInitialized] = useState(false);
	const isMountedRef = useRef(true);
	const checkoutPollingRef = useRef<{
		cancelled: boolean;
		intervalId?: ReturnType<typeof setInterval>;
		maxTimeoutId?: ReturnType<typeof setTimeout>;
		initialDelayId?: ReturnType<typeof setTimeout>;
	} | null>(null);

	// Initialize cart on mount with shared initialization
	useEffect(() => {
		isMountedRef.current = true;

		// Always reset loading state
		setIsLoading(true);

		// Handle empty wallet address
		if (!walletAddress) {
			setCollections([]);
			setIsInitialized(true);
			setIsLoading(false);
			return;
		}

		const initializeCart = async () => {
			try {
				const initialCart = await getSharedInitialization(walletAddress);

				// Only update state if component is still mounted
				if (isMountedRef.current) {
					setCollections(initialCart);
					setIsInitialized(true);
				}
			} catch (error) {
				console.error('Error initializing cart:', error);
				if (isMountedRef.current) {
					setCollections([]);
					setIsInitialized(true);
				}
			} finally {
				if (isMountedRef.current) {
					setIsLoading(false);
				}
			}
		};

		initializeCart();

		// Cleanup function
		return () => {
			isMountedRef.current = false;
		};
	}, [walletAddress]);

	// Subscribe to cart changes
	useEffect(() => {
		if (!isInitialized || !walletAddress) return;

		const unsubscribe = cartManager.subscribe((newCart) => {
			if (isMountedRef.current) {
				setCollections(newCart);
			}
		});

		return unsubscribe;
	}, [isInitialized, walletAddress]);

	// Cleanup checkout polling on unmount
	useEffect(() => {
		return () => {
			if (checkoutPollingRef.current) {
				checkoutPollingRef.current.cancelled = true;
				if (checkoutPollingRef.current.intervalId !== undefined) {
					clearInterval(checkoutPollingRef.current.intervalId);
				}
				if (checkoutPollingRef.current.maxTimeoutId !== undefined) {
					clearTimeout(checkoutPollingRef.current.maxTimeoutId);
				}
				if (checkoutPollingRef.current.initialDelayId !== undefined) {
					clearTimeout(checkoutPollingRef.current.initialDelayId);
				}
				checkoutPollingRef.current = null;
			}
		};
	}, []);

	const updateCollections = useCallback((newCollections: ServerCartCollection[]) => {
		cartManager.updateCollections(newCollections);
	}, []);

	const hasItem = useCallback((productId: number) => {
		return cartManager.hasItem(productId);
	}, []);

	const getItem = useCallback((productId: number) => {
		return cartManager.getItem(productId);
	}, []);

	// Server-side operations with validation
	const addToCartWithSync = useCallback(
		async (data: { walletAddress: string; productId: number; quantity: number; checkoutAction: string; assetId?: number }) => {
			if (!data.walletAddress) {
				return { success: false, error: 'Wallet address is required' };
			}
			return await cartManager.addToCart(data);
		},
		[walletAddress],
	);

	const updateQuantityWithSync = useCallback(
		async (itemId: number, quantity: number, checkoutAction: 'BuyAndMint' | 'BuyAndTransfer' = 'BuyAndMint') => {
			if (!walletAddress) {
				return { success: false, error: 'Wallet address is required' };
			}

			// Find the item to check availability
			const item = cartManager.getItemById(itemId);

			if (item) {
				const res = await cartManager.checkItemAvailability(walletAddress, item.productId, quantity);
				console.log(walletAddress, item.productId, quantity);

				const isUnlimited =
					item.product.collection?.contractType === 'ERC721AC' &&
					item.product.maxQuantity === 0 &&
					item.product.availableQuantity === 0;

				if (item.product.collection?.contractType === 'ERC721AC') {
					if (!isUnlimited && quantity > res.availableQuantity) {
						return {
							success: false,
							error: `Cannot set quantity to ${quantity}. Only ${res.availableQuantity} available in stock.`,
						};
					}
				} else {
					if (!res.canAdd || quantity > res.availableQuantity) {
						return {
							success: false,
							error: `Cannot set quantity to ${quantity}. Only ${res.availableQuantity} available in stock.`,
						};
					}
				}
				// if (
				// 	!isUnlimited &&
				// 	(!res.canAdd || quantity > res.availableQuantity)
				// ) {
				// 	return {
				// 		success: false,
				// 		error: `Cannot set quantity to ${quantity}. Only ${res.availableQuantity} available in stock.`,
				// 	};
				// }
			}

			return await cartManager.updateItemQuantityWithSync(walletAddress, itemId, quantity, checkoutAction);
		},
		[walletAddress],
	);

	const updateSelectionWithSync = useCallback(
		async (itemId: number, isSelected: boolean) => {
			if (!walletAddress) {
				return { success: false, error: 'Wallet address is required' };
			}

			return await cartManager.updateItemSelectionWithSync(walletAddress, itemId, isSelected);
		},
		[walletAddress],
	);

	const removeItemWithSync = useCallback(
		async (itemId: number) => {
			if (!walletAddress) {
				return { success: false, error: 'Wallet address is required' };
			}
			return await cartManager.removeItemWithSync(walletAddress, itemId);
		},
		[walletAddress],
	);

	const syncWithServer = useCallback(async () => {
		if (!walletAddress) {
			return { success: false, error: 'Wallet address is required' };
		}
		return await cartManager.syncWithServer(walletAddress);
	}, [walletAddress]);

	const validateFromServer = useCallback(
		async (selectedItems: ServerCartItem[]) => {
			if (!walletAddress) {
				return false;
			}
			return await cartManager.validateFromServer(walletAddress, selectedItems);
		},
		[walletAddress],
	);

	/**
	 * Extracts order status from notification message
	 * Message format: "Your order {checkoutId} has been delivered with status: {status}"
	 * Possible statuses: "Failed", "Partial Success", "Success"
	 */
	const extractOrderStatusFromMessage = useCallback((message: string): 'success' | 'partial' | 'failed' | null => {
		const lowerMessage = message.toLowerCase();

		if (lowerMessage.includes('status: success')) {
			return 'success';
		}
		if (lowerMessage.includes('status: partial success')) {
			return 'partial';
		}
		if (lowerMessage.includes('status: failed')) {
			return 'failed';
		}

		return null;
	}, []);

	/**
	 * Checks if notification matches the checkout being monitored
	 */
	const isMatchingOrderNotification = useCallback((eventData: any, checkoutId: string): boolean => {
		// Must be push notification
		if (eventData.type !== 'PUSH_NOTIFICATION_RECEIVED') {
			return false;
		}

		const notification = eventData.payload;

		// Must be order topic
		if (notification?.topic !== 'order') {
			return false;
		}

		// Must match checkoutId
		if (notification?.payload?.checkoutId !== checkoutId) {
			return false;
		}

		return true;
	}, []);

	// Monitor order status using service worker push notifications
	const monitorOrderStatus = useCallback(
		(
			checkoutId: string,
			callbacks: {
				onSuccess: (checkout: GetCheckoutByIdResponse) => void;
				onFailure: (error: string) => void;
			},
		) => {
			let cancelled = false;
			let timeoutId: number | undefined;

			const TIMEOUT_MS = 90000; // 1 minute 30 seconds fallback timeout

			// Safe callback wrapper
			const safeCall = <T extends any[]>(fn: (...args: T) => void, ...args: T) => {
				if (!cancelled) {
					try {
						fn(...args);
					} catch (e) {
						console.error('Checkout callback error:', e);
					}
				}
			};

			// Cleanup function
			const cleanup = () => {
				cancelled = true;
				if (timeoutId !== undefined) {
					window.clearTimeout(timeoutId);
					timeoutId = undefined;
				}
				if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
					navigator.serviceWorker.removeEventListener('message', handleOrderNotification);
				}
			};

			// Helper: Analyze order statuses from checkout response
			interface OrderStatusAnalysis {
				allCompleted: boolean;
				anyFailed: boolean;
				anyCompleted: boolean;
				allPending: boolean;
			}

			const analyzeOrderStatuses = (checkoutResponse: GetCheckoutByIdResponse): OrderStatusAnalysis => {
				const allCompleted = checkoutResponse.orders.every(
					(order: { status: OrderStatus }) => order.status.toLowerCase() === OrderStatus.Completed.toLowerCase(),
				);

				const anyFailed = checkoutResponse.orders.some(
					(order: { status: OrderStatus }) =>
						order.status.toLowerCase() === OrderStatus.Failed.toLowerCase() ||
						order.status.toLowerCase() === OrderStatus.Cancelled.toLowerCase(),
				);

				const anyCompleted = checkoutResponse.orders.some(
					(order: { status: OrderStatus }) => order.status.toLowerCase() === OrderStatus.Completed.toLowerCase(),
				);

				const allPending = checkoutResponse.orders.every(
					(order: { status: OrderStatus }) => order.status.toLowerCase() === OrderStatus.Pending.toLowerCase(),
				);

				return { allCompleted, anyFailed, anyCompleted, allPending };
			};

			// Helper: Sync cart in background
			const syncCartInBackground = () => {
				if (!cancelled) {
					cartManager.syncWithServer(walletAddress).catch((e) => {
						console.warn('Cart sync after checkout failed:', e);
					});
				}
			};

			// Helper: Handle successful checkout completion
			const handleSuccess = (checkoutResponse: GetCheckoutByIdResponse) => {
				syncCartInBackground();
				safeCall(callbacks.onSuccess, checkoutResponse);
				cleanup();
			};

			// Helper: Handle checkout failure
			const handleFailure = (errorMessage: string, shouldSyncCart: boolean = false) => {
				if (shouldSyncCart) {
					syncCartInBackground();
				}
				safeCall(callbacks.onFailure, errorMessage);
				cleanup();
			};

			// Process checkout response based on order statuses
			const processCheckoutResponse = (
				checkoutResponse: GetCheckoutByIdResponse,
				context: {
					source: 'notification' | 'timeout';
					notificationStatus?: 'success' | 'partial' | 'failed';
				},
			) => {
				const { allCompleted, anyFailed, anyCompleted, allPending } = analyzeOrderStatuses(checkoutResponse);

				// Handle completed orders
				if (allCompleted) {
					if (context.source === 'timeout') {
						console.debug('[Order Monitor] Fallback: All orders completed');
					}
					handleSuccess(checkoutResponse);
					return;
				}

				// Handle failed/partial orders
				if (anyFailed) {
					if (context.source === 'timeout') {
						console.debug('[Order Monitor] Fallback: Some orders failed');
					}

					let errorMessage: string;
					if (context.source === 'notification') {
						errorMessage =
							context.notificationStatus === 'failed'
								? 'All orders failed or were cancelled'
								: 'One or more orders failed or were cancelled';
					} else {
						// Timeout context
						errorMessage = allPending
							? 'Transaction timeout. Please check your order status manually.'
							: anyCompleted
								? 'One or more orders failed or were cancelled'
								: 'All orders failed or were cancelled';
					}

					handleFailure(errorMessage, anyCompleted);
					return;
				}

				// Handle pending orders (timeout only)
				if (context.source === 'timeout' && allPending) {
					console.debug('[Order Monitor] Fallback: Orders still pending');
					handleFailure('Transaction timeout. Please check your order status manually.');
					return;
				}

				// Status mismatch for notifications
				if (context.source === 'notification') {
					console.warn('Order status mismatch between notification and checkout data', {
						notificationStatus: context.notificationStatus,
						allCompleted,
						anyFailed,
						anyCompleted,
					});
				}
			};

			// Process order notification and fetch checkout data
			const processOrderNotification = async (status: 'success' | 'partial' | 'failed') => {
				if (cancelled) return;

				try {
					const resp = await getCheckoutById(checkoutId);

					if (!resp.success) {
						console.error('Failed to fetch checkout status:', resp.error);
						handleFailure(resp.error || 'Failed to fetch checkout status');
						return;
					}

					const checkoutResponse = resp.data!;
					const { allCompleted, anyFailed } = analyzeOrderStatuses(checkoutResponse);

					// Only process if status matches notification expectation
					if ((status === 'success' && allCompleted) || ((status === 'partial' || status === 'failed') && anyFailed)) {
						// Clear timeout since we got a valid response
						if (timeoutId !== undefined) {
							window.clearTimeout(timeoutId);
							timeoutId = undefined;
						}
						processCheckoutResponse(checkoutResponse, {
							source: 'notification',
							notificationStatus: status,
						});
					} else {
						// Status mismatch - log warning but don't fail
						console.warn('Order status mismatch between notification and checkout data', {
							notificationStatus: status,
							allCompleted,
							anyFailed,
						});
					}
				} catch (error: any) {
					console.error('Error processing order notification:', error);

					// Check if it's an Axios timeout error
					const isAxiosTimeout =
						error?.code === 'ECONNABORTED' || error?.message?.includes('timeout') || error?.message?.includes('30000');

					if (isAxiosTimeout) {
						console.warn('[Order Monitor] API timeout detected, triggering fallback immediately');
						// Clear the existing timeout and trigger fallback immediately
						if (timeoutId !== undefined) {
							window.clearTimeout(timeoutId);
							timeoutId = undefined;
						}
						// Trigger fallback
						await handleTimeout();
					} else {
						handleFailure('Failed to process order status. Please check manually.');
					}
				}
			};

			// Fallback timeout handler - fetches checkout status when timeout is reached
			const handleTimeout = async () => {
				if (cancelled) return;

				console.warn('[Order Monitor] Timeout reached for checkout:', checkoutId);
				console.debug('[Order Monitor] Fetching checkout status as fallback...');

				try {
					const resp = await getCheckoutById(checkoutId);

					if (!resp.success) {
						console.error('[Order Monitor] Fallback fetch failed:', resp.error);
						handleFailure('Transaction timeout. Please check your order status manually.');
						return;
					}

					processCheckoutResponse(resp.data!, { source: 'timeout' });
				} catch (error) {
					console.error('[Order Monitor] Fallback fetch error:', error);
					handleFailure('Transaction timeout. Please check your order status manually.');
				}
			};

			// Service worker message handler
			const handleOrderNotification = async (event: MessageEvent) => {
				if (cancelled) return;

				// Check if this notification matches our checkout
				if (!isMatchingOrderNotification(event.data, checkoutId)) {
					return;
				}

				const notification = event.data.payload;
				console.debug('[Order Monitor] Notification received:', {
					checkoutId,
					message: notification.message,
					timestamp: Date.now(),
				});

				// Extract status from message
				const status = extractOrderStatusFromMessage(notification.message);

				if (!status) {
					console.error('Could not extract status from notification message:', notification.message);
					return;
				}

				// Process the notification
				await processOrderNotification(status);
			};

			// Register service worker listener
			if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
				navigator.serviceWorker.addEventListener('message', handleOrderNotification);

				console.debug('[Order Monitor] Started monitoring checkout:', checkoutId);
			} else {
				console.error('Service Worker not available. Cannot monitor order status.');
				safeCall(callbacks.onFailure, 'Push notifications not supported. Please check order status manually.');
				// Return no-op cleanup since no listener was registered
				return () => {};
			}

			// Set timeout as fallback
			timeoutId = window.setTimeout(() => {
				handleTimeout();
			}, TIMEOUT_MS);

			// Return cleanup function
			return cleanup;
		},
		[walletAddress, extractOrderStatusFromMessage, isMatchingOrderNotification],
	);

	/**
	 * Validates if the user has sufficient wallet balance for the transaction
	 * @param walletAddress - User's wallet address
	 * @param grandTotal - Total amount to be paid
	 * @param cartCurrency - Currency of the cart items
	 * @param chainId - Blockchain chain ID (default: '0x14a34')
	 * @returns Promise<boolean> - true if balance is sufficient, throws error otherwise
	 */
	const validateWalletBalance = useCallback(
		async (walletAddress: string, grandTotal: number, cartCurrency: string, chainId: string): Promise<boolean> => {
			try {
				const userBalance: WalletBalanceResponse = await getWalletBalance(walletAddress, chainId);

				if (!userBalance || !userBalance.data) {
					throw new Error('Failed to fetch wallet balance');
				}

				const ethBalance = parseFloat(userBalance.data.ethBalanceFormatted);
				const usdcBalance = parseFloat(userBalance.data.usdcBalanceFormatted);
				const cryptoBalance = cartCurrency === 'ETH' ? ethBalance : usdcBalance;

				// Check if either ETH or USDC balance is less than grand total
				if (cryptoBalance < grandTotal) {
					const errorMsg = `Insufficient balance.\nRequired: ${cartCurrency} ${grandTotal.toFixed(
						2,
					)}.\nAvailable: ETH ${ethBalance.toFixed(4)}, USDC ${usdcBalance.toFixed(2)}`;
					// ToastMessage('error', errorMsg);
					throw new Error(errorMsg);
				}
				return true;
			} catch (error) {
				console.error('Wallet balance validation failed:', error);
				throw error;
			}
		},
		[],
	);

	/**
	 * Handles the checkout process for selected cart items
	 * @param callbacks - Callback functions for different checkout states
	 * @param grandTotal - Total amount including all charges and fees
	 */
	const handleCheckout = useCallback(
		async (
			callbacks: {
				onStart: () => void;
				onSuccess: (checkout: GetCheckoutByIdResponse) => void;
				onFailure: (error: string | GetCheckoutByIdResponse) => void;
				onComplete: () => void;
				onProgress?: (state: string) => void;
			},
			grandTotal: number,
			chainId: string,
		) => {
			// Validate wallet connection
			if (!walletAddress) {
				ToastMessage('error', 'Please connect your wallet first');
				return;
			}

			// Get selected items
			const selectedItems = collections.flatMap((col) =>
				col.items.filter((item) => item.isSelected && item.product.consumerAction !== 'None'),
			);

			// Validate item selection
			if (selectedItems.length === 0) {
				ToastMessage('error', 'Please select at least one item to checkout');
				return;
			}

			// Validate grand total
			if (!grandTotal || grandTotal <= 0) {
				ToastMessage('error', 'Invalid checkout amount');
				return;
			}

			const cartCurrency = selectedItems[0]?.product.currencySymbol;

			if (cartCurrency === undefined || cartCurrency === null) {
				ToastMessage('error', 'Unable to determine cart currency');
				return;
			}

			// Fetch newest cart and check differences
			if (!(await validateFromServer(selectedItems))) {
				ToastMessage('error', 'Some items in your cart were updated to reflect the latest changes.');
				cartManager.syncWithServer(walletAddress);
				return;
			}

			callbacks.onStart();

			try {
				// Fetch currency configuration
				const currencyResponse: Currency = await fetchCurrency(cartCurrency);
				const paymentTypeRequest: PaymentType = currencyResponse.type;

				/**
				 * Handles fiat payment checkout
				 */
				const handleCheckoutFiat = async () => {
					// TODO: Implement fiat payment gateway integration
					ToastMessage('info', 'Fiat payment processing coming soon');
					throw new Error('Fiat payment not yet implemented');
				};

				/**
				 * Handles cryptocurrency payment checkout
				 */
				const handleCheckoutCrypto = async () => {
					// Validate wallet balance before proceeding
					callbacks.onProgress?.('Validating wallet balance...');
					const balanceStartTime = performance.now();
					// TO PASS Chain ID HERE
					await validateWalletBalance(walletAddress, grandTotal, cartCurrency, chainId);
					const balanceEndTime = performance.now();
					console.debug(`⏱️ [Checkout] Wallet balance validation took: ${(balanceEndTime - balanceStartTime).toFixed(2)}ms`);

					// Prepare checkout request
					const checkoutRequest: CreateCheckoutRequest = {
						fromWalletAddress: walletAddress,
						paymentType: paymentTypeRequest,
						currency: cartCurrency,
						items: selectedItems.map((item) => ({
							productId: item.product.id,
							quantity: item.quantity,
							assetId: item.assetId ?? undefined,
						})),
					};

					// Create checkout on server
					callbacks.onProgress?.('Creating checkout and minting products...');
					const checkoutStartTime = performance.now();
					const checkoutResp = await createCheckout(checkoutRequest);
					const checkoutEndTime = performance.now();
					console.debug(`⏱️ [Checkout] Create checkout request took: ${(checkoutEndTime - checkoutStartTime).toFixed(2)}ms`);

					if (!checkoutResp.success) {
						throw new Error(maskServerError(checkoutResp.error) || 'Failed to create checkout');
					}

					// Validate checkout response has required id field
					if (!checkoutResp || !checkoutResp.checkoutId) {
						console.error('Invalid checkout response - missing id:', checkoutResp);
						throw new Error('Failed to create checkout: Invalid response from server');
					}

					const checkoutId = checkoutResp.checkoutId;

					// Terminal response with full checkout: use it and skip polling
					if (
						(checkoutResp.status === 'success' || checkoutResp.status === 'partial' || checkoutResp.status === 'failed') &&
						checkoutResp.checkout
					) {
						callbacks.onProgress?.('Finalizing transaction...');
						cartManager.syncWithServer(walletAddress).catch((e) => {
							console.warn('Cart sync after checkout failed:', e);
						});
						if (checkoutResp.status === 'success') {
							callbacks.onSuccess(checkoutResp.checkout);
						} else {
							callbacks.onFailure(checkoutResp.checkout as GetCheckoutByIdResponse);
						}
						return;
					}

					// Job in progress or no full checkout: poll getCheckoutStatus
					const FIRST_POLL_DELAY_MS = 5000; // allow web3-service time to register the new checkout
					const POLL_INTERVAL_MS = 2500;
					const MAX_WAIT_MS = 8 * 60 * 1000; // 8 minutes

					const formatProgressMessage = (s: CheckoutStatus): string => {
						const stageLabel =
							s.stage != null
								? s.stage.charAt(0).toUpperCase() + s.stage.slice(1)
								: s.status === 'processing'
									? 'Processing'
									: 'Pending';
						if (s.progress != null && s.progress >= 0 && s.progress <= 100) {
							return `${stageLabel}... ${s.progress}%`;
						}
						return `${stageLabel}...`;
					};

					checkoutPollingRef.current = { cancelled: false };
					const ref = checkoutPollingRef.current;
					callbacks.onProgress?.('Checkout started...');

					const pollingDone = new Promise<void>((resolve) => {
						const clearPolling = (): void => {
							if (ref.intervalId !== undefined) {
								clearInterval(ref.intervalId);
								ref.intervalId = undefined;
							}
							if (ref.maxTimeoutId !== undefined) {
								clearTimeout(ref.maxTimeoutId);
								ref.maxTimeoutId = undefined;
							}
							if (ref.initialDelayId !== undefined) {
								clearTimeout(ref.initialDelayId);
								ref.initialDelayId = undefined;
							}
							ref.cancelled = true;
							checkoutPollingRef.current = null;
						};

						const pollOnce = async (): Promise<void> => {
							if (ref.cancelled) return;
							try {
								const status = await getCheckoutStatus(checkoutId);
								if (ref.cancelled) return;
								callbacks.onProgress?.(formatProgressMessage(status));

								// Completed: success true, status 'completed', result has checkout response
								if (status.success && status.status === 'completed') {
									clearPolling();
									const checkoutData = status.result;
									if (checkoutData) {
										cartManager.syncWithServer(walletAddress).catch((e) => {
											console.warn('Cart sync after checkout failed:', e);
										});
										callbacks.onSuccess(checkoutData);
									} else {
										try {
											const resp = await getCheckoutById(checkoutId);
											if (!resp.success || !resp.data) {
												callbacks.onFailure(resp.error || 'Failed to load checkout result.');
											} else {
												cartManager.syncWithServer(walletAddress).catch((e) => {
													console.warn('Cart sync after checkout failed:', e);
												});
												callbacks.onSuccess(resp.data);
											}
										} catch (err) {
											console.error('[Checkout] getCheckoutById error:', err);
											callbacks.onFailure('Checkout completed but failed to load result. Please check your orders.');
										}
									}
									resolve();
									return;
								}

								// Failed: success false, status 'failed', error/errors describe the failure
								if (!status.success && status.status === 'failed') {
									clearPolling();
									const errorMsg =
										status.error ||
										(status.errors && status.errors.length > 0
											? status.errors.map((e) => e.error).filter(Boolean).join('; ') || 'Checkout failed.'
											: 'Checkout failed.');
									callbacks.onFailure(errorMsg);
									resolve();
									return;
								}

								// In progress: success false, status 'pending' or 'processing' → keep polling
								// (no extra branch needed; we just don't resolve and interval will call pollOnce again)
							} catch (err) {
								if (ref.cancelled) return;
								const msg = err instanceof Error ? err.message : '';
								// 404 / checkout not found: stop polling and dismiss the popup
								if (msg.includes('Checkout not found') || msg.includes('expired')) {
									clearPolling();
									callbacks.onFailure('Checkout not found or expired. Please try again.');
									resolve();
									return;
								}
								console.error('[Checkout] Poll getCheckoutStatus error:', err);
								// Continue polling on transient errors; next tick will retry
							}
						};

						ref.maxTimeoutId = setTimeout(() => {
							if (ref.cancelled) return;
							clearPolling();
							callbacks.onFailure('Checkout is taking longer than expected. Please check your order status.');
							resolve();
						}, MAX_WAIT_MS);

						// Delay first poll to allow web3-service time to register the new checkout
						ref.initialDelayId = setTimeout(() => {
							ref.initialDelayId = undefined;
							if (ref.cancelled) return;
							void pollOnce().then(() => {
								if (ref.cancelled) return;
								ref.intervalId = setInterval(pollOnce, POLL_INTERVAL_MS);
							});
						}, FIRST_POLL_DELAY_MS);
					});

					await pollingDone;
				};

				// Route to appropriate payment handler
				if (paymentTypeRequest === PaymentType.Fiat) {
					await handleCheckoutFiat();
				} else if (paymentTypeRequest === PaymentType.Crypto) {
					await handleCheckoutCrypto();
				} else {
					throw new Error('Unsupported currency type for checkout');
				}
			} catch (error) {
				console.error('Checkout failed:', error);
				const rawMessage = error instanceof Error ? error.message : 'Checkout failed';
				callbacks.onFailure(maskServerError(rawMessage));
			} finally {
				callbacks.onComplete();
			}
		},
		[walletAddress, collections, validateFromServer, validateWalletBalance],
	);

	// Memoized derived values
	const cartCount = cartManager.getCartCount();
	const cartTotal = cartManager.getCartTotal();

	return {
		// State
		collections,
		cartCount,
		cartTotal,
		isLoading,
		isInitialized,

		// Actions
		updateCollections,

		// Server-side actions
		addToCartWithSync,
		updateQuantityWithSync,
		updateSelectionWithSync,
		removeItemWithSync,
		syncWithServer,

		// Checkout actions
		handleCheckout,
		monitorOrderStatus,

		// Utilities
		hasItem,
		getItem,
	};
}

/**
 * Lightweight hook for components that only need cart count
 * Optimized for navbar and other simple displays
 */
export function useCartCount(walletAddress: string) {
	const [count, setCount] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const isMountedRef = useRef(true);

	useEffect(() => {
		isMountedRef.current = true;
		setIsLoading(true);

		// Handle empty wallet address
		if (!walletAddress) {
			setCount(0);
			setIsLoading(false);
			return;
		}

		const initializeCount = async () => {
			try {
				await getSharedInitialization(walletAddress);

				if (isMountedRef.current) {
					setCount(cartManager.getCartCount());
					setIsLoading(false);
				}
			} catch (error) {
				console.error('Error initializing cart count:', error);
				if (isMountedRef.current) {
					setCount(0);
					setIsLoading(false);
				}
			}
		};

		initializeCount();

		const unsubscribe = cartManager.subscribe((cart) => {
			if (isMountedRef.current) {
				const totalCount = cart.reduce((total, collection) => total + collection.items.length, 0);
				setCount(totalCount);
			}
		});

		return () => {
			isMountedRef.current = false;
			unsubscribe();
		};
	}, [walletAddress]);

	return { count, isLoading };
}

/**
 * Hook for cart items display (for popover/dropdown)
 * Returns limited items for performance
 */
export function useCartPreview(walletAddress: string, maxItems: number = 5) {
	const [items, setItems] = useState<ServerCartItem[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const isMountedRef = useRef(true);

	useEffect(() => {
		isMountedRef.current = true;
		setIsLoading(true);

		// Handle empty wallet address
		if (!walletAddress) {
			setItems([]);
			setTotalCount(0);
			setIsLoading(false);
			return;
		}

		const initializePreview = async () => {
			try {
				const cart = await getSharedInitialization(walletAddress);

				if (isMountedRef.current) {
					const allItems = cart.flatMap((collection) => collection.items);
					setItems(allItems.slice(0, maxItems));
					setTotalCount(allItems.length);
					setIsLoading(false);
				}
			} catch (error) {
				console.error('Error initializing cart preview:', error);
				if (isMountedRef.current) {
					setItems([]);
					setTotalCount(0);
					setIsLoading(false);
				}
			}
		};

		initializePreview();

		const unsubscribe = cartManager.subscribe((cart) => {
			if (isMountedRef.current) {
				const allItems = cart.flatMap((collection) => collection.items);
				setItems(allItems.slice(0, maxItems));
				setTotalCount(allItems.length);
			}
		});

		return () => {
			isMountedRef.current = false;
			unsubscribe();
		};
	}, [walletAddress, maxItems]);

	const removeItem = useCallback(
		(itemId: number) => {
			if (isMountedRef.current) {
				cartManager.removeItemWithSync(walletAddress, itemId);
			}
		},
		[walletAddress],
	);

	return {
		items,
		totalCount,
		isLoading,
		removeItem,
		hasMore: totalCount > maxItems,
	};
}

/**
 * Hook for checking cart item availability
 * Used for validation before adding items to cart
 */
export function useCartAvailability() {
	const [isChecking, setIsChecking] = useState(false);

	const checkAvailability = useCallback(
		async (walletAddress: string, productId: number, quantity: number): Promise<CartAvailabilityCheck | null> => {
			if (!walletAddress) {
				return {
					canAdd: false,
					reason: 'Wallet address is required',
					cartQuantity: 0,
					availableQuantity: 0,
				};
			}

			setIsChecking(true);
			try {
				const result = await cartManager.checkItemAvailability(walletAddress, productId, quantity);
				return result;
			} catch (error) {
				console.error('Error checking availability:', error);
				return {
					canAdd: false,
					reason: 'Failed to check availability',
					cartQuantity: 0,
					availableQuantity: 0,
				};
			} finally {
				setIsChecking(false);
			}
		},
		[],
	);

	return {
		checkAvailability,
		isChecking,
	};
}

export function parseVoucherMetadata(voucherMetaData: any): VoucherMetadata | null {
	try {
		if (!voucherMetaData) return null;

		// If it's already an object, return it
		if (typeof voucherMetaData === 'object') {
			return voucherMetaData as VoucherMetadata;
		}

		// If it's a string, try to parse it
		if (typeof voucherMetaData === 'string') {
			const parsed = JSON.parse(voucherMetaData);
			return parsed as VoucherMetadata;
		}

		return null;
	} catch (error) {
		console.warn('Failed to parse voucher metadata:', error);
		return null;
	}
}
