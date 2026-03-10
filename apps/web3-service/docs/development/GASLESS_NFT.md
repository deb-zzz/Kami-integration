# Gasless KAMI NFT Functions

This document describes the gasless NFT deployment and minting functions implemented using the `@paulstinchcombe/gasless-nft-tx` library for all three KAMI NFT types: KAMI721-C, KAMI721-AC, and KAMI1155-C.

## Overview

The gasless KAMI NFT system allows users to deploy and mint NFTs without paying gas fees directly. Instead, a relayer service pays the gas fees on behalf of the user, making the experience more user-friendly. The system supports all three KAMI NFT standards with their specific deployment and minting parameters.

## Architecture

The system uses a two-step pattern:

1. **Deployer Setup**: `KamiSimpleAccountDeployer` is used to deploy contracts
2. **Handler Usage**: Specific handlers (`KAMI721CSimpleAccountHandler`, `KAMI721ACSimpleAccountHandler`, `KAMI1155CSimpleAccountHandler`) are used to mint NFTs

This pattern ensures proper gasless transaction handling and account management.

## Files

-   `src/lib/gasless-nft.ts` — Main gasless NFT facade
-   `src/lib/gasless-nft/` — Deploy, mint, sell, operations, signatures
-   `src/lib/gasless-config.ts` — Configuration utilities (reads from database)

## Configuration (database-driven)

Gasless configuration is **stored in the database**, not in environment variables. For each chain:

-   **blockchain** table: `chainId`, `name`, `rpcUrl`, `logoUrl`
-   **platform** table: `simpleAccountAddress`, `contractDeployerAddress`, `platformFundingWalletAddress`, `platformFundingWalletPrivateKey` (stored encrypted), `platformAddress`, and KAMI library addresses

See [ARCHITECTURE.md](./ARCHITECTURE.md) and [env.example](../../env.example). Populate via `tsx scripts/setup-gasless-infrastructure.ts <chainId> <privateKey>`.

## Environment Variables

Required for the service to run:

-   **DEFAULT_CHAIN_ID** — Fallback chain ID (hex) when not provided in requests; must exist in `blockchain` table.
-   **ENCRYPTION_KEY** — 64-character hex string used to decrypt `platformFundingWalletPrivateKey` (and account keys) from the database. Generate with `openssl rand -hex 32`. See [secrets.ts](../../src/app/utils/secrets.ts).

Optional (deployment scripts and EntryPoint path):

-   **ENTRY_POINT_ADDRESS** — Override EntryPoint (default: v0.7 `0x0000000071727De22E5E9d8BAf0edAc6f37da032`).
-   **USE_ENTRY_POINT_FOR_EXECUTE** — Set to `"true"` to send execute() (mint, setPrice, etc.) via EntryPoint.handleOps. When true, the SimpleAccount must have an EntryPoint deposit.
-   **USE_ENTRYPOINT_FOR_DEPLOYMENT** — Set to `"true"` to send deployment via EntryPoint.handleOps. Same EntryPoint deposit requirement.
-   **FUND_SIMPLE_ACCOUNT_ETH** — Optional ETH amount to send to the SimpleAccount's native balance after deploy (used by `deploy-simpleaccount.ts`).
-   **FUND_ENTRYPOINT_DEPOSIT_ETH** — Optional ETH amount to fund the SimpleAccount's EntryPoint deposit (EntryPoint.depositTo). Used by deploy scripts when set.

### EntryPoint deposit (when using EntryPoint path)

When **`USE_ENTRY_POINT_FOR_EXECUTE`** or **`USE_ENTRYPOINT_FOR_DEPLOYMENT`** is `true`, the SimpleAccount is invoked via EntryPoint.handleOps (UserOperation). In that case, **gas is paid from an EntryPoint deposit**, not from the SimpleAccount’s native ETH balance. The **Platform Funding EOA** should fund that deposit:

-   **Scripts:** Set **`FUND_ENTRYPOINT_DEPOSIT_ETH`** (e.g. `"0.01"`) when running `deploy-simpleaccount.ts` or `setup-gasless-infrastructure.ts`. The Platform Funding EOA will call **EntryPoint.depositTo(simpleAccountAddress)** with that ETH.
-   **Manual:** Call **`EntryPoint.depositTo(simpleAccountAddress)`** (payable) with the desired ETH from the Platform Funding EOA (EntryPoint v0.7; same address on all chains).
-   **Balance:** Use **`EntryPoint.balanceOf(simpleAccountAddress)`** to check deposit; top up as needed for ongoing operations and deployments.

## Functions

### Utility Functions

#### `kamiTotalSupply(chainId, contractType, contractAddress, tokenId?)`

Gets the current total supply of a KAMI NFT contract.

**Parameters:**

-   `chainId` - Chain ID as hex string (e.g., '0x5')
-   `contractType` - Contract type: 'ERC721AC' or 'ERC1155C'
-   `contractAddress` - Contract address
-   `tokenId` - Token ID (required for ERC1155C, optional for ERC721AC)

**Returns:** `Promise<number>` - Current total supply

**Example:**

```typescript
const totalSupply = await kamiTotalSupply('0x5', 'ERC721AC', '0x1234...');
console.log(`Current total supply: ${totalSupply}`);
```

#### `kamiMaxQuantity(chainId, contractAddress)`

Gets the maximum quantity (maxSupply) limit for a KAMI721AC contract.

**Parameters:**

-   `chainId` - Chain ID as hex string (e.g., '0x5')
-   `contractAddress` - ERC721AC contract address

**Returns:** `Promise<number>` - Maximum quantity (0 if unlimited or not set)

**Example:**

```typescript
const maxQuantity = await kamiMaxQuantity('0x5', '0x1234...');
if (maxQuantity > 0) {
	console.log(`Max quantity limit: ${maxQuantity}`);
} else {
	console.log('No quantity limit set (unlimited)');
}
```

### Core Functions

#### KAMI721-C Functions

##### `deployKami721CContract(params: DeployKami721CParams)`

Deploys a gasless KAMI721-C contract (Standard NFT).

**Parameters:**

-   `contractType` - 'ERC721C'
-   `ownerAddress` - Wallet address of the contract owner
-   `name` - Collection name
-   `symbol` - Collection symbol
-   `baseURI` - Base URI for metadata

**Example:**

```typescript
const result = await deployKami721CContract({
	contractType: 'ERC721C',
	ownerAddress: '0x1234...',
	name: 'My Collection',
	symbol: 'MC',
	baseURI: 'https://api.kami.com/metadata/',
});
```

##### `mintKami721CToken(params: MintKami721CParams)`

Mints a gasless KAMI721-C NFT.

**Parameters:**

-   `contractAddress` - Deployed contract address
-   `recipientAddress` - Address to receive the NFT
-   `tokenId` - Token ID to mint

#### KAMI721-AC Functions

##### `deployKami721ACContract(params: DeployKami721ACParams)`

Deploys a gasless KAMI721-AC contract (Claimable NFT).

**Parameters:**

-   `contractType` - 'ERC721AC'
-   `ownerAddress` - Wallet address of the contract owner
-   `name` - Collection name
-   `symbol` - Collection symbol
-   `baseURI` - Base URI for metadata
-   `maxQuantity` - Optional maximum quantity (0 for unlimited). If not provided, will be set from `voucher.maxQuantity` during deployment

**KAMI721AC Deployment Rules:**

When deploying a KAMI721AC contract via `deployGaslessCollection()`:

-   The `maxQuantity` is automatically fetched from the first voucher's `maxQuantity` field associated with the collection
-   If `voucher.maxQuantity` is `null` or `undefined`, the contract's `maxQuantity` is set to `0` (unlimited)
-   The `maxQuantity` is set on the contract after deployment using `setTotalSupply()`
-   This value determines the maximum number of tokens that can ever be minted from this contract

##### `mintKami721ACToken(params: MintKami721ACParams)`

