# Changelog

All notable changes to the KAMI Platform Web3 Service will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

-   Comprehensive documentation suite
-   API reference documentation
-   Development guide
-   Database schema documentation
-   npm scripts for convenient deployment (`deploy:libraries`, `deploy:simpleaccount`, `deploy:contractdeployer`)
-   `GET /api/blockchain/getTotalMinted` endpoint - Get total minted count using gasless-nft-tx library's `getTotalMinted` method
-   `kamiMaxQuantity()` function - Get max quantity limit from ERC721AC contracts
-   Batch minting support for ERC721AC NFTs - Multiple tokens can be minted to the same recipient in a single transaction
-   TotalSupply validation - Validates that requested quantity doesn't exceed maxQuantity before minting

### Changed

-   Updated @paulstinchcombe/gasless-nft-tx from v0.9.1 to v0.10.4
-   Improved library deployment script with correct artifact path resolution
-   Added delays between library deployments to avoid nonce issues
-   Enhanced error handling in deployment scripts
-   Checkout endpoint now groups ERC721AC items by voucherId for efficient batch minting
-   `mintGaslessNFT()` now accepts optional `quantity` parameter for batch minting
-   `MintResponse` interface extended with batch minting fields (`amount`, `tokenIds`, `startTokenId`)

### Fixed

-   Checkout mint vs buy logic: when request has productId and assetId (or tokenId that resolves to an asset), server now correctly chooses buy instead of mint. When tokenId is sent without assetId, server looks up the asset table (contractAddress + tokenId); if token exists → buy, else → mint (requires productId or voucherId). tokenId is now accepted as a valid checkout item identifier.
-   Checkout tokenId lookup: collection chainId is normalized to hex before querying the asset table, so buy is correctly chosen when the collection has a decimal chainId (e.g. `84532`) and assets were stored with hex (e.g. `0x14a34`) after mint.

### Changed

-   Checkout API logs each request with prefix `[checkout] Request` (checkoutId, walletAddress, item count, and per-item fields) for cart-service and integration debugging.
-   Fixed library deployment script that was looking for artifacts in incorrect location
-   Added proper path resolution for npm package artifacts in `deploy-libraries.ts`
-   Fixed nonce errors in sequential library deployments
-   Fixed KAMI721AC quantity handling - Quantities are now properly tracked and validated
-   Fixed checkout response to correctly reflect batch minted quantities
-   Fixed product availableQuantity updates to account for batch minting scenarios
-   Fixed totalSupply validation to prevent minting beyond maxQuantity limits

## [0.2.0] - 2024-12-XX

### Added

-   Complete gasless operations using @paulstinchcombe/gasless-nft-tx v0.10.4
-   Multi-chain support with database-driven configuration
-   Backend signature handling for Web2-centric frontend
-   Comprehensive API endpoints for all NFT operations
-   Advanced royalty and collaborator management
-   IPFS integration for metadata and file storage
-   Database-driven blockchain configuration
-   Support for multiple contract types (ERC721C, ERC721AC, ERC1155C)
-   Checkout and payment processing system
-   Social features (likes, shares, tips, follows)
-   Project and collection management
-   Lazy minting with vouchers
-   Transaction logging and tracking
-   Platform wallet management
-   Payment token support
-   Order and cart management
-   Trending and analytics features
-   Notification system
-   User profile management
-   Tag system for categorization
-   Playlist functionality
-   Affiliate and referral system
-   Mailing list management
-   JWT configuration
-   Administrator role management
-   Currency management
-   Wallet transaction tracking

### Changed

-   Updated to use `Web3TransactionType` enum instead of `TransactionType`
-   Removed default values from transaction type field to fix Prisma parsing errors
-   Enhanced error handling and validation across all endpoints
-   Improved database schema with better relationships and constraints
-   Optimized API response times and data structure
-   Better TypeScript type safety throughout the codebase
-   Updated gasless library to v0.10.4 for improved functionality
-   Enhanced IPFS integration with better error handling
-   Improved database connection management with Prisma
-   Better separation of concerns in library functions

