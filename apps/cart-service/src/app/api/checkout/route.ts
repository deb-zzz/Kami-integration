import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ChargeLocation, PaymentType, OrderStatus, Prisma, CheckoutActions } from '@prisma/client';
import { calculateCharges, validateAndProcessCheckoutItems, groupItemsBySeller, validateBuyer } from '@/utils/checkout-order';
import { formatZodError, serializePrisma } from '@/utils/common';

// Set timeout to 10 minutes (600 seconds)
export const maxDuration = 600;

const checkoutItemSchema = z.object({
	productId: z.number().int({ message: 'productId must be an integer' }),
	quantity: z.number().int().min(1, { message: 'quantity must be at least 1' }),
	assetId: z.number().int().optional(), /// optional: specific asset to buy (for buy path)
});
const checkoutOrderSchema = z
	.object({
		checkoutId: z.string().optional(),
		fromWalletAddress: z.string().nonempty('Required'),
		paymentType: z.enum(PaymentType),
		currency: z.string().optional(),
		items: z.array(checkoutItemSchema).nonempty({ message: 'At least one item is required' }),
	})
	.superRefine((data, ctx) => {
		if (data.paymentType === PaymentType.Crypto) {
			if (!data.currency || data.currency.trim() === '') {
				ctx.addIssue({
					path: ['currency'],
					code: 'custom',
					message: 'Required when paymentType is Crypto',
				});
			}
		}
	});
type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;