Mints a gasless KAMI721-AC NFT. Supports batch minting when `amount > 1`.

**Important:** For KAMI721AC contracts, the mint price is read from the contract's global `mintPrice` variable, not from the `tokenPrice` parameter. The `tokenPrice` parameter in `SponsoredMintParams` is optional and ignored for KAMI721AC (but still required for KAMI721C/KAMI1155C).

**Parameters:**

-   `contractAddress` - Deployed contract address
-   `recipientAddress` - Address to receive the NFT
-   `tokenUri` - URI for the token metadata
-   `royaltyData` - Array of royalty data (required for KAMI721AC)
-   `amount` - Quantity to mint (default: 1). When > 1, enables batch minting multiple tokens to the same recipient
-   `price` - Price parameter (used for signature generation, but mint price comes from contract)
-   `checkoutId` - Optional checkout ID for transaction tracking

**Batch Minting:**

When `amount > 1`, the function uses batch minting to mint multiple tokens to the same recipient in a single transaction. The response includes:

-   `tokenId` - First token ID minted
-   `amount` - Number of tokens minted
-   `tokenIds` - Array of all token IDs (if returned by contract)
-   `startTokenId` - Starting token ID for the batch (if returned by contract)

**Example:**

```typescript
// Single token mint
const result = await mintKami721ACToken({
  contractAddress: '0x1234...',
  recipientAddress: '0x5678...',
  tokenUri: 'https://...',
  royaltyData: [...],
  amount: 1,
  price: 100,
  privateKey: '0x...',
  chain: baseSepolia,
});

// Batch mint (5 tokens)
const batchResult = await mintKami721ACToken({
  contractAddress: '0x1234...',
  recipientAddress: '0x5678...',
  tokenUri: 'https://...',
  royaltyData: [...],
  amount: 5, // Batch mint 5 tokens
  price: 100,
  privateKey: '0x...',
  chain: baseSepolia,
});
console.log(`Minted ${batchResult.amount} tokens`);
```

#### KAMI1155-C Functions

##### `deployKami1155Contract(params: DeployKami1155Params)`

Deploys a gasless KAMI1155-C contract (Series NFT).

**Parameters:**

-   `contractType` - 'ERC1155C'
-   `ownerAddress` - Wallet address of the contract owner
-   `uri` - URI template for metadata (e.g., 'https://api.kami.com/metadata/{id}.json')

##### `mintKami1155Token(params: MintKami1155Params)`

Mints a gasless KAMI1155-C NFT with quantity.

**Parameters:**

-   `contractAddress` - Deployed contract address
-   `recipientAddress` - Address to receive the NFT
-   `tokenId` - Token ID to mint
-   `amount` - Quantity to mint

#### Price Management Functions

##### `setKamiNFTPrice(chainId, contractAddress, contractType, tokenId, price, options)`

Sets the price for a KAMI NFT token.

**For KAMI721AC:** Uses `setSalePrice()` internally (token owner only, sets per-token sale price)
**For KAMI721C/KAMI1155C:** Uses `setPrice()` (OWNER_ROLE only)

**Parameters:**

-   `chainId` - Chain ID as hex string
-   `contractAddress` - Contract address
-   `contractType` - Contract type ('ERC721C', 'ERC721AC', 'ERC1155C')
-   `tokenId` - Token ID
-   `price` - Price to set (number, string, or bigint)
-   `options` - Optional: `ownerPrivateKey`, `simpleAccountAddress`

**Returns:** `Promise<boolean>` - Success status

##### `setMintPrice(chainId, contractAddress, contractType, mintPrice, options)`

Sets the global mint price for a KAMI721AC contract. **KAMI721AC only.**

**Parameters:**

-   `chainId` - Chain ID as hex string
-   `contractAddress` - KAMI721AC contract address
-   `contractType` - Must be 'ERC721AC'
-   `mintPrice` - Global mint price to set (number, string, or bigint)
-   `options` - Optional: `ownerPrivateKey`, `simpleAccountAddress`

