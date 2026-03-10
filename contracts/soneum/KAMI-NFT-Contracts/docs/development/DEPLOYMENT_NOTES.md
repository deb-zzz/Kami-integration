# Contract Size Optimization & Deployment Notes

## Current Status ✅

### Deployment Ready

-   **Soneum Network**: ✅ No size restrictions (allowUnlimitedContractSize: true)
-   **Minato Network**: ✅ No size restrictions (allowUnlimitedContractSize: true)

### Optimization Settings Applied

```solidity
optimizer: {
    enabled: true,
    runs: 1, // Maximum size optimization
}
viaIR: true,
metadata: {
    bytecodeHash: 'none', // Removes metadata to save space
}
```

### Contract Sizes

-   KAMI1155C: 26,775 bytes
-   KAMI1155CUpgradeable: 33,506 bytes
-   KAMI721AC: 25,322 bytes
-   KAMI721ACUpgradable: 26,159 bytes
-   KAMI721CUpgradeable: 26,159 bytes

## For Ethereum Mainnet Deployment (24,576 byte limit)

If deploying to Ethereum mainnet, consider these options:

### Option 1: Use UUPS Proxy Pattern (Recommended)

The upgradeable contracts already use UUPS pattern. Deploy the implementation separately:

1. Deploy implementation contract
2. Deploy UUPS proxy pointing to implementation
3. The proxy is small (~few KB)

### Option 2: Further Code Splitting

Move more logic to external libraries to reduce contract size.

### Option 3: Remove Redundant Functions

Some contracts have duplicate functions that could be consolidated.

## Current Recommendation

**Deploy to Soneum/Minato without changes** - these networks support unlimited contract size.

如果要部署到以太坊主网，请联系团队进行进一步的优化。
