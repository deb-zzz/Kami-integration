# KAMI1155C - Advanced ERC1155 Contract with Extended Features

A comprehensive, modular ERC1155 contract system with programmable royalties, rental functionality, platform commissions, and more. Built with a reusable library architecture for easy integration and maintenance.

## 🚀 Extended Features

### Core Capabilities

-   **ERC1155/ERC2981 Compliant** - Full NFT standard compliance with royalty support
-   **Generic ERC20 Payment Support** - Accept any ERC20 token with configurable decimals
-   **Platform Commissions** - Automated commission distribution to platform
-   **Programmable Royalties** - Flexible royalty system for both minting and transfers
-   **Rental System** - Time-based token rental with automatic role management
-   **Mandatory Royalty Payments** - Enforce royalty payments before transfers
-   **Access Control** - Role-based permissions for contract management
-   **Pausable Functionality** - Emergency pause/unpause capabilities
-   **Direct Sales** - Built-in marketplace functionality
-   **Upgradeable Architecture** - Transparent proxy support for future upgrades

### Advanced Features

-   **Modular Library Design** - Reusable `KamiNFTLibrary` for easy integration
-   **Token-Specific Royalties** - Override global royalties per token
-   **Transfer Validation** - Comprehensive transfer validation with royalty enforcement
-   **Gas Optimizations** - Efficient storage and function design
-   **Comprehensive Events** - Detailed event logging for all operations
-   **Utility Functions** - Rich set of view and utility functions

## 📋 Prerequisites

-   Node.js 18+ and npm
-   Hardhat development environment
-   Solidity 0.8.24+

## 🛠 Installation

```bash
# Clone the repository
git clone <repository-url>
cd KAMI1155-C

# Install dependencies
npm install
```

### Dependencies

The project uses the following key dependencies:

-   **@openzeppelin/contracts**: 4.9.3 - Core OpenZeppelin contracts
-   **@openzeppelin/contracts-upgradeable**: 4.9.3 - Upgradeable contract patterns
-   **@paulstinchcombe/kaminftlibrary**: Latest - Reusable NFT functionality library

The `KamiNFTLibrary` is a separate npm package that provides modular, reusable functions for NFT contracts including royalty management, rental systems, platform commissions, and transfer validation.

## 🏗 Architecture

### Contract Structure

-   **KAMI1155C.sol** - Standard implementation with all features
-   **KAMI1155CUpgradeable.sol** - Upgradeable version using transparent proxy
-   **KamiNFTLibrary.sol** - Reusable library containing all business logic (imported from `@paulstinchcombe/kaminftlibrary`)

### Library Integration

The contracts use the `KamiNFTLibrary` for all business logic:

```solidity
import "@paulstinchcombe/kaminftlibrary/contracts/KamiNFTLibrary.sol";

contract KAMI1155C is AccessControl, ERC1155, ERC1155Supply, ERC2981, Pausable {
    using KamiNFTLibrary for *;

    // Library storage (only for transfer tracker)
    KamiNFTLibrary.TransferTracker private _transferTracker;

    // Use library functions
    function mint(uint256 amount) external {
        paymentToken.safeTransferFrom(msg.sender, address(this), mintPrice * amount);
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _mint(msg.sender, tokenId, amount, "");
        KamiNFTLibrary.distributeMintRoyalties(tokenId, mintPrice * amount, paymentToken);
    }
}
```

### Library Usage

The `KamiNFTLibrary` provides modular, reusable functions that can be integrated into other contracts:

```solidity
import "@paulstinchcombe/kaminftlibrary/contracts/KamiNFTLibrary.sol";

contract MyCustomNFT {
    using KamiNFTLibrary for *;

    // Library storage (only for transfer tracker)
    KamiNFTLibrary.TransferTracker private _transferTracker;

    // Use library functions
    function mint(uint256 amount) external {
        // ... minting logic
        KamiNFTLibrary.distributeMintRoyalties(tokenId, mintPrice * amount, paymentToken);
    }
}
```

## 📚 KamiNFTLibrary Documentation

The `KamiNFTLibrary` is a comprehensive, modular library that provides advanced NFT functionality including programmable royalties, rental systems, platform commissions, and transfer validation. It's designed to be easily integrated into any ERC1155 contract.

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

// Set global mint royalties
function setMintRoyalties(
    RoyaltyData[] calldata royalties,
    address accessControl
) internal

// Set global transfer royalties
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
```

#### Royalty Distribution

```solidity
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

