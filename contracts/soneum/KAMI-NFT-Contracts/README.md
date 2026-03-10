# KAMI NFT Contracts

A comprehensive suite of ERC721 and ERC1155 NFT contracts with advanced features including per-token pricing, royalty management, rental systems, and platform commissions.

## 🌟 Features

### Core NFT Standards

-   **ERC721**: Non-fungible tokens with full OpenZeppelin v5 compatibility
-   **ERC1155**: Multi-token standard supporting both fungible and non-fungible tokens
-   **Upgradeable Versions**: UUPS proxy pattern for future contract upgrades
-   **Allowlist/Claim System**: ERC721AC with one-token-per-address claiming functionality

### Advanced Pricing System

-   **Per-Token Pricing**: Each token can have its own individual price
-   **Flexible Minting**: Support for minting to any recipient address
-   **Free Minting**: Optional payment - tokens can be minted without cost
-   **Dynamic Price Updates**: Update token prices after minting
-   **Batch Operations**: Efficient batch minting with individual pricing (ERC721AC only)
-   **ERC20 Payment Integration**: Any ERC20 token can be used for payments

### Supply Management

-   **Contract-Wide Limits (ERC721AC)**: Set maximum total tokens for the entire collection
-   **Contract-Wide Limits (ERC1155)**: Set maximum total tokens across all tokenIds
-   **Per-TokenId Limits (ERC1155)**: Set individual supply limits for specific token types
-   **Unlimited Option**: Set limit to 0 for unlimited supply
-   **Dynamic Updates**: Change supply limits after deployment (OWNER_ROLE only)
-   **Real-Time Tracking**: Query actual minted count vs. set limits
-   **Automatic Enforcement**: All mint/claim operations check limits before execution

### Royalty Management

-   **ERC2981 Compliance**: Standard royalty interface support
-   **Mint Royalties**: Automatic royalty distribution on token creation (distributes entire remaining amount after platform commission)
-   **Transfer Royalties**: Royalty collection on secondary sales (percent of remaining after platform commission)
-   **Token-Specific Royalties**: Individual royalty rates per token
-   **Multi-Receiver Support**: Distribute royalties to multiple recipients
-   **Mint-Time Royalties**: Set royalties during token creation
-   **Global Royalty Percentage**: Set default royalty percentage for all tokens
-   **Extended Royalty Info**: Get complete breakdown of all royalty receivers and amounts

### Rental System

-   **Time-Based Rentals**: Rent tokens for specific durations with start/end timestamps
-   **Role-Based Access**: Automatic renter role assignment during rental
-   **Rental Validation**: Prevent transfers during active rentals
-   **Early Termination**: End rentals before expiration (owner or renter)
-   **Rental Extensions**: Extend rental periods with additional payment
-   **Flexible Renting**: Rent tokens for any recipient address
-   **Rental Info Queries**: Check rental status, duration, and pricing
-   **Active Rental Tracking**: Query if user has any active rentals

### Platform Integration

-   **Commission System**: Automatic platform fee collection (20% by default, configurable)
-   **Multi-Role Access Control**: Granular permission management
-   **Pausable Operations**: Emergency stop functionality
-   **Upgradeable Architecture**: Future-proof contract design with UUPS proxy
-   **Platform Address Updates**: Change platform recipient address (OWNER_ROLE only)

### Transfer & Sale Features

-   **Direct Selling**: Built-in `sellToken()` function with automatic distribution
-   **Transfer Royalty Enforcement**: Two-step process (initiate → pay → transfer)
-   **Marketplace Support**: Seller can be different from function caller
-   **Automatic Distribution**: Platform commission + royalties calculated and distributed automatically
-   **Rental Protection**: Cannot sell or transfer rented tokens

### Token Metadata

-   **Per-Token URIs**: Individual metadata URI for each token
-   **Base URI Fallback**: Base URI + token ID if individual URI not set
-   **Dynamic Updates**: Change token URIs after minting (OWNER_ROLE only)
-   **ERC721 Metadata Standard**: Full compatibility with OpenSea and other marketplaces

### Security Features

-   **Access Control**: Role-based permissions (Owner, Platform, Renter, Upgrader)
-   **Pausable Contracts**: Emergency stop mechanism
-   **Input Validation**: Comprehensive parameter checking with custom errors
-   **Reentrancy Protection**: Safe external calls using SafeERC20
-   **Ownership Verification**: Secure transfer and rental operations
-   **OpenZeppelin v5**: Latest security best practices
-   **Custom Errors**: Gas-efficient error reporting

## 📁 Contract Structure

