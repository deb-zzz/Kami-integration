# KAMI721C - Advanced ERC721 Contract with Extended Features

A comprehensive, modular ERC721 contract system with programmable royalties, rental functionality, platform commissions, and more. Built with a reusable library architecture for easy integration and maintenance.

## 🚀 Extended Features

### Core Capabilities

-   **ERC721/ERC2981 Compliant** - Full NFT standard compliance with royalty support
-   **Generic ERC20 Payment Support** - Accept any ERC20 token with configurable decimals
-   **Platform Commissions** - Automated commission distribution to platform
-   **Programmable Royalties** - Flexible royalty system for both minting and transfers
-   **Rental System** - Time-based token rental with automatic role management
-   **Mandatory Royalty Payments** - Enforce royalty payments before transfers
-   **Access Control** - Role-based permissions for contract management
-   **Pausable Functionality** - Emergency pause/unpause capabilities
-   **Direct Sales** - Built-in marketplace functionality
-   **Upgradeable Architecture** - UUPS proxy support for future upgrades
-   **Proxy Compatible** - Full compatibility with upgradeable contracts

### Advanced Features

-   **Modular Library Design** - Reusable `KamiNFTLibrary` for easy integration
-   **Token-Specific Royalties** - Override global royalties per token
-   **Transfer Validation** - Comprehensive transfer validation with royalty enforcement
-   **Gas Optimizations** - Efficient storage and function design
-   **Comprehensive Events** - Detailed event logging for all operations
-   **Utility Functions** - Rich set of view and utility functions
-   **Storage Slot Management** - Proxy-compatible storage using deterministic slots

## 📋 Prerequisites

-   Node.js 18+ and npm
-   Hardhat development environment
-   Solidity 0.8.24+

## 🛠 Installation

```bash
# Clone the repository
git clone <repository-url>
cd KAMI721-C

# Install dependencies
npm install
```

### Dependencies

The project uses the following key dependencies:

-   **@openzeppelin/contracts**: 4.9.3 - Core OpenZeppelin contracts
-   **@openzeppelin/contracts-upgradeable**: 4.9.3 - Upgradeable contract patterns
-   **@paulstinchcombe/kaminftlibrary**: 0.0.3 - Reusable NFT functionality library

The `KamiNFTLibrary` is a separate npm package that provides modular, reusable functions for NFT contracts including royalty management, rental systems, platform commissions, and transfer validation.

## 🏗 Architecture

### Contract Structure

-   **KAMI721C.sol** - Standard implementation with all features
-   **KAMI721CUpgradeable.sol** - Upgradeable version using UUPS proxy
-   **KamiNFTLibrary.sol** - Reusable library containing all business logic (imported from `@paulstinchcombe/kaminftlibrary`)

### Library Integration

The contracts use the `KamiNFTLibrary` for all business logic with proxy-compatible storage management:

```solidity
import "@paulstinchcombe/kaminftlibrary/contracts/KamiNFTLibrary.sol";

contract KAMI721C is AccessControl, ERC721Enumerable, ERC2981, Pausable {
    using KamiNFTLibrary for *;

    // Only transfer tracker is stored here - all other config managed by library
    KamiNFTLibrary.TransferTracker private _transferTracker;

    // Use library functions (no storage parameters needed)
    function mint() external {
        paymentToken.safeTransferFrom(msg.sender, address(this), mintPrice);
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(msg.sender, tokenId);
        KamiNFTLibrary.distributeMintRoyalties(tokenId, mintPrice, paymentToken);
    }
}
```

### Storage Management

The new library architecture uses deterministic storage slots for proxy compatibility:

-   **Platform Configuration**: Managed internally by library
-   **Royalty Configuration**: Managed internally by library
-   **Rental Data**: Managed internally by library
-   **Transfer Tracker**: Stored in contract (for royalty enforcement)

This eliminates storage layout conflicts and ensures full proxy compatibility.

## 📚 KamiNFTLibrary Documentation

The `KamiNFTLibrary` is a comprehensive, modular library that provides advanced NFT functionality including programmable royalties, rental systems, platform commissions, and transfer validation. It's designed to be easily integrated into any ERC721 contract.

### 🏗 Library Structure

#### Core Data Structures

```solidity
// Royalty recipient information
struct RoyaltyData {
    address receiver;    // Address to receive royalties
    uint96 feeNumerator; // Fee percentage in basis points (e.g., 1000 = 10%)
}

// Rental information
struct Rental {
    address renter;      // Address renting the token
    uint256 startTime;   // Rental start timestamp
    uint256 endTime;     // Rental end timestamp
    uint256 rentalPrice; // Total rental price paid
    bool active;         // Whether rental is currently active
}

// Transfer tracking for royalty enforcement
struct TransferTracker {
    mapping(bytes32 => bool) pendingTransfers;    // Pending transfer status
    mapping(bytes32 => uint256) transferPrices;   // Transfer prices
    mapping(bytes32 => bool) paidTransfers;       // Paid transfer status
    mapping(bytes32 => uint256) actualSalePrices; // Actual sale prices
}
```