// Calculate total required payment for transfers
function calculateTransferPayment(
    uint256 salePrice
) internal view returns (uint256 totalRequired)
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
function isRented(uint256 tokenId)
    internal view returns (bool)

// Get rental information
function getRentalInfo(
    mapping(uint256 => Rental) storage rentals,
    uint256 tokenId,
    function(uint256) view returns (bool) exists
) internal view returns (Rental memory)

// Check if user has active rentals (ERC1155)
function hasActiveRentalsERC1155(
    mapping(uint256 => Rental) storage rentals,
    address user,
    function(uint256) view returns (uint256) totalSupply,
    function(uint256) view returns (uint256) tokenByIndex,
    uint256 maxTokenId
) internal view returns (bool)
```

#### Transfer Validation & Sales

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
    address buyer,
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

#### Utility Functions

```solidity
// Get mint royalty receivers for a token
function getMintRoyaltyReceivers(uint256 tokenId)
    internal view returns (RoyaltyData[] memory)

// Get transfer royalty receivers for a token
function getTransferRoyaltyReceivers(uint256 tokenId)
    internal view returns (RoyaltyData[] memory)

// Validate burn operation
function validateBurn(
    uint256 tokenId,
    address tokenOwner
) internal view

// Get platform commission percentage
function platformCommission() internal view returns (uint96)

// Get platform address
function platformAddress() internal view returns (address)

// Get royalty percentage
function royaltyPercentage() internal view returns (uint96)

// Get rentals mapping (for internal use)
function _getRentals() internal view returns (mapping(uint256 => Rental) storage)
```

### 🎯 Key Features

#### **Flexible Royalty System**

-   **Global & Token-Specific**: Set royalties globally or override per token
-   **Multiple Receivers**: Support for multiple royalty recipients with percentage splits
-   **Mint & Transfer Separation**: Different royalty configurations for minting vs transfers
-   **ERC2981 Compliance**: Full compatibility with NFT royalty standards

#### **Advanced Rental System**

-   **Time-Based Rentals**: Configurable rental duration with automatic expiration
-   **Role Management**: Automatic role assignment/revocation for renters
-   **Platform Commissions**: Automatic commission distribution on rentals
-   **Transfer Protection**: Prevents transfers during active rentals
-   **ERC1155 Support**: Native support for ERC1155 rental functionality

#### **Transfer Validation**

-   **Royalty Enforcement**: Two-step transfer process with mandatory royalty payments
-   **Approval Bypass**: Allow transfers to approved addresses without royalty payment
-   **Rental Integration**: Automatic rental status updates on transfers
-   **Flexible Validation**: Configurable validation rules and thresholds

#### **Platform Integration**

-   **Commission Automation**: Automatic platform commission distribution
-   **Configurable Rates**: Adjustable commission percentages
-   **Multi-Token Support**: Works with any ERC20 payment token
-   **Event Logging**: Comprehensive event emission for tracking

### 📊 Events

The library emits comprehensive events for all operations:

```solidity
// Royalty events
event MintRoyaltiesUpdated(RoyaltyData[] royalties);
event TransferRoyaltiesUpdated(RoyaltyData[] royalties);
event TokenMintRoyaltiesUpdated(uint256 indexed tokenId, RoyaltyData[] royalties);
event TokenTransferRoyaltiesUpdated(uint256 indexed tokenId, RoyaltyData[] royalties);
event TransferRoyaltyDistributed(uint256 indexed tokenId, address indexed receiver, uint256 amount);
event RoyaltyPercentageUpdated(uint96 newPercentage);

// Platform events
event PlatformCommissionUpdated(uint96 newPercentage, address newPlatformAddress);
event PlatformCommissionPaid(uint256 indexed tokenId, address indexed platformAddress, uint256 amount);

// Transaction events
event TokenSold(uint256 indexed tokenId, address indexed from, address indexed to, uint256 salePrice);

// Rental events
event TokenRented(uint256 indexed tokenId, address indexed owner, address indexed renter, uint256 startTime, uint256 endTime, uint256 rentalPrice);
event RentalEnded(uint256 indexed tokenId, address indexed owner, address indexed renter);
event RentalExtended(uint256 indexed tokenId, address indexed renter, uint256 newEndTime);

// Transfer royalty events
event TransferRoyaltyRequired(uint256 indexed tokenId, address indexed from, address indexed to, uint256 requiredAmount);
event TransferRoyaltyPaid(uint256 indexed tokenId, address indexed from, address indexed to, uint256 amount);

