# KamiNFTLibrary

A comprehensive Solidity library providing advanced features for ERC721 and ERC1155 contracts, including programmable royalties, ERC20 payment integration, platform commission system, time-based rental system, and mandatory royalty enforcement.

## Features

### 🎯 Core Features

-   **Programmable Royalties**: Multiple receivers with configurable percentages (up to 30%)
-   **ERC20 Payment Integration**: Native support for ERC20 tokens as payment
-   **Platform Commission System**: Built-in platform fee collection (up to 20%)
-   **Time-based Rental System**: NFT rental functionality with automatic expiration
-   **Mandatory Royalty Enforcement**: Ensures royalties are paid before transfers
-   **Role-based Access Control**: Secure permission management
-   **Storage Slot Pattern**: Proxy-compatible storage using dedicated slots

### 🔧 Advanced Capabilities

-   **Token-specific Royalties**: Set different royalty structures per token
-   **Dual Royalty Types**: Separate mint and transfer royalty configurations
-   **Rental Management**: Extend, end, and track rental periods
-   **Transfer Validation**: Comprehensive transfer validation with royalty checks
-   **Event Tracking**: Extensive event emission for transparency
-   **Rounding & Dust Handling**: Robust handling of rounding errors and dust in royalty splits
-   **ERC721/ERC1155 Support**: Compatible with both token standards
-   **Gas Optimization**: Efficient functions with optimized gas usage

## Installation

```bash
npm install @paulstinchcombe/kaminftlibrary
```

## Quick Start Example

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@paulstinchcombe/kaminftlibrary/contracts/KamiNFTLibrary.sol";

contract MyNFT is ERC721Enumerable, AccessControl {
    using KamiNFTLibrary for *;
    using SafeERC20 for IERC20;

    IERC20 public paymentToken;
    address public contractOwner;

    constructor(address _paymentToken) ERC721("MyNFT", "MNFT") {
        paymentToken = IERC20(_paymentToken);
        contractOwner = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KamiNFTLibrary.OWNER_ROLE, msg.sender);

        // Initialize library configurations
        KamiNFTLibrary.initializeRoyaltyConfig();
    }

    // Platform and royalty config initialization
    function initializePlatform(address platform, uint96 commission) external onlyRole(DEFAULT_ADMIN_ROLE) {
        KamiNFTLibrary.initializePlatform(platform, commission);
    }

    function setRoyaltyPercentage(uint96 pct) external onlyRole(DEFAULT_ADMIN_ROLE) {
        KamiNFTLibrary.setRoyaltyPercentage(pct, address(this));
    }

    function setMintRoyalties(KamiNFTLibrary.RoyaltyData[] calldata royalties) external onlyRole(DEFAULT_ADMIN_ROLE) {
        KamiNFTLibrary.setMintRoyalties(royalties, address(this));
    }

    function setTransferRoyalties(KamiNFTLibrary.RoyaltyData[] calldata royalties) external onlyRole(DEFAULT_ADMIN_ROLE) {
        KamiNFTLibrary.setTransferRoyalties(royalties, address(this));
    }

    // Payment distribution
    function distributeMintRoyalties(uint256 tokenId, uint256 mintPrice) external {
        paymentToken.safeTransferFrom(msg.sender, address(this), mintPrice);
        KamiNFTLibrary.distributeMintRoyalties(tokenId, mintPrice, paymentToken);
    }

    function distributeTransferRoyalties(uint256 tokenId, uint256 salePrice) external returns (uint256) {
        paymentToken.safeTransferFrom(msg.sender, address(this), salePrice);
        return KamiNFTLibrary.distributeTransferRoyalties(tokenId, salePrice, paymentToken);
    }

    // Rental system
    function rentToken(uint256 tokenId, uint256 duration, uint256 rentalPrice) external {
        KamiNFTLibrary.rentToken(paymentToken, tokenId, duration, rentalPrice, ownerOf(tokenId), address(this), false);
    }

    function endRental(uint256 tokenId) external {
        KamiNFTLibrary.endRentalSimple(tokenId, ownerOf(tokenId), false);
    }

    function extendRental(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment) external {
        KamiNFTLibrary.extendRental(paymentToken, tokenId, additionalDuration, additionalPayment, ownerOf(tokenId), false);
    }

    function isRented(uint256 tokenId) external view returns (bool) {
        return KamiNFTLibrary.isRented(tokenId);
    }

    // Utility
    function owner() external view returns (address) {
        return contractOwner;
    }
}
```

## API Reference

### Configuration Functions

#### Platform Configuration

```solidity
function initializePlatform(address platformAddress_, uint96 platformCommissionPercentage_) internal
```

Initialize platform configuration with commission percentage and address.

#### Royalty Configuration

```solidity
function initializeRoyaltyConfig() internal
function setRoyaltyPercentage(uint96 newRoyaltyPercentage, address accessControl) internal
function setMintRoyalties(RoyaltyData[] calldata royalties, address accessControl) internal
function setTransferRoyalties(RoyaltyData[] calldata royalties, address accessControl) internal
function setTokenMintRoyalties(uint256 tokenId, RoyaltyData[] calldata royalties, address accessControl, function(uint256) view returns (bool) exists) internal
function setTokenTransferRoyalties(uint256 tokenId, RoyaltyData[] calldata royalties, address accessControl, function(uint256) view returns (bool) exists) internal
```

### Distribution Functions

#### Mint Royalties

```solidity
function distributeMintRoyalties(uint256 tokenId, uint256 amount, IERC20 paymentToken) internal
```

Distribute royalties and platform commission during minting.

#### Transfer Royalties

```solidity
function distributeTransferRoyalties(uint256 tokenId, uint256 salePrice, IERC20 paymentToken) internal returns (uint256 totalDistributed)
```

Distribute royalties and platform commission during transfers.

### Rental Functions

#### Core Rental Operations

```solidity
function rentToken(IERC20 paymentToken, uint256 tokenId, uint256 duration, uint256 rentalPrice, address tokenOwner, address accessControl, bool isERC1155) internal
function endRentalSimple(uint256 tokenId, address tokenOwner, bool isERC1155) internal
function extendRental(IERC20 paymentToken, uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment, address tokenOwner, bool isERC1155) internal
```

#### Rental Queries

```solidity
function isRented(uint256 tokenId) internal view returns (bool)
function getRentalInfo(mapping(uint256 => Rental) storage rentals, uint256 tokenId, function(uint256) view returns (bool) exists) internal view returns (Rental memory)
```

### Transfer Functions

#### Sale and Transfer

```solidity
function sellToken(IERC20 paymentToken, uint256 tokenId, address to, uint256 salePrice, address seller) internal
function validateTransfer(uint256 tokenId, address from, address to, address tokenOwner, function(address, address) view returns (bool) isApprovedForAll, function(uint256) view returns (address) getApproved) internal view
function updateRentalOnTransferSimple(uint256 tokenId, address from, address to) internal
```

#### Royalty Payment

```solidity
function initiateTransferWithRoyalty(uint256 tokenId, address to, uint256 salePrice, address owner) internal
function payTransferRoyalty(IERC20 paymentToken, uint256 tokenId, address to, uint256 salePrice, address buyer, address seller) internal
function calculateTransferPayment(uint256 salePrice) internal view returns (uint256 totalRequired)
function isTransferRoyaltyRequired(uint256 tokenId, address from, address to, uint256 salePrice) internal view returns (bool)
```

### Getter Functions

```solidity
function platformAddress() internal view returns (address)
function platformCommission() internal view returns (uint96)
function royaltyPercentage() internal view returns (uint96)
function getMintRoyaltyReceivers(uint256 tokenId) internal view returns (RoyaltyData[] memory)
function getTransferRoyaltyReceivers(uint256 tokenId) internal view returns (RoyaltyData[] memory)
```

### Data Structures

```solidity
struct RoyaltyData {
    address receiver;      // The address that will receive the royalty payment
    uint96 feeNumerator;   // The royalty percentage in basis points (e.g., 1000 = 10%)
}

