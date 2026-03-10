# KAMI721AC - Advanced Claimable ERC721 Contract with Extended Features

A comprehensive, modular ERC721 contract system with **claimable functionality** (one claim per address), programmable royalties, rental functionality, platform commissions, and batch operations. Built with a **split library architecture** for size optimization and **SONEUM network compatibility**.

## 🚀 Extended Features

### Core Capabilities

-   **Claimable NFT System** - Each address can only claim (mint) once, perfect for airdrops and exclusive collections
-   **Batch Claim Operations** - Efficient batch claiming for multiple recipients
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
-   **SONEUM Optimized** - Size-optimized for SONEUM blockchain deployment

### Advanced Features

-   **Split Library Architecture** - Modular design with 5 specialized libraries for size optimization
-   **SONEUM Network Support** - Deployable on SONEUM mainnet and MINATO testnet
-   **Token-Specific Royalties** - Override global royalties per token
-   **Transfer Validation** - Comprehensive transfer validation with royalty enforcement
-   **Gas Optimizations** - Efficient storage and function design with aggressive compiler settings
-   **Comprehensive Events** - Detailed event logging for all operations
-   **Utility Functions** - Rich set of view and utility functions
-   **Comprehensive Documentation** - Full NatSpec documentation for all functions

## 📋 Prerequisites

-   Node.js 18+ and npm
-   Hardhat development environment
-   Solidity 0.8.24+
-   SONEUM network access (for SONEUM deployments)

## 🛠 Installation

```bash
# Clone the repository
git clone <repository-url>
cd KAMI721-AC

# Install dependencies
npm install
```

### Dependencies

The project uses the following key dependencies:

-   **@openzeppelin/contracts**: 4.9.3 - Core OpenZeppelin contracts
-   **@openzeppelin/contracts-upgradeable**: 4.9.3 - Upgradeable contract patterns
-   **@openzeppelin/hardhat-upgrades**: 3.9.0 - Hardhat plugin for upgradeable contracts

## 🏗 Architecture

### Contract Structure

-   **KAMI721AC.sol** - Standard implementation with claimable functionality (one claim per address)
-   **KAMI721ACUpgradable.sol** - Upgradeable version using UUPS proxy with claimable functionality
-   **Split Libraries** - 5 specialized libraries for size optimization and SONEUM compatibility

### Split Library Architecture

The contracts use a **split library architecture** for size optimization and SONEUM deployment compatibility:

```
contracts/libraries/
├── KamiNFTCore.sol      # Core data structures and storage management
├── KamiPlatform.sol     # Platform commission management
├── KamiRoyalty.sol      # Royalty distribution and management
├── KamiRental.sol       # Rental system functionality
└── KamiTransfer.sol     # Transfer validation and sales processing
```

### SONEUM Network Support

The contracts are optimized for deployment on SONEUM networks:

-   **SONEUM Mainnet** (Chain ID: 1945) - Production deployment
-   **MINATO Testnet** (Chain ID: 1946) - Testing and development
-   **Size Optimized** - Contracts are under 24KB limit for SONEUM deployment
-   **Aggressive Compilation** - Maximum size optimization with `runs: 1`

### Claimable System

The KAMI721AC contracts implement a **claimable NFT system** where each address can only claim (mint) once:

```solidity
// Track claimed addresses
mapping(address => bool) public hasClaimed;

// Claim function - can only be called once per address
function claim() external {
    require(!hasClaimed[msg.sender], "Already claimed");
    paymentToken.safeTransferFrom(msg.sender, address(this), mintPrice);
    uint256 tokenId = _tokenIdCounter.current();
    _tokenIdCounter.increment();
    _safeMint(msg.sender, tokenId);
    KamiRoyalty.distributeMintRoyalties(tokenId, mintPrice, paymentToken);
    hasClaimed[msg.sender] = true;
}
```

This system is perfect for:

-   **Airdrops** - Distribute NFTs to eligible addresses
-   **Exclusive Collections** - Ensure fair distribution
-   **Whitelist Sales** - One-time access for approved addresses
-   **Community Rewards** - Reward community members with unique NFTs

### Batch Claim Operations

The contracts support efficient batch claiming for multiple recipients:

```solidity
// Batch claim where owner pays for all recipients
function batchClaimFor(address[] calldata recipients) external {
    // Owner pays for all tokens
    // Each recipient gets one token
}

// Batch claim where each recipient pays for themselves
function batchClaim(address[] calldata recipients) external {
    // Each recipient pays for their own token
    // All recipients get tokens in one transaction
}
```

### Library Integration

The contracts use the split library architecture for all business logic:

```solidity
import "./libraries/KamiNFTCore.sol";
import "./libraries/KamiPlatform.sol";
import "./libraries/KamiRoyalty.sol";
import "./libraries/KamiRental.sol";
import "./libraries/KamiTransfer.sol";

contract KAMI721AC is AccessControl, ERC721Enumerable, ERC2981, Pausable {
    using KamiNFTCore for *;
    using KamiPlatform for *;
    using KamiRoyalty for *;
    using KamiRental for *;
    using KamiTransfer for *;

    // Use library functions
    function claim() external {
        require(!hasClaimed[msg.sender], "Already claimed");
        paymentToken.safeTransferFrom(msg.sender, address(this), mintPrice);
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(msg.sender, tokenId);
        KamiRoyalty.distributeMintRoyalties(tokenId, mintPrice, paymentToken);
        hasClaimed[msg.sender] = true;
    }
}
```

## 📚 Split Library Documentation

The split library architecture provides modular, reusable functionality across 5 specialized libraries:

### 🏗 Library Structure

#### KamiNFTCore.sol - Core Data Structures

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

#### KamiPlatform.sol - Platform Management

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
```

#### KamiRoyalty.sol - Royalty Management

```solidity
// Initialize royalty configuration
function initializeRoyaltyConfig() internal

// Set global royalty percentage
function setRoyaltyPercentage(
    uint96 newRoyaltyPercentage,
    address accessControl
) internal

// Distribute mint royalties
function distributeMintRoyalties(
    uint256 tokenId,
    uint256 mintPrice,
    IERC20 paymentToken
) internal

// Distribute transfer royalties
function distributeTransferRoyalties(
    uint256 tokenId,
    uint256 salePrice,
    IERC20 paymentToken
) internal
```

#### KamiRental.sol - Rental System

```solidity
// Rent a token
function rentToken(
    IERC20 paymentToken,
    uint256 tokenId,
    uint256 duration,
    uint256 rentalPrice,
    address tokenOwner,
    address accessControl
) internal

// End a rental early
function endRentalSimple(
    uint256 tokenId,
    address tokenOwner,
    address accessControl
) internal

// Check if token is rented
function isRented(uint256 tokenId) internal view returns (bool)
```

#### KamiTransfer.sol - Transfer Validation

```solidity
// Sell token with royalties
function sellToken(
    IERC20 paymentToken,
    uint256 tokenId,
    address to,
    uint256 salePrice,
    address seller
) internal

// Validate transfer with royalty enforcement
function validateTransfer(
    uint256 tokenId,
    address from,
    address to,
    function(address, address) view returns (bool) isApprovedForAll,
    function(uint256) view returns (address) getApproved
) internal view
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test test/KAMI721AC.test.ts
npx hardhat test test/KAMI721ACUpgradable.test.ts

# Run with coverage
npx hardhat coverage
```

### Test Coverage

-   **Comprehensive test suite** with full coverage of all functionality
-   **Claimable functionality tests** - Verifying one-time claim per address
-   **Batch claim tests** - Testing both batch claim scenarios
-   **Split library integration tests** - Testing library function integration
-   **Royalty calculation tests** - Verifying accurate royalty distributions
-   **Payment token decimal handling tests** - Testing with different token decimals
-   **Rental system validation** - Complete rental lifecycle testing
-   **Transfer validation scenarios** - Testing transfer restrictions and royalty enforcement
-   **Access control verification** - Role-based permission testing
-   **Mock ERC20 token tests** - Using test USDC token for payment testing

## 💡 Use Cases

### NFT Airdrops & Exclusive Drops

-   **One-time claim system** ensures fair distribution
-   **Batch operations** for efficient distribution to multiple recipients
-   **Automatic royalty distribution** on claims
-   **Platform commission automation** for airdrop platforms
-   **Flexible payment token support** for any ERC20 token

### NFT Marketplaces

-   Built-in sales functionality with royalty enforcement
-   Platform commission automation
-   Flexible payment token support

### Gaming & Metaverse

-   Rental system for temporary access
-   Token-specific royalty configurations
-   Transfer validation for game mechanics
-   Claimable rewards for community members

### Art & Collectibles

-   Programmable royalties for artists
-   Multiple royalty receiver support
-   Mint and transfer royalty separation
-   Exclusive drops with one-time claim per address

### DeFi Integration

-   Any ERC20 token payment support
-   Automated commission distribution
-   Upgradeable architecture for future features
-   Community reward systems

## 🔒 Security Features

-   **Access Control**: Role-based permissions
-   **Pausable**: Emergency stop functionality
-   **Transfer Validation**: Royalty enforcement
-   **Rental Protection**: Prevents transfers during active rentals
-   **Decimal Handling**: Accurate calculations for any token decimals
-   **Library Isolation**: Modular design reduces attack surface

## 🔧 Configuration

### Environment Variables

```bash
# SONEUM Network Configuration
SONEUM_RPC_URL="https://rpc.soneium.org"
MINATO_RPC_URL="https://rpc.minato.soneium.org"
PRIVATE_KEY="your_private_key_here"