// Debug events
event DebugMintRoyalties(uint256 indexed tokenId, uint256 amount, uint256 platformAmount, uint256 remainingAmount, uint256 royaltiesLength);
event DebugRoyaltyDistributed(uint256 indexed tokenId, address indexed receiver, uint256 amount);
```

### 🔒 Security Features

#### **Access Control Integration**

-   **Role-Based Permissions**: Integrates with OpenZeppelin's AccessControl
-   **Function-Level Security**: Critical functions require specific roles
-   **Upgradeable Support**: Compatible with both standard and upgradeable contracts

#### **Transfer Protection**

-   **Rental Lock**: Prevents transfers during active rentals
-   **Royalty Enforcement**: Mandatory royalty payments for transfers
-   **Approval System**: Flexible approval mechanisms for trusted addresses

#### **Decimal Handling**

-   **Multi-Token Support**: Works with any ERC20 token regardless of decimals
-   **Accurate Calculations**: Precise royalty and commission calculations
-   **Rounding Protection**: Handles rounding errors gracefully

### 💡 Integration Examples

#### **Basic Integration**

```solidity
contract MyNFT is ERC1155, AccessControl {
    using KamiNFTLibrary for *;

    // Library storage (only for transfer tracker)
    KamiNFTLibrary.TransferTracker private _transferTracker;

    constructor() {
        // Initialize library configurations
        KamiNFTLibrary.initializePlatform(platformAddress, 500);
        KamiNFTLibrary.initializeRoyaltyConfig();
    }

    function mint() external {
        // ... minting logic
        KamiNFTLibrary.distributeMintRoyalties(tokenId, mintPrice, paymentToken);
    }
}
```

#### **Advanced Integration with Transfer Validation**

```solidity
contract AdvancedNFT is ERC1155, AccessControl {
    using KamiNFTLibrary for *;

    // Library storage (only for transfer tracker)
    KamiNFTLibrary.TransferTracker private _transferTracker;

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 tokenId = ids[i];

            // Validate transfer with royalty enforcement
            KamiNFTLibrary.validateTransfer(
                tokenId,
                from,
                to,
                from == address(0) ? address(0) : msg.sender,
                isApprovedForAll,
                _dummyGetApproved
            );

            // Update rental status
            KamiNFTLibrary.updateRentalOnTransfer(tokenId, from, to, address(this), hasActiveRentals);
        }
    }
}
```

### 🧪 Testing

The library includes comprehensive test coverage:

```bash
# Test library functions directly
npx hardhat test test/KamiNFTLibrary.test.ts

# Test integration with main contracts
npx hardhat test test/KAMI1155C.test.ts
npx hardhat test test/KAMI1155CUpgradeable.test.ts
```

### 📈 Gas Optimization

-   **Efficient Storage**: Optimized struct layouts and storage patterns
-   **Batch Operations**: Support for batch processing where applicable
-   **Minimal External Calls**: Reduced external contract interactions
-   **Library Functions**: Internal functions for gas efficiency

### 🔄 Version Compatibility

-   **Solidity 0.8.24+**: Full compatibility with latest Solidity features
-   **OpenZeppelin 4.9.3**: Compatible with current OpenZeppelin contracts
-   **KamiNFTLibrary Latest**: External library dependency for core functionality
-   **Backward Compatible**: Maintains compatibility with existing integrations
-   **Upgradeable Support**: Works with both standard and upgradeable patterns

## 📦 Library Dependency

### KamiNFTLibrary

The project depends on the `@paulstinchcombe/kaminftlibrary` package, which provides:

-   **Modular Design**: Reusable functions for NFT contracts
-   **Royalty Management**: Comprehensive royalty calculation and distribution
-   **Rental System**: Time-based rental functionality with role management
-   **Transfer Validation**: Advanced transfer validation with royalty enforcement
-   **Platform Integration**: Automated platform commission handling
-   **ERC1155 Support**: Native support for ERC1155 contracts

### Installation

The library is automatically installed when you run `npm install`:

```bash
npm install @paulstinchcombe/kaminftlibrary
```

### Usage

Import the library in your contracts:

```solidity
import "@paulstinchcombe/kaminftlibrary/contracts/KamiNFTLibrary.sol";

contract MyNFT {
    using KamiNFTLibrary for *;

    // Use library functions and data structures
}
```

### Library Features

-   **Royalty Calculations**: Automatic royalty distribution for minting and transfers
-   **Rental Management**: Complete rental system with time tracking and role management
-   **Transfer Validation**: Comprehensive transfer validation with royalty enforcement
-   **Platform Commissions**: Automated commission distribution to platform addresses
-   **Event Emission**: Comprehensive event logging for all operations
-   **ERC1155 Support**: Native support for ERC1155 contracts with batch operations

## 🚀 Usage

### Deployment

#### Standard Contract

```bash
# Deploy to local network
npm run deploy:local