### 🔧 Core Functions

#### Platform Management

```solidity
// Initialize platform configuration
function initializePlatform(
    address platformAddress_,
    uint96 platformCommissionPercentage_
) internal

// Update platform commission and address
function updatePlatformCommission(
    uint96 newPlatformCommissionPercentage,
    address newPlatformAddress,
    address accessControl
) internal

// Get platform commission percentage
function platformCommission() internal view returns (uint96)

// Get platform address
function platformAddress() internal view returns (address)
```

#### Royalty Management

```solidity
// Initialize royalty configuration
function initializeRoyaltyConfig() internal

// Set global royalty percentage
function setRoyaltyPercentage(
    uint96 newRoyaltyPercentage,
    address accessControl
) internal

// Set global mint royalties (must sum to 10000 basis points)
function setMintRoyalties(
    RoyaltyData[] calldata royalties,
    address accessControl
) internal

// Set global transfer royalties (must sum to 10000 basis points)
function setTransferRoyalties(
    RoyaltyData[] calldata royalties,
    address accessControl
) internal

// Set token-specific mint royalties
function setTokenMintRoyalties(
    uint256 tokenId,
    RoyaltyData[] calldata royalties,
    address accessControl,
    function(uint256) view returns (bool) exists
) internal

// Set token-specific transfer royalties
function setTokenTransferRoyalties(
    uint256 tokenId,
    RoyaltyData[] calldata royalties,
    address accessControl,
    function(uint256) view returns (bool) exists
) internal

// Get royalty percentage
function royaltyPercentage() internal view returns (uint96)

// Get mint royalty receivers
function getMintRoyaltyReceivers(uint256 tokenId) internal view returns (RoyaltyData[] memory)

// Get transfer royalty receivers
function getTransferRoyaltyReceivers(uint256 tokenId) internal view returns (RoyaltyData[] memory)
```

#### Royalty Distribution

```solidity
// Distribute mint royalties
function distributeMintRoyalties(
    uint256 tokenId,
    uint256 mintPrice,
    IERC20 paymentToken
) internal

// Sell token with royalties and commission
function sellToken(
    IERC20 paymentToken,
    uint256 tokenId,
    address to,
    uint256 salePrice,
    address seller
) internal
```

#### Rental System

```solidity
// Rent a token
function rentToken(
    IERC20 paymentToken,
    uint256 tokenId,
    uint256 duration,
    uint256 rentalPrice,
    address tokenOwner,
    address accessControl,
    bool isERC1155
) internal

// End a rental early
function endRental(
    uint256 tokenId,
    address tokenOwner,
    address accessControl,
    function(address) view returns (bool) hasActiveRentals,
    bool isERC1155
) internal

// Extend a rental period
function extendRental(
    IERC20 paymentToken,
    uint256 tokenId,
    uint256 additionalDuration,
    uint256 additionalPayment,
    address tokenOwner,
    bool isERC1155
) internal

// Check if token is rented
function isRented(uint256 tokenId) internal view returns (bool)

// Get rental information
function getRentalInfo(
    mapping(uint256 => Rental) storage rentals,
    uint256 tokenId,
    function(uint256) view returns (bool) exists
) internal view returns (Rental memory)

// Check if user has active rentals
function hasActiveRentals(
    mapping(uint256 => Rental) storage rentals,
    address user,
    function() view returns (uint256) totalSupply,
    function(uint256) view returns (uint256) tokenByIndex
) internal view returns (bool)

// Get rentals mapping (for external access)
function _getRentals() internal pure returns (mapping(uint256 => Rental) storage)
```

#### Transfer Validation & Sales

```solidity
// Validate transfer with royalty enforcement
function validateTransfer(
    uint256 tokenId,
    address from,
    address to,
    address tokenOwner,
    function(address, address) view returns (bool) isApprovedForAll,
    function(uint256) view returns (address) getApproved
) internal view

// Update rental status on transfer
function updateRentalOnTransfer(
    uint256 tokenId,
    address from,
    address to,
    address accessControl,
    function(address) view returns (bool) hasActiveRentals
) internal

// Validate burn operation
function validateBurn(
    uint256 tokenId,
    address tokenOwner
) internal view
```

#### Transfer Royalty Enforcement

