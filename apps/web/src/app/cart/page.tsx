'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
	Button,
	Checkbox,
	Tooltip,
	Modal,
	ModalContent,
	ModalHeader,
	ModalBody,
	ModalFooter,
	useDisclosure,
} from '@nextui-org/react';
import { useCartState, parseVoucherMetadata } from '@/hooks/useCartState';
import { CartItem, CartCollection } from '@/lib/CartManager';
import { useGlobalState } from '@/lib/GlobalContext';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { ToastMessage } from '@/components/ToastMessage';
import { AssetType, PlatformFeeType } from '@/types';
import { getChargeByLocation } from '@/apihandler/Admin';
import {
	CheckoutLoadingModal,
	CheckoutSuccessModal,
	CheckoutFailureModal,
} from '@/components/CheckoutModals';
import '@/styles/scrollbar.css';
import {
	convertIPFSUrl,
	numberWithCommas,
	replaceVoucherWithAsset,
} from '@/lib/Util';
import { getBlockchains } from '@/apihandler/Wallet';

/* ----------------------
   CartTable component (separate, reusable)
   ---------------------- */
function CartTable({
	collections,
	onUpdateSelectionWithSync,
	onUpdateQuantityWithSync,
	onRemoveItemWithSync,
	onSyncWithServer,
	getBlockchainByChainId,
}: {
	collections: CartCollection[];
	onUpdateSelectionWithSync: (
		itemId: number,
		isSelected: boolean,
	) => Promise<{ success: boolean; error?: string }>;
	onUpdateQuantityWithSync: (
		itemId: number,
		quantity: number,
		checkoutAction?: 'BuyAndMint' | 'BuyAndTransfer',
	) => Promise<{ success: boolean; error?: string }>;
	onRemoveItemWithSync: (
		itemId: number,
	) => Promise<{ success: boolean; error?: string }>;
	onSyncWithServer: () => Promise<{ success: boolean; error?: string }>;
	getBlockchainByChainId: (
		chainId: string,
	) => { chainId: string; name: string; logoUrl: string } | undefined;
}) {
	const router = useRouter();
	const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());
	const [loadingSelections, setLoadingSelections] = useState<Set<number>>(
		new Set(),
	);
	const [optimisticUpdates, setOptimisticUpdates] = useState<
		Map<number, { isSelected?: boolean; quantity?: number }>
	>(new Map());
	const debounceTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());

	// Remove item confirmation modal state
	const {
		isOpen: isRemoveModalOpen,
		onOpen: onRemoveModalOpen,
		onClose: onRemoveModalClose,
	} = useDisclosure();
	const [itemToRemove, setItemToRemove] = useState<{
		collectionId: number;
		itemId: number;
		itemName: string;
	} | null>(null);

	// Cleanup debounce timeouts on unmount
	useEffect(() => {
		return () => {
			debounceTimeouts.current.forEach((timeout) =>
				clearTimeout(timeout),
			);
			debounceTimeouts.current.clear();
		};
	}, []);

	// Standardized error handler
	const handleOperationError = useCallback(
		(error: unknown, operation: string, itemId?: number) => {
			const errorMessage =
				error instanceof Error
					? error.message
					: `Failed to ${operation}`;
			const userFriendlyMessage = errorMessage.includes('network')
				? `Network error while ${operation}. Please check your connection and try again.`
				: errorMessage.includes('validation')
					? `Invalid data while ${operation}. Please refresh and try again.`
					: `Unable to ${operation}. Please try again.`;

			ToastMessage('error', userFriendlyMessage);
			console.error(`Error ${operation}:`, error);

			// Clear optimistic update on error
			if (itemId) {
				setOptimisticUpdates((prev) => {
					const next = new Map(prev);
					next.delete(itemId);
					return next;
				});
			}
		},
		[],
	);

	// Get effective item state (optimistic + actual)
	const getEffectiveItemState = useCallback(
		(item: CartItem) => {
			const optimistic = optimisticUpdates.get(item.id);
			return {
				...item,
				isSelected:
					optimistic?.isSelected !== undefined
						? optimistic.isSelected
						: item.isSelected,
				quantity:
					optimistic?.quantity !== undefined
						? optimistic.quantity
						: item.quantity,
			};
		},
		[optimisticUpdates],
	);

	// Effective available number (same 721AC logic as getAvailableQuantity) for validation and display
	const getEffectiveAvailable = useCallback((item: CartItem): number => {
		const is721AC = item.product.collection?.contractType === 'ERC721AC';
		const availableQty = item.product.availableQuantity;
		const maxQty = item.product.maxQuantity;
		if (is721AC) {
			if (item.assetId) {
				return 1;
			}
			// 721AC: availableQuantity === 0 and maxQuantity === 0 → unlimited
			if (availableQty === 0 && (maxQty == null || maxQty === 0))
				return Number.POSITIVE_INFINITY;
			// 721AC: mint with cap
			if (maxQty != null && maxQty > 0 && availableQty === 0)
				return maxQty;
			// 721AC: sold out (e.g. maxQty set but no stock)
			if (maxQty !== availableQty && availableQty === 0) return 0;
			return availableQty;
		}
		return availableQty;
	}, []);

	// Debounced server sync after successful operations
	const debouncedServerSync = useCallback(() => {
		const timeoutId = setTimeout(async () => {
			try {
				await onSyncWithServer();
			} catch (error) {
				console.warn('Background server sync failed:', error);
			}
		}, 1000); // Sync 1 second after last operation

		// Clear existing timeout
		if (debounceTimeouts.current.has(-1)) {
			clearTimeout(debounceTimeouts.current.get(-1)!);
		}
		debounceTimeouts.current.set(-1, timeoutId);
	}, [onSyncWithServer]);

	// Handle individual item selection with optimistic updates
	const toggleItemSelection = useCallback(
		async (itemId: number) => {
			const currentItem = collections
				.flatMap((col) => col.items)
				.find((item) => item.id === itemId);
			if (!currentItem) {
				handleOperationError(
					new Error('Item not found'),
					'update selection',
				);
				return;
			}

			const newIsSelected = !currentItem.isSelected;

			// Optimistic update
			setOptimisticUpdates((prev) =>
				new Map(prev).set(itemId, {
					...prev.get(itemId),
					isSelected: newIsSelected,
				}),
			);

			// Add to loading state
			setLoadingSelections((prev) => new Set(prev).add(itemId));

			try {
				// Validate operation
				if (typeof newIsSelected !== 'boolean') {
					throw new Error('Invalid selection state');
				}

				const result = await onUpdateSelectionWithSync(
					itemId,
					newIsSelected,
				);

				if (!result.success) {
					throw new Error(
						result.error || 'Server rejected selection update',
					);
				}

				// Clear optimistic update on success
				setOptimisticUpdates((prev) => {
					const next = new Map(prev);
					const current = next.get(itemId);
					if (current) {
						delete current.isSelected;
						if (Object.keys(current).length === 0) {
							next.delete(itemId);
						}
					}
					return next;
				});

				// Trigger background server sync
				debouncedServerSync();
			} catch (error) {
				handleOperationError(error, 'update selection', itemId);
			} finally {
				setLoadingSelections((prev) => {
					const next = new Set(prev);
					next.delete(itemId);
					return next;
				});
			}
		},
		[
			collections,
			onUpdateSelectionWithSync,
			handleOperationError,
			debouncedServerSync,
		],
	);

	// Debounced quantity update to prevent rapid server calls
	const debouncedQuantityUpdate = useCallback(
		(
			itemId: number,
			newQty: number,
			checkoutAction: 'BuyAndMint' | 'BuyAndTransfer',
		) => {
			// Clear existing timeout for this item
			if (debounceTimeouts.current.has(itemId)) {
				clearTimeout(debounceTimeouts.current.get(itemId)!);
			}

			// Set new timeout
			const timeoutId = setTimeout(async () => {
				try {
					const result = await onUpdateQuantityWithSync(
						itemId,
						newQty,
						checkoutAction,
					);

					if (!result.success) {
						throw new Error(
							result.error || 'Server rejected quantity update',
						);
					}

					// Clear optimistic update on success
					setOptimisticUpdates((prev) => {
						const next = new Map(prev);
						const current = next.get(itemId);
						if (current) {
							delete current.quantity;
							if (Object.keys(current).length === 0) {
								next.delete(itemId);
							}
						}
						return next;
					});

					// Trigger background server sync
					debouncedServerSync();
				} catch (error) {
					handleOperationError(error, 'update quantity', itemId);
				} finally {
					setLoadingItems((prev) => {
						const next = new Set(prev);
						next.delete(itemId);
						return next;
					});
				}
			}, 500); // 500ms debounce for quantity updates

			debounceTimeouts.current.set(itemId, timeoutId);
		},
		[onUpdateQuantityWithSync, handleOperationError, debouncedServerSync],
	);

	// Handle quantity updates with optimistic updates and debouncing
	const updateQty = useCallback(
		async (collectionId: number, itemId: number, delta: number) => {
			const item = collections
				.find((c) => c.collection.collectionId === collectionId)
				?.items.find((i) => i.id === itemId);

			if (!item) {
				handleOperationError(
					new Error('Item not found'),
					'update quantity',
				);
				return;
			}

			const currentQty = getEffectiveItemState(item).quantity;
			const newQty = Math.max(1, currentQty + delta);

			// Validate quantity limits (skip cap when unlimited)
			const maxQty = getEffectiveAvailable(item);
			if (delta > 0 && Number.isFinite(maxQty) && newQty > maxQty) {
				ToastMessage(
					'error',
					`Cannot add more items. Only ${maxQty} available in stock.`,
				);
				return;
			}

			if (newQty < 1) {
				ToastMessage('error', 'Quantity cannot be less than 1');
				return;
			}

			// Optimistic update
			setOptimisticUpdates((prev) =>
				new Map(prev).set(itemId, {
					...prev.get(itemId),
					quantity: newQty,
				}),
			);

			// Add to loading state
			setLoadingItems((prev) => new Set(prev).add(itemId));

			console.log(newQty);
			// Debounced server update
			debouncedQuantityUpdate(itemId, newQty, item.checkoutAction);
		},
		[
			collections,
			getEffectiveAvailable,
			getEffectiveItemState,
			handleOperationError,
			debouncedQuantityUpdate,
		],
	);

	// Open confirmation modal for item removal
	const openRemoveConfirmation = useCallback(
		(collectionId: number, itemId: number) => {
			const item = collections
				.find((c) => c.collection.collectionId === collectionId)
				?.items.find((i) => i.id === itemId);

			if (!item) {
				handleOperationError(
					new Error('Item not found'),
					'remove item',
				);
				return;
			}

			setItemToRemove({
				collectionId,
				itemId,
				itemName: item.product.name,
			});
			onRemoveModalOpen();
		},
		[collections, handleOperationError, onRemoveModalOpen],
	);

	// Handle confirmed item removal
	const confirmRemoveItem = useCallback(async () => {
		if (!itemToRemove) return;

		const { itemId } = itemToRemove;

		// Close modal
		onRemoveModalClose();

		// Add to loading state
		setLoadingItems((prev) => new Set(prev).add(itemId));

		try {
			const result = await onRemoveItemWithSync(itemId);

			if (!result.success) {
				throw new Error(result.error || 'Server rejected item removal');
			}

			// Clear any optimistic updates for this item
			setOptimisticUpdates((prev) => {
				const next = new Map(prev);
				next.delete(itemId);
				return next;
			});

			// Clear any pending debounced updates
			if (debounceTimeouts.current.has(itemId)) {
				clearTimeout(debounceTimeouts.current.get(itemId)!);
				debounceTimeouts.current.delete(itemId);
			}

			// Trigger background server sync
			debouncedServerSync();
		} catch (error) {
			handleOperationError(error, 'remove item', itemId);
		} finally {
			setLoadingItems((prev) => {
				const next = new Set(prev);
				next.delete(itemId);
				return next;
			});
			setItemToRemove(null);
		}
	}, [
		itemToRemove,
		onRemoveItemWithSync,
		handleOperationError,
		debouncedServerSync,
		onRemoveModalClose,
	]);

	function collectionTotal(items: CartItem[]) {
		return items
			.filter(
				(item) =>
					item.isSelected && item.product.consumerAction !== 'None',
			)
			.reduce(
				(s, it) =>
					s + parseFloat(it.product.price || '0') * it.quantity,
				0,
			);
	}

	const getAvailableQuantity = (item: CartItem) => {
		const is721AC = item.product.collection?.contractType === 'ERC721AC';

		const availableQty = item.assetId ? 1 : item.product.availableQuantity;
		const maxQty = item.product.maxQuantity;
		if (is721AC) {
			// 721AC: availableQuantity === 0 and maxQuantity === 0 → unlimited (don't disable)
			if (availableQty === 0 && (maxQty == null || maxQty === 0))
				return false;
			// 721AC: can buy when maxQuantity set and availableQuantity === 0 (mint)
			if (maxQty != null && maxQty > 0 && availableQty === 0)
				return false;
			// 721AC: disable when maxQuantity !== availableQuantity and availableQuantity === 0
			return maxQty !== availableQty && availableQty === 0;
		}
		return availableQty === 0;
	};

	return (
		<div className='w-full bg-[#323131] border rounded-md text-[#F1F0EB] text-[13px]'>
			{/* Header row */}
			<div className='hidden md:grid grid-cols-12 gap-4 items-center border-b p-3 mb-4 font-bold'>
				<div className='col-span-1 text-center ml-3'>Select</div>
				<div className='col-span-5 text-center'>Product:</div>
				<div className='col-span-2 text-center'>Qty:</div>
				<div className='col-span-2 text-center'>Total:</div>
				<div className='col-span-2 text-right mr-3'>Action:</div>
			</div>

			<div className='space-y-5 mx-3 mb-4'>
				{collections.length === 0 && (
					<div className='text-slate-300'>
						No items in cart collections.
					</div>
				)}

				{collections.map((col: CartCollection) => (
					<section
						key={col.collection.collectionId}
						className='bg-[#323131] rounded-lg border border-[#6E6E6E]'
						aria-labelledby={`col-${col.collection.collectionId}`}
					>
						<div className='mb-3 p-2 bg-[#454343] rounded-t-lg flex flex-row items-center gap-1.5'>
							{col.collection.chainId && (
								<Image
									src={
										getBlockchainByChainId(
											col.collection.chainId!,
										)?.logoUrl!
									}
									alt='chain icon'
									width={20}
									height={20}
									className='ml-4'
								/>
							)}
							<h3
								id={`col-${col.collection.collectionId}`}
								className='text-lg font-semibold text-[#A79755] inline-block cursor-pointer'
								onClick={() =>
									router.push(
										'/collection/' +
											col.collection.collectionId,
									)
								}
							>
								{col.collection.name}
							</h3>
						</div>

						<div className='space-y-4 p-4'>
							{col.items.map((item: CartItem) => {
								const isItemLoading = loadingItems.has(item.id);
								const effectiveItem =
									getEffectiveItemState(item);
								// Parse voucher metadata outside of hooks
								const metaData = item.assetId
									? parseVoucherMetadata(
											item.product.asset?.find(
												(asset) =>
													asset.id === item.assetId,
											)?.metadata,
										)
									: parseVoucherMetadata(
											item.product.voucher.metadata,
										);
								const assetData = item.product.asset?.find(
									(asset) => asset.id === item.assetId,
								);

								return (
									<div
										key={item.id}
										className={
											isItemLoading ? 'opacity-60' : ''
										}
									>
										<div className='grid grid-cols-12 gap-4 items-center'>
											{/* Checkbox cell */}
											<div className='col-span-1 flex justify-center'>
												{item.product.consumerAction !==
													'None' && (
													<Checkbox
														id={`item-${item.id}`}
														isSelected={
															effectiveItem.isSelected
														}
														onChange={() =>
															toggleItemSelection(
																item.id,
															)
														}
														isDisabled={
															getAvailableQuantity(
																item,
															) ||
															loadingSelections.has(
																item.id,
															)
														}
													/>
												)}
											</div>

											{/* Product cell */}
											<div className='col-span-11 md:col-span-5 flex items-center gap-3'>
												<div
													className='w-16 h-16 bg-slate-700 rounded overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer'
													onClick={() =>
														router.push(
															'/product/' +
																item.productId,
														)
													}
												>
													{metaData?.image ? (
														<Image
															src={
																convertIPFSUrl(
																	metaData.image,
																) ?? ''
															}
															alt={
																item.product
																	.name
															}
															width={64}
															height={64}
															className='object-cover w-full h-full'
															onError={(e) => {
																console.warn(
																	`Failed to load image for ${item.product.name}:`,
																	metaData.image,
																);
																// Hide the image element on error
																(
																	e.target as HTMLImageElement
																).style.display =
																	'none';
															}}
														/>
													) : (
														<div className='w-full h-full flex items-center justify-center text-slate-400 text-xs'>
															No Image
														</div>
													)}
												</div>
												<div>
													<div className='font-normal text-slate-100'>
														{item.product.name}
														<span
															style={{
																marginLeft:
																	'6px',
															}}
														>
															#
															{item.assetId
																? assetData?.tokenId
																: item.product
																		.id}
														</span>
														{isItemLoading && (
															<span className='ml-2 text-xs text-slate-400'>
																Updating...
															</span>
														)}
													</div>
												</div>
											</div>

											{/* Qty */}
											{item.product.consumerAction !==
											'None' ? (
												<>
													<div className='col-span-6 md:col-span-2 flex flex-col  justify-start md:justify-center'>
														<div className='inline-flex items-center border border-slate-700 rounded mx-auto'>
															<button
																aria-label={`Decrease quantity for ${item.product.name}`}
																onClick={() =>
																	updateQty(
																		col
																			.collection
																			.collectionId,
																		item.id,
																		-1,
																	)
																}
																disabled={
																	isItemLoading ||
																	item.quantity <=
																		1 ||
																	item.product
																		.consumerAction ===
																		'None'
																}
																className='px-2 py-1 text-slate-200 hover:bg-slate-700/40 disabled:opacity-50 disabled:cursor-not-allowed '
															>
																-
															</button>
															<div className='px-3 py-1 bg-slate-900 text-center min-w-[30px] text-slate-100 font-xs'>
																{
																	effectiveItem.quantity
																}
															</div>
															<button
																aria-label={`Increase quantity for ${item.product.name}`}
																onClick={() =>
																	updateQty(
																		col
																			.collection
																			.collectionId,
																		item.id,
																		+1,
																	)
																}
																disabled={
																	isItemLoading ||
																	getAvailableQuantity(
																		item,
																	)
																}
																className='px-2 py-1 text-slate-200 hover:bg-slate-700/40 disabled:opacity-50 disabled:cursor-not-allowed '
															>
																+
															</button>
														</div>
														{/* Stock availability indicator */}
														<div className='text-slate-400 mt-1 text-center'>
															{(() => {
																const available =
																	item.assetId
																		? 1
																		: item
																				.product
																				.availableQuantity;
																const isUnlimited =
																	item.product
																		.collection
																		?.contractType ===
																		'ERC721AC' &&
																	item.product
																		.maxQuantity ===
																		0 &&
																	available ===
																		0;

																if (
																	isUnlimited &&
																	!item.assetId
																) {
																	return null;
																}

																const remaining =
																	available -
																	item.quantity;

																if (
																	item.product
																		.consumerAction ===
																	'None'
																) {
																	return (
																		<span className='text-red-500 text-xs'>
																			Sold
																			out!
																		</span>
																	);
																}

																if (
																	item.quantity >=
																	available
																) {
																	return (
																		<span className='text-orange-400 text-[10px]'>
																			Max
																			quantity
																			reached
																		</span>
																	);
																}

																return (
																	<span className='text-xs'>
																		{
																			remaining
																		}{' '}
																		more
																		available
																	</span>
																);
															})()}
														</div>
													</div>
													{/* Total */}
													<div className='col-span-6 md:col-span-2 text-right'>
														<div className='font-medium text-slate-100'>
															<div className='flex flex-row items-center gap-1'>
																{getBlockchainByChainId(
																	item.product
																		.collection
																		.chainId!,
																)?.logoUrl! && (
																	<Image
																		src={
																			getBlockchainByChainId(
																				item
																					.product
																					.collection
																					.chainId!,
																			)
																				?.logoUrl!
																		}
																		alt='chain icon'
																		width={
																			15
																		}
																		height={
																			15
																		}
																	/>
																)}
																{numberWithCommas(
																	parseFloat(
																		(item.assetId
																			? assetData?.price
																			: item
																					.product
																					.price) ||
																			'0',
																	) *
																		item.quantity,
																	2,
																)}{' '}
																{
																	item.product
																		.currencySymbol
																}
															</div>
														</div>
													</div>
												</>
											) : (
												<div className='col-span-12 md:col-span-4 text-center'>
													<div className='text-slate-400 mt-1 text-center'>
														<span className='text-red-500 text-xs'>
															Product has been
															unlisted from sale
														</span>
													</div>
												</div>
											)}

											{/* Action */}
											<div className='col-span-12 md:col-span-2 flex justify-end'>
												<Button
													aria-label={`Remove ${item.product.name}`}
													onClick={() =>
														openRemoveConfirmation(
															col.collection
																.collectionId,
															item.id,
														)
													}
													disabled={isItemLoading}
													className='bg-transparent hover:shadow-sm hover:bg-slate-700/40 disabled:opacity-50'
													isIconOnly
													title='Remove item'
												>
													<Image
														className='cursor-pointer'
														src={
															'/creator/trashGrey.svg'
														}
														alt={'remove'}
														width={20}
														height={20}
													/>
												</Button>
											</div>
										</div>

										<hr className='border-slate-700/60 my-3' />
									</div>
								);
							})}

							<div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3 justify-self-end'>
								<div className='text-right '>
									<div className='text-sm text-slate-400 text-left'>
										Collection total
									</div>
									<div className='text-lg font-semibold text-slate-100'>
										{numberWithCommas(
											collectionTotal(col.items),
											2,
										)}{' '}
										{col.items.find(
											(item) => item.isSelected,
										)?.product.currencySymbol || 'USDC'}
									</div>
								</div>
							</div>
						</div>
					</section>
				))}
			</div>

			{/* Remove Item Confirmation Modal */}
			<Modal
				isOpen={isRemoveModalOpen}
				onClose={onRemoveModalClose}
				className='dark text-foreground bg-background'
			>
				<ModalContent>
					{(onClose) => (
						<>
							<ModalHeader className='flex flex-col gap-1'>
								Remove Item from Cart
							</ModalHeader>
							<ModalBody>
								<p>
									Are you sure you want to remove{' '}
									<strong>{itemToRemove?.itemName}</strong>{' '}
									from your cart?
								</p>
							</ModalBody>
							<ModalFooter>
								<Button
									color='default'
									variant='light'
									onPress={onClose}
								>
									Cancel
								</Button>
								<Button
									color='danger'
									onPress={confirmRemoveItem}
								>
									Remove
								</Button>
							</ModalFooter>
						</>
					)}
				</ModalContent>
			</Modal>
		</div>
	);
}

