# KAMI Platform Cart Service — Plan

## Overview

TypeScript/Next.js API service for shopping cart, checkout, and order management in the KAMI NFT platform. It manages cart items (products/playlists), creates checkouts and orders from selected cart items, applies charges, and for **Crypto** payment delegates blockchain operations (deploy, mint, transfer) to the **Web3 service**.

## Scope

- **Cart**: Add, list, update, remove cart items by `walletAddress`. Items are products or playlists with quantity and optional selection for checkout.
- **Checkout**: Create a checkout from **selected** cart items: validate buyer and stock, group by seller, compute subtotals and charges, create a `Checkout` and one `Order` per seller with `OrderItem` snapshots.
- **Payment routing**:
  - **Crypto**: Build `checkoutItems` payload (mint path: `voucherId`/productId; buy path: `assetId`) and call Web3 service for deploy/mint/buy. Update order and order-item status from Web3 result; on full or partial failure, restore affected cart items.
  - **Fiat**: Call Wallet service for payment URL and set orders to `Pending`; status updates via `PUT /api/checkout` (e.g. when payment completes).
- **Orders**: List orders by buyer or seller wallet; get checkout or order by ID.

## Architecture

- Sits between frontend (or API gateway) and shared database; for Crypto checkout calls Web3 service. Does **not** talk to the blockchain directly.
- **Cart API**: cart items only; reads/writes `cartItems` and product/collection/voucher/asset data.
- **Checkout API**: creates `checkout`, `order`, `orderItem`, `checkoutCharge`; for Crypto, calls Web3 then updates order/orderItem status and optionally restores cart items.
- **Orders API**: read-only queries on `order` (and related checkout/orderItem/product).

## Operation Flows

### Cart → Checkout (high level)

1. User adds items to cart (`POST /api/cart/items`).
2. User selects which items to buy (`PUT /api/cart/items/[id]` with `isSelected: true`).
3. User initiates checkout with `POST /api/checkout`: body includes `fromWalletAddress`, `paymentType`, `currency` (if Crypto), and `items: [{ productId, quantity }]`. Items must match **selected** cart lines.
4. Service validates buyer and that selected cart items exist and are in stock; groups by seller; computes charges; creates one `Checkout` and one `Order` per seller with `OrderItem` rows; then:
   - **Crypto**: Calls Web3 with `checkoutItems`, then updates order/orderItem status and optionally notifies.
   - **Fiat**: Calls Wallet service for payment URL and sets orders to `Pending`; later updates via `PUT /api/checkout`.

### Checkout POST (Crypto): payload to Web3

- **Mint path** (product has voucher): `{ collectionId, productId, voucherId, tokenId, quantity, charges }`. Web3 deploys (if needed) and mints; for ERC721AC, quantity can be &gt; 1.
- **Buy path** (product has asset): `{ collectionId, assetId, tokenId, quantity, charges }`. Quantity must be 1 for ERC721AC buy; service enforces before calling Web3.

### Order status (Fiat)

- `New` → `Pending`: body `{ checkoutId }`.
- `Pending` → `Completed`: body `{ checkoutId, paymentId }`.
- `Pending` → `Failed`: body `{ checkoutId, isFailed: true }`.

## Key Concepts

| Concept   | Description |
|----------|-------------|
| Cart item | Line in cart: product (or playlist), quantity, `checkoutAction`, `isSelected`. Only selected items included in checkout. |
| Checkout  | One purchase session: one `Checkout`, multiple `Order` (one per seller), each with `OrderItem` lines. Identified by `checkoutId`. |
| Order     | Per-seller grouping: buyer, seller, amount, status (`New` → `Pending` → `Completed` or `Failed`). |
| Mint vs buy | For Crypto: **mint** (product has voucher: new token minted) or **buy** (product has asset: existing token transferred). Cart service sends appropriate payload to Web3. |

## Dependencies

- Shared database (Prisma schema: `kami-platform-v1-schema`).
- **Web3 service**: Crypto checkout (deploy/mint/buy).
- **Wallet service**: Fiat payment URL.
- **Notifications service**: Order result (optional).

## Environment

- `PORT`, `NODE_ENV`, `DATABASE_URL` (or equivalent).
- `WALLET_SERVICE_URL`, `WEB3_SERVICE_URL`.
