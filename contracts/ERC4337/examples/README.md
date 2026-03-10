# KAMI Sponsored NFT System Examples

This directory contains examples demonstrating how to use the KAMI sponsored NFT system with ERC-4337 account abstraction for gasless transactions on Base blockchain.

## Overview

The KAMI sponsored NFT system enables users to interact with NFT contracts without holding ETH for gas fees. Instead, gas fees are paid using ERC20 tokens (like USDC) through a Paymaster contract that sponsors the transactions.

## Features

-   **Gasless Transactions**: Users can mint, sell, and rent NFTs without ETH
-   **ERC20 Payments**: All operations use USDC or other ERC20 tokens
-   **Account Abstraction**: Smart accounts enable advanced transaction patterns
-   **Spending Limits**: Configurable per-user and global spending limits
-   **Batch Operations**: Multiple operations in a single transaction
-   **Rental System**: Time-based NFT rental functionality
-   **Royalty System**: Programmable royalties for creators

## Quick Start

### 1. Install Dependencies

```bash
npm install ethers viem permissionless
```

### 2. Set Environment Variables

Copy `env.example` to `.env` and fill in your configuration:

```bash
cp env.example .env
```

Required variables:

-   `PRIVATE_KEY`: Your wallet private key
-   `FACTORY_ADDRESS`: Smart Account Factory contract address
-   `PAYMASTER_ADDRESS`: Paymaster contract address
-   `NFT_CONTRACT_ADDRESS`: Sponsored NFT contract address

### 3. Deploy Contracts

Deploy to Base Sepolia testnet:

```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url base-sepolia --broadcast --verify
```

Deploy to Base mainnet:

```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url base --broadcast --verify
```

### 4. Run Examples

```bash
node examples/sponsored-transactions.js
```

## Examples

### Basic NFT Operations

```javascript
import { initializeSponsoredSystem, mintSponsoredNFT } from './sponsored-transactions.js';

// Initialize the system
const { smartAccountClient } = await initializeSponsoredSystem();

// Mint an NFT (gas sponsored)
await mintSponsoredNFT(smartAccountClient);
```

### Advanced Operations

```javascript
import { rentSponsoredNFT, sellSponsoredNFT, batchSponsoredOperations } from './sponsored-transactions.js';

// Rent an NFT for 7 days
await rentSponsoredNFT(smartAccountClient, tokenId, 7 * 24 * 60 * 60, rentalPrice);

// Sell an NFT
await sellSponsoredNFT(smartAccountClient, tokenId, buyerAddress, salePrice);

// Batch multiple operations
const operations = [{ data: mintData }, { data: rentData }];
await batchSponsoredOperations(smartAccountClient, operations);
```

## Contract Architecture

### Smart Account Factory

-   Creates smart accounts for users
-   Enables account abstraction features
-   Integrates with ERC-4337 EntryPoint

### Sponsored NFT Contract

-   ERC721 implementation with ERC20 payments
-   Rental system with time-based access
-   Royalty distribution system
-   Platform commission handling

### Paymaster Contract

-   Sponsors gas fees for approved operations
-   Enforces spending limits per user and globally
-   Integrates with Base Paymaster system
-   Manages ERC20 token payments for gas

## Configuration

### Spending Limits

-   **Global Limit**: Maximum total spending across all users
-   **User Limit**: Maximum spending per user
-   **Operation Limit**: Maximum operations per user
-   **Reset Period**: How often limits reset (daily/weekly/monthly)

### Allowed Operations

The Paymaster can be configured to allow specific functions:

-   `mint()`: Mint new NFTs
-   `mintTo(address)`: Mint to specific address
-   `sellToken(address,uint256,uint256)`: Sell NFTs
-   `rentToken(uint256,uint256,uint256)`: Rent NFTs
-   `endRental(uint256)`: End rentals
-   `extendRental(uint256,uint256,uint256)`: Extend rentals

## Security Considerations

1. **Private Key Management**: Never commit private keys to version control
2. **Spending Limits**: Set appropriate limits to prevent abuse
3. **Contract Verification**: Always verify contracts on BaseScan
4. **Access Control**: Use role-based access control for admin functions
5. **Reentrancy Protection**: All functions are protected against reentrancy

## Troubleshooting

### Common Issues

1. **"Only smart accounts allowed"**

    - Ensure you're using a smart account, not an EOA
    - Check that the smart account is properly initialized

2. **"Contract not allowed"**

    - The NFT contract must be added to the Paymaster's allowed contracts
    - Use the `allowContract` function to add it

3. **"Function not allowed"**

    - The specific function must be allowed in the Paymaster
    - Use the `allowFunction` function to add it

4. **"User limit exceeded"**

    - Check user spending and operation limits
    - Wait for limit reset or increase limits

5. **"Global limit exceeded"**
    - Check global spending limit
    - Increase limit or wait for reset

### Debug Commands

```bash
# Check user limits
node -e "
import { checkUserLimits } from './sponsored-transactions.js';
checkUserLimits(publicClient, userAddress);
"

# Check contract configuration
cast call $PAYMASTER_ADDRESS "allowedContracts(address)" $NFT_CONTRACT_ADDRESS
cast call $PAYMASTER_ADDRESS "userSpending(address)" $USER_ADDRESS
```

## Integration with Existing KAMI Contracts

The sponsored NFT system is designed to work alongside existing KAMI contracts:

-   **KAMI721-C**: Can be integrated with the Paymaster for sponsored minting
-   **KAMI721-AC**: Claimable NFTs can use sponsored transactions
-   **KAMI1155-C**: Multi-token contracts can benefit from gas sponsorship

## Support

For technical support or questions:

-   GitHub Issues: [Create an issue](https://github.com/KAMI-Github/contracts/issues)
-   Documentation: [KAMI Docs](https://docs.kami.com)
-   Discord: [KAMI Community](https://discord.gg/kami)

## License

MIT License - see LICENSE file for details.