/**
 * POST /api/checkout
 *
 * Create order(s) from checkout with unique reference ID to indicate
 * its collection group containing snapshot of items and charges imposed.
 *
 * @example
 * // Request body:
 * {
 *   "fromWalletAddress": "<buyer_wallet_address>",
 *   "paymentType": "Crypto", // Crypto/Fiat
 *   "currency": "USDC",
 *   "items": [
 *     {
 *       "productId": 13,
 *       "quantity": 1
 *     }
 *   ]
 * }
 * */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const data: CheckoutOrderInput = checkoutOrderSchema.parse(body);

		const buyer = await validateBuyer(data.fromWalletAddress);
		const { productIds, checkoutItems } = await validateAndProcessCheckoutItems(buyer.walletAddress, data.items);
		const checkoutSellers = groupItemsBySeller(checkoutItems);

		const overallSubtotal = checkoutSellers.reduce((sum, s) => sum + s.total, 0);
		const { overallAppliedCharges, overallTotalCharges } = await calculateCharges(overallSubtotal, ChargeLocation.Checkout);
		const overallTotalAmount = overallSubtotal + overallTotalCharges;

		const now = Math.floor(Date.now());

		// Precompute charges for all sellers/items BEFORE the transaction
		for (const seller of checkoutSellers) {
			for (const collection of seller.collections ?? []) {
				for (const item of collection.items) {
					const { overallTotalCharges } = await calculateCharges(Number(item.price ?? 0), ChargeLocation.Checkout);
					item.charges = overallTotalCharges;
				}
			}
		}

		const checkout = await prisma.checkout.create({
			data: {
				userWalletAddress: buyer.walletAddress,
				subtotal: overallSubtotal,
				totalCharges: overallTotalCharges,
				totalAmount: overallTotalAmount,
				createdAt: now,
			},
		});

		// Now start the transaction — only do DB writes here
		const createdCheckout = await prisma.$transaction(async (txn) => {
			if (overallAppliedCharges?.length) {
				await txn.checkoutCharge.createMany({
					data: overallAppliedCharges.map((c) => ({
						checkoutId: checkout.id,
						chargeId: c.id,
						chargeTypeName: c.name,
						fixedAmount: c.fixedAmount,
						percentage: c.percentage,
						appliedAmount: c.amount,
					})),
				});
			}

			await txn.cartItems.updateMany({
				where: {
					walletAddress: buyer.walletAddress,
					productId: { in: productIds },
					isActive: true,
				},
				data: {
					checkoutId: checkout.id,
					isActive: false,
					actionedAt: Math.floor(Date.now() / 1000),
					updatedAt: Math.floor(Date.now() / 1000),
				},
			});

			// Orders + items
			for (const seller of checkoutSellers) {
				const order = await txn.order.create({
					data: {
						checkoutId: checkout.id,
						paymentType: body.paymentType,
						currency: body.currency,
						fromWalletAddress: buyer.walletAddress,
						toWalletAddress: seller.walletAddress,
						status: OrderStatus.New,
						amount: seller.total,
						createdAt: now,
						updatedAt: now,
					},
				});

				const allItems = seller.collections?.flatMap((c) => c.items) ?? [];
				if (allItems.length) {
					await txn.orderItem.createMany({
						data: allItems.map((i) => ({
							orderId: order.id,
							productId: i.id,
							assetId: i.assetId ?? undefined,
							checkoutAction: CheckoutActions.None,
							unitPrice: i.price ?? 0,
							quantity: i.quantity,
							subtotal: i.subtotal,
							charges: Number(i.charges ?? 0),
						})),
					});
				}
			}

			return checkout;
		});

		// Payment Start
		if (data.paymentType === PaymentType.Crypto) {
			// Get checkout orders and orderItems
			const checkoutOrders = await prisma.checkout.findUnique({
				where: { id: createdCheckout.id },
				include: {
					orders: {
						include: {
							orderItems: {
								include: {
									product: {
										include: { collection: true, voucher: true, asset: true },
									},
								},
							},
						},
					},
				},
			});

			// build checkoutItems payload (use orderItem.assetId when buying a specific asset)
			const checkoutItems = checkoutOrders?.orders.flatMap((order) =>
				order.orderItems.map((item) => {
					const { product } = item;

					// Resolve asset: specific asset when orderItem.assetId set, else first asset
					const asset = item.assetId != null ? product.asset?.find((a) => a.id === item.assetId) : product.asset?.[0];
					const isMint = !!product.voucher;
					const isTransfer = !!asset;

					// ERC721AC buy: quantity must be 1 (fail fast at cart level)
					if (isTransfer && product.collection?.contractType === 'ERC721AC' && (item.quantity ?? 1) > 1) {
						throw new Error('Quantity must be 1 for ERC721AC buy operations. Each token must be purchased separately.');
					}

					// Buy path: specific minted asset (check before mint so we send assetId + asset.tokenId)
					if (isTransfer && item.assetId != null) {
						return {
							collectionId: product.collectionId,
							assetId: asset.id,
							tokenId: asset.tokenId,
							quantity: item.quantity,
							charges: Number(item.charges ?? 0),
						};
					}

					// Mint path: not yet minted; send voucher info for web3 KAMI721AC resolution
					if (isMint) {
						return {
							collectionId: product.collectionId,
							productId: product.id,
							voucherId: product.voucher?.id,
							tokenId: product.voucher?.tokenId,
							quantity: item.quantity,
							charges: Number(item.charges ?? 0),
						};
					}

					// Buy path: product has assets only (no voucher), use resolved asset
					if (isTransfer) {
						return {
							collectionId: product.collectionId,
							assetId: asset.id,
							tokenId: asset.tokenId,
							quantity: item.quantity,
							charges: Number(item.charges ?? 0),
						};
					}
				}),
			);
			console.log('[Checkout] checkoutItems: ', checkoutItems);

			// Fetch checkout snapshot for immediate response; web3 runs in background
			const wholeCheckout = await prisma.checkout.findUnique({
				where: { id: createdCheckout.id },
				include: {
					checkoutCharges: true,
					orders: {
						include: {
							orderItems: {
								include: {
									product: {
										include: { collection: true },
									},
								},
							},
						},
					},
				},
			});

			const checkoutId = createdCheckout.id;
			const walletAddress = buyer.walletAddress;
			const buyerForNotification = {
				walletAddress: buyer.walletAddress,
				avatarUrl: buyer.avatarUrl ?? null,
				userName: buyer.userName ?? null,
			};

			after(async () => {
				try {
					const paymentResponse = await fetch(`${process.env.WEB3_SERVICE_URL as string}/checkout`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							checkoutId,
							walletAddress,
							checkoutItems,
						}),
					});
					const paymentResult = await paymentResponse.json().catch(() => ({}));
					console.log('[Checkout] CRYPTO paymentResult (background): ', paymentResult);

					const hasPartialErrors = Array.isArray(paymentResult.errors) && paymentResult.errors.length > 0;
					const isCompleteFailure =
						!paymentResponse.ok ||
						paymentResult.success === false ||
						(hasPartialErrors && !paymentResult.mintedTokens?.length && !paymentResult.purchasedAssets?.length);

					if (isCompleteFailure) {
						await prisma.$transaction(async (tx) => {
							await tx.order.updateMany({
								where: { checkoutId },
								data: {
									status: OrderStatus.Failed,
									updatedAt: BigInt(Math.floor(Date.now() / 1000)),
								},
							});

							const errors = paymentResult.errors ?? [];
							if (errors.length > 0) {
								for (const error of errors) {
									const { collectionId, voucherId, assetId, tokenId, error: errorMessage } = error;

									await tx.orderItem.updateMany({
										where: {
											order: { checkoutId },
											product: {
												...(collectionId && { collectionId }),
												...(voucherId && { voucher: { id: voucherId } }),
												...(assetId &&
													tokenId && {
														asset: { id: Number(assetId), tokenId: String(tokenId) },
													}),
											},
										},
										data: {
											status: OrderStatus.Failed,
											errorMessage: errorMessage ?? 'Unknown error',
										},
									});
								}
							} else {
								await tx.orderItem.updateMany({
									where: { order: { checkoutId } },
									data: {
										status: OrderStatus.Failed,
										errorMessage: paymentResult.error ?? 'Unknown error',
									},
								});
							}

							await tx.cartItems.updateMany({
								where: {
									checkoutId,
									isActive: false,
								},
								data: {
									isActive: true,
									actionedAt: null,
									updatedAt: Math.floor(Date.now() / 1000),
								},
							});
						});
					} else if (hasPartialErrors) {
						const now = BigInt(Math.floor(Date.now() / 1000));

						await prisma.$transaction(async (tx) => {
							await tx.order.updateMany({
								where: { checkoutId },
								data: {
									status: OrderStatus.Completed,
									updatedAt: now,
								},
							});

							for (const error of paymentResult.errors ?? []) {
								const { collectionId, voucherId, assetId, tokenId, error: errorMessage } = error;

								await tx.orderItem.updateMany({
									where: {
										order: { checkoutId },
										product: {
											...(collectionId && { collectionId }),
											...(voucherId && { voucher: { id: voucherId } }),
											...(assetId &&
												tokenId && {
													asset: { id: Number(assetId), tokenId: String(tokenId) },
												}),
										},
									},
									data: {
										status: OrderStatus.Failed,
										errorMessage: errorMessage ?? 'Unknown error',
									},
								});
							}

							await tx.orderItem.updateMany({
								where: {
									order: { checkoutId },
									status: OrderStatus.New,
								},
								data: { status: OrderStatus.Completed },
							});

							const failedOrderItems = await tx.orderItem.findMany({
								where: {
									order: { checkoutId },
									status: OrderStatus.Failed,
									errorMessage: { not: null },
								},
								select: {
									productId: true,
								},
							});

							const failedProductIds = failedOrderItems.map((item) => item.productId);

							await tx.cartItems.updateMany({
								where: {
									checkoutId,
									productId: { in: failedProductIds },
									isActive: false,
								},
								data: {
									isActive: true,
									actionedAt: null,
									updatedAt: Math.floor(Date.now() / 1000),
								},
							});
						});
					} else {
						await prisma.$transaction(async (tx) => {
							await tx.order.updateMany({
								where: { checkoutId },
								data: {
									status: OrderStatus.Completed,
									updatedAt: BigInt(Math.floor(Date.now() / 1000)),
								},
							});

							await tx.orderItem.updateMany({
								where: {
									order: { checkoutId },
								},
								data: {
									status: OrderStatus.Completed,
								},
							});
						});
					}

					const statusMessage = isCompleteFailure ? 'Failed' : hasPartialErrors ? 'Partial Success' : 'Success';
					try {
						await fetch(
							`http://notifications-service:3000/api/web-push/send?walletAddress=${buyerForNotification.walletAddress}`,
							{
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									topic: 'order',
									payload: {
										checkoutId,
										walletAddress: buyerForNotification.walletAddress,
										from: {
											avatarUrl: buyerForNotification.avatarUrl,
											userName: buyerForNotification.userName,
										},
									},
									message: `Your order ${checkoutId} has been delivered with status: ${statusMessage}`,
								}),
							},
						);
					} catch (error) {
						console.log((error as Error).message);
					}
				} catch (error) {
					console.error('[Checkout] Background web3 checkout failed:', error);
					try {
						await prisma.$transaction(async (tx) => {
							await tx.order.updateMany({
								where: { checkoutId },
								data: {
									status: OrderStatus.Failed,
									updatedAt: BigInt(Math.floor(Date.now() / 1000)),
								},
							});
							await tx.orderItem.updateMany({
								where: { order: { checkoutId } },
								data: {
									status: OrderStatus.Failed,
									errorMessage: (error as Error).message ?? 'Unknown error',
								},
							});
							await tx.cartItems.updateMany({
								where: { checkoutId, isActive: false },
								data: {
									isActive: true,
									actionedAt: null,
									updatedAt: Math.floor(Date.now() / 1000),
								},
							});
						});
					} catch (txError) {
						console.error('[Checkout] Failed to mark checkout as failed after background error:', txError);
					}
				}
			});

			return NextResponse.json(
				serializePrisma({
					success: true,
					status: 'processing',
					paymentType: PaymentType.Crypto,
					checkoutId: createdCheckout.id,
					checkout: wholeCheckout,
				}),
			);
		} else {
			// Call wallet service - PS - get session URL
			console.log('[Checkout] Calling to Wallet Service...');
			const paymentResponse = await fetch(`${process.env.WALLET_SERVICE_URL as string}/payment`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: PaymentType.Fiat,
					checkoutId: createdCheckout.id,
					currency: data.currency,
				}),
			});

			const paymentResult = await paymentResponse.json().catch(() => ({}));
			console.log('[Checkout] FIAT paymentResult: ', paymentResult);

			if (!paymentResponse.ok || paymentResult.success === false) {
				throw new Error(paymentResult.message || `Payment service error`);
			}

			await prisma.order.updateMany({
				where: { checkoutId: createdCheckout.id },
				data: {
					status: OrderStatus.Pending,
					updatedAt: Math.floor(Date.now()),
				},
			});

			return NextResponse.json({
				paymentUrl: paymentResult.data,
				checkoutId: createdCheckout.id,
			});
		}
	} catch (e) {
		if (e instanceof z.ZodError) {
			return NextResponse.json({ error: 'Validation failed', fields: formatZodError(e) }, { status: 400 });
		}
		return NextResponse.json({ error: 'Failed to checkout: ' + (e as Error).message }, { status: 500 });
	}
}