struct Rental {
    address renter;        // The address currently renting the token
    uint256 startTime;     // The timestamp when the rental started
    uint256 endTime;       // The timestamp when the rental will end
    uint256 rentalPrice;   // The total price paid for the rental
    bool active;           // Whether the rental is currently active
}

struct PlatformConfig {
    uint96 commissionPercentage; // The platform commission percentage in basis points
    address platformAddress;     // The address that receives platform commission payments
}

struct RoyaltyConfig {
    uint96 royaltyPercentage;           // The global royalty percentage in basis points
    RoyaltyData[] mintRoyaltyReceivers; // Array of royalty receivers for mint operations
    RoyaltyData[] transferRoyaltyReceivers; // Array of royalty receivers for transfer operations
    mapping(uint256 => RoyaltyData[]) tokenMintRoyalties;     // Token-specific mint royalties
    mapping(uint256 => RoyaltyData[]) tokenTransferRoyalties; // Token-specific transfer royalties
}
```

## Usage Examples

### Setting Up Royalties

```solidity
// Initialize with 10% global royalty and 5% platform commission
KamiNFTLibrary.initializeRoyaltyConfig();
KamiNFTLibrary.initializePlatform(platformAddress, 500); // 5%

// Set mint royalties: 70% to artist, 30% to platform
KamiNFTLibrary.RoyaltyData[] memory mintRoyalties = new KamiNFTLibrary.RoyaltyData[](2);
mintRoyalties[0] = KamiNFTLibrary.RoyaltyData(artistAddress, 7000); // 70%
mintRoyalties[1] = KamiNFTLibrary.RoyaltyData(platformAddress, 3000); // 30%
KamiNFTLibrary.setMintRoyalties(mintRoyalties, address(this));