```solidity
// Initiate transfer with royalty requirement
function initiateTransferWithRoyalty(
    uint256 tokenId,
    address to,
    uint256 salePrice,
    address owner
) internal

// Pay transfer royalty
function payTransferRoyalty(
    IERC20 paymentToken,
    uint256 tokenId,
    address to,
    uint256 salePrice,
    address owner,
    address seller
) internal

// Check if transfer royalty is required
function isTransferRoyaltyRequired(
    uint256 tokenId,
    address from,
    address to,
    uint256 salePrice
) internal view returns (bool)
```

## 🚀 Quick Start

### Deployment

```solidity
// Deploy standard contract
const KAMI721C = await ethers.getContractFactory("KAMI721C");
const kami721c = await KAMI721C.deploy(
    paymentTokenAddress,    // ERC20 token for payments
    "KAMI721C",            // Token name
    "KAMI",                // Token symbol
    "https://api.kami.com/token/", // Base URI
    ethers.parseUnits("100", 6),   // Mint price
    platformAddress,       // Platform commission recipient
    500                    // Platform commission (5% = 500 basis points)
);

// Deploy upgradeable contract
const KAMI721CUpgradeable = await ethers.getContractFactory("KAMI721CUpgradeable");
const kami721cUpgradeable = await KAMI721CUpgradeable.deploy();
await kami721cUpgradeable.initialize(
    paymentTokenAddress,
    "KAMI721C",
    "KAMI",
    "https://api.kami.com/token/",
    ethers.parseUnits("100", 6),
    platformAddress,
    500
);
```

### Basic Usage

```solidity
// Mint a token
await kami721c.mint();

// Set royalty receivers (must sum to 10000 basis points)
await kami721c.setTransferRoyalties([
    { receiver: artistAddress, feeNumerator: 8000 },  // 80%
    { receiver: platformAddress, feeNumerator: 2000 } // 20%
]);

// Sell a token
await kami721c.sellToken(buyerAddress, tokenId, salePrice);

// Rent a token
await kami721c.rentToken(tokenId, 7 * 24 * 3600, rentalPrice); // 7 days

// Extend rental
await kami721c.extendRental(tokenId, 3 * 24 * 3600, additionalPayment); // 3 more days

// End rental
await kami721c.endRental(tokenId);
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run specific test files
npm run test:standard
npm run test:upgradeable

# Run with coverage
npm run coverage
```

## 📦 Scripts

```bash
# Compile contracts
npm run compile

# Deploy to local network
npm run deploy:local

# Deploy to testnet
npm run deploy:sepolia
npm run deploy:goerli
npm run deploy:mumbai

# Deploy to mainnet
npm run deploy:mainnet
npm run deploy:polygon

# Lint code
npm run lint
npm run lint:fix
```

## 🔧 Configuration

### Hardhat Configuration

The project includes comprehensive Hardhat configuration for multiple networks:

```typescript
// hardhat.config.ts
export default {
	solidity: {
		version: '0.8.24',
		settings: {
			optimizer: {
				enabled: true,
				runs: 200,
			},
		},
	},
	networks: {
		localhost: {
			/* local development */
		},
		sepolia: {
			/* testnet */
		},
		mainnet: {
			/* mainnet */
		},
	},
};
```

### Environment Variables

Create a `.env` file for deployment:

```env
PRIVATE_KEY=your_private_key
INFURA_API_KEY=your_infura_key
ETHERSCAN_API_KEY=your_etherscan_key
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📞 Support

For questions, issues, or contributions, please open an issue on GitHub or contact the development team.

## 🔄 Migration Guide

If you're migrating from an older version, see [CHANGES.md](CHANGES.md) for detailed migration instructions and breaking changes.

## 📚 Examples

The project includes comprehensive TypeScript examples demonstrating how to interact with the KAMI721C contract. These examples are located in the `examples/` folder and provide step-by-step guidance for common operations.

### 🚀 Available Examples

#### `examples/deploy.ts` - Contract Deployment
Demonstrates how to deploy the KAMI721C contract with proper configuration:

```bash
npx hardhat run examples/deploy.ts
```

**Features demonstrated:**
- Deploy MockERC20 payment token
- Deploy KAMI721C with initial parameters
- Set up royalty configuration (5% global royalty)
- Configure mint royalties (50% creator, 50% collaborator)
- Configure transfer royalties (100% to deployer)
- Verify deployment and role assignments

**Sample output:**
```
🚀 Starting KAMI721C deployment...
📝 Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
🏢 Platform: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
👥 Collaborator: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

💰 Deploying MockERC20 payment token...
✅ Payment token deployed: 0x5FbDB2315678afecb367f032d93F642f64180aa3
🎨 Deploying KAMI721C contract...
✅ KAMI721C deployed: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

📋 Contract Details:
   Name: KAMI NFT Collection
   Symbol: KAMI
   Deployer has owner role: true
   Mint Price: 0.1 tokens

