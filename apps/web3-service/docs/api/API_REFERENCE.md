# KAMI Platform Web3 Service - API Reference

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Core Endpoints](#core-endpoints)
4. [Blockchain Endpoints](#blockchain-endpoints)
5. [Product Management](#product-management)
6. [Asset API](#asset-api)
7. [Checkout & Payments](#checkout--payments)
8. [Checkout Async (status & stream)](#checkout-async-status--stream)
9. [IPFS Upload](#ipfs-upload)
10. [NFT Stop Minting](#nft-stop-minting)
11. [Sponsored Payment Token Transfer](#sponsored-payment-token-transfer)
12. [Error Handling](#error-handling)
13. [Rate Limiting](#rate-limiting)
14. [Examples](#examples)

## Overview

The KAMI Platform Web3 Service provides a comprehensive REST API for gasless NFT operations, multi-chain support, and Web2-centric frontend integration. All operations are completely gasless, with the platform paying all gas fees.

**Base URL**: `http://localhost:3000` (development) or your deployed domain

**Content-Type**: `application/json`

## Authentication

Currently, the API does not require authentication for most endpoints. Some endpoints may require wallet address parameters for personalized responses.

## Core Endpoints

### POST /api/publish

Publish NFT collections and vouchers with gasless deployment.

**Description**: Creates a new NFT collection, deploys the contract gaslessly, and sets up all necessary database records.

**Request Body**:

```json
{
	"name": "Collection Name",
	"symbol": "SYMBOL",
	"description": "Collection description",
	"mediaUrl": "https://example.com/image.jpg",
	"metadata": {
		"name": "NFT Name",
		"description": "NFT description",
		"image": "https://example.com/image.jpg",
		"animation_url": "https://example.com/animation.mp4",
		"attributes": [
			{
				"trait_type": "Color",
				"value": "Blue"
			},
			{
				"trait_type": "Rarity",
				"value": "Common"
			}
		],
		"properties": {
			"bundle": [
				{
					"uri": "https://example.com/bundle.json",
					"type": "application/json",
					"name": "Bundle Name",
					"description": "Bundle description",
					"cover_url": "https://example.com/cover.jpg",
					"owner_description": "Owner description",
					"category": "Art"
				}
			],
			"creators": [
				{
					"address": "0x1234567890123456789012345678901234567890",
					"name": "Creator Name",
					"share": 70,
					"role": "Artist",
					"profile_url": "https://example.com/profile"
				}
			],
			"project_creator": {
				"address": "0x1234567890123456789012345678901234567890",
				"name": "Project Creator",
				"profile_url": "https://example.com/profile"
			}
		}
	},
	"quantity": 100,
	"price": "1000000000000000000",
	"projectId": 1,
	"collectionId": 1,
	"collaborators": [
		{
			"walletAddress": "0x1234567890123456789012345678901234567890",
			"role": "Artist",
			"primaryShare": 0.7,
			"secondaryShare": 0.3,
			"writeAccess": true
		}
	]
}
```

**Response**:

```json
{
	"success": true,
	"data": {
		"collectionId": 1,
		"contractAddress": "0x1234567890123456789012345678901234567890",
		"tokenId": 1,
		"transactionHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
	}
}
```

**Error Response**:

```json
{
	"success": false,
	"error": "Quantity must be between 1 and 100000"
}
```

### GET /api/product/{id}

Get detailed product information including metadata, creator details, and social interactions.

**Parameters**:

-   `id` (path): Product ID (integer)

**Query Parameters**:

-   `walletAddress` (optional): User's wallet address for personalized data

**Response**:

```json
{
	"id": 1,
	"name": "Product Name",
	"description": "Product description",
	"type": "Standard",
	"price": "1000000000000000000",
	"availableQuantity": 1,
	"ownerWalletAddress": "0x1234567890123456789012345678901234567890",
	"canSubscribe": false,
	"subscriptionValue": null,
	"forSale": true,
	"audience": "Public",
	"consumerAction": "Buy",
	"whitelist": null,
	"spotlight": false,
	"projectId": 1,
	"collectionId": 1,
	"createdAt": 1703001600,
	"collection": {
		"collectionId": 1,
		"projectId": 1,
		"name": "Collection Name",
		"symbol": "SYMBOL",
		"description": "Collection description",
		"avatarUrl": "https://example.com/avatar.jpg",
		"bannerUrl": "https://example.com/banner.jpg",
		"chainId": "0x14a34",
		"contractAddress": "0x1234567890123456789012345678901234567890",
		"contractType": "ERC721C",
		"ownerWalletAddress": "0x1234567890123456789012345678901234567890",
		"createdAt": 1703001600
	},
	"creator": {
		"walletAddress": "0x1234567890123456789012345678901234567890",
		"userName": "creator",
		"tagLine": "Digital Artist",
		"description": "Creator description",
		"avatarUrl": "https://example.com/avatar.jpg"
	},
	"collaborators": [
		{
			"id": 1,
			"projectId": 1,
			"userWalletAddress": "0x1234567890123456789012345678901234567890",
			"role": "Artist",
			"status": "Accepted",
			"primaryShare": 0.7,
			"secondaryShare": 0.3,
			"writeAccess": true,
			"userProfile": {
				"avatarUrl": "https://example.com/avatar.jpg",
				"userName": "collaborator",
				"tagLine": "Digital Artist",
				"description": "Collaborator description"
			}
		}
	],
	"owner": {
		"walletAddress": "0x1234567890123456789012345678901234567890",
		"userName": "owner",
		"tagLine": "NFT Collector",
		"description": "Owner description",
		"avatarUrl": "https://example.com/avatar.jpg"
	},
	"tags": [
		{
			"tag": "Digital Art",
			"type": "Asset"
		},
		{
			"tag": "Rare",
			"type": "Other"
		}
	],
	"likes": 10,
	"likedBy": ["0x1234567890123456789012345678901234567890", "0x0987654321098765432109876543210987654321"],
	"likedByMe": false,
	"shares": 5,
	"sharedBy": ["0x1234567890123456789012345678901234567890"],
	"tip": "500000000000000000",
	"mentions": []
}
```

### PUT /api/product/[productId]/audience

Update the audience setting for a product (e.g. Public, Private, Whitelist).

**Request Body**: JSON with `audience` (and optional `whitelist` for Whitelist audience).

**Response**: `{ "success": true }` or error.

## Asset API

### GET /api/asset

List assets with pagination and filters. Query parameters: `page`, `perPage`, `sort` (e.g. `createdAt,desc`), plus filter params (e.g. `walletAddress`, `collectionId`, `contractType`, `audience`, `consumerAction`, `priceMin`/`priceMax`, `tag`, `collectionName`, `projectName`). See route implementation for full filter and sort options.

**Response**: Paginated list of asset objects (id, walletAddress, contractAddress, tokenId, metadata, price, audience, consumerAction, collection, product, etc.).

### GET /api/asset/[assetId]

Get a single asset by ID. Optional query: `walletAddress` for personalized data.

**Response**: Asset object with collection, product, owner, and related details.

### POST /api/asset/[assetId]/setPrice

Set the sale price for an asset. Request body: `{ "price": "weiAmount" }`.

### POST /api/asset/[assetId]/setAudience

Set the audience for an asset. Request body: `{ "audience": "Public" | "Private" | "Whitelist" | ... }` and optionally `whitelist`.

### POST /api/asset/[assetId]/setConsumerAction

Set the consumer action for an asset. Request body: `{ "consumerAction": "Buy" | "Subscribe" | "Rent" | "Claim" | "None" }`.

## Blockchain Endpoints

### POST /api/blockchain/deploy

Deploy KAMI NFT contracts gaslessly.

**Request Body**:

```json
{
	"chainId": "0x14a34",
	"contractType": "ERC721C",
	"name": "Collection Name",
	"symbol": "SYMBOL",
	"baseTokenURI": "https://api.example.com/metadata/",
	"initialMintPrice": "1000000000000000000",
	"platformCommissionPercentage": 5
}
```

**Response**:

```json
{
	"success": true,
	"contractAddress": "0x1234567890123456789012345678901234567890",
	"transactionHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
}
```

### POST /api/blockchain/mint

Mint NFTs to existing contracts.

**Request Body**:

```json
{
	"chainId": "0x14a34",
	"contractAddress": "0x1234567890123456789012345678901234567890",
	"contractType": "ERC721C",
	"to": "0x1234567890123456789012345678901234567890",
	"tokenId": 1,
	"quantity": 1
}
```

**Response**:

```json
{
	"success": true,
	"transactionHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
}
```

### POST /api/blockchain/setTokenPrice

Set token prices for existing NFTs.

**Note:**

-   For **KAMI721AC**: Sets per-token sale price using `setSalePrice()` (token owner only)
-   For **KAMI721C/KAMI1155C**: Sets token price using `setPrice()` (OWNER_ROLE only)

**Request Body**:

```json
{
	"chainId": "0x14a34",
	"contractAddress": "0x1234567890123456789012345678901234567890",
	"contractType": "ERC721C",
	"tokenId": 1,
	"price": "2000000000000000000"
}
```

**Response**:

```json
{
	"success": true
}
```

**KAMI721AC Pricing Model:**

KAMI721AC contracts use a dual pricing model:

-   **Global Mint Price**: Set using `setMintPrice()` (applies to all tokens, OWNER_ROLE only)
-   **Per-Token Sale Price**: Set using `setTokenPrice()` (token owner only, for individual token sales)

When minting KAMI721AC tokens, the mint price is read from the contract's global `mintPrice` variable, not from the `tokenPrice` parameter.

### GET /api/blockchain/nft

Get NFT metadata and information.

**Query Parameters**:

-   `chainId`: Blockchain chain ID
-   `contractAddress`: Contract address
-   `tokenId`: Token ID
-   `type`: Contract type (ERC721C, ERC721AC, ERC1155C)
-   `walletAddress` (optional): User's wallet address

**Response**:

```json
{
	"type": "ERC721C",
	"name": "NFT Name",
	"description": "NFT description",
	"image": "https://example.com/image.jpg",
	"animation_url": "https://example.com/animation.mp4",
	"token_id": "1",
	"contract_address": "0x1234567890123456789012345678901234567890",
	"chain_id": "0x14a34",
	"total_supply": 100,
	"balance": 1,
	"attributes": [
		{
			"trait_type": "Color",
			"value": "Blue"
		}
	],
	"properties": {
		"bundle": [
			{
				"uri": "https://example.com/bundle.json",
				"type": "application/json",
				"name": "Bundle Name",
				"description": "Bundle description",
				"cover_url": "https://example.com/cover.jpg",
				"owner_description": "Owner description",
				"category": "Art"
			}
		],
		"creators": [
			{
				"address": "0x1234567890123456789012345678901234567890",
				"name": "Creator Name",
				"share": "70",
				"role": "Artist",
				"profile_url": "https://example.com/profile"
			}
		],
		"project_creator": {
			"address": "0x1234567890123456789012345678901234567890",
			"name": "Project Creator",
			"profile_url": "https://example.com/profile"
		}
	}
}
```

### GET /api/blockchain/getTotalSupply

Get total supply of a contract.

**Query Parameters**:

-   `chainId`: Blockchain chain ID
-   `contractAddress`: Contract address
-   `type`: Contract type (ERC721C, ERC721AC, ERC1155C)
-   `tokenId`: Token ID (required for ERC1155C)

**Response**:

```json
{
	"success": true,
	"totalSupply": 100
}
```

### GET /api/blockchain/getTotalMinted

Get total minted count of a contract. Uses the `getTotalMinted` method from the gasless-nft-tx library.

**Query Parameters**:

-   `chainId`: Blockchain chain ID
-   `contractAddress`: Contract address
-   `type`: Contract type (ERC721C, ERC721AC, ERC1155C)
-   `tokenId`: Token ID (required for ERC1155C, optional for ERC721C/ERC721AC)

**Response**:

```json
{
	"success": true,
	"totalMinted": 75
}
```

**Error Response**:

```json
{
	"success": false,
	"error": "Token ID is required for ERC1155C"
}
```

### GET /api/blockchain/[walletAddress]/getTokenBalance

Get token balance for a wallet.

**Parameters**:

-   `walletAddress` (path): Wallet address

**Query Parameters**:

-   `contractAddress`: Contract address
-   `tokenId`: Token ID
-   `type`: Contract type (ERC721C, ERC721AC, ERC1155C)
-   `chainId`: Blockchain chain ID

**Response**:

```json
{
	"success": true,
	"balance": 5
}
```

### POST /api/blockchain/deployAndMint

Deploy a collection (if not yet deployed) and mint the first token for a voucher in one call.

**Request Body**:

```json
{
	"voucherId": 1,
	"toWalletAddress": "0x1234567890123456789012345678901234567890"
}
```

**Response**: `{ "success": true, "contractAddress": "0x..." }` or error.

### POST /api/blockchain/[walletAddress]/sponsoredPaymentTokenTransfer

Platform-sponsored transfer of payment token (e.g. USDC) from one wallet to another. The platform pays gas. See [PRD-sponsored-payment-token-transfer](../reference/PRD-sponsored-payment-token-transfer.md) for details.

**Request Body**:

```json
{
	"chainId": "0x14a34",
	"fromWalletAddress": "0x...",
	"toWalletAddress": "0x...",
	"quantity": "100",
	"symbol": "USDC"
}
```

**Response**: `{ "success": true, "transactionHash": "0x..." }` or error.

## Checkout & Payments

### POST /api/checkout

Process checkout for multiple items. Supports batch minting for ERC721AC NFTs when multiple items share the same voucherId.

**Request Body**:

```json
{
	"checkoutId": "optional-checkout-id",
	"checkoutItems": [
		{
			"collectionId": 1,
			"tokenId": 1,
			"quantity": 1,
			"voucherId": 1,
			"assetId": null,
			"charges": 0
		},
		{
			"collectionId": 1,
			"tokenId": 1,
			"quantity": 4,
			"voucherId": 1,
			"assetId": null,
			"charges": 0
		},
		{
			"collectionId": 2,
			"tokenId": 2,
			"quantity": 1,
			"voucherId": 2,
			"assetId": null,
			"charges": 0
		}
	],
	"walletAddress": "0x1234567890123456789012345678901234567890"
}
```

**Note:** For ERC721AC collections, items with the same `voucherId` and `collectionId` are automatically grouped and their quantities are summed for efficient batch minting. In the example above, the first two items (both with `voucherId: 1`) will be combined into a single batch mint of 5 tokens (1 + 4).

**Checkout item resolution:**
- An item may have **tokenId** without **assetId**. The server looks up the asset table by contractAddress + tokenId (collection chainId is normalized to hex for the lookup). If the token exists → **buy** (transfer existing NFT); if not found → **mint** (item must include productId or voucherId).
- **productId** and **assetId** (or a tokenId that resolves to an asset) may both be present; the server chooses **buy** in that case.

**Logging:** Each request is logged with prefix `[checkout] Request` (checkoutId, walletAddress, item count, and per-item fields) so integrators (e.g. cart-service) can verify payloads in server logs.

**Response**:

```json
{
	"success": true,
	"checkoutId": "uuid-checkout-id",
	"deployedCollections": [
		{
			"collectionId": 1,
			"contractAddress": "0x1234567890123456789012345678901234567890",
			"checkoutId": "uuid-checkout-id"
		}
	],
	"mintedTokens": [
		{
			"voucherId": 1,
			"tokenId": 1,
			"quantity": 5,
			"tokenIds": [1, 2, 3, 4, 5],
			"assetId": 123,
			"contractAddress": "0x1234567890123456789012345678901234567890",
			"checkoutId": "uuid-checkout-id"
		},
		{
			"voucherId": 2,
			"tokenId": 10,
			"assetId": 124,
			"contractAddress": "0x9876543210987654321098765432109876543210",
			"checkoutId": "uuid-checkout-id"
		}
	],
	"purchasedAssets": [],
	"errors": []
}
```

**Response Fields:**

-   `mintedTokens` - Array of minted token information:
    -   `voucherId` - Voucher ID that was minted
    -   `tokenId` - Primary token ID (first token for batch mints)
    -   `quantity` - Number of tokens minted (only present for batch mints with quantity > 1)
    -   `tokenIds` - Array of all token IDs minted (only present for batch mints)
    -   `assetId` - Asset ID created in database
    -   `contractAddress` - Contract address where tokens were minted
    -   `checkoutId` - Checkout ID for tracking

**Validation:**

-   For ERC721AC Minting: Validates that `quantity <= availableQuantity` from product
-   For ERC721AC Minting: Validates that `currentTotalSupply + quantity <= maxQuantity` from contract
-   For ERC721AC Buying: Quantity must be exactly 1 (enforced by API)
-   For ERC721C: Quantity must be exactly 1 (mint and buy)
-   ERC1155C: Deploy and mint are not supported in checkout; only buy (transfer) is supported. Items that would require ERC1155C deploy or mint are rejected with a clear error.
-   Returns error if validation fails

**Quantity rules and supported contract types:**

| Contract type | Mint (voucher) | Buy (existing asset) | Deploy (gasless) |
|---------------|----------------|----------------------|------------------|
| ERC721C       | qty = 1 only   | qty = 1 only         | Supported        |
| ERC721AC      | qty ≥ 1 (batch)| qty = 1 only         | Supported        |
| ERC1155C      | Not supported  | Supported (transfer) | Not supported    |

Rules are centralised in `src/lib/checkout-processor/nft-rules.ts`; when adding new NFT types, update that module and validation/categorisation.

**KAMI721AC Quantity Rules:**

1. **Minting**: Multiple tokens can be minted in a single transaction (`quantity > 1` allowed)

    - Items with the same `voucherId` are automatically grouped for batch minting
    - System validates against `maxQuantity` from contract before minting
    - If `maxQuantity = 0` (unlimited), validation is skipped

2. **Buying**: Only 1 token can be purchased per transaction (`quantity = 1` enforced)
    - Attempting to buy with `quantity > 1` will result in an error
    - Users can make multiple separate purchases to acquire multiple tokens
    - There is no limit on how many tokens a single user can own

**Error Response**:

```json
{
	"success": false,
	"errors": [
		{
			"collectionId": 1,
			"tokenId": 1,
			"quantity": 1,
			"voucherId": 1,
			"assetId": 1,
			"error": "Collection not found"
		}
	]
}
```

## Checkout Async (status & stream)

For long-running checkout, use async mode so the client does not block.

**Start async checkout**: `POST /api/checkout?async=true` with the same body as sync (checkoutId, checkoutItems, walletAddress). Returns **202 Accepted** with `{ "success": true, "checkoutId": "...", "status": "pending", "message": "..." }`.

**Poll status**: `GET /api/checkout/[checkoutId]/status` returns `status` (`pending` | `processing` | `completed` | `failed`), `progress`, `stage`, and when finished either `result` (full checkout result) or `error`/`errors`.

**Stream progress**: `GET /api/checkout/[checkoutId]/stream` — Server-Sent Events: events `progress`, `status`, then `complete` (with result) or `error` (with error/errors). Proxies and load balancers must disable buffering and use long timeouts (e.g. 300s). See [checkout-processor README](../../src/lib/checkout-processor/README.md) for NGINX and gateway configuration.

## IPFS Upload

### POST /api/ipfs/upload

Upload a file to IPFS via Filebase (S3-compatible). Requires FILEBASE_ACCESS_KEY, FILEBASE_SECRET_KEY, and FILEBASE_BUCKET to be configured.

**Request Body**: `{ "url": "https://example.com/file.jpg" }` — the service fetches the file from the URL and uploads it to Filebase.

**Response**: `{ "success": true, "cid": "...", "url": "ipfs://..." }` or `{ "success": false, "error": "..." }`.

## NFT Stop Minting

### POST /api/nft/[productId]/stopMinting

Stop minting for a product (e.g. set max quantity to current supply). Path parameter: product ID.

**Response**: `{ "success": true }` or error.

## Sponsored Payment Token Transfer

Platform-sponsored payment token (e.g. USDC) transfer. Documented under [Blockchain Endpoints](#blockchain-endpoints) (POST /api/blockchain/[walletAddress]/sponsoredPaymentTokenTransfer): `POST /api/blockchain/[walletAddress]/sponsoredPaymentTokenTransfer`. See [PRD-sponsored-payment-token-transfer](../reference/PRD-sponsored-payment-token-transfer.md) for full specification.

## Error Handling

### HTTP Status Codes

-   `200` - Success
-   `400` - Bad Request (invalid parameters)
-   `404` - Not Found (resource doesn't exist)
-   `500` - Internal Server Error

### Error Response Format

```json
{
	"success": false,
	"error": "Error message describing what went wrong"
}
```

### Common Error Messages

-   `"Quantity must be between 1 and 100000"` - Invalid quantity parameter
-   `"No media URL provided in metadata"` - Missing required media URL
-   `"Requested quantity (X) exceeds available quantity (Y)"` - Requested quantity exceeds product's available quantity
-   `"Requested quantity (X) would exceed maxQuantity limit. Current totalSupply: Y, MaxQuantity: Z, Would result in: W"` - Batch mint would exceed contract's maxQuantity limit
-   `"Quantity must be 1 for ERC721C Collection"` - ERC721C collections only support quantity of 1
-   `"Collection not found"` - Collection ID doesn't exist
-   `"Failed to create voucher"` - Database error during voucher creation
-   `"Invalid creator shares"` - Collaborator shares don't add up to 100%
-   `"Failed to deploy gasless collection"` - Blockchain deployment failed
-   `"Failed to mint gasless NFT"` - NFT minting failed

## Rate Limiting

Currently, there are no rate limits implemented. However, it's recommended to:

-   Implement reasonable delays between requests
-   Batch operations when possible
-   Handle rate limit responses gracefully

## KAMI721AC Quantity Rules

KAMI721AC contracts have specific rules governing deployment, minting, and buying operations:

### Deployment Rules

1. **Max Quantity Setting**:

    - During deployment via `/api/blockchain/deploy` or `deployGaslessCollection()`, the `maxQuantity` is automatically read from the first voucher's `maxQuantity` field
    - If `voucher.maxQuantity` is `null` or `undefined`, the contract's `maxQuantity` is set to `0` (unlimited)
    - The value is set on the contract after deployment using `setTotalSupply()`
    - This establishes the maximum number of tokens that can ever be minted

2. **Available Quantity Initialization**:

    - After deployment, `availableQuantity` is set to `maxQuantity` for all products in the collection
    - `availableQuantity` tracks the number of tokens **available for minting** (not for buying)
    - If `maxQuantity = 0` (unlimited), `availableQuantity` is left unchanged (preserves existing value)

3. **Unlimited Collections**:
    - When `maxQuantity = 0`, there is no limit on the number of tokens that can be minted
    - This is the default if no `maxQuantity` is specified in the voucher

### Minting Rules

1. **Multiple Tokens Per Transaction**:

    - Users can mint multiple tokens in a single transaction by specifying `quantity > 1` in the checkout request
    - Items with the same `voucherId` are automatically grouped and their quantities are summed for batch minting
    - This enables efficient batch minting to the same recipient

2. **Max Quantity Validation**:

    - Before minting, the system validates: `currentTotalSupply + quantity <= maxQuantity`
    - If `maxQuantity > 0` and the validation fails, minting is rejected with an error
    - If `maxQuantity = 0` (unlimited), validation is skipped

3. **Available Quantity Check**:

    - The system validates that `quantity <= availableQuantity` from the product
    - This ensures users don't mint more tokens than are available for minting
    - `availableQuantity` represents the remaining mint capacity

4. **Available Quantity Decrement**:
    - After successful minting, `availableQuantity` is decremented by the quantity minted
    - Formula: `availableQuantity = max(0, availableQuantity - quantityMinted)`
    - This tracks how many tokens are still available to mint

### Buying Rules

1. **Creator Minting vs Buyer Transfer**:

    - When a checkout item includes an `assetId` or a `tokenId` that resolves to an existing asset (server looks up asset table by contractAddress + tokenId), the system intelligently determines whether to mint or transfer:
        - **If seller is creator AND availableQuantity > 0**: Route to MINT
            - Creator can mint multiple tokens (up to `availableQuantity`)
            - Uses existing voucher associated with the product
            - Quantity is validated against `availableQuantity`
            - Allows batch minting (quantity > 1)
        - **If seller is NOT creator OR availableQuantity = 0**: Route to BUY/transfer
            - Only allows quantity = 1 per transaction
            - Transfers ownership of an already-minted token
            - Error if quantity > 1: `"Quantity must be 1 for ERC721AC buy operations. Each token must be purchased separately."`
    - This allows creators to continue minting directly even after initial minting, as long as `availableQuantity > 0`

2. **Single Token Per Purchase (Non-Creators)**:

    - Non-creators can only purchase **1 token at a time** when buying existing tokens
    - The checkout API enforces `quantity = 1` for ERC721AC buy operations by non-creators
    - Attempting to buy with `quantity > 1` will result in an error

3. **Unlimited Ownership**:

    - While only 1 token can be purchased per transaction (for non-creators), there is **no limit** on how many tokens a single user can own
    - Users can make multiple separate purchases to acquire multiple tokens

4. **Available Quantity Behavior**:
    - **Important**: Buying/transferring does NOT affect `availableQuantity`
    - `availableQuantity` tracks tokens available for **minting**, not for buying
    - Buying only transfers ownership of an already-minted token, so it does not change the mint capacity
    - The `availableQuantity` remains unchanged after a purchase/transfer
    - Creator minting DOES decrement `availableQuantity` by the quantity minted

### Smart Contract Validation and Auto-Correction

During the minting process, the system automatically validates that smart contract values match the database values. If discrepancies are detected, the database is automatically corrected to match the contract state. **The smart contract is always the source of truth.**

#### Validation Process

1. **When Validation Occurs**:

    - Validation runs automatically after each successful mint operation via the `/api/checkout` endpoint
    - Applies to ERC721AC collections only
    - Validation occurs both in the checkout API route and in the underlying `mintGaslessNFT()` library function

2. **Values Compared**:

    - **`totalSupply`** (contract) vs **`maxQuantity`** (database)
        - The contract's `totalSupply` should equal the database's `maxQuantity`
    - **`totalSupply - totalMinted`** (contract) vs **`availableQuantity`** (database)
        - The contract's calculated available quantity should equal the database's `availableQuantity`

3. **Auto-Correction Behavior**:
   When mismatches are detected, the system automatically synchronizes the database:

    - **`product.maxQuantity`** = `totalSupply` (from contract)
    - **`product.availableQuantity`** = `totalSupply - totalMinted` (calculated from contract)
    - **`voucher.maxQuantity`** = `totalSupply` (if voucher exists)

4. **Warning Logs**:
   When a mismatch is detected and corrected, a highlighted warning is logged to the server console showing:

    - Contract values (source of truth)
    - Database values before correction
    - Database values after correction
    - All corrections applied

5. **Benefits**:

    - Ensures database always reflects the true contract state
    - Prevents inventory discrepancies
    - Automatically corrects any drift between contract and database
    - Provides visibility into corrections through server logs

6. **Edge Cases**:
    - **Unlimited Collections**: Validation is skipped for collections with `maxQuantity = 0` (unlimited)
    - **Contract Read Failures**: If reading from the contract fails, an error is logged but the mint operation continues
    - **Database Update Failures**: If database correction fails, an error is logged but the mint operation continues

### Summary Table

| Operation                               | Quantity Allowed        | Max Quantity Check             | AvailableQuantity Behavior     | Notes                                     |
| --------------------------------------- | ----------------------- | ------------------------------ | ------------------------------ | ----------------------------------------- |
| **Deploy**                              | N/A                     | Set from `voucher.maxQuantity` | Set to `maxQuantity`           | 0 = unlimited                             |
| **Mint** (voucher)                      | Multiple (batch)        | ✅ Validated                   | Decremented by quantity minted | `totalSupply + quantity <= maxQuantity`   |
| **Mint** (creator with assetId)         | Up to availableQuantity | ✅ Validated                   | Decremented by quantity minted | Creator can mint if availableQuantity > 0 |
| **Buy** (non-creator)                   | 1 only                  | N/A                            | **No change**                  | No limit on total ownership               |
| **Buy** (creator, no availableQuantity) | 1 only                  | N/A                            | **No change**                  | Creator buys when availableQuantity = 0   |

## Examples

### Complete NFT Creation Flow

1. **Create Project** (handled by frontend)
2. **Publish Collection**:

    ```bash
    curl -X POST http://localhost:3000/api/publish \
      -H "Content-Type: application/json" \
      -d '{
        "name": "My Collection",
        "symbol": "MC",
        "description": "A collection of digital art",
        "mediaUrl": "https://example.com/collection.jpg",
        "metadata": {
          "name": "Digital Art #1",
          "description": "First piece in the collection",
          "image": "https://example.com/art1.jpg",
          "attributes": [
            {"trait_type": "Color", "value": "Blue"},
            {"trait_type": "Rarity", "value": "Common"}
          ]
        },
        "quantity": 100,
        "price": "1000000000000000000",
        "projectId": 1,
        "collectionId": 1
      }'
    ```

3. **Get Product Details**:
    ```bash
    curl "http://localhost:3000/api/product/1?walletAddress=0x1234567890123456789012345678901234567890"
    ```

### Gasless Minting

```bash
curl -X POST http://localhost:3000/api/blockchain/mint \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": "0x14a34",
    "contractAddress": "0x1234567890123456789012345678901234567890",
    "contractType": "ERC721C",
    "to": "0x1234567890123456789012345678901234567890",
    "tokenId": 1,
    "quantity": 1
  }'
```

### Get Total Minted Count

```bash
# For ERC721C/ERC721AC (tokenId optional)
curl "http://localhost:3000/api/blockchain/getTotalMinted?chainId=84532&contractAddress=0x1234567890123456789012345678901234567890&type=ERC721AC"

# For ERC1155C (tokenId required)
curl "http://localhost:3000/api/blockchain/getTotalMinted?chainId=84532&contractAddress=0x1234567890123456789012345678901234567890&type=ERC1155C&tokenId=1"
```

### Checkout Process

```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "checkoutItems": [
      {
        "collectionId": 1,
        "tokenId": 1,
        "quantity": 1,
        "voucherId": 1,
        "checkoutAction": "BuyAndMint"
      }
    ],
    "walletAddress": "0x1234567890123456789012345678901234567890"
  }'
```

---

**Version**: 1.0.0  
**Last Updated**: February 2026  
**Gasless Library**: See [package.json](../../package.json) (`@paulstinchcombe/gasless-nft-tx`)
