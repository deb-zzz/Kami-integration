# KAMI Platform Wallet Service - Test Suite

This directory contains all test files for the KAMI Platform Wallet Service API with multi-chain support.

## Test Files

### `test-api.js`

Basic API functionality tests including:

-   Health endpoint (`/health`)
-   Balance retrieval (`/api/balances/:chainId`) with chainId parameter
-   USDC contract info (`/api/balances/:chainId/usdc-info`) with chainId parameter
-   Gas estimation (`/api/transfer/:chainId/estimate-gas`)

### `test-validation.js`

Zod validation tests including:

-   Valid balance requests with chainId
-   Invalid balance requests (missing address, missing chainId)
-   Invalid address format validation
-   Transfer request validation with chainId
-   Missing field validation

### `test-transaction-details.js`

Transaction details endpoint tests including:

-   Transaction hash validation with chainId
-   Invalid transaction hash format handling
-   Transfer response format validation

### `test-transactions.js`

Wallet transactions endpoint tests including:

-   Get wallet transactions (`/api/transactions/:chainId`)
-   Missing wallet address validation
-   Invalid wallet address format validation

### `test-gas-estimation.js`

Comprehensive gas estimation tests including:

-   Valid gas estimation requests
-   Invalid address validation
-   Invalid amount validation
-   Missing field validation
-   Multiple amount testing

### `test-blockchain.js`

Blockchain information endpoint tests including:

-   Get blockchain information with valid chainId
-   Invalid chainId handling
-   Missing chainId parameter validation
-   Response structure validation

### `test-usdc-info.js`

Enhanced USDC contract info tests including:

-   Get USDC info with name field
-   Invalid chainId handling
-   Missing chainId parameter validation
-   Enhanced response structure validation

### `test-enhanced-transactions.js`

Enhanced transactions with token data tests including:

-   Get wallet transactions with token data
-   Invalid wallet address validation
-   Missing wallet address validation
-   Invalid chainId handling
-   Token data structure validation
-   BigInt to string conversion validation

## Running Tests

### Run All Tests

```bash
pnpm test
```

### Run Individual Test Suites

```bash
# Basic API tests
pnpm run test:api

# Validation tests
pnpm run test:validation

# Transaction details tests
pnpm run test:transaction

# Transactions endpoint tests
pnpm run test:transactions

# Gas estimation tests
pnpm run test:gas

# Blockchain information tests
pnpm run test:blockchain

# Enhanced USDC info tests
pnpm run test:usdc-info

# Enhanced transactions with token data tests
pnpm run test:enhanced-transactions
```

## Prerequisites

1. **Server Running**: Make sure the KAMI Wallet Service is running on port 3001

    ```bash
    PORT=3001 pnpm run dev
    ```

2. **Environment Variables**: Ensure `.env` file is configured with:

    - `RPC_URL` - Base Sepolia RPC endpoint
    - `USDC_CONTRACT_ADDRESS` - USDC contract address
    - `DATABASE_URL` - PostgreSQL database connection
    - `CHAIN_ID` - Blockchain chain ID (e.g., "0x14a34" for Base Sepolia)

3. **Prisma Client**: Ensure Prisma client is generated:
    ```bash
    npx prisma generate
    ```

## Test Environment

-   **Port**: 3001 (to avoid conflicts with other services)
-   **Network**: Base Sepolia testnet
-   **Database**: PostgreSQL with Prisma ORM

## Notes

-   Tests use real blockchain data from Base Sepolia
-   All tests now require `chainId` parameter for multi-chain support
-   Some tests may show expected errors (e.g., address checksum validation)
-   Transaction tests may return empty results for test addresses
-   All validation tests are designed to verify proper error handling
-   Gas estimation tests demonstrate real-time gas calculation capabilities
