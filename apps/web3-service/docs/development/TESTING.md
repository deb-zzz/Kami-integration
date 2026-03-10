# KAMI Platform Web3 Service - Testing Guide

## Overview

This document describes the test suite for KAMI721C and KAMI721AC contracts, covering publishing, deploying, minting, and buying operations.

## Test Structure

```
tests/
├── setup.ts                     # Test configuration and setup
├── fixtures/
│   └── index.ts                 # Test data factories
├── helpers/
│   └── api.ts                   # API call helpers
├── unit/
│   ├── supply-service.test.ts   # SupplyService unit tests
│   └── product-service.test.ts  # ProductService unit tests
└── integration/
    ├── kami721c.test.ts         # KAMI721C lifecycle tests
    └── kami721ac.test.ts        # KAMI721AC lifecycle tests
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run specific contract tests
pnpm test:kami721c
pnpm test:kami721ac
```

## Configuration

Create a `.env.test` file (or set environment variables) with:

```bash
# API Configuration
TEST_API_BASE_URL=http://localhost:3000/api

# Test Wallet (must own test projects)
TEST_WALLET_ADDRESS=0x1A653455cF346034E6BEE40cb80cf7748876Dc7d

# Test Project IDs (must exist in database)
TEST_PROJECT_ID_ERC721C=7
TEST_PROJECT_ID_ERC721AC=8

# Chain Configuration
TEST_CHAIN_ID=0x14a34

# Authentication (if using API gateway)
TEST_BEARER_TOKEN=your-token
API_SIGNATURE_SECRET=your-secret

# Test Behavior
TEST_SKIP_BLOCKCHAIN=false  # Set to true for fast tests without blockchain
TEST_VERBOSE=false          # Set to true for detailed logging
```

## Test Categories

### Unit Tests

Unit tests verify business logic without external dependencies.

**SupplyService Tests** (`tests/unit/supply-service.test.ts`):
- `isUnlimited()` - Checks unlimited supply detection
- `canMint()` - Validates minting permissions
- `calculateMaxQuantity()` - Product type to max quantity mapping
- `calculateInitialAvailableQuantity()` - Initial supply calculation
- `calculateNewAvailableQuantity()` - Post-mint supply calculation

**ProductService Tests** (`tests/unit/product-service.test.ts`):
- `getTokenType()` - Product to token type mapping
- `getContractType()` - Product to contract type mapping
- `getSupplyInfo()` - Supply information aggregation

### Integration Tests

Integration tests verify API endpoints and database operations.

**KAMI721C Tests** (`tests/integration/kami721c.test.ts`):

| Test | Description |
|------|-------------|
| Publish | Creates product with `type=Standard` |
| Deploy | First checkout deploys contract |
| Mint | Mints single token (quantity=1) |
| Buy | Transfers ownership of existing token |
| Voucher Deletion | Voucher deleted after mint |
| Quantity Validation | Rejects quantity > 1 |

**KAMI721AC Tests** (`tests/integration/kami721ac.test.ts`):

| Test | Description |
|------|-------------|
| Publish Limited | Creates product with maxQuantity |
| Publish Unlimited | Creates product with maxQuantity=0 |
| Deploy | First checkout deploys contract |
| Single Mint | Mints 1 token |
| Batch Mint | Mints multiple tokens (quantity > 1) |
| Buy | Transfers single token (quantity=1 enforced) |
| Voucher Persistence | Voucher persists after mint |
| Supply Tracking | availableQuantity decremented correctly |
| Product-Based Mint | Mints via productId instead of voucherId |

## Test Data Lifecycle

### KAMI721C (Standard)

```
1. Publish
   ├── Creates collection (ERC721C)
   ├── Creates product (type=Standard)
   ├── Creates voucher (quantity=1)
   └── availableQuantity = 1

2. First Checkout (Deploy + Mint)
   ├── Deploys contract
   ├── Mints token to buyer
   ├── Creates asset record
   ├── Deletes voucher
   └── availableQuantity = 0

3. Buy (Transfer)
   ├── Transfers token ownership
   └── availableQuantity unchanged
```

### KAMI721AC (Claimable)