```
contracts/
├── KAMI721C.sol                    # ERC721 Standard (unlimited minting per address)
├── KAMI721CUpgradeable.sol         # ERC721 Upgradeable (UUPS proxy)
├── KAMI1155C.sol                   # ERC1155 Multi-token (dual supply limits)
├── KAMI1155CUpgradeable.sol        # ERC1155 Upgradeable (UUPS proxy)
├── KAMI721AC.sol                   # ERC721 Claimable (one token per address)
├── KAMI721ACUpgradable.sol         # ERC721AC Upgradeable (UUPS proxy)
└── libraries/
    ├── KamiNFTCore.sol             # Core NFT functionality & data structures
    ├── KamiPlatform.sol            # Platform commission logic
    ├── KamiRental.sol              # Rental system management
    ├── KamiRoyalty.sol             # Royalty distribution & ERC2981
    └── KamiTransfer.sol            # Transfer validation & enforcement
```

### Contract Differences

| Contract | Minting Restrictions | Supply Limits | Primary Use Case |
|----------|---------------------|---------------|------------------|
| **KAMI721C** | None (unlimited per address) | None | General NFT collections |
| **KAMI721AC** | One claim per address | Contract-wide | Allowlist/whitelist systems |
| **KAMI1155C** | None (unlimited) | Contract-wide + Per-tokenId | Gaming assets, bundles |

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy contracts
npm run deploy
```

### Basic Usage

#### 1. Deploy a Contract

```typescript
import { ethers } from 'hardhat';

// Deploy ERC721 contract
const KAMI721C = await ethers.getContractFactory('KAMI721C');
const kami721 = await KAMI721C.deploy(
	paymentTokenAddress, // ERC20 payment token
	'KAMI NFT', // name
	'KAMI', // symbol
	'https://api.kami.com/metadata/', // baseURI
	platformAddress, // platform address
	2000, // platform commission (20%)
	adminAddress // admin address
);
```

#### 2. Mint Tokens

```typescript
// Mint to yourself
await kami721.mint(
	owner.address,
	ethers.parseUnits('100', 6), // 100 USDC
	'https://api.kami.com/metadata/1',
	[] // no mint royalties
);

// Mint to someone else (gifting)
await kami721.mintFor(
	recipient.address,
	ethers.parseUnits('150', 6), // 150 USDC
	'https://api.kami.com/metadata/2',
	[] // no mint royalties
);

// Mint with royalties
const mintRoyalties = [
	{ receiver: creator.address, feeNumerator: 5000 }, // 50%
	{ receiver: platform.address, feeNumerator: 5000 }, // 50%
];
await kami721.mint(owner.address, ethers.parseUnits('200', 6), 'https://api.kami.com/metadata/3', mintRoyalties);
```

#### 3. Sell Tokens

```typescript
// Sell your own token
await kami721.sellToken(buyer.address, tokenId, owner.address);

// Sell on behalf of someone else (marketplace)
await kami721.sellToken(buyer.address, tokenId, tokenOwner.address);
```

#### 4. Rent Tokens

```typescript
// Rent for yourself
await kami721.rentToken(
	tokenId,
	86400, // 1 day in seconds
	ethers.parseUnits('10', 6), // 10 USDC rental fee
	renter.address
);

// Rent for someone else
await kami721.rentToken(tokenId, 86400, ethers.parseUnits('10', 6), beneficiary.address);
```

## 🔧 Advanced Features

### Per-Token Pricing

Each token can have its own unique price, enabling dynamic pricing strategies:

```typescript
// Set individual token price
await kami721.setPrice(tokenId, ethers.parseUnits('500', 6));

// Check token price
const price = await kami721.tokenPrices(tokenId);
console.log(`Token ${tokenId} price: ${ethers.formatUnits(price, 6)} USDC`);
```

### Supply Management

Control token supply with flexible limit systems:

**KAMI721AC - Contract-Wide Limits:**
```typescript
// Deploy with 1000 token limit
const kami721ac = await KAMI721AC.deploy(
    paymentToken,
    'KAMI Collection',
    'KAMI',
    baseURI,
    platformAddress,
    2000,
    adminAddress,
    1000  // Maximum 1000 tokens
);

// Update limit later
await kami721ac.setTotalSupply(2000);

// Check limits
const maxSupply = await kami721ac.maxTotalSupply();  // 2000
const minted = await kami721ac.getTotalMinted();      // 150 (actual count)
```

**KAMI1155C - Dual-Level Limits:**
```typescript
// Contract-wide: 10,000 max across all tokenIds
// Per-tokenId: 1,000 max for tokenId 5
await kami1155c.setTotalSupply(10000);
await kami1155c.setTokenTotalSupply(5, 1000);