// Set transfer royalties: 60% to artist, 40% to creator
KamiNFTLibrary.RoyaltyData[] memory transferRoyalties = new KamiNFTLibrary.RoyaltyData[](2);
transferRoyalties[0] = KamiNFTLibrary.RoyaltyData(artistAddress, 6000); // 60%
transferRoyalties[1] = KamiNFTLibrary.RoyaltyData(creatorAddress, 4000); // 40%
KamiNFTLibrary.setTransferRoyalties(transferRoyalties, address(this));
```

### Minting with Royalties

```solidity
function mintWithRoyalties(uint256 tokenId, uint256 mintPrice) external {
    // Transfer payment from minter to contract
    paymentToken.safeTransferFrom(msg.sender, address(this), mintPrice);

    // Distribute royalties and platform commission
    KamiNFTLibrary.distributeMintRoyalties(tokenId, mintPrice, paymentToken);

    // Mint the token
    _mint(msg.sender, tokenId);
}
```

### Renting Tokens

```solidity
function rentToken(uint256 tokenId, uint256 duration, uint256 rentalPrice) external {
    // Rent token for specified duration
    KamiNFTLibrary.rentToken(
        paymentToken,
        tokenId,
        duration,
        rentalPrice,
        ownerOf(tokenId),
        address(this),
        false // isERC1155
    );
}

function endRental(uint256 tokenId) external {
    // End rental early (only owner or renter can call)
    KamiNFTLibrary.endRentalSimple(tokenId, ownerOf(tokenId), false);
}
```

### Selling with Royalties

```solidity
function sellToken(uint256 tokenId, address buyer, uint256 salePrice) external {
    // Sell token with automatic royalty distribution
    KamiNFTLibrary.sellToken(
        paymentToken,
        tokenId,
        buyer,
        salePrice,
        msg.sender // seller
    );

    // Transfer token to buyer
    _transfer(msg.sender, buyer, tokenId);
}
```

## Testing

The project includes a comprehensive test suite covering all functionality:

### Test Coverage

-   ✅ **20/20 tests passing**
-   Platform configuration and validation
-   Royalty management and distribution
-   Mint and transfer royalty calculations
-   Rental system functionality
-   Edge cases and rounding handling
-   Buyer-as-royalty-receiver scenarios

### Gas Optimization Results

-   `distributeMintRoyalties`: ~104k gas
-   `distributeTransferRoyalties`: ~125k gas
-   `rentToken`: ~213k gas
-   `sellToken`: ~182k gas

### Running Tests

```bash
# Run all tests
npx hardhat test

# Run with gas reporting
npx hardhat test --gas

# Run specific test file
npx hardhat test test/KamiNFTLibrary.test.ts
```

## Deployment

### Prerequisites

-   Node.js >= 16.0.0
-   npm >= 8.0.0
-   Hardhat
-   OpenZeppelin Contracts v5

### Setup

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to network (example)
npx hardhat run scripts/deploy.js --network mainnet
```

### Environment Configuration

```bash
# .env file
PRIVATE_KEY=your_private_key
INFURA_URL=your_infura_url
ETHERSCAN_API_KEY=your_etherscan_key
```

## Security Considerations

### Access Control

-   All critical functions are protected by role-based access control
-   Maximum commission rate: 20% (2000 basis points)
-   Maximum royalty rate: 30% (3000 basis points)

### Validation

-   Rental and transfer validation ensures royalties are always paid
-   Token existence checks prevent invalid operations
-   Rental expiration is automatically enforced

### Rounding & Dust Handling

-   Rounding errors are handled by sending dust to the first royalty receiver
-   All calculations use safe math operations
-   Comprehensive edge case testing

## Troubleshooting

### Common Issues

**"Caller is not an owner"**

-   Ensure the caller has the `OWNER_ROLE` in the AccessControl contract
-   Check that the role was granted during contract initialization

**"Royalty payment required before transfer"**

-   Use `initiateTransferWithRoyalty` and `payTransferRoyalty` functions
-   Ensure the buyer has approved sufficient tokens for the contract

**"Token is currently rented"**

-   Check rental status with `isRented(tokenId)`
-   End rental with `endRentalSimple` if needed

**Rounding Errors**

-   The library automatically handles rounding by sending dust to the first receiver
-   Use `.to.be.closeTo()` in tests for approximate equality checks

### Gas Optimization Tips

-   Use the simplified rental functions (`endRentalSimple`, `updateRentalOnTransferSimple`)
-   Batch operations when possible
-   Consider using ERC1155 for multiple token types

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Support

-   **Documentation**: [GitHub Wiki](https://github.com/paulstinchcombe/kaminftlibrary/wiki)
-   **Issues**: [GitHub Issues](https://github.com/paulstinchcombe/kaminftlibrary/issues)
-   **Discussions**: [GitHub Discussions](https://github.com/paulstinchcombe/kaminftlibrary/discussions)
