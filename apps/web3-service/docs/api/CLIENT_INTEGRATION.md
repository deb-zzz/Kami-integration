# KAMI NFT Platform - Frontend Integration Guide

This document provides detailed information for frontend developers building e-commerce style client interfaces for the KAMI NFT platform. It covers the publish and checkout flows, API specifications, and database impacts.

## Table of Contents

1. [Overview](#overview)
2. [Token Types](#token-types)
3. [Publish Flow](#publish-flow)
4. [Checkout Flow](#checkout-flow)
5. [Product APIs](#product-apis)
6. [Database Schema](#database-schema)
7. [Flow Diagrams](#flow-diagrams)
8. [Error Handling](#error-handling)
9. [Code Examples](#code-examples)

---

## Overview

The KAMI platform supports three token types with different workflows:

| Token Type | Contract | Use Case | Supply |
|------------|----------|----------|--------|
| **KAMI721C** | ERC721C | Unique 1:1 NFTs | Single token per product |
| **KAMI721AC** | ERC721AC | Multi-edition NFTs | Multiple tokens per product (limited or unlimited) |
| **KAMI1155C** | ERC1155C | Fungible/semi-fungible | Quantity-based; buy/transfer supported in checkout |

### Key Concepts

- **Product**: The master record representing an NFT listing
- **Collection**: A group of products deployed to the same smart contract
- **Voucher**: Metadata template used for lazy minting
- **Asset**: An on-chain minted token owned by a wallet

---

## Token Types

### KAMI721C (Standard - ERC721C)

- **1:1 relationship**: One product = one token
- **Ownership transfer**: Creator loses ownership when sold
- **Voucher consumed**: Voucher is deleted after minting
- **Use case**: Unique artworks, collectibles

### KAMI721AC (Claimable - ERC721AC)

- **1:many relationship**: One product = multiple tokens
- **Creator retains concept**: Creator keeps ownership of the product
- **Voucher persists**: Voucher acts as a template for future mints
- **Supply control**: Limited or unlimited editions
- **Use case**: Music releases, event tickets, merchandise

---

## Publish Flow

The publish flow creates a new NFT listing in the marketplace.

### POST `/api/publish`

Creates a new product with associated voucher and optionally deploys to blockchain.

#### Request Body

```typescript
interface PublishRequest {
  walletAddress: string;           // Creator's wallet address
  projectId: number;               // Project ID (required)
  
  // Collection - use ONE of these options:
  collectionId?: number;           // Existing collection ID
  newCollection?: {                // Create new collection
    symbol: string;                // e.g., "KAMI"
    name: string;                  // e.g., "My Collection"
    description?: string;
    type: 'ERC721C' | 'ERC721AC' | 'ERC1155C';
    chainId?: string;              // e.g., "0x14a34" (Base Sepolia)
  };
  
  // Product details
  metadata: {
    name: string;
    description?: string;
    image?: string;                // Media URL
    animation_url?: string;        // For video/audio
    token_id?: string;
    properties?: {
      bundle?: Array<{             // Bundled content
        uri: string;
        name: string;
        description?: string;
        category?: string;
        cover_url?: string;
        owner_description?: string;
        type: string;              // Mimetype
      }>;
      creators?: Array<{           // Revenue sharing
        address: string;
        share: number;             // Percentage (0-100)
      }>;
      project_creator?: {
        address: string;
        name: string;
      };
    };
  };
  
  // Pricing
  price: number;
  currency: string;                // e.g., "USDC"
  
  // Product type
  type: 'Standard' | 'Claimable' | 'Series';
  
  // Supply (for Claimable/Series)
  quantity?: number;               // 0 or undefined = unlimited
  
  // Optional settings
  audience?: 'Public' | 'Private' | 'Whitelist';
  consumerAction?: 'Buy' | 'Subscribe' | 'Rent' | 'Claim' | 'None';
  spotlight?: boolean;
  tags?: string[];
  shouldDeploy?: boolean;          // Deploy & mint immediately
}
```

#### Response

```typescript
interface PublishResponse {
  success: true;
  projectId: number;
  collectionId: number;
  productId: number;
  product: {
    id: number;
    name: string;
    // ... full product details
  };
  voucher: {
    id: number;
    tokenId: string;
    // ... full voucher details
  };
}
```

### Publish Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PUBLISH FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐     POST /api/publish      ┌──────────────┐
│ Frontend │ ─────────────────────────▶ │   Backend    │
│  Client  │                            │    Server    │
└──────────┘                            └──────┬───────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │  Validate Request   │
                                    │  - Check quantity   │
                                    │  - Verify project   │
                                    └──────────┬──────────┘
                                               │
                            ┌──────────────────┼──────────────────┐
                            ▼                  │                  ▼
                  ┌─────────────────┐          │         ┌─────────────────┐
                  │ Use Existing    │          │         │ Create New      │
                  │ Collection      │          │         │ Collection      │
                  └────────┬────────┘          │         └────────┬────────┘
                           │                   │                  │
                           └───────────────────┼──────────────────┘
                                               ▼
                                    ┌─────────────────────┐
                                    │   $transaction      │
                                    │   ┌─────────────┐   │
                                    │   │Create Product│  │
                                    │   │- name       │   │
                                    │   │- price      │   │
                                    │   │- quantity   │   │
                                    │   │- maxQuantity│   │
                                    │   └──────┬──────┘   │
                                    │          ▼          │
                                    │   ┌─────────────┐   │
                                    │   │Create Voucher│  │
                                    │   │- metadata   │   │
                                    │   │- mediaUrl   │   │
                                    │   └──────┬──────┘   │
                                    │          ▼          │
                                    │   ┌─────────────┐   │
                                    │   │Update Project│  │
                                    │   │- status     │   │
                                    │   └─────────────┘   │
                                    └──────────┬──────────┘
                                               │
                            ┌──────────────────┼──────────────────┐
                            │ shouldDeploy?    │                  │
                            ▼ true             │                  ▼ false
                  ┌─────────────────┐          │         ┌─────────────────┐
                  │ Deploy Contract │          │         │ Return Response │
                  │ + Mint Token    │          │         │ (lazy mint)     │
                  └────────┬────────┘          │         └─────────────────┘
                           │                   │
                           └───────────────────┘

```

### Database Impact (Publish)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE CHANGES ON PUBLISH                          │
└─────────────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────┐
                         │     collection      │
                         ├─────────────────────┤
                         │ collectionId (PK)   │◄──────── Created if new
                         │ projectId (FK)      │
                         │ name                │
                         │ symbol              │
                         │ contractType        │
                         │ chainId             │
                         │ contractAddress     │◄──────── NULL until deployed
                         └─────────┬───────────┘
                                   │
                                   │ 1:N
                                   ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│      project        │   │      product        │   │      voucher        │
├─────────────────────┤   ├─────────────────────┤   ├─────────────────────┤
│ id (PK)             │◄──│ projectId (FK)      │──▶│ projectId (FK)      │
│ status ────────────────▶│ id (PK)             │◄──│ productId (FK)      │
│ (updated to Publish)│   │ name                │   │ id (PK)             │
│ draft               │   │ price               │   │ tokenId             │
└─────────────────────┘   │ availableQuantity   │   │ metadata (JSON)     │
                          │ maxQuantity         │◄──│ maxQuantity         │
                          │ ownerWalletAddress  │   │ walletAddress       │
                          │ type                │   │ mediaUrl            │
                          │ collectionId (FK)───┼───│ collectionId (FK)   │
                          └─────────────────────┘   └─────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     SUPPLY CONFIGURATION BY TOKEN TYPE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  KAMI721C (Standard):                                                        │
│    - maxQuantity: NULL (not applicable)                                      │
│    - availableQuantity: 1                                                    │
│                                                                              │
│  KAMI721AC (Claimable) - Limited Supply:                                     │
│    - maxQuantity: N (e.g., 100)                                              │
│    - availableQuantity: N (decrements on mint)                               │
│                                                                              │
│  KAMI721AC (Claimable) - Unlimited Supply:                                   │
│    - maxQuantity: 0 (sentinel for unlimited)                                 │
│    - availableQuantity: 0 (sentinel - never decremented)                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Checkout Flow

The checkout flow handles purchasing, minting, and transferring NFTs.

### POST `/api/checkout`

Processes one or more checkout items, handling deployment, minting, and buying.

#### Request Body

```typescript
interface CheckoutRequest {
  checkoutId: string;              // Unique checkout identifier
  walletAddress: string;           // Buyer's wallet address
  checkoutItems: Array<{
    collectionId: number;          // Required
    
    // Identify what to purchase (at least one required):
    productId?: number;            // For KAMI721AC minting; can be sent with assetId/tokenId (buy wins)
    voucherId?: number;            // For KAMI721C minting (legacy)
    assetId?: number;              // For buying existing token
    tokenId?: number | null;       // For buy: server looks up asset by contractAddress+tokenId. If found → buy; if not → mint (requires productId or voucherId)
    
    quantity?: number | null;      // For KAMI721AC batch minting
    charges?: number | null;       // Payment amount
  }>;
}
```

#### Response

```typescript
interface CheckoutResponse {
  success: boolean;
  deployedCollections: Array<{
    collectionId: number;
    contractAddress: string;
    checkoutId?: string;
  }>;
  mintedTokens: Array<{
    voucherId: number;
    tokenId: number;
    quantity?: number;             // For batch mints
    assetId?: number;
    contractAddress?: string;
    checkoutId?: string;
    tokenIds?: number[];           // All minted token IDs
  }>;
  purchasedAssets: Array<{
    collectionId: number;
    tokenId: number;
    checkoutId?: string;
  }>;
  errors: Array<{
    collectionId: number;
    tokenId: number | null;
    quantity: number | null;
    error: string;
  }>;
}
```

#### Checkout item contract and quantity rules

Each checkout item is either a **mint** (voucher) or **buy** (existing asset) path:

- **Mint path**: `{ collectionId, productId?, voucherId?, quantity?, charges? }` — or `{ collectionId, tokenId, productId?, voucherId?, quantity?, charges? }` when that token is not yet in the asset table (server resolves and mints).
- **Buy path**: `{ collectionId, assetId, quantity?, charges? }` or `{ collectionId, tokenId, quantity?, charges? }` when that token exists in the asset table (server looks up by contractAddress+tokenId and buys). Sending `productId` in addition is allowed; the server treats it as buy when an asset is identified (assetId or tokenId lookup found).

Quantity rules depend on the collection’s contract type:

| Contract type | Mint (voucher) | Buy (existing asset) | Deploy (gasless) |
|---------------|----------------|----------------------|------------------|
| **ERC721C** (KAMI721C) | quantity must be 1 | quantity must be 1 | Supported |
| **ERC721AC** (KAMI721AC) | quantity ≥ 1 (batch mint) | quantity must be 1 only | Supported |
| **ERC1155C** | Not supported in checkout | Supported (transfer) | Not supported in checkout |

- **ERC721C**: Non-fungible; mint and buy always quantity 1.
- **ERC721AC**: Only type that allows multiple quantity on **mint**. On **buy** (purchasing an existing token), quantity must be 1; each token is purchased separately. If the seller is the creator and supply is available, the server may convert a buy to a mint.
- **ERC1155C**: Deploy and mint are not supported in checkout (gasless). Only buy (transfer) is supported. Use ERC721C or ERC721AC for mint in checkout.

When adding new NFT/contract types, the central rules are defined in the web3 service (`checkout-processor/nft-rules.ts`); validation and categorisation use these rules.

### Checkout Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CHECKOUT FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐     POST /api/checkout     ┌──────────────┐
│ Frontend │ ─────────────────────────▶ │   Backend    │
│  Client  │                            │    Server    │
└──────────┘                            └──────┬───────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │  Validate Charges   │
                                    │  (check balance)    │
                                    └──────────┬──────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │  Process Each Item  │
                                    └──────────┬──────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
         ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
         │   Has Voucher?  │       │   Has Asset/    │       │  productId      │
         │   (mint path)   │       │   TokenId?      │       │  provided?      │
         └────────┬────────┘       │   (buy path)    │       └────────┬────────┘
                  │                └────────┬────────┘                │
                  │                         │                         │
                  │                         ▼                         ▼
                  │                ┌─────────────────┐       ┌─────────────────┐
                  │                │ ERC721AC +      │       │ Resolve to      │
                  │                │ Seller=Creator? │       │ Voucher ID      │
                  │                └────────┬────────┘       └────────┬────────┘
                  │                         │                         │
                  │            ┌────────────┴────────────┐            │
                  │            ▼                         ▼            │
                  │   ┌─────────────────┐       ┌─────────────────┐   │
                  │   │ Yes + Available │       │ No / Sold Out   │   │
                  │   │ → Mint New      │       │ → Buy Existing  │   │
                  │   └────────┬────────┘       └────────┬────────┘   │
                  │            │                         │            │
                  └────────────┴─────────────────────────┴────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
         ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
         │     DEPLOY      │       │      MINT       │       │      BUY        │
         │  (if needed)    │       │                 │       │                 │
         └────────┬────────┘       └────────┬────────┘       └────────┬────────┘
                  │                         │                         │
                  ▼                         ▼                         ▼
         ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
         │ Deploy Contract │       │ Call Gasless    │       │ Transfer Token  │
         │ via Gasless     │       │ Mint Function   │       │ via Gasless     │
         └────────┬────────┘       └────────┬────────┘       └────────┬────────┘
                  │                         │                         │
                  │                         ▼                         │
                  │                ┌─────────────────┐                │
                  │                │ Create Asset(s) │                │
                  │                │ in Database     │                │
                  │                └────────┬────────┘                │
                  │                         │                         │
                  │                         ▼                         │
                  │                ┌─────────────────┐                │
                  │                │ Update Product  │◄───────────────┤
                  │                │ availableQty    │                │
                  │                └─────────────────┘                │
                  │                                                   │
                  └───────────────────────────────────────────────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │   Return Response   │
                                    │   (results/errors)  │
                                    └─────────────────────┘
```

**Note:** When an item has `tokenId` but no `assetId`, the server looks up the asset table (contractAddress + tokenId). If the token exists → buy (transfer); if not → mint (item must include productId or voucherId). Sending both `productId` and `assetId` (or a tokenId that resolves to an asset) is valid; the server treats it as buy.

### Database Impact (Checkout)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DATABASE CHANGES ON CHECKOUT                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              DEPLOY OPERATION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  collection table:                                                           │
│    UPDATE SET contractAddress = '0x...'                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          MINT OPERATION (KAMI721C)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  product table:                                                              │
│    UPDATE SET ownerWalletAddress = buyer                                     │
│    UPDATE SET consumerAction = 'None'                                        │
│                                                                              │
│  asset table:                                                                │
│    INSERT new asset record                                                   │
│    - walletAddress = buyer                                                   │
│    - tokenId from blockchain                                                 │
│    - productId linked                                                        │
│                                                                              │
│  voucher table:                                                              │
│    DELETE voucher (consumed)                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         MINT OPERATION (KAMI721AC)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  product table:                                                              │
│    UPDATE SET availableQuantity = availableQuantity - quantity               │
│    (Skip if unlimited: maxQuantity = 0)                                      │
│    UPDATE SET consumerAction = 'None'                                        │
│    NOTE: ownerWalletAddress stays with creator                               │
│                                                                              │
│  asset table:                                                                │
│    INSERT N new asset records (one per token minted)                         │
│    - walletAddress = buyer                                                   │
│    - tokenId = sequential from startTokenId                                  │
│    - productId linked (same product for all)                                 │
│                                                                              │
│  voucher table:                                                              │
│    KEEP voucher (template for future mints)                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             BUY OPERATION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  asset table:                                                                │
│    UPDATE SET walletAddress = buyer                                          │
│                                                                              │
│  product table (KAMI721C only):                                              │
│    UPDATE SET ownerWalletAddress = buyer                                     │
│    UPDATE SET consumerAction = 'None'                                        │
│                                                                              │
│  NOTE: Buy does NOT decrement availableQuantity                              │
│        (it transfers existing token, not mint new)                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Checkout Decision Tree

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CHECKOUT ROUTING DECISION TREE                        │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌───────────────┐
                              │ Checkout Item │
                              └───────┬───────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
             ┌────────────┐    ┌────────────┐    ┌────────────┐
             │ productId  │    │ voucherId  │    │  assetId/  │
             │ provided   │    │ provided   │    │  tokenId   │
             └─────┬──────┘    └─────┬──────┘    └─────┬──────┘
                   │                 │                 │
                   ▼                 │                 │
         ┌─────────────────┐         │                 │
         │ Resolve Product │         │                 │
         │ → Get Voucher   │         │                 │
         └────────┬────────┘         │                 │
                  │                  │                 │
                  └──────────────────┤                 │
                                     │                 │
                                     ▼                 │
                          ┌─────────────────┐          │
                          │ Contract        │          │
                          │ Deployed?       │          │
                          └────────┬────────┘          │
                                   │                   │
                    ┌──────────────┴──────────────┐    │
                    │ No                          │ Yes│
                    ▼                             ▼    │
           ┌─────────────────┐           ┌────────────┴────┐
           │ DEPLOY then     │           │      MINT       │
           │ MINT            │           │                 │
           └─────────────────┘           └─────────────────┘
                                                           │
                                     ┌─────────────────────┤
                                     │                     │
                                     ▼                     ▼
                          ┌─────────────────┐    ┌─────────────────┐
                          │  ERC721AC &     │    │ Find Asset by   │
                          │  Seller=Creator │    │ assetId/tokenId │
                          │  & Available?   │    └────────┬────────┘
                          └────────┬────────┘             │
                                   │                      │
                    ┌──────────────┴──────────────┐       │
                    │ Yes                         │ No    │
                    ▼                             ▼       │
           ┌─────────────────┐           ┌───────────────┐│
           │ MINT (creator   │           │     BUY       ││
           │ mints new)      │           │ (transfer     │◄┘
           └─────────────────┘           │ existing)     │
                                         └───────────────┘
```

---

## Product APIs

### GET `/api/product`

Retrieves a paginated list of products with filtering and sorting.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `perPage` | number | Items per page (max: 100, default: 10) |
| `sort` | string | Sort fields (e.g., "spotlight,desc;createdAt,desc") |
| `type` | enum | Standard, Claimable, Series |
| `ownerWalletAddress` | string | Filter by owner |
| `creatorWalletAddress` | string | Filter by creator |
| `collectionId` | number | Filter by collection |
| `priceMin` / `priceMax` | number | Price range |
| `forSale` | boolean | Available for purchase |
| `spotlight` | boolean | Featured products |
| `tag` | string | Filter by tag |
| `includeBlockchain` | boolean | Include blockchain metadata |

#### Response

```typescript
interface ProductListResponse {
  data: Array<{
    id: number;
    name: string;
    description: string | null;
    type: 'Standard' | 'Claimable' | 'Series';
    price: string;
    currency: string | null;
    availableQuantity: number;
    maxQuantity: number | null;     // 0 = unlimited
    totalMinted: number;            // Count of assets
    isUnlimited: boolean;           // maxQuantity === 0
    mediaUrl: string | null;
    animationUrl: string | null;
    
    project: {
      projectId: number;
      name: string;
    };
    
    collection: {
      collectionId: number;
      name: string;
      chainId: string;
    } | null;
    
    creator: {
      walletAddress: string;
      userName: string;
    };
    
    owner: {
      walletAddress: string;
      userName: string;
    };
    
    tags: Array<{ tag: string; type: string }>;
    
    // Optional
    blockchain?: { chainId: string; name: string; ... };
    likeCount?: number;
    followCount?: number;
  }>;
  
  meta: {
    pagination: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
    filters: { ... };
    sort: { ... };
  };
}
```

### GET `/api/product/{productId}`

Retrieves detailed information about a specific product.

#### Response

```typescript
interface ProductDetailResponse {
  id: number;
  name: string;
  description: string | null;
  type: 'Standard' | 'Claimable' | 'Series';
  tokenType: 'KAMI721C' | 'KAMI721AC' | 'KAMI1155C';
  
  // Supply information
  maxQuantity: number | null;
  availableQuantity: number;
  totalMinted: number;
  isUnlimited: boolean;
  
  // Pricing
  price: number;
  currencySymbol: string | null;
  
  // Status
  forSale: boolean;
  consumerAction: 'Buy' | 'Subscribe' | 'Rent' | 'Claim' | 'None';
  audience: 'Public' | 'Private' | 'Whitelist';
  
  // Assets (minted tokens)
  assets: Array<{
    id: number;
    tokenId: string;
    walletAddress: string;
    contractAddress: string;
    mediaUrl: string | null;
  }>;
  
  // Voucher (for unminted/template)
  voucher: {
    id: number;
    tokenId: string;
    metadata: object;
    mediaUrl: string | null;
  } | null;
  
  // Collection
  collection: {
    collectionId: number;
    name: string;
    contractAddress: string | null;
    chainId: string;
    contractType: 'ERC721C' | 'ERC721AC' | 'ERC1155C';
  };
  
  // Creator & Owner
  creator: { walletAddress: string; userName: string; ... };
  owner: { walletAddress: string; userName: string; ... };
  collaborators: Array<{ ... }>;
  
  // Social
  likes: number;
  likedBy: string[];
  likedByMe: boolean;
  shares: number;
  sharedBy: string[];
  mentions: Array<{ ... }>;
  
  // Content
  bundle: Array<{ url: string; name: string; type: string; ... }>;
  tags: Array<{ tag: string; type: string }>;
}
```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY RELATIONSHIPS                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   project   │──1:1──│  collection │──1:N──│   product   │
└─────────────┘       └──────┬──────┘       └──────┬──────┘
                             │                     │
                             │ 1:N                 │ 1:1 (KAMI721C)
                             │                     │ 1:N (KAMI721AC)
                             ▼                     ▼
                      ┌─────────────┐       ┌─────────────┐
                      │   voucher   │──1:1──│             │
                      │  (template) │       │   product   │
                      └─────────────┘       └──────┬──────┘
                             │                     │
                             │                     │ 1:N
                             │                     ▼
                             │              ┌─────────────┐
                             └──────────────│    asset    │
                                on mint     │ (on-chain)  │
                                            └─────────────┘

                      ┌─────────────────────────────────────┐
                      │                user                 │
                      │  (owner of products, assets, etc.)  │
                      └─────────────────────────────────────┘
```

### Key Tables

#### `product`

| Column | Type | Description |
|--------|------|-------------|
| `id` | int | Primary key |
| `name` | string | Product name |
| `type` | enum | Standard, Claimable, Series |
| `price` | decimal | Listing price |
| `availableQuantity` | int | Remaining mintable (0 = sentinel for unlimited) |
| `maxQuantity` | int? | Max supply (0 = unlimited, NULL for KAMI721C) |
| `ownerWalletAddress` | string | Current owner |
| `collectionId` | int | Foreign key to collection |
| `projectId` | int | Foreign key to project |

#### `collection`

| Column | Type | Description |
|--------|------|-------------|
| `collectionId` | int | Primary key |
| `name` | string | Collection name |
| `symbol` | string | Token symbol |
| `contractType` | enum | ERC721C, ERC721AC, ERC1155C |
| `chainId` | string | Blockchain chain ID |
| `contractAddress` | string? | Deployed contract address |
| `projectId` | int | Foreign key to project |

#### `voucher`

| Column | Type | Description |
|--------|------|-------------|
| `id` | int | Primary key |
| `tokenId` | string | Reserved token ID |
| `metadata` | json | NFT metadata |
| `mediaUrl` | string | Media file URL |
| `maxQuantity` | int? | Copied from product |
| `productId` | int | Foreign key to product (unique for KAMI721C) |
| `collectionId` | int | Foreign key to collection |

#### `asset`

| Column | Type | Description |
|--------|------|-------------|
| `id` | int | Primary key |
| `tokenId` | string | On-chain token ID |
| `walletAddress` | string | Current owner |
| `contractAddress` | string | Smart contract address |
| `chainId` | string | Blockchain chain ID |
| `productId` | int? | Foreign key to product |
| `collectionId` | int? | Foreign key to collection |

---

## Flow Diagrams

### Complete User Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE USER JOURNEY                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                              CREATOR FLOW                                    │
│                                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│  │ Upload  │───▶│ Set     │───▶│ Choose  │───▶│ Publish │───▶│ Listed  │   │
│  │ Content │    │ Price   │    │ Type    │    │ (POST)  │    │ Product │   │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘   │
│                                     │                                        │
│                    ┌────────────────┴────────────────┐                       │
│                    ▼                                 ▼                       │
│             ┌─────────────┐                   ┌─────────────┐                │
│             │  KAMI721C   │                   │  KAMI721AC  │                │
│             │  Standard   │                   │  Claimable  │                │
│             │  (1:1 NFT)  │                   │  (Editions) │                │
│             └─────────────┘                   └─────────────┘                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                              BUYER FLOW                                      │
│                                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│  │ Browse  │───▶│ Select  │───▶│ Add to  │───▶│Checkout │───▶│ Own     │   │
│  │ Products│    │ Product │    │ Cart    │    │ (POST)  │    │ Token   │   │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘   │
│       │                                            │                         │
│       ▼                                            │                         │
│  GET /api/product                   ┌──────────────┴──────────────┐          │
│  GET /api/product/{id}              │                             │          │
│                              ┌──────▼──────┐              ┌───────▼──────┐   │
│                              │  First Buy  │              │  Secondary   │   │
│                              │  (Mint)     │              │  (Transfer)  │   │
│                              └─────────────┘              └──────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Error Handling

### Common Error Responses

```typescript
// Validation Error
{
  "success": false,
  "errors": [
    {
      "collectionId": 123,
      "tokenId": null,
      "quantity": 5,
      "error": "Requested quantity (5) exceeds available quantity (3)"
    }
  ]
}

// Insufficient Balance
{
  "success": false,
  "error": "Insufficient balance to cover charges"
}

// Not Found
{
  "success": false,
  "error": "Product not found: 456"
}

// Publish Error
{
  "success": false,
  "error": "Failed to create voucher: Collection already exists for this project..."
}
```

### Error Codes

| Error | Description | Resolution |
|-------|-------------|------------|
| `Quantity exceeds available` | Requested mint quantity > available | Reduce quantity or wait for restock |
| `Insufficient balance` | Not enough payment tokens | Add funds to wallet |
| `Voucher not found` | Invalid voucherId | Verify product is still available |
| `Asset not found` | Invalid assetId/tokenId | Token may have been transferred |
| `Contract not deployed` | Collection not on-chain | System will auto-deploy |
| `Quantity must be 1 for ERC721C Collection` | Mint/buy with quantity > 1 for ERC721C | Use quantity 1 |
| `Quantity must be 1 for ERC721AC buy operations` | Buying existing token with quantity > 1 | Buy tokens individually (quantity 1 per item) |
| `ERC1155C deploy/mint is not supported in checkout` | Checkout item is ERC1155C mint or deploy | Only ERC721C and ERC721AC are supported for mint; use buy path for ERC1155C transfers only |

---

## Code Examples

### Publishing a KAMI721AC Product (Unlimited)

```typescript
const response = await fetch('/api/publish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: '0x...',
    projectId: 1,
    newCollection: {
      symbol: 'MUSIC',
      name: 'My Music Collection',
      type: 'ERC721AC',
      chainId: '0x14a34'
    },
    metadata: {
      name: 'Track #1',
      description: 'My first track',
      image: 'https://storage.example.com/cover.jpg',
      animation_url: 'https://storage.example.com/track.mp3'
    },
    price: 10,
    currency: 'USDC',
    type: 'Claimable',
    quantity: 0,  // 0 = unlimited supply
  })
});
```

### Publishing a KAMI721C Product (Unique)

```typescript
const response = await fetch('/api/publish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: '0x...',
    projectId: 1,
    collectionId: 123,  // Existing collection
    metadata: {
      name: 'Unique Artwork #1',
      description: 'One of a kind',
      image: 'https://storage.example.com/artwork.jpg'
    },
    price: 100,
    currency: 'USDC',
    type: 'Standard',
    // quantity not needed for Standard type
  })
});
```

### Purchasing (Minting) Multiple KAMI721AC Tokens

```typescript
const response = await fetch('/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    checkoutId: 'checkout-123',
    walletAddress: '0x...',  // Buyer's wallet
    checkoutItems: [
      {
        collectionId: 123,
        productId: 456,      // Using productId for KAMI721AC
        quantity: 5,         // Mint 5 tokens
        charges: 50          // 5 tokens × $10 each
      }
    ]
  })
});

// Response includes all minted tokenIds
// { success: true, mintedTokens: [{ tokenIds: [1, 2, 3, 4, 5], ... }] }
```

### Buying an Existing Token (Secondary Sale)

```typescript
const response = await fetch('/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    checkoutId: 'checkout-789',
    walletAddress: '0x...',  // Buyer's wallet
    checkoutItems: [
      {
        collectionId: 123,
        assetId: 999,        // Specific asset to buy
        quantity: 1,         // Must be 1 for buy operations
        charges: 15          // Resale price
      }
    ]
  })
});
```

### Fetching Products for Storefront

```typescript
// Get featured products
const featured = await fetch(
  '/api/product?spotlight=true&forSale=true&sort=createdAt,desc&perPage=10'
);

// Get products by creator
const byCreator = await fetch(
  '/api/product?creatorWalletAddress=0x...&type=Claimable'
);

// Get product details
const product = await fetch(
  '/api/product/123?walletAddress=0x...'  // Include wallet for likedByMe
);
```

---

## Best Practices

### For Storefronts

1. **Display supply info**: Show `totalMinted` / `maxQuantity` for limited editions
2. **Handle unlimited**: When `isUnlimited=true`, display "Open Edition"
3. **Check availability**: Use `availableQuantity > 0` or `isUnlimited` before showing buy button
4. **Show token type**: Display KAMI721C as "1/1" and KAMI721AC as "Edition"

### For Checkout

1. **Validate before submit**: Check `availableQuantity` against requested quantity
2. **Handle partial success**: Process `errors` array even when `success=true`
3. **Track minted tokens**: Store `tokenIds` array for multi-mint operations
4. **Implement retry logic**: Blockchain operations can timeout (90s max)

### For Creators

1. **Choose type wisely**: Use KAMI721C for unique items, KAMI721AC for editions, KAMI1155C for fungible/semi-fungible
2. **Set unlimited carefully**: `quantity: 0` means infinite supply (KAMI721AC)
3. **Price appropriately**: Consider gas costs in pricing

---

**See also**: [API Reference](API_REFERENCE.md) (all endpoints, including Asset API, async checkout, IPFS upload) | [Overview](../OVERVIEW.md) (business context) | [Architecture](../development/ARCHITECTURE.md) | [Database Schema](../development/DATABASE_SCHEMA.md)