### Fixed

-   Prisma schema parsing error with enum default values
-   Database connection issues in production
-   Gasless operation failures with proper error handling
-   IPFS upload failures with retry logic
-   TypeScript compilation errors
-   API response consistency issues
-   Memory leaks in long-running processes
-   Race conditions in concurrent operations

### Security

-   Enhanced input validation for all API endpoints
-   Improved error handling to prevent information leakage
-   Better sanitization of user inputs
-   Secure handling of private keys and sensitive data
-   Proper CORS configuration
-   Input validation for all database operations

### Performance

-   Optimized database queries with proper indexing
-   Improved API response times
-   Better memory management
-   Reduced bundle size with tree shaking
-   Optimized IPFS operations
-   Better caching strategies

## [0.1.0] - 2024-XX-XX

### Added

-   Initial release of KAMI Platform Web3 Service
-   Basic gasless operations with single-chain support
-   Core API endpoints for NFT operations
-   Database schema with essential models
-   Basic IPFS integration
-   Simple project structure
-   Initial documentation

### Features

-   NFT contract deployment
-   NFT minting operations
-   Basic product management
-   Simple user management
-   Basic blockchain integration
-   Initial database setup

## Migration Guide

### From v0.1.x to v0.2.0

#### Breaking Changes

1. **Database Schema Changes**

    - `TransactionType` enum renamed to `Web3TransactionType`
    - Removed default values from transaction type field
    - Added new models for enhanced functionality

2. **API Changes**

    - Updated response formats for consistency
    - Enhanced error handling
    - New required fields in some endpoints

3. **Environment Variables**
    - New required environment variables for KAMI libraries
    - Updated IPFS configuration
    - Additional blockchain configuration options

#### Migration Steps

1. **Update Dependencies**

    ```bash
    pnpm install
    ```

2. **Update Database Schema**

    ```bash
    npx prisma migrate dev
    npx prisma generate
    ```

3. **Deploy Gasless Infrastructure**

    ```bash
    tsx scripts/setup-gasless-infrastructure.ts <chainId> <privateKey>
    ```

4. **Update Environment Variables**

    - Add new KAMI library addresses
    - Update IPFS configuration
    - Configure blockchain settings

5. **Test All Endpoints**
    - Verify all API endpoints work correctly
    - Test gasless operations
    - Validate database operations

#### Code Changes Required

1. **Update Import Statements**

    ```typescript
    // Old
    import { TransactionType } from '@prisma/client';

    // New
    import { Web3TransactionType } from '@prisma/client';
    ```

2. **Update Database Queries**

    ```typescript
    // Old
    const transactions = await prisma.transaction.findMany({
    	where: { type: TransactionType.Deploy721C },
    });

    // New
    const transactions = await prisma.transaction.findMany({
    	where: { type: Web3TransactionType.Deploy721C },
    });
    ```

3. **Update API Responses**
    - Ensure consistent response format
    - Add proper error handling
    - Update TypeScript types

## Deprecations

### v0.2.0

-   No deprecations in this version

### Future Deprecations

-   Single-chain support will be deprecated in favor of multi-chain
-   Basic error handling will be replaced with enhanced error management
-   Simple API responses will be replaced with structured responses

## Known Issues

### v0.2.0

-   IPFS service dependency requires manual setup
-   Some blockchain operations may timeout on slow networks
-   Database migrations may take time on large datasets

### Workarounds

-   Use retry logic for IPFS operations
-   Implement proper timeout handling for blockchain operations
-   Run migrations during maintenance windows

## Support

For issues and questions:

1. Check the [Overview](./OVERVIEW.md)
2. Review the [API Reference](./api/API_REFERENCE.md)
3. Check the [Development Guide](./development/DEVELOPMENT.md)
4. Contact the development team

---

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Gasless Library**: @paulstinchcombe/gasless-nft-tx v0.10.4