# Deploy to testnet
npm run deploy:sepolia
npm run deploy:goerli
npm run deploy:mumbai

# Deploy to mainnet
npm run deploy:mainnet
npm run deploy:polygon
```

#### Upgradeable Contract

```bash
npx hardhat run scripts/deploy_upgradeable.ts --network <network>
```

### Constructor Parameters

```solidity
constructor(
    address paymentToken_,        // ERC20 token address (any token with configurable decimals)
    string memory name_,          // NFT collection name
    string memory symbol_,        // NFT collection symbol
    string memory baseURI_,       // Base URI for metadata
    uint256 mintPrice_,           // Mint price in payment token units
    address platformAddress_,     // Platform address for commissions
    uint96 platformCommissionPercentage_ // Platform commission (basis points)
)
```

### Payment Token Support

The contracts support **any ERC20 token** with configurable decimal places:

-   **USDC**: 6 decimals (1 USDC = 1,000,000 units)
-   **WETH**: 18 decimals (1 WETH = 1,000,000,000,000,000,000 units)
-   **Custom tokens**: Any decimal configuration

The library handles decimal differences automatically, ensuring accurate calculations regardless of the payment token's decimal configuration.

### Key Functions

#### Minting

```solidity
function mint(uint256 amount) external
function mintBatch(uint256[] memory amounts) external
```

-   Mints new tokens (single or batch)
-   Requires payment token approval
-   Distributes mint royalties automatically using KamiNFTLibrary

#### Selling

```solidity
function sellToken(address to, uint256 tokenId, uint256 amount, uint256 salePrice) external
```

-   Sells token with automatic royalty distribution
-   Only token owner can sell
-   Cannot sell rented tokens
-   Uses KamiNFTLibrary for royalty calculations

#### Renting

```solidity
function rentToken(uint256 tokenId, uint256 duration, uint256 rentalPrice) external
function extendRental(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment) external
function endRental(uint256 tokenId) external
```

-   Time-based rental system powered by KamiNFTLibrary
-   Automatic role management
-   Platform commission on rentals
-   ERC1155-specific rental functionality

#### Royalty Management

```solidity
function setMintRoyalties(RoyaltyData[] calldata royalties) external
function setTransferRoyalties(RoyaltyData[] calldata royalties) external
function setTokenMintRoyalties(uint256 tokenId, RoyaltyData[] calldata royalties) external
function setTokenTransferRoyalties(uint256 tokenId, RoyaltyData[] calldata royalties) external
```

-   Global and token-specific royalty configuration
-   Multiple royalty receivers with percentage splits
-   Separate mint and transfer royalty systems
-   All royalty logic handled by KamiNFTLibrary

#### Transfer Validation

```solidity
function initiateTransferWithRoyalty(address to, uint256 tokenId, uint256 salePrice) external
function payTransferRoyalty(address seller, address to, uint256 tokenId, uint256 salePrice) external
```

-   Two-step transfer process with royalty enforcement
-   Prevents transfers without royalty payments
-   Flexible royalty validation using KamiNFTLibrary

## 💡 Usage Examples

### Minting

```solidity
// Mint a single token
await contract.mint(1);

// Mint multiple tokens in batch
await contract.mintBatch([1, 2, 3]); // Mints 1 of token 0, 2 of token 1, 3 of token 2
```

### Transferring

```solidity
// Transfer tokens
await contract.safeTransferFrom(from, to, tokenId, amount, data);

// Batch transfer
await contract.safeBatchTransferFrom(from, to, tokenIds, amounts, data);
```

### Selling

```solidity
// Sell tokens with royalty distribution
await contract.sellToken(buyer, tokenId, amount, salePrice);
```

### Renting

```solidity
// Rent tokens
await contract.rentToken(tokenId, duration, rentalPrice);

// Extend rental
await contract.extendRental(tokenId, additionalDuration, additionalPayment);

// End rental
await contract.endRental(tokenId);
```

### Burning

```solidity
// Burn tokens
await contract.burn(tokenId, amount);