// Check limits
const contractMax = await kami1155c.maxTotalSupply();  // 10000
const tokenMax = await kami1155c.totalSupply(5);       // 1000 (limit)
const tokenMinted = await kami1155c.getTotalMinted(5); // 500 (actual)
```

### Royalty Management

Configure and manage royalties for creators and platform:

**Royalty Distribution Logic:**

-   **Mint**: Platform gets 20% commission, remaining 80% split among mint royalty receivers
-   **Sale**: Platform gets 20% commission, 10% royalty on remaining 80% to receivers, seller gets 72%
-   **Rental**: Same as sale (Platform 20%, Royalty 8%, Token owner 72%)

```typescript
// Set global royalty percentage (10%)
await kami721.setRoyaltyPercentage(1000);

// Set token-specific royalties
const transferRoyalties = [
	{ receiver: creator.address, feeNumerator: 5000 }, // 50%
	{ receiver: coCreator.address, feeNumerator: 5000 }, // 50%
];
await kami721.setTransferRoyalties(transferRoyalties);

// Get complete royalty breakdown
const [receivers, amounts] = await kami721.getRoyaltyInfo(tokenId);

// Check ERC2981 royalty info
const [receiver, royaltyAmount] = await kami721.royaltyInfo(tokenId, salePrice);
```

### Rental System

Advanced rental functionality with time-based access:

```typescript
// Check if token is rented
const isRented = await kami721.isRented(tokenId);

// Get rental information
const rentalInfo = await kami721.getRentalInfo(tokenId);
console.log(`Rental start: ${new Date(rentalInfo.startTime * 1000)}`);
console.log(`Rental end: ${new Date(rentalInfo.endTime * 1000)}`);

// End rental early
await kami721.endRental(tokenId);

// Extend rental
await kami721.extendRental(tokenId, additionalTime, additionalPayment);
```

### Platform Commissions

Automatic platform fee collection and distribution:

```typescript
// Set platform commission (20%)
await kami721.setPlatformCommission(2000);

// Update platform address
await kami721.setPlatformAddress(newPlatformAddress);

// Check platform settings
const commission = await kami721.platformCommission();
const platform = await kami721.platformAddress();
```

## 🏗️ Architecture

### Contract Inheritance

```
KAMI721C
├── ERC721
├── ERC2981
├── AccessControl
├── Pausable
└── Libraries (KamiNFTCore, KamiPlatform, KamiRental, KamiRoyalty, KamiTransfer)

KAMI1155C
├── ERC1155Supply
├── ERC2981
├── AccessControl
├── Pausable
└── Libraries (KamiNFTCore, KamiPlatform, KamiRental, KamiRoyalty, KamiTransfer)
```

### Library Functions

#### KamiNFTCore

-   Token existence validation
-   Ownership verification
-   External contract interaction helpers

#### KamiPlatform

-   Commission calculation and distribution
-   Platform fee management
-   Multi-receiver payment splitting

#### KamiRental

-   Rental state management
-   Time-based access control
-   Rental validation and enforcement

#### KamiRoyalty

-   Royalty calculation and distribution
-   ERC2981 compliance
-   Multi-receiver royalty support

#### KamiTransfer

-   Transfer validation
-   Rental state checking
-   Payment processing

## 🔐 Access Control

### Roles

-   **OWNER_ROLE**: Contract administration, pausing, upgrades
-   **PLATFORM_ROLE**: Platform-specific operations
-   **RENTER_ROLE**: Automatic assignment during rentals
-   **UPGRADER_ROLE**: Contract upgrade authorization

### Permission Matrix

| Function  | Owner | Platform | Renter | Public |
| --------- | ----- | -------- | ------ | ------ |
| mint      | ✅    | ✅       | ❌     | ✅     |
| sellToken | ✅    | ✅       | ❌     | ✅     |
| rentToken | ✅    | ✅       | ❌     | ✅     |
| setPrice  | ✅    | ❌       | ❌     | ❌     |
| pause     | ✅    | ❌       | ❌     | ❌     |
| upgrade   | ✅    | ❌       | ❌     | ❌     |

## 📊 Gas Optimization

### Efficient Batch Operations

-   Batch minting reduces gas costs per token (KAMI1155C, KAMI721AC)
-   Batch burning for cleanup operations (KAMI1155C)
-   Optimized storage layout with efficient mappings

### Library Usage

-   Reusable code reduces contract size significantly
-   Shared functionality across all contract types
-   Modular architecture for easy maintenance
-   Separate libraries: Core, Platform, Rental, Royalty, Transfer

### Supply Tracking

-   Efficient `_actualMintedCount` mapping for real-time tracking
-   Contract-wide and per-tokenId limits for flexible control
-   Optimized supply checks using actual minted counts

## 🧪 Testing

### Test Coverage

-   **175+ tests passing**: Comprehensive coverage of all functionality
-   Unit tests for all functions
-   Integration tests for complex workflows
-   Flow tests for royalty and commission distribution
-   Supply limit tests for contract-wide and per-tokenId limits
-   Gas usage analysis
-   Security vulnerability testing
-   Supply management verification for all contracts

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test test/KAMI721C.test.ts

# Run with gas reporting
REPORT_GAS=true npm test
```