**Returns:** `Promise<boolean>` - Success status

**Note:** This function is only available for KAMI721AC contracts. Requires OWNER_ROLE.

#### Generic Functions

##### `deployGaslessCollection(collectionId: number, ownerAddress: string)`

Deploys a gasless NFT contract for an existing collection (automatically determines type).

**Parameters:**

-   `collectionId` - ID of the collection in the database
-   `ownerAddress` - Wallet address of the collection owner

**Returns:**

-   `DeployResponse` - Object containing contract address, transaction hash, block number, and gas used

**Example:**

```typescript
const result = await deployGaslessCollection(1, '0x1234...');
console.log('Contract deployed at:', result.contractAddress);
```

#### `mintGaslessNFT(voucherId: number, recipientAddress: string, checkoutId?: string, quantity?: number)`

Mints a gasless NFT for a specific voucher. Supports batch minting for ERC721AC contracts when quantity > 1.

**Parameters:**

-   `voucherId` - ID of the voucher in the database
-   `recipientAddress` - Wallet address to receive the NFT
-   `checkoutId` - Optional checkout ID for transaction tracking
-   `quantity` - Optional quantity to mint (default: 1). For ERC721AC, this enables batch minting multiple tokens to the same recipient

**Returns:**

-   `MintResponse` - Object containing token ID, transaction hash, checkout ID, and optional batch minting fields:
    -   `tokenId` - Primary token ID (first token for batch mints)
    -   `transactionHash` - Transaction hash
    -   `checkoutId` - Checkout ID if provided
    -   `assetId` - Asset ID created after minting
    -   `amount` - Quantity minted (for batch mints)
    -   `tokenIds` - Array of all token IDs minted (for batch mints)
    -   `startTokenId` - Starting token ID for batch mints (if returned by contract)

**Validation:**

For ERC721AC contracts with quantity > 1:

-   Validates that `quantity <= availableQuantity` from product
-   Validates that `currentTotalSupply + quantity <= maxQuantity` from contract
-   Throws error if validation fails

**KAMI721AC Minting Rules:**

-   **Multiple Tokens Allowed**: When minting, you can mint multiple tokens in a single transaction by specifying `quantity > 1`
-   **Max Quantity Validation**: The system validates that `currentTotalSupply + quantity <= maxQuantity` before minting
-   **Unlimited Collections**: If `maxQuantity = 0` (unlimited), the validation is skipped and any quantity can be minted
-   **Batch Minting**: Multiple tokens are minted to the same recipient in a single transaction, improving efficiency and reducing gas costs

**Example:**

```typescript
// Single NFT mint
const result = await mintGaslessNFT(1, '0x5678...');
console.log('Token minted with ID:', result.tokenId);

// Batch mint (ERC721AC only)
const batchResult = await mintGaslessNFT(1, '0x5678...', 'checkout-123', 5);
console.log(`Minted ${batchResult.amount} tokens`);
console.log('Token IDs:', batchResult.tokenIds);
```

#### `batchMintGaslessNFTs(voucherIds: number[], recipientAddress: string, checkoutId?: string)`

Mints multiple gasless NFTs in batches to avoid overwhelming the relayer. Each voucher is minted separately (for different vouchers). For batch minting multiple tokens from the same voucher, use `mintGaslessNFT()` with `quantity > 1`.

**Parameters:**

-   `voucherIds` - Array of voucher IDs to mint (each voucher minted separately)
-   `recipientAddress` - Wallet address to receive the NFTs
-   `checkoutId` - Optional checkout ID for transaction tracking

**Returns:**

-   `MintResponse[]` - Array of minting responses

**Example:**

```typescript
// Mint multiple different vouchers
const results = await batchMintGaslessNFTs([1, 2, 3], '0x5678...', 'checkout-123');
console.log(`Minted ${results.length} NFTs`);

// For batch minting multiple tokens from same voucher, use mintGaslessNFT with quantity
const batchResult = await mintGaslessNFT(1, '0x5678...', 'checkout-123', 5);
console.log(`Minted ${batchResult.amount} tokens from voucher 1`);
```

