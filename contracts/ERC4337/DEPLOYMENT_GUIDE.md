# KAMI Sponsored NFT System - Deployment Guide

## 🚀 Quick Deployment

### 1. Prerequisites

-   [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
-   [Node.js](https://nodejs.org/) v16+ installed
-   [pnpm](https://pnpm.io/) package manager
-   Base network RPC access (Alchemy recommended)
-   Private key with sufficient ETH for deployment

### 2. Environment Setup

```bash
# Copy environment template
cp env.example .env

# Edit .env with your configuration
nano .env
```

Required environment variables:

```bash
PRIVATE_KEY=your_private_key_here
ALCHEMY_API_KEY=your_alchemy_api_key_here
BASESCAN_API_KEY=your_basescan_api_key_here
```

### 3. Deploy to Base Sepolia (Testnet)

```bash
# Deploy contracts
forge script script/Deploy.s.sol:DeployScript --rpc-url base-sepolia --broadcast --verify

# Configure contracts
forge script script/Configure.s.sol:ConfigureScript --rpc-url base-sepolia --broadcast
```

### 4. Deploy to Base Mainnet

```bash
# Deploy contracts
forge script script/Deploy.s.sol:DeployScript --rpc-url base --broadcast --verify

# Configure contracts
forge script script/Configure.s.sol:ConfigureScript --rpc-url base --broadcast
```

## 📋 Contract Addresses

After deployment, update your `.env` file with the deployed addresses:

```bash
FACTORY_ADDRESS=0x...
PAYMASTER_ADDRESS=0x...
NFT_CONTRACT_ADDRESS=0x...
```

## 🔧 Configuration

### Paymaster Settings

The Paymaster is configured with the following default settings:

-   **Global Spending Limit**: 1,000,000 USDC (testnet: 100,000 USDC)
-   **User Spending Limit**: 1,000 USDC
-   **User Operation Limit**: 100 operations
-   **Limit Reset Period**: 7 days (testnet: 1 day)
-   **Max Gas Price**: 100 gwei
-   **Max Gas Limit**: 500,000

### NFT Contract Settings

-   **Mint Price**: 100 USDC (testnet: 10 USDC)
-   **Platform Commission**: 5%
-   **Royalty Percentage**: 10%
-   **Payment Token**: USDC on Base

## 🧪 Testing

### Run Tests

```bash
# Run all tests
forge test

# Run with gas reporting
forge test --gas-report

# Run specific test
forge test --match-test testMintSponsoredNFT
```

### Test on Base Sepolia

1. Get testnet ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
2. Get testnet USDC from [Base Sepolia USDC Faucet](https://faucet.circle.com/)
3. Deploy contracts to testnet
4. Test sponsored transactions

## 🔍 Verification

### Verify Contracts on BaseScan

```bash
# Verify on BaseScan
forge verify-contract --chain-id 8453 --num-of-optimizations 200 --watch --constructor-args $(cast abi-encode "constructor(address,address,string,string,string,uint256,address,uint96,address,address)" $PAYMENT_TOKEN $NAME $SYMBOL $BASE_URI $MINT_PRICE $PLATFORM_ADDRESS $PLATFORM_COMMISSION $FACTORY_ADDRESS $PAYMASTER_ADDRESS) $CONTRACT_ADDRESS KamiSponsoredNFT
```

### Check Contract Status

```bash
# Check if contracts are deployed
cast code $FACTORY_ADDRESS
cast code $PAYMASTER_ADDRESS
cast code $NFT_CONTRACT_ADDRESS

# Check contract configuration
cast call $PAYMASTER_ADDRESS "globalSpendingLimit()"
cast call $NFT_CONTRACT_ADDRESS "mintPrice()"
```

## 🚨 Security Checklist

-   [ ] Private keys are secure and not committed to version control
-   [ ] Contracts are verified on BaseScan
-   [ ] Spending limits are set appropriately
-   [ ] Access control is properly configured
-   [ ] Emergency pause functionality is tested
-   [ ] All functions are tested thoroughly

## 🔄 Integration

### With Existing KAMI Contracts

The sponsored NFT system can be integrated with existing KAMI contracts:

1. **KAMI721-C**: Add to Paymaster allowed contracts
2. **KAMI721-AC**: Enable sponsored claiming
3. **KAMI1155-C**: Support sponsored multi-token operations

### JavaScript Integration

```javascript
import { initializeSponsoredSystem, mintSponsoredNFT } from './examples/sponsored-transactions.js';

// Initialize system
const { smartAccountClient } = await initializeSponsoredSystem();

// Mint NFT with sponsored gas
await mintSponsoredNFT(smartAccountClient);
```

## 📊 Monitoring

### Key Metrics to Monitor

-   **Gas Sponsorship**: Track total gas sponsored
-   **User Activity**: Monitor per-user spending
-   **Contract Health**: Check for failed transactions
-   **Spending Limits**: Monitor limit utilization

### Useful Commands

```bash
# Check global spending
cast call $PAYMASTER_ADDRESS "globalSpending()"

# Check user spending
cast call $PAYMASTER_ADDRESS "userSpending(address)" $USER_ADDRESS

# Check remaining limits
cast call $PAYMASTER_ADDRESS "getRemainingGlobalSpending()"
cast call $PAYMASTER_ADDRESS "getRemainingUserSpending(address)" $USER_ADDRESS
```

## 🆘 Troubleshooting

### Common Issues

1. **"Only smart accounts allowed"**

    - Ensure you're using a smart account, not an EOA
    - Check smart account initialization

2. **"Contract not allowed"**

    - Add contract to Paymaster allowed contracts
    - Use `allowContract` function

3. **"Function not allowed"**

    - Add function to Paymaster allowed functions
    - Use `allowFunction` function

4. **"User limit exceeded"**

    - Check user spending limits
    - Wait for limit reset or increase limits

5. **"Global limit exceeded"**
    - Check global spending limit
    - Increase limit or wait for reset

### Debug Commands

```bash
# Check contract configuration
cast call $PAYMASTER_ADDRESS "allowedContracts(address)" $NFT_CONTRACT_ADDRESS
cast call $PAYMASTER_ADDRESS "allowedFunctions(address,bytes4)" $NFT_CONTRACT_ADDRESS 0x1249c58b

# Check user limits
cast call $PAYMASTER_ADDRESS "userSpending(address)" $USER_ADDRESS
cast call $PAYMASTER_ADDRESS "userOperationCount(address)" $USER_ADDRESS
```

## 📞 Support

-   **GitHub Issues**: [Create an issue](https://github.com/KAMI-Github/contracts/issues)
-   **Documentation**: [KAMI Docs](https://docs.kami.com)
-   **Discord**: [KAMI Community](https://discord.gg/kami)

---

**Built with ❤️ by the KAMI team**