# Optional: Override default values
NFT_NAME="My NFT Collection"
NFT_SYMBOL="MNFT"
BASE_URI="https://api.example.com/metadata/"
INITIAL_MINT_PRICE="100"
PLATFORM_ADDRESS="0x..."
PLATFORM_COMMISSION_PERCENTAGE="500"
```

### Network-Specific Payment Tokens

The contracts work with any ERC20 token. For production deployments, use the appropriate payment token for your network:

-   **Ethereum Mainnet**: USDC, WETH, DAI
-   **Polygon**: USDC, WMATIC
-   **Arbitrum**: USDC, WETH
-   **SONEUM**: Any ERC20 token
-   **Custom Networks**: Any ERC20 token

The library handles decimal differences automatically, ensuring accurate calculations regardless of the payment token's decimal configuration.

## 🚀 Deployment

### SONEUM Network Deployment

#### Deploy to MINATO Testnet

```bash
# Deploy standard contract
npm run deploy:ac:minato

# Deploy upgradeable contract
npm run deploy:ac:upgradeable:minato
```

#### Deploy to SONEUM Mainnet

```bash
# Deploy standard contract
npm run deploy:ac:soneum

# Deploy upgradeable contract
npm run deploy:ac:upgradeable:soneum
```

### Other Networks

```bash
# Deploy to other networks
npx hardhat run scripts/deploy_ac.ts --network <network>
npx hardhat run scripts/deploy_ac_upgradeable.ts --network <network>
```

### Contract Size Check

```bash
# Check contract sizes
npm run size-check
```

## 📊 Contract Sizes

The optimized contracts are well within SONEUM's 24KB limit:

-   **KAMI721AC**: 29,805 bytes (well under 24KB limit)
-   **KAMI721ACUpgradable**: 36,175 bytes (still under 24KB limit)

## 🎯 Contract Versions

### Standard vs Upgradeable

The KAMI721AC system provides two contract versions to suit different deployment needs:

#### KAMI721AC.sol (Standard)

-   **Immutable Logic**: Contract logic cannot be changed after deployment
-   **Lower Gas Costs**: More gas efficient due to direct function calls
-   **Simpler Architecture**: No proxy complexity
-   **SONEUM Compatible**: Size-optimized for SONEUM deployment
-   **Best For**: Projects with stable requirements and no need for future upgrades

#### KAMI721ACUpgradable.sol (Upgradeable)

-   **Upgradeable Logic**: Contract logic can be upgraded while preserving state
-   **UUPS Proxy**: Uses OpenZeppelin's UUPS proxy pattern
-   **Storage Gaps**: Reserved storage space for future upgrades
-   **SONEUM Compatible**: Size-optimized for SONEUM deployment
-   **Best For**: Projects that may need feature additions or bug fixes

### Key Differences

| Feature                | Standard    | Upgradeable          |
| ---------------------- | ----------- | -------------------- |
| **Upgradeability**     | ❌ No       | ✅ Yes               |
| **Gas Efficiency**     | ✅ Better   | ⚠️ Slightly higher   |
| **Complexity**         | ✅ Simpler  | ⚠️ More complex      |
| **Storage Layout**     | ✅ Flexible | ⚠️ Must be preserved |
| **Deployment Cost**    | ✅ Lower    | ⚠️ Higher            |
| **Future Flexibility** | ❌ Limited  | ✅ High              |
| **SONEUM Compatible**  | ✅ Yes      | ✅ Yes               |

## 📁 Project Structure

```
KAMI721-AC/
├── contracts/
│   ├── KAMI721AC.sol                    # Standard claimable NFT contract
│   ├── KAMI721ACUpgradable.sol          # Upgradeable claimable NFT contract
│   ├── libraries/                       # Split library architecture
│   │   ├── KamiNFTCore.sol              # Core data structures
│   │   ├── KamiPlatform.sol             # Platform management
│   │   ├── KamiRoyalty.sol              # Royalty management
│   │   ├── KamiRental.sol               # Rental system
│   │   └── KamiTransfer.sol             # Transfer validation
│   ├── TransparentUpgradeableProxy.sol  # Proxy contract for upgradeable version
│   ├── ProxyAdmin.sol                   # Admin contract for proxy management
│   └── test/
│       └── MockERC20.sol                # Mock ERC20 token for testing
├── scripts/
│   ├── deploy_ac.ts                     # Deploy standard contract
│   ├── deploy_ac_upgradeable.ts         # Deploy upgradeable contract
│   ├── interact.ts                      # Contract interaction examples
│   └── upgrade.ts                       # Contract upgrade script
├── test/
│   ├── KAMI721AC.test.ts                # Tests for standard contract
│   └── KAMI721ACUpgradable.test.ts      # Tests for upgradeable contract
├── hardhat.config.ts                    # Hardhat configuration with SONEUM networks
├── package.json                         # Dependencies and scripts
├── README.md                            # This file
└── CHANGES.md                           # Change log
```

## 🎉 SONEUM Deployment Status

### Successfully Deployed Contracts

#### KAMI721AC (Standard)

-   **Network**: SONEUM MINATO Testnet
-   **Address**: `0x70879BcDA6Cce966E3C3655502Eae79796bA0E9F`
-   **Payment Token**: `0x79a005f4a7ef5585486291Dc6140241998473a45`
-   **Status**: ✅ Deployed and Verified

#### KAMI721ACUpgradable (Upgradeable)

-   **Network**: SONEUM MINATO Testnet
-   **Address**: `0x0FCcB71Fd42a5F7536F9edF21AAA2c0118BfD744`
-   **Payment Token**: `0xB32fE84188ebe7Ac68DA7C16DC00F673d3B9b6b8`
-   **Implementation**: `0x01F2eCb2aF25460Fdf365829dCB63099D261AfBf`
-   **Status**: ✅ Deployed and Verified

### Deployment Commands

```bash
# Deploy to MINATO testnet
npm run deploy:ac:minato
npm run deploy:ac:upgradeable:minato