### Service Functions

#### `createGaslessNFTService(walletAddress: string)`

Creates a gasless NFT service instance for direct usage.

**Parameters:**

-   `walletAddress` - Wallet address for the signer

**Returns:**

-   `GaslessNFTService` - Service instance

**Example:**

```typescript
const service = await createGaslessNFTService('0x1234...');
const result = await service.deployContract({...});
```

## Configuration

### Default Settings

-   **Royalty Fee:** 2.5% (250 basis points)
-   **Batch Size:** 10 NFTs per batch
-   **Batch Delay:** 1 second between batches
-   **Retry Attempts:** 3 attempts with 2-second delays

### Customization

You can modify these settings in `src/lib/gasless-config.ts`:

```typescript
export const DEFAULT_ROYALTY_CONFIG = {
	feeNumerator: 250, // 2.5%
	maxFeeNumerator: 1000, // 10% maximum
};

export const BATCH_CONFIG = {
	maxBatchSize: 10,
	delayBetweenBatches: 1000, // 1 second
	retryAttempts: 3,
	retryDelay: 2000, // 2 seconds
};
```

## Error Handling

All functions include comprehensive error handling:

-   **Configuration validation** - Ensures required environment variables are set
-   **Database validation** - Verifies collection and voucher existence
-   **Transaction validation** - Checks for successful contract deployment and minting
-   **Retry logic** - Automatic retries for transient failures

## Integration with Existing System

### Database Requirements

The functions expect the following database structure:

1. **Collections table** with:

    - `collectionId` (primary key)
    - `name`, `symbol`, `description`
    - `contractType` (ERC721C, ERC721AC, ERC1155C, ERC20)
    - `contractAddress` (updated after deployment)

2. **Vouchers table** with:

    - `id` (primary key)
    - `walletAddress`
    - `tokenId`
    - `metadata`
    - `collectionId` (foreign key)

3. **Private keys table** with:
    - `walletAddress` (primary key)
    - `key` (encrypted private key)

### Integration Steps

1. **Deploy Collection:**

    ```typescript
    // When a collection is ready for deployment
    const deployResult = await deployGaslessCollection(collectionId, ownerAddress);
    ```

2. **Mint NFTs:**

    ```typescript
    // When vouchers are ready to be minted
    const mintResult = await mintGaslessNFT(voucherId, recipientAddress);
    ```

3. **Batch Operations:**
    ```typescript
    // For multiple vouchers
    const results = await batchMintGaslessNFTs(voucherIds, recipientAddress);
    ```

## Security Considerations

1. **Private Key Storage:** Private keys are stored encrypted in the database
2. **Access Control:** Only authorized wallet addresses can deploy/mint
3. **Rate Limiting:** Batch operations include delays to prevent overwhelming the relayer
4. **Error Recovery:** Failed operations are logged and can be retried

## Monitoring and Logging

All functions include detailed logging:

-   **Deployment logs:** Contract addresses, transaction hashes
-   **Minting logs:** Token IDs, recipient addresses
-   **Error logs:** Detailed error messages and stack traces
-   **Performance logs:** Gas usage, transaction times

## Testing

See `src/lib/gasless-examples.ts` for comprehensive usage examples and test patterns.

## Troubleshooting

### Common Issues

1. **"Private key not found"** - Ensure the wallet address exists in the `pks` table
2. **"Collection not found"** - Verify the collection ID exists in the database
3. **"Configuration validation failed"** - Check that required environment variables are set
4. **"Transaction failed"** - Check network connectivity and relayer service status

### Debug Mode

Enable debug logging by setting the log level in your environment:

```bash
export LOG_LEVEL=debug
```

## KAMI721AC Quantity Rules

KAMI721AC contracts have specific rules governing deployment, minting, and buying operations:

### Deployment Rules

