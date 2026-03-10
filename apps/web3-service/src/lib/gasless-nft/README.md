# KAMI Platform Gasless NFT Operations

This folder contains the **gasless-nft** package: gasless deployment, minting, selling, and payment-token operations for KAMI NFT contracts. All operations use **sponsored transactions** (the platform pays gas).

The code was split out from a single 4,600+ line file into domain-focused modules. The public API is unchanged: consumers still import from `@/lib/gasless-nft` (the parent `gasless-nft.ts` file re-exports from this package).

---

## Package structure

| File | Responsibility |
|------|----------------|
| **index.ts** | Re-exports the public API only. Do not add logic here. |
| **types.ts** | Param and response types: deploy/mint params, `DeployResponse`, `MintResponse`, `ContractQuantityValidationResult`. No runtime deps on other gasless-nft modules. |
| **config.ts** | Chain and platform configuration: `getHexChainId`, `getChainIdWithDefault`, `getBlockchainViemObject`, `getBlockchainInfo`, `getPlatformInfo`, `validatePaymentTokens`, `getDefaultPaymentToken`, `validateChainId`. Talks to DB and viem chains only. |
| **signatures.ts** | Internal helpers: `normalizePrivateKey`, `generateUserSignature`, `generateOperationSignature`. Used by deploy, mint, sell, operations, tokens. |
| **transaction.ts** | Transaction persistence and wait: `createTransaction`, `waitForTransactionBlock` (internal). Uses config for chain info. |
| **wallet.ts** | Wallet access: `getOwnerPrivateKey`, `validateWalletAccess`. Uses config and gasless-config. |
| **contract-reads.ts** | Read-only contract calls: `kamiBalanceOf`, `kamiTotalSupply`, `kamiMaxQuantity`, `kamiTotalMinted`. Uses config (and for max/minted, the sponsored-operations library). |
| **operations.ts** | Price, royalty, role, and URI operations: `setTokenURI` (internal), `setKamiNFTRoyalty`, `setKamiNFTPrice`, `setMintPrice`, `setMaxQuantity`, `hasOwnerRole` (internal), `grantOwnerRoleToSimpleAccount`. Uses config, signatures, transaction, tokens. |
| **inventory.ts** | DB quantity sync: `updateProductQuantities`, `updateVoucherQuantities` (internal), `validateAndCorrectContractQuantityState`. Uses contract-reads and prisma. |
| **deploy.ts** | All deployment flows: `deployKami721CContract`, `deployKami721ACContract`, `deployKami1155Contract`, `deployKamiNFTContract`, `deployGaslessCollection`. Uses config, signatures, transaction, operations, wallet. |
| **mint.ts** | All mint flows: `mintKami721CToken`, `mintKami721ACToken`, `mintKami1155Token`, `mintKamiNFTToken`, `mintGaslessNFT`, `batchMintGaslessNFTs`. Uses config, signatures, transaction, tokens, operations, inventory, contract-reads, wallet, ipfs, gasless-config. |
| **sell.ts** | Sell/transfer: `sellKamiToken`. Uses config, signatures, transaction, wallet. |
| **tokens.ts** | Payment token helpers: `toTokenUnits`, `getPaymentTokenDecimals`, `transferPaymentToken`, `getPaymentTokenBalances`. Uses config, signatures, transaction, wallet. |

---

## Dependency rules (no cycles)

- **config** and **types** – No imports from other files in this package.
- **signatures**, **transaction**, **wallet**, **contract-reads** – May import **config** (and external libs) only.
- **operations** – **config**, **signatures**, **tokens** (and **transaction** for `createTransaction`).
- **inventory** – **contract-reads** (and prisma).
- **deploy** – **config**, **signatures**, **transaction**, **operations**, **wallet**.
- **mint** – **config**, **signatures**, **transaction**, **tokens**, **operations**, **inventory**, **contract-reads**, **wallet** (plus `@/lib/ipfs`, `@/lib/gasless-config`).
- **sell** – **config**, **signatures**, **transaction**, **wallet**.
- **tokens** – **config**, **signatures**, **transaction**, **wallet**.

Do not introduce cycles (e.g. config or signatures must not import deploy/mint/sell).

---

## Contract types

- **ERC721C** – Non-fungible; one token per voucher, quantity always 1.
- **ERC721AC** – Claimable; batch minting, reusable vouchers, optional max supply.
- **ERC1155C** – Semi-fungible; quantity-based minting.

---

## How to import

Always use the barrel import so you get the public API and types:

```typescript
import {
  deployGaslessCollection,
  mintGaslessNFT,
  sellKamiToken,
  getBlockchainInfo,
  validateChainId,
  type DeployResponse,
  type MintResponse,
} from '@/lib/gasless-nft';
```

Do not import from individual files (e.g. `@/lib/gasless-nft/deploy`) in app or API code; use `@/lib/gasless-nft` so the public surface stays in one place.

---

## Usage examples

```typescript
// Deploy a collection (idempotent if already deployed)
const deployResult = await deployGaslessCollection(collectionId, checkoutId);

// Mint from a voucher (single or batch for ERC721AC)
const mintResult = await mintGaslessNFT(voucherId, recipientAddress, checkoutId, quantity);

// Sell / transfer token to buyer
const sellResult = await sellKamiToken(
  chainId,
  contractType,
  contractAddress,
  tokenId,
  buyerAddress,
  sellerPrivateKey,
  checkoutId,
  buyerPrivateKey
);
```

---

## External dependencies

- **Database**: `prisma` (blockchain, platform, payment_token, collection, voucher, product, asset, transaction).
- **Libraries**: `@paulstinchcombe/gasless-nft-tx`, `viem`, `@prisma/client`.
- **App**: `@/lib/db`, `@/lib/types`, `@/lib/ipfs`, `@/lib/gasless-config`, `@/app/utils/secrets`.