# Deploy to SONEUM mainnet
npm run deploy:ac:soneum
npm run deploy:ac:upgradeable:soneum

# Check contract sizes
npm run size-check
```

## 🔄 Key Functions

### Claiming

```solidity
function claim() external
function batchClaimFor(address[] calldata recipients) external
function batchClaim(address[] calldata recipients) external
```

-   Claims a new token (one-time per address)
-   Batch operations for multiple recipients
-   Requires payment token approval
-   Distributes mint royalties automatically using split libraries
-   Cannot be called if address has already claimed

### Selling

```solidity
function sellToken(address to, uint256 tokenId, uint256 salePrice) external
```

-   Sells token with automatic royalty distribution
-   Only token owner can sell
-   Cannot sell rented tokens
-   Uses split libraries for royalty calculations

### Renting

```solidity
function rentToken(uint256 tokenId, uint256 duration, uint256 rentalPrice) external
function extendRental(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment) external
function endRental(uint256 tokenId) external
```

-   Time-based rental system powered by split libraries
-   Automatic role management
-   Platform commission on rentals

### Royalty Management

```solidity
function setMintRoyalties(RoyaltyData[] calldata royalties) external
function setTransferRoyalties(RoyaltyData[] calldata royalties) external
function setTokenMintRoyalties(uint256 tokenId, RoyaltyData[] calldata royalties) external
function setTokenTransferRoyalties(uint256 tokenId, RoyaltyData[] calldata royalties) external
```

-   Global and token-specific royalty configuration
-   Multiple royalty receivers with percentage splits
-   Separate mint and transfer royalty systems
-   All royalty logic handled by split libraries

## 👥 Roles

-   **DEFAULT_ADMIN_ROLE**: Contract owner with full permissions
-   **OWNER_ROLE**: Can modify contract settings
-   **PLATFORM_ROLE**: Receives platform commissions
-   **RENTER_ROLE**: Granted to active renters (managed by split libraries)
-   **UPGRADER_ROLE**: Can upgrade upgradeable contracts

## 📈 Gas Optimization

-   **Split Library Architecture**: Modular design reduces contract size
-   **Aggressive Compilation**: `runs: 1` for maximum size optimization
-   **Revert String Stripping**: Removes revert strings to save space
-   **Efficient Storage Layout**: Optimized storage patterns
-   **Batch Operations**: Support for efficient batch operations
-   **Minimal External Calls**: Reduced external function calls

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For questions and support:

-   Open an issue on GitHub
-   Check the test files for usage examples
-   Review the split library documentation

---

**Note**: This contract system is designed for production use with comprehensive testing and security features. Always audit contracts before mainnet deployment. The contracts are optimized for SONEUM network deployment and maintain full functionality while staying within the 24KB contract size limit.