/* ----------------------
   Page: CartPage (reads localStorage, keeps state, renders CartTable + summary)
   ---------------------- */

export default function CartPage() {
	// Get global state for wallet address (for future server integration)
	const [gs, setGs] = useGlobalState();
	const [subtotal, setSubtotal] = useState<number>(0);
	const [grandTotal, setGrandTotal] = useState<number>(0);
	const [charges, setCharges] = useState<PlatformFeeType[]>([]);
	const [chargesLoading, setChargesLoading] = useState<boolean>(false);
	const [chargesError, setChargesError] = useState<string | null>(null);
	const [currencyMismatch, setCurrencyMismatch] = useState<boolean>(false);
	const [selectedCurrency, setSelectedCurrency] = useState<string>('');
	const [blockchains, setBlockchains] = useState<
		Array<{ chainId: string; name: string; logoUrl: string }>
	>([]);
	const [blockchainsLoading, setBlockchainsLoading] =
		useState<boolean>(false);
	const blockchainsFetchedRef = useRef<boolean>(false);
	const getChainsPromiseRef = useRef<Promise<void> | null>(null);

	// Checkout modal states
	const [showLoadingModal, setShowLoadingModal] = useState<boolean>(false);
	const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
	const [showFailureModal, setShowFailureModal] = useState<boolean>(false);
	const [checkoutData, setCheckoutData] = useState<any>(null);
	const [checkoutError, setCheckoutError] = useState<string>('');
	const [isProcessingCheckout, setIsProcessingCheckout] =
		useState<boolean>(false);
	const [checkoutLoadingState, setCheckoutLoadingState] =
		useState<string>('Processing...');

	const {
		collections,
		isLoading,
		updateQuantityWithSync,
		removeItemWithSync,
		updateSelectionWithSync,
		syncWithServer,
		handleCheckout: handleCheckoutFromHook,
	} = useCartState(gs?.walletAddress || '');

	// Helper function to get blockchain by chainId
	const getBlockchainByChainId = (
		chainId: string,
	): { chainId: string; name: string; logoUrl: string } | undefined => {
		return blockchains.find((b) => b.chainId === chainId);
	};

	useEffect(() => {
		fetchCharges();
		syncWithServer();

		// Fetch blockchains only once - check if already fetched or if blockchains array has data
		if (blockchainsFetchedRef.current || blockchains.length > 0) {
			return;
		}

		// If there's already a pending request, don't start another
		if (getChainsPromiseRef.current) {
			return;
		}

		// Mark as fetching
		blockchainsFetchedRef.current = true;
		setBlockchainsLoading(true);

		// Create and store the promise
		const fetchPromise = (async () => {
			try {
				const blockchainsRes = await getBlockchains();
				if (blockchainsRes.success && blockchainsRes.data) {
					setBlockchains(
						blockchainsRes.data.map((b) => ({
							chainId: b.chainId,
							name: b.name,
							logoUrl: b.logoUrl,
						})),
					);
				}
			} catch (error) {
				console.error('Error fetching blockchains:', error);
				// Reset ref on error so it can be retried
				blockchainsFetchedRef.current = false;
			} finally {
				setBlockchainsLoading(false);
				getChainsPromiseRef.current = null;
			}
		})();

		getChainsPromiseRef.current = fetchPromise;

		// Cleanup function to cancel pending request if component unmounts
		return () => {
			// Note: We don't reset blockchainsFetchedRef here to prevent re-fetching on remount
			// The ref persists across remounts in React Strict Mode
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [blockchains.length]);

	const selectedItems = useMemo(() => {
		return collections.flatMap((col) =>
			col.items.filter(
				(item) =>
					item.isSelected && item.product.consumerAction !== 'None',
			),
		);
	}, [collections]);

	// Group selected items by chainId
	const groupedItemsByChain = useMemo(() => {
		const grouped = new Map<string, typeof selectedItems>();
		selectedItems.forEach((item) => {
			const chainId = item.product.collection?.chainId || 'unknown';
			if (!grouped.has(chainId)) {
				grouped.set(chainId, []);
			}
			grouped.get(chainId)!.push(item);
		});
		return Array.from(grouped.entries()).map(([chainId, items]) => ({
			chainId,
			items,
		}));
	}, [selectedItems]);

	const fetchCharges = async () => {
		setChargesLoading(true);
		setChargesError(null);
		try {
			const res = await getChargeByLocation('Checkout');
			setCharges(res || []);
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: 'Failed to load charges';
			setChargesError(errorMessage);
			console.error('Failed to fetch charges:', error);
			ToastMessage(
				'error',
				'Failed to load checkout charges. Please refresh the page.',
			);
		} finally {
			setChargesLoading(false);
		}
	};

	// Calculate subtotal from selected items and check currency consistency
	useEffect(() => {
		// Check if all selected items have the same currency
		const currencies = new Set(
			selectedItems.map((item) => item.product.currencySymbol),
		);

		const hasMismatch = currencies.size > 1;
		setCurrencyMismatch(hasMismatch);

		// Set the selected currency (use the first one if available)
		if (selectedItems.length > 0) {
			setSelectedCurrency(selectedItems[0].product.currencySymbol);
		} else {
			setSelectedCurrency('');
		}

		// Calculate Subtotal
		const total = selectedItems.reduce((sum, item) => {
			const price = parseFloat(item.product.price || '0');
			return sum + (isNaN(price) ? 0 : price) * item.quantity;
		}, 0);

		setSubtotal(total);
	}, [selectedItems]);

	// Calculate grand total including charges
	useEffect(() => {
		let total = subtotal;

		charges.forEach((charge) => {
			if (charge.fixedAmount && charge.fixedAmount > 0) {
				total += charge.fixedAmount;
			} else if (charge.percentage && charge.percentage > 0) {
				total += (subtotal * charge.percentage) / 100;
			}
		});

		setGrandTotal(total);
	}, [subtotal, charges]);

	// Format charge value for display
	const formatChargeValue = (
		charge: PlatformFeeType,
		currencySymbol: string = 'USDC',
	): string => {
		if (charge.fixedAmount && charge.fixedAmount > 0) {
			return `${charge.fixedAmount.toFixed(2)} ${currencySymbol}`;
		} else if (charge.percentage && charge.percentage > 0) {
			return `${charge.percentage}%`;
		}
		return 'Free';
	};

	// Calculate actual charge amount
	// const calculateChargeAmount = (charge: PlatformFeeType): number => {
	// 	if (charge.fixedAmount && charge.fixedAmount > 0) {
	// 		return charge.fixedAmount;
	// 	} else if (charge.percentage && charge.percentage > 0) {
	// 		return (subtotal * charge.percentage) / 100;
	// 	}
	// 	return 0;
	// };

	// Calculate subtotal for a specific group of items
	const calculateGroupSubtotal = useCallback(
		(items: typeof selectedItems): number => {
			return items.reduce((sum, item) => {
				const assetData = item.product.asset?.find(
					(asset) => asset.id === item.assetId,
				);
				const price = parseFloat(
					(item.assetId ? assetData?.price : item.product.price) ||
						'0',
				);
				return sum + (isNaN(price) ? 0 : price) * item.quantity;
			}, 0);
		},
		[],
	);

	// Calculate charge amount for a specific group
	const calculateGroupChargeAmount = (
		charge: PlatformFeeType,
		groupSubtotal: number,
	): number => {
		if (charge.fixedAmount && charge.fixedAmount > 0) {
			return charge.fixedAmount;
		} else if (charge.percentage && charge.percentage > 0) {
			return (groupSubtotal * charge.percentage) / 100;
		}
		return 0;
	};

	// Calculate grand total for a specific group
	const calculateGroupGrandTotal = useCallback(
		(items: typeof selectedItems): number => {
			const groupSubtotal = calculateGroupSubtotal(items);
			let total = groupSubtotal;

			charges.forEach((charge) => {
				total += calculateGroupChargeAmount(charge, groupSubtotal);
			});

			return total;
		},
		[calculateGroupSubtotal, charges],
	);

	// Handle checkout process using the hook
	// const handleCheckout = useCallback(async () => {
	// 	// Prevent multiple simultaneous checkouts
	// 	if (isProcessingCheckout) {
	// 		return;
	// 	}

	// 	// Check for currency mismatch
	// 	if (currencyMismatch) {
	// 		ToastMessage(
	// 			'error',
	// 			'Cannot checkout with mixed currencies. Please select items with the same currency only.'
	// 		);
	// 		return;
	// 	}

	// 	// Validate grand total before proceeding
	// 	if (!grandTotal || grandTotal <= 0) {
	// 		ToastMessage(
	// 			'error',
	// 			'Invalid checkout amount. Please refresh and try again.'
	// 		);
	// 		return;
	// 	}

	// 	await handleCheckoutFromHook(
	// 		{
	// 			onStart: () => {
	// 				setIsProcessingCheckout(true);
	// 				setShowLoadingModal(true);
	// 				setCheckoutError('');
	// 				setCheckoutLoadingState('Processing...');
	// 			},
	// 			onSuccess: (checkout) => {
	// 				setCheckoutData(checkout);
	// 				setShowLoadingModal(false);
	// 				setShowSuccessModal(true);
	// 			},
	// 			onFailure: (error) => {
	// 				setCheckoutError(error as any);
	// 				setShowLoadingModal(false);
	// 				setShowFailureModal(true);
	// 			},
	// 			onComplete: () => {
	// 				setIsProcessingCheckout(false);
	// 			},
	// 			onProgress: (state) => {
	// 				setCheckoutLoadingState(state);
	// 			},
	// 		},
	// 		grandTotal // Pass grandTotal as second parameterm
	// 	);
	// }, [
	// 	handleCheckoutFromHook,
	// 	isProcessingCheckout,
	// 	grandTotal,
	// 	currencyMismatch,
	// ]);

	// Handle checkout for a specific chain group
	const handleGroupCheckout = useCallback(
		async (items: typeof selectedItems, chainId: string) => {
			// Prevent multiple simultaneous checkouts
			if (isProcessingCheckout) {
				return;
			}
			console.log(items);
			// Check if all items in this group have the same currency
			const currencies = new Set(
				items.map((item) => item.product.currencySymbol),
			);
			if (currencies.size > 1) {
				ToastMessage(
					'error',
					'Cannot checkout with mixed currencies. Please select items with the same currency only.',
				);
				return;
			}

			const groupGrandTotal = calculateGroupGrandTotal(items);

			// Validate grand total before proceeding
			if (!groupGrandTotal || groupGrandTotal <= 0) {
				ToastMessage(
					'error',
					'Invalid checkout amount. Please refresh and try again.',
				);
				return;
			}

			// Note: The checkout hook processes all selected items, not just this group
			// For true per-group checkout, you would need to temporarily deselect
			// items from other chains before calling checkout
			await handleCheckoutFromHook(
				{
					onStart: () => {
						setIsProcessingCheckout(true);
						setShowLoadingModal(true);
						setCheckoutError('');
						setCheckoutLoadingState('Processing...');
					},
					onSuccess: (checkout) => {
						setCheckoutData(checkout);
						setShowLoadingModal(false);
						setShowSuccessModal(true);
					},
					onFailure: (error) => {
						console.log('error', error);
						setCheckoutError(error as any);
						setShowLoadingModal(false);
						setShowFailureModal(true);
					},
					onComplete: () => {
						setIsProcessingCheckout(false);
					},
					onProgress: (state) => {
						setCheckoutLoadingState(state);
					},
				},
				groupGrandTotal,
				chainId,
			);
		},
		[
			handleCheckoutFromHook,
			isProcessingCheckout,
			calculateGroupGrandTotal,
		],
	);

	// Close modal handlers
	const closeModals = useCallback(() => {
		setShowLoadingModal(false);
		setShowSuccessModal(false);
		setShowFailureModal(false);
		setCheckoutData(null);
		setCheckoutError('');
	}, []);

	return (
		<>
			<div className='px-5 md:px-10 py-5 max-h-screen text-slate-100 '>
				<div className='flex justify-between items-center mb-4'>
					<h1 className='text-2xl font-bold'>Shopping Cart</h1>
				</div>

				<div className='grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20'>
					{/* Cart table area */}
					<div className='lg:col-span-2  overflow-y-auto custom-scrollbar'>
						{isLoading ? (
							<div className='p-6 bg-slate-800 rounded'>
								Loading cart…
							</div>
						) : collections.length > 0 ? (
							<CartTable
								collections={collections}
								onUpdateQuantityWithSync={
									updateQuantityWithSync
								}
								onUpdateSelectionWithSync={
									updateSelectionWithSync
								}
								onRemoveItemWithSync={removeItemWithSync}
								onSyncWithServer={syncWithServer}
								getBlockchainByChainId={getBlockchainByChainId}
							/>
						) : (
							<div className='p-6 bg-slate-800 rounded text-slate-300'>
								Your cart is empty.
							</div>
						)}
					</div>

					{/* Order summary */}
					<aside className=' pb-10 '>
						<h2 className='text-[22px] font-bold  mb-2 '>
							Order Summary:
						</h2>
						<div className='flex-1 flex flex-col  text-[#1A1A1A]'>
							{/* Selected items list */}
							<div
								className='mb-4  overflow-y-auto custom-scrollbar'
								role='region'
								aria-label='Selected items'
							>
								{selectedItems.length === 0 ? (
									<p className='text-sm text-gray-600'>
										No items selected
									</p>
								) : (
									<div className='space-y-4'>
										{groupedItemsByChain.map(
											({ chainId, items }) => (
												<div
													key={chainId}
													className=' bg-[#D9D9D9] px-5 py-4 rounded-lg flex flex-col gap-2 '
												>
													{/* Chain header */}
													<div className='flex items-center gap-2 '>
														{(() => {
															const blockchain =
																getBlockchainByChainId(
																	chainId,
																);
															return (
																<>
																	{blockchain?.logoUrl && (
																		<Image
																			src={
																				blockchain.logoUrl
																			}
																			alt={
																				blockchain.name ||
																				'chain icon'
																			}
																			width={
																				16
																			}
																			height={
																				16
																			}
																		/>
																	)}
																	<span className=' font-semibold text-gray-700'>
																		{blockchain?.name ||
																			(chainId ===
																			'unknown'
																				? 'Unknown Chain'
																				: `Chain: ${chainId}`)}
																	</span>
																</>
															);
														})()}
													</div>
													{/* Items in this chain */}
													<div className='bg-[#F1F0EB] p-3 rounded-md flex flex-col gap-3 '>
														{items.map(
															(item, index) => {
																const assetData =
																	item.product.asset?.find(
																		(
																			asset,
																		) =>
																			asset.id ===
																			item.assetId,
																	);
																return (
																	<div
																		key={
																			item.id
																		}
																		className='flex justify-between items-start  min-w-0 gap-1'
																	>
																		<div className='flex-1 min-w-0 overflow-hidden'>
																			{/* <Tooltip
																			className='bg-black cursor-pointer text-[10px]'
																			content={
																				item
																					.product
																					.name
																			}
																		>
																			<p className='font-medium truncate text-[15px]'>
																				{`${
																					index +
																					1
																				}. ${
																					item
																						.product
																						.name
																				}`}
																			</p>
																		</Tooltip> */}
																			<p className='font-medium truncate text-[15px]'>
																				{`${
																					index +
																					1
																				}. ${
																					item
																						.product
																						.name
																				}`}
																			</p>
																			<p className='text-gray-600 whitespace-nowrap'>
																				{item.quantity +
																					' × ' +
																					numberWithCommas(
																						parseFloat(
																							(item.assetId
																								? assetData?.price
																								: item
																										.product
																										?.price) ||
																								'0',
																						),
																						2,
																					) +
																					' ' +
																					item
																						.product
																						.currencySymbol}
																			</p>
																		</div>
																		<p className='font-medium whitespace-nowrap text-[15px]'>
																			{numberWithCommas(
																				parseFloat(
																					(item.assetId
																						? assetData?.price
																						: item
																								.product
																								?.price) ||
																						'0',
																				) *
																					item.quantity,
																				2,
																			) +
																				' ' +
																				item
																					.product
																					.currencySymbol}
																		</p>
																	</div>
																);
															},
														)}
													</div>

													{/* Group-specific totals and charges */}
													{(() => {
														const groupSubtotal =
															calculateGroupSubtotal(
																items,
															);
														const groupGrandTotal =
															calculateGroupGrandTotal(
																items,
															);
														const groupCurrency =
															items[0]?.product
																.currencySymbol ||
															'USDC';
														const groupCurrencyMismatch =
															new Set(
																items.map(
																	(item) =>
																		item
																			.product
																			.currencySymbol,
																),
															).size > 1;

														return (
															<div className='flex flex-col gap-4 mt-4 pt-4 border-t border-gray-400'>
																{/* Currency mismatch warning for this group */}
																{groupCurrencyMismatch && (
																	<div className='bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm'>
																		⚠️ Mixed
																		currencies
																		detected
																		in this
																		group.
																		Please
																		select
																		items
																		with the
																		same
																		currency.
																	</div>
																)}

																{/* Subtotal */}
																<div className='flex justify-between  font-bold'>
																	<p className='text-[16px]'>
																		Subtotal
																	</p>
																	<p className='text-[16px]'>
																		{numberWithCommas(
																			groupSubtotal,
																			2,
																		)}{' '}
																		{
																			groupCurrency
																		}
																	</p>
																</div>

																{/* Charges section */}
																<div
																	className='bg-[#BFE0C7] rounded-lg p-3'
																	role='region'
																	aria-label='Additional charges'
																>
																	{chargesLoading ? (
																		<p className='text-sm text-gray-600 text-center'>
																			Loading
																			charges...
																		</p>
																	) : chargesError ? (
																		<p className='text-sm text-red-600 text-center'>
																			Error
																			loading
																			charges:{' '}
																			{
																				chargesError
																			}
																			<button
																				onClick={
																					fetchCharges
																				}
																				className='ml-2 text-blue-600 underline hover:no-underline'
																				aria-label='Retry loading charges'
																			>
																				Retry
																			</button>
																		</p>
																	) : charges.length >
																	  0 ? (
																		<div className='space-y-1'>
																			{charges.map(
																				(
																					charge,
																					index,
																				) => (
																					<div
																						key={
																							charge.id ||
																							index
																						}
																						className='flex justify-between font-normal'
																					>
																						<div className='flex-1'>
																							<span>
																								{
																									charge
																										.chargeType
																										.name
																								}
																							</span>
																							<span className=' ml-1'>
																								(
																								{formatChargeValue(
																									charge,
																									groupCurrency,
																								)}

																								)
																							</span>
																						</div>
																						<p className='font-medium'>
																							{numberWithCommas(
																								calculateGroupChargeAmount(
																									charge,
																									groupSubtotal,
																								),
																								2,
																							)}{' '}
																							{
																								groupCurrency
																							}
																						</p>
																					</div>
																				),
																			)}
																		</div>
																	) : (
																		<p className='text-sm text-gray-600 text-center'>
																			No
																			additional
																			charges
																		</p>
																	)}
																</div>

																<div className='border-y py-3 border-black '>
																	<div className='flex justify-between font-bold'>
																		<p className='text-[16px]'>
																			Total
																		</p>
																		<p className='text-[16px]'>
																			{numberWithCommas(
																				groupGrandTotal,
																				2,
																			)}{' '}
																			{
																				groupCurrency
																			}
																		</p>
																	</div>
																</div>

																{/* Buy Now button for this group */}
																<div className='pt-2'>
																	<button
																		className='mt-2 w-full bg-[#A79755] text-[#F1F0EB] text-[16px] font-bold rounded-lg px-4 py-2 hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[#9E9E9D] disabled:text-[#6E6E6E]'
																		onClick={() =>
																			handleGroupCheckout(
																				items,
																				chainId,
																			)
																		}
																		disabled={
																			isProcessingCheckout ||
																			groupCurrencyMismatch ||
																			items.length ===
																				0
																		}
																	>
																		{isProcessingCheckout
																			? 'Processing...'
																			: groupCurrencyMismatch
																				? 'Mixed Currencies'
																				: 'Buy Now'}
																	</button>
																</div>
															</div>
														);
													})()}
												</div>
											),
										)}
									</div>
								)}
							</div>
						</div>
					</aside>
				</div>
			</div>

			{/* Checkout Modals */}
			<CheckoutLoadingModal
				isOpen={showLoadingModal}
				onClose={closeModals}
				loadingState={checkoutLoadingState}
			/>

			<CheckoutSuccessModal
				isOpen={showSuccessModal}
				onClose={closeModals}
				checkoutResponse={checkoutData}
			/>

			<CheckoutFailureModal
				isOpen={showFailureModal}
				onClose={closeModals}
				errorMessage={checkoutError}
			/>
		</>
	);
}