👑 Setting up royalty configuration...
✅ Royalty percentage set to 5%
✅ Mint royalties configured
✅ Transfer royalties configured
```

#### `examples/mint.ts` - NFT Minting
Shows how to mint NFTs with payment token approval and royalty setup:

```bash
npx hardhat run examples/mint.ts
```

**Features demonstrated:**
- Set up payment tokens for minter
- Approve tokens for minting
- Mint NFT and get token ID
- Verify ownership and token URI
- Check royalty distribution and balance changes
- Display mint royalty receivers

**Sample output:**
```
🎨 Starting NFT minting process...
💸 Setting up payment tokens...
✅ Minted 1000.0 tokens to minter
💰 Minter balance: 1000.0 tokens
🎯 Mint price: 0.1 tokens

🎨 Minting NFT...
✅ NFT minted successfully!
🆔 Token ID: 0
👤 Token owner: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

💰 Balance Summary:
   Minter: 999.9 tokens
   Platform: 0.005 tokens
   Creator: 0.0475 tokens

📋 Mint Royalty Receivers:
   1. 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 - 50%
   2. 0x90F79bf6EB2c4f870365E785982E1f101E93b906 - 50%
```

#### `examples/buy.ts` - NFT Buying/Selling
Demonstrates the complete buy/sell process with royalty distribution and rental functionality:

```bash
npx hardhat run examples/buy.ts
```

**Features demonstrated:**
- Mint NFT to seller
- Set up payment tokens for buyer
- Sell NFT with royalty and commission distribution
- Verify ownership transfer
- Test rental functionality (rent and end rental)
- Track balance changes throughout the process

**Sample output:**
```
🛒 Starting NFT buying/selling process...
💰 Sale price: 0.5 tokens

🛒 Selling NFT...
✅ NFT sold successfully!
👤 New owner: 0x90F79bf6EB2c4f870365E785982E1f101E93b906

📊 Sale Breakdown:
   Sale Price: 0.5 tokens
   Royalty (10%): 0.05 tokens
   Platform Commission (5%): 0.025 tokens
   Seller Net: 0.425 tokens

🏠 Testing rental functionality...
⏰ Rental duration: 3600 seconds
💰 Rental price: 0.05 tokens
✅ Token rented successfully!
✅ Rental ended successfully!
```

### 🛠️ Running Examples

#### Prerequisites
```bash
# Install dependencies
npm install

# Compile contracts
npm run compile
```

#### Individual Examples
```bash
# Deploy contract
npx hardhat run examples/deploy.ts

# Mint NFT
npx hardhat run examples/mint.ts

# Buy/Sell NFT
npx hardhat run examples/buy.ts
```

#### Run All Examples
```bash
# Run all examples in sequence
npx hardhat run examples/deploy.ts && \
npx hardhat run examples/mint.ts && \
npx hardhat run examples/buy.ts
```

#### With Different Networks
```bash
# Local network
npx hardhat run examples/deploy.ts --network localhost

# Testnet (if configured)
npx hardhat run examples/deploy.ts --network sepolia
```

### 📋 Example Configuration

Each example demonstrates different aspects of the contract:

#### Contract Parameters
- **Name**: NFT collection name
- **Symbol**: NFT collection symbol  
- **Payment Token**: ERC20 token for payments
- **Platform Address**: Platform fee recipient
- **Mint Price**: Cost to mint one NFT
- **Platform Commission**: Platform fee percentage
- **Base URI**: Metadata base URL

#### Royalty Configuration
- **Royalty Percentage**: Global royalty percentage (basis points)
- **Mint Royalties**: Royalty receivers for minting
- **Transfer Royalties**: Royalty receivers for transfers

#### Rental Configuration
- **Rental Duration**: Time period for rental
- **Rental Price**: Cost to rent NFT
- **Rental Extension**: Extend existing rental

### 🔧 Example Features

#### Payment Token Integration
- Uses MockERC20 for testing
- Demonstrates approval workflow
- Shows balance tracking throughout processes

#### Royalty System
- Configures multiple royalty receivers
- Demonstrates mint vs transfer royalties
- Shows royalty calculation and distribution

#### Rental System
- Rents tokens for specified duration
- Tracks rental information
- Demonstrates rental extension and ending

#### Transfer Validation
- Enforces royalty payments before transfers
- Validates ownership and permissions
- Tracks transfer prices and payments

### 📝 Notes

- Examples use MockERC20 for testing purposes
- All examples are self-contained and can be run independently
- Error handling is included for robust testing
- Detailed logging helps understand the process flow
- Balance tracking shows the financial impact of operations

### 🔗 Related Files

- `examples/README.md` - Detailed examples documentation
- `contracts/KAMI721C.sol` - Main contract implementation
- `contracts/KAMI721CUpgradeable.sol` - Upgradeable version
- `test/` - Comprehensive test suite
- `scripts/` - Deployment scripts