1. **Max Quantity Setting**:

    - During deployment, `maxQuantity` is read from the first voucher's `maxQuantity` field associated with the collection
    - If `voucher.maxQuantity` is `null` or `undefined`, the contract's `maxQuantity` is set to `0` (unlimited)
    - The `maxQuantity` value is set on the contract after deployment using `setTotalSupply()`
    - This establishes the maximum number of tokens that can ever be minted from the contract

2. **Available Quantity Initialization**:

    - After deployment, `availableQuantity` is set to `maxQuantity` for all products in the collection
    - `availableQuantity` tracks the number of tokens **available for minting** (not for buying)
    - If `maxQuantity = 0` (unlimited), `availableQuantity` is left unchanged (preserves existing value)

3. **Unlimited Collections**:
    - When `maxQuantity = 0`, there is no limit on the number of tokens that can be minted
    - This is the default behavior if no `maxQuantity` is specified in the voucher

### Minting Rules

1. **Multiple Tokens Per Transaction**:

    - Users can mint multiple tokens in a single transaction by specifying `quantity > 1`
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

    - When a checkout item includes an `assetId` (instead of `voucherId`), the system determines whether to mint or transfer:
        - **If seller is creator AND availableQuantity > 0**: Route to MINT
            - Creator can mint multiple tokens (up to `availableQuantity`)
            - Uses existing voucher associated with the product
            - Quantity is validated against `availableQuantity`
        - **If seller is NOT creator OR availableQuantity = 0**: Route to BUY/transfer
            - Only allows quantity = 1 per transaction
            - Transfers ownership of an already-minted token
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

During the minting process, the system automatically validates that smart contract values match the database values. If discrepancies are detected, the database is automatically corrected to match the contract state (the source of truth).

#### Validation Process

1. **When Validation Occurs**:

    - Validation runs automatically after each successful mint operation
    - Applies to ERC721AC collections only
    - Validation occurs both in the checkout API route and in the `mintGaslessNFT()` library function

2. **Values Compared**:

    - **`totalSupply`** (contract) vs **`maxQuantity`** (database)
        - The contract's `totalSupply` should equal the database's `maxQuantity`
    - **`totalSupply - totalMinted`** (contract) vs **`availableQuantity`** (database)
        - The contract's calculated available quantity should equal the database's `availableQuantity`

3. **Auto-Correction Behavior**:
   When mismatches are detected, the system automatically:

    - Updates `product.maxQuantity` = `totalSupply` (from contract)
    - Updates `product.availableQuantity` = `totalSupply - totalMinted` (calculated from contract)
    - Updates `voucher.maxQuantity` = `totalSupply` (if voucher exists)
    - Logs a highlighted warning showing the mismatch and all corrections applied

4. **Warning Format**:
   When a mismatch is detected and corrected, a highly visible warning is logged:

    ```
    ================================================================================
    ⚠️  QUANTITY MISMATCH DETECTED AND CORRECTED ⚠️
    ================================================================================
    Contract Address: 0x...
    Collection ID: 123
    Product ID: 456
    Voucher ID: 789

    Smart Contract Values (Source of Truth):
      - totalSupply: 100
      - maxQuantity: 100
      - totalMinted: 50
      - availableQuantity (calculated): 50

    Product Table Values (Before Correction):
      - maxQuantity: 95
      - availableQuantity: 45

    Product Table Values (After Correction):
      - maxQuantity: 100 ✅
      - availableQuantity: 50 ✅

    Corrections Applied:
      - Updated product.maxQuantity: 95 → 100
      - Updated product.availableQuantity: 45 → 50
      - Updated voucher.maxQuantity: 95 → 100

    Database values have been synchronized with smart contract state.
    ================================================================================
    ```

5. **Benefits**:

    - Ensures database always reflects the true contract state
    - Prevents inventory discrepancies
    - Automatically corrects any drift between contract and database
    - Provides visibility into corrections through highlighted warnings

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

## Future Enhancements

-   Support for additional contract types
-   Enhanced retry mechanisms
-   Gas price optimization
-   Multi-chain support
-   Advanced batch processing options