## 🚀 Deployment

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Configure your environment variables
PRIVATE_KEY=your_private_key
RPC_URL=your_rpc_url
ETHERSCAN_API_KEY=your_etherscan_key
```

### Deployment Scripts

```bash
# Deploy all contracts
npm run deploy

# Deploy specific contract
npm run deploy:721
npm run deploy:1155
npm run deploy:upgradeable

# Verify contracts on Etherscan
npm run verify
```

## 🔄 Upgrade Process

### UUPS Proxy Pattern

Upgradeable contracts use the UUPS (Universal Upgradeable Proxy Standard) pattern:

```typescript
// Deploy implementation
const KAMI721CUpgradeable = await ethers.getContractFactory('KAMI721CUpgradeable');
const implementation = await KAMI721CUpgradeable.deploy();

// Deploy proxy
const ProxyAdmin = await ethers.getContractFactory('KAMIProxyAdmin');
const proxyAdmin = await ProxyAdmin.deploy(adminAddress);

const TransparentUpgradeableProxy = await ethers.getContractFactory('TransparentUpgradeableProxy');
const proxy = await TransparentUpgradeableProxy.deploy(implementation.address, proxyAdmin.address, initializeData);
```

### Upgrade Process

1. Deploy new implementation
2. Authorize upgrade (UPGRADER_ROLE)
3. Execute upgrade through proxy
4. Verify new functionality

## 📈 Use Cases

### NFT Marketplace

-   Per-token pricing for dynamic markets
-   Commission collection for platform revenue
-   Rental system for temporary access
-   Royalty distribution for creators

### Corporate Gifting

-   Mint tokens for employees
-   Bulk distribution with individual pricing
-   Time-based access control
-   Platform management tools

### Gaming & Metaverse

-   In-game asset trading
-   Rental systems for temporary items
-   Creator royalty distribution
-   Platform fee collection

### Art & Collectibles

-   Artist royalty management
-   Dynamic pricing based on demand
-   Rental for exhibitions
-   Platform commission handling

## 📚 Documentation

### Contract Specifications
-   **[KAMI721AC Specification](docs/KAMI721AC.specification.md)** - Claimable ERC721 with one-token-per-address
-   **[KAMI1155C Specification](docs/KAMI1155C.specification.md)** - Multi-token ERC1155 with dual supply limits
-   **[KAMI721C Specification](docs/KAMI721C.specification.md)** - Standard ERC721 with full feature set

### Guides & References
-   **[API Reference](docs/API_REFERENCE.md)** - Complete function reference
-   **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Step-by-step deployment instructions
-   **[Examples](docs/EXAMPLES.md)** - Code examples and use cases
-   **[Security Audit](docs/SECURITY_AUDIT.md)** - Security considerations
-   **[Upgradeable Architecture](docs/README_UPGRADEABLE.md)** - UUPS proxy pattern guide
-   **[Changelog](docs/CHANGELOG.md)** - Version history and changes
-   **[Migration Guide](docs/CHANGES.md)** - Breaking changes and migration instructions
-   **[Development Notes](docs/development/)** - Technical development documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Development Guidelines

-   Follow Solidity style guide
-   Add comprehensive tests
-   Update documentation
-   Consider gas optimization
-   Security-first approach

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

-   Documentation: [docs.kami.com](https://docs.kami.com)
-   Issues: [GitHub Issues](https://github.com/kami/nft-contracts/issues)
-   Discord: [KAMI Community](https://discord.gg/kami)
-   Email: support@kami.com

## 🔗 Links

-   Website: [kami.com](https://kami.com)
-   Documentation: [docs.kami.com](https://docs.kami.com)
-   GitHub: [github.com/kami/nft-contracts](https://github.com/kami/nft-contracts)
-   OpenSea: [opensea.io/collection/kami](https://opensea.io/collection/kami)

---

**Built with ❤️ by the KAMI team**