```
1. Publish
   ├── Creates collection (ERC721AC)
   ├── Creates product (type=Claimable)
   ├── Creates voucher (maxQuantity=N or 0)
   └── availableQuantity = N (or 0 for unlimited)

2. First Checkout (Deploy + Mint)
   ├── Deploys contract
   ├── Sets contract maxQuantity
   ├── Mints token(s) to buyer
   ├── Creates asset record(s)
   ├── Voucher persists
   └── availableQuantity = N - minted

3. Subsequent Mint
   ├── Uses existing voucher
   ├── Validates quantity <= availableQuantity
   ├── Mints token(s)
   └── availableQuantity decremented

4. Buy (Transfer)
   ├── Transfers single token (quantity=1)
   └── availableQuantity unchanged
```

## Test Fixtures

The test fixtures (`tests/fixtures/index.ts`) provide factory functions:

```typescript
// Create KAMI721C publish payload
createKAMI721CPublishPayload({
  walletAddress?: string,
  projectId?: number,
  price?: number,
  // ...
});

// Create KAMI721AC publish payload
createKAMI721ACPublishPayload({
  quantity?: number,     // Initial supply
  maxQuantity?: number,  // 0 for unlimited
  royaltyData?: Array<{ receiver, feeNumerator, share }>,
  // ...
});

// Create mint checkout payload
createMintCheckoutPayload({
  collectionId: number,
  voucherId: number,
  quantity?: number,    // 1 for 721C, 1+ for 721AC
});

// Create buy checkout payload
createBuyCheckoutPayload({
  collectionId: number,
  assetId: number,
  tokenId: number | string,
  quantity?: number,    // Must be 1
});

// Create productId-based mint (KAMI721AC)
createProductMintCheckoutPayload({
  collectionId: number,
  productId: number,
  quantity?: number,
});
```

## Assertions

### Supply Assertions

```typescript
// Limited edition
expect(product.maxQuantity).toBe(100);
expect(product.availableQuantity).toBe(90);  // After minting 10
expect(product.isUnlimited).toBe(false);

// Unlimited edition
expect(product.maxQuantity).toBe(0);
expect(product.availableQuantity).toBe(0);   // Sentinel value
expect(product.isUnlimited).toBe(true);
```

### Checkout Assertions

```typescript
// Deployment
expect(response.deployedCollections).toBeDefined();
expect(response.deployedCollections[0].contractAddress).toBeDefined();

// Minting
expect(response.mintedTokens).toBeDefined();
expect(response.mintedTokens[0].tokenId).toBeDefined();
expect(response.mintedTokens[0].assetId).toBeDefined();
expect(response.mintedTokens[0].quantity).toBe(5);  // Batch mint

// Buying
expect(response.purchasedAssets).toBeDefined();
expect(response.purchasedAssets[0].assetId).toBeDefined();
```

## Troubleshooting

### Common Issues

**"Project not found"**
- Ensure TEST_PROJECT_ID values exist in database
- Ensure projects are owned by TEST_WALLET_ADDRESS

**"Voucher not found"**
- For KAMI721C, voucher is deleted after mint
- Verify voucherId exists before checkout

**"Quantity exceeds available"**
- Check product.availableQuantity before minting
- For limited editions, ensure quantity <= availableQuantity

**"Blockchain timeout"**
- Increase test timeout in vitest.config.ts
- Set TEST_SKIP_BLOCKCHAIN=true for fast tests

### Debugging

```bash
# Run with verbose logging
TEST_VERBOSE=true pnpm test

# Run single test file
pnpm vitest run tests/unit/supply-service.test.ts

# Run specific test
pnpm vitest run -t "should publish a KAMI721C product"
```

## Best Practices

1. **Isolate Tests**: Each test should be independent
2. **Use Fixtures**: Use factory functions for test data
3. **Clean Up**: Tests should not leave dirty state
4. **Skip Blockchain**: Use TEST_SKIP_BLOCKCHAIN for fast CI
5. **Verify Side Effects**: Check database state after operations
6. **Test Edge Cases**: Include validation and error scenarios

---

**Version**: 1.0.0  
**Last Updated**: January 2026
