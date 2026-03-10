# Base Deployment Guide

## ⚠️ Current Status

**Your contracts will NOT deploy to Base Mainnet as-is due to size limitations.**

### Contract Sizes (Current)

-   KAMI721C: **26,775 bytes** ❌
-   KAMI721CUpgradeable: **26,159 bytes** ❌
-   KAMI721AC: **25,422 bytes** ✅ (barely passes)
-   KAMI1155C: **26,775 bytes** ❌
-   KAMI1155CUpgradeable: **33,506 bytes** ❌

### Size Limit: 24,576 bytes

Base (as an EVM-compatible L2) enforces the same EIP-170 limit as Ethereum: **24,576 bytes per contract**

## Options for Base Deployment

### Option 1: Enable `allowUnlimitedContractSize` (NOT RECOMMENDED)

```typescript
base: {
    url: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    chainId: 8453,
    accounts: [PRIVATE_KEY],
    gasPrice: 'auto',
    allowUnlimitedContractSize: true, // ⚠️ Only works in local/hardhat
},
```

**This setting only works in local development**. On-chain deployment will still fail.

### Option 2: Deploy with UUPS Proxy ✅ RECOMMENDED

**This is your best option!**

Your upgradeable contracts already use the UUPS pattern:

-   Only the **implementation contract** needs to be large (>24KB)
-   The **proxy contract** is small (~3-4KB) and stays under limit
-   The proxy delegates to the implementation

**How it works:**

1. Deploy implementation (large, stored at specific address)
2. Deploy proxy (small, delegates to implementation)
3. Users interact with the proxy address

**Your upgradeable contracts are ready to deploy:**

-   `KAMI721CUpgradeable` proxy ✅
-   `KAMI1155CUpgradeable` proxy ✅
-   `KAMI721ACUpgradable` proxy ✅

### Option 3: Further Optimize for Size

If you need direct deployment (no proxy), you'd need to:

1. **Split libraries externally** (not `using for *`)

    - Deploy `KamiPlatform`, `KamiRoyalty`, `KamiRental`, `KamiTransfer` as separate contracts
    - Link them at deployment time
    - Call them via `delegatecall` or external calls

2. **Remove features** (not recommended)

    - Remove functionality to reduce size
    - Would need to refactor significantly

3. **Use optimizer with size-focused settings** (already done)
    - Already using `runs: 1` for size optimization
    - Already using `viaIR: true`
    - Already using `bytecodeHash: 'none'`

## Recommended Approach for Base

### Use Upgradeable Contracts with UUPS Proxy ✅

1. **Deploy to Base Sepolia Testnet first:**

    ```bash
    npx hardhat deploy --network baseSepolia
    ```

2. **Deploy to Base Mainnet:**

    ```bash
    npx hardhat deploy --network base
    ```

3. **Your current scripts already support this:**
    - `scripts/deploy_upgradeable.ts`
    - `scripts/deploy_upgradeable_optimized.ts`

## Network Configuration

I've added Base networks to your `hardhat.config.ts`:

```typescript
base: {
    url: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    chainId: 8453,
    accounts: [PRIVATE_KEY],
    gasPrice: 'auto',
},
baseSepolia: {
    url: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    chainId: 84532,
    accounts: [PRIVATE_KEY],
    gasPrice: 'auto',
},
```

## Comparison: Soneum vs Base

| Feature                         | Soneum/Minato | Base            |
| ------------------------------- | ------------- | --------------- |
| Size limit                      | Unlimited ✅  | 24,576 bytes ❌ |
| Direct deploy (non-upgradeable) | Yes ✅        | No ❌           |
| UUPS proxy deploy               | Yes ✅        | Yes ✅          |
| EIP-170 enforcement             | No            | Yes             |

## Summary

-   ✅ **Ready to deploy to Base** using upgradeable contracts with UUPS proxy
-   ❌ **Cannot deploy direct** (non-upgradeable) to Base due to size limits
-   ✅ **Can deploy direct** to Soneum/Minato (unlimited size)
-   ⚠️ **KAMI721AC (25,422 bytes)** barely passes - might be risky

**Recommendation:** Test upgradeable contracts on Base Sepolia first, then proceed to mainnet.