// Batch burn
await contract.burnBatch(tokenIds, amounts);
```

## 👥 Roles

-   **DEFAULT_ADMIN_ROLE**: Contract owner with full permissions
-   **OWNER_ROLE**: Can modify contract settings
-   **PLATFORM_ROLE**: Receives platform commissions
-   **RENTER_ROLE**: Granted to active renters (managed by KamiNFTLibrary)
-   **UPGRADER_ROLE**: Can upgrade upgradeable contracts

## 📊 Events

The contracts emit comprehensive events for all operations, including events from the KamiNFTLibrary:

```solidity
// Contract-specific events
event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 price);
event TokenSold(address indexed from, address indexed to, uint256 indexed tokenId, uint256 price);
event TokenRented(address indexed owner, address indexed renter, uint256 indexed tokenId, uint256 startTime, uint256 endTime, uint256 price);
event RentalEnded(address indexed owner, address indexed renter, uint256 indexed tokenId);
event RentalExtended(address indexed renter, uint256 indexed tokenId, uint256 newEndTime);

// Library events
event MintRoyaltiesUpdated(RoyaltyData[] royalties);
event TransferRoyaltiesUpdated(RoyaltyData[] royalties);
event TokenMintRoyaltiesUpdated(uint256 indexed tokenId, RoyaltyData[] royalties);
event TokenTransferRoyaltiesUpdated(uint256 indexed tokenId, RoyaltyData[] royalties);
event TransferRoyaltyDistributed(uint256 indexed tokenId, address indexed receiver, uint256 amount);
event PlatformCommissionPaid(uint256 indexed tokenId, address indexed platform, uint256 amount);
event TransferRoyaltyPaid(uint256 indexed tokenId, address indexed from, address indexed to, uint256 amount);
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test test/KAMI1155C.test.ts
npx hardhat test test/KAMI1155CUpgradeable.test.ts

# Run with coverage
npx hardhat coverage
```

### Test Coverage

-   **Comprehensive test suite** with full coverage of all functionality (63 tests passing)
-   **KamiNFTLibrary integration tests** - Testing library function integration
-   **Royalty calculation tests** - Verifying accurate royalty distributions
-   **Payment token decimal handling tests** - Testing with different token decimals
-   **Rental system validation** - Complete rental lifecycle testing including extension
-   **Transfer validation scenarios** - Testing transfer restrictions and royalty enforcement
-   **Access control verification** - Role-based permission testing
-   **Mock ERC20 token tests** - Using test USDC token for payment testing
-   **ERC1155-specific tests** - Testing batch operations and ERC1155-specific functionality

### Test Dependencies

The test suite includes:

-   **MockERC20.sol** - Test USDC token for payment testing
-   **KamiNFTLibrary integration** - Testing all library function calls
-   **Comprehensive scenarios** - Edge cases and error conditions
-   **Gas optimization tests** - Ensuring efficient contract operations

## 💡 Use Cases

### NFT Marketplaces

-   Built-in sales functionality with royalty enforcement
-   Platform commission automation
-   Flexible payment token support
-   Batch operations for efficient marketplace operations

### Gaming & Metaverse

-   Rental system for temporary access
-   Token-specific royalty configurations
-   Transfer validation for game mechanics
-   ERC1155 batch operations for game items

### Art & Collectibles

-   Programmable royalties for artists
-   Multiple royalty receiver support
-   Mint and transfer royalty separation
-   Batch minting for collections

### DeFi Integration

-   Any ERC20 token payment support
-   Automated commission distribution
-   Upgradeable architecture for future features
-   Efficient batch operations

## 🔒 Security Features

-   **Access Control**: Role-based permissions
-   **Pausable**: Emergency stop functionality
-   **Transfer Validation**: Royalty enforcement
-   **Rental Protection**: Prevents transfers during active rentals
-   **Decimal Handling**: Accurate calculations for any token decimals
-   **Library Isolation**: Modular design reduces attack surface
-   **ERC1155 Security**: Proper handling of batch operations and ownership

## 🔧 Configuration

### Environment Variables

```bash
# Optional: Override default values
NFT_NAME="My NFT Collection"
NFT_SYMBOL="MNFT"
BASE_URI="https://api.example.com/metadata/"
INITIAL_MINT_PRICE="100"
PLATFORM_ADDRESS="0x..."
PLATFORM_COMMISSION_PERCENTAGE="500"
```

## 📈 Performance

-   **Gas Optimized**: Efficient storage patterns and function design
-   **Batch Operations**: Support for ERC1155 batch operations
-   **Library Functions**: Internal functions for gas efficiency
-   **Minimal External Calls**: Reduced external contract interactions

## 🔄 Migration

For existing contracts migrating to the new library architecture, see `CHANGES.md` for detailed migration instructions.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