/**
 * PUT /api/checkout
 *
 * Update a collection of orders by reference ID for status transition
 * according to progress of payment and transfer ownership.
 *
 * @example
 * // New to Pending request body:
 * { "checkoutId": "uuid" }
 * // Pending to Complete request body:
 * {
 *   "checkoutId": "uuid",
 *   "paymentId": "transaction_id",
 * }
 * // Pending to Failed request body:
 * {
 *   "checkoutId": "uuid",
 *   "isFailed": true,
 * }
 * */
export async function PUT(request: NextRequest) {
	try {
		const body = await request.json();

		if (!body.checkoutId) {
			return NextResponse.json({ error: `"checkoutId" is required` }, { status: 400 });
		}

		const orders = await prisma.order.findMany({
			where: {
				checkoutId: body.checkoutId,
			},
		});
		if (orders.length === 0) {
			return NextResponse.json({ error: `No orders found for checkoutId: ${body.checkoutId}` }, { status: 404 });
		}

		const currentStatus: OrderStatus = orders[0].status; // same status for orders of same RefId
		let nextStatus: OrderStatus | undefined = undefined;

		// Infer next status
		if (currentStatus === OrderStatus.New) {
			nextStatus = OrderStatus.Pending;
		} else if (currentStatus === OrderStatus.Pending && body.paymentId) {
			nextStatus = OrderStatus.Completed;
		} else if (currentStatus === OrderStatus.Pending && !body.paymentId) {
			return NextResponse.json({ error: `"paymentId" is required to move from Pending to Completed status` }, { status: 400 });
		} else if (currentStatus === OrderStatus.Pending && body.isFailed) {
			nextStatus = OrderStatus.Failed;
		} else {
			return NextResponse.json({ error: `Invalid state transition from ${currentStatus}` }, { status: 400 });
		}

		const updatedOrders = await prisma.order.updateMany({
			where: { checkoutId: body.checkoutId },
			data: {
				status: nextStatus,
				...(body.paymentId ? { paymentId: body.paymentId } : {}),
				updatedAt: Math.floor(Date.now()),
			},
		});

		return NextResponse.json(serializePrisma(updatedOrders));
	} catch (e) {
		return NextResponse.json({ error: 'Failed to update checkout order(s): ' + (e as Error).message }, { status: 500 });
	}
}

/**
 * GET /api/checkout?walletAddress=<wallet_address>
 * */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const walletAddress = searchParams.get('walletAddress') ?? undefined;
	if (!walletAddress) {
		return NextResponse.json({ error: 'User walletAddress param is required' }, { status: 400 });
	}

	try {
		const where: Prisma.checkoutWhereInput = {};
		if (walletAddress) {
			where.userWalletAddress = walletAddress;
		}

		const checkout = await prisma.checkout.findMany({
			where,
			orderBy: {
				createdAt: 'desc',
			},
			include: {
				user: { select: { walletAddress: true, userName: true } },
				checkoutCharges: true,
				orders: {
					include: {
						orderItems: {
							include: {
								product: {
									include: {
										collection: true,
									},
								},
							},
						},
						seller: { select: { walletAddress: true, userName: true } },
					},
				},
			},
		});

		return NextResponse.json(serializePrisma(checkout));
	} catch (e) {
		return NextResponse.json({ error: 'Failed to fetch checkout: ' + (e as Error).message }, { status: 500 });
	}
}
