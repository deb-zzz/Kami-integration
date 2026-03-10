# KamiNFTLibrary

A comprehensive Solidity library providing extended features for ERC721 contracts including programmable royalties, ERC20 payment integration, platform commission system, time-based rental system, and mandatory royalty enforcement.

## Features

### 🎯 Core Features

-   **Programmable Royalties**: Multiple receivers with configurable percentages
-   **ERC20 Payment Integration**: Native support for ERC20 tokens as payment
-   **Platform Commission System**: Built-in platform fee collection
-   **Time-based Rental System**: NFT rental functionality with automatic expiration
-   **Mandatory Royalty Enforcement**: Ensures royalties are paid before transfers
-   **Role-based Access Control**: Secure permission management

### 🔧 Advanced Capabilities

-   **Token-specific Royalties**: Set different royalty structures per token
-   **Dual Royalty Types**: Separate mint and transfer royalty configurations
-   **Rental Management**: Extend, end, and track rental periods
-   **Transfer Validation**: Comprehensive transfer validation with royalty checks
-   **Event Tracking**: Extensive event emission for transparency

## Installation

```bash
npm install @paulstinchcombe/kaminftlibrary
```

## Quick Start

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@paulstinchcombe/kaminftlibrary/contracts/KamiNFTLibrary.sol";

contract MyNFT is ERC721, AccessControl {
    using KamiNFTLibrary for *;

    // Library storage variables
    KamiNFTLibrary.PlatformConfig public platformConfig;
    KamiNFTLibrary.RoyaltyConfig public royaltyConfig;
    KamiNFTLibrary.TransferTracker public transferTracker;
    mapping(uint256 => KamiNFTLibrary.Rental) public rentals;

    constructor() ERC721("MyNFT", "MNFT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KamiNFTLibrary.OWNER_ROLE, msg.sender);

        // Initialize platform configuration
        platformConfig.initializePlatform(
            address(this), // platform address
            500 // 5% platform commission
        );

        // Initialize royalty configuration
        royaltyConfig.initializeRoyaltyConfig();
    }

    // Your NFT implementation here...
}
```

## API Reference

### Structs

#### RoyaltyData

```solidity
struct RoyaltyData {
    address receiver;
    uint96 feeNumerator; // In basis points (e.g., 1000 = 10%)
}
```

#### Rental

```solidity
struct Rental {
    address renter;
    uint256 startTime;
    uint256 endTime;
    uint256 rentalPrice;
    bool active;
}
```

#### PlatformConfig

```solidity
struct PlatformConfig {
    uint96 commissionPercentage; // In basis points (e.g., 500 = 5%)
    address platformAddress;
}
```

#### RoyaltyConfig

```solidity
struct RoyaltyConfig {
    uint96 royaltyPercentage; // In basis points (e.g., 1000 = 10%)
    RoyaltyData[] mintRoyaltyReceivers;
    RoyaltyData[] transferRoyaltyReceivers;
    mapping(uint256 => RoyaltyData[]) tokenMintRoyalties;
    mapping(uint256 => RoyaltyData[]) tokenTransferRoyalties;
}
```

### Core Functions

#### Platform Management

##### `initializePlatform`

Initialize platform configuration with commission percentage and address.

```solidity
function initializePlatform(
    PlatformConfig storage config,
    address platformAddress_,
    uint96 platformCommissionPercentage_
) internal
```

**Parameters:**

-   `config`: Platform configuration storage
-   `platformAddress_`: Platform wallet address
-   `platformCommissionPercentage_`: Commission percentage in basis points (max 20%)

##### `updatePlatformCommission`

Update platform commission settings (requires OWNER_ROLE).

```solidity
function updatePlatformCommission(
    PlatformConfig storage config,
    uint96 newPlatformCommissionPercentage,
    address newPlatformAddress,
    address accessControl
) internal
```

#### Royalty Management

##### `setRoyaltyPercentage`

Set the global royalty percentage (requires OWNER_ROLE).

```solidity
function setRoyaltyPercentage(
    RoyaltyConfig storage config,
    uint96 newRoyaltyPercentage,
    address accessControl
) internal
```

**Parameters:**

-   `config`: Royalty configuration storage
-   `newRoyaltyPercentage`: New royalty percentage in basis points (max 30%)
-   `accessControl`: AccessControl contract address

##### `setMintRoyalties`

Configure mint royalty receivers and percentages.

```solidity
function setMintRoyalties(
    RoyaltyConfig storage config,
    RoyaltyData[] calldata royalties,
    PlatformConfig storage platformConfig,
    address accessControl
) internal
```

**Example:**

```solidity
KamiNFTLibrary.RoyaltyData[] memory mintRoyalties = new KamiNFTLibrary.RoyaltyData[](2);
mintRoyalties[0] = KamiNFTLibrary.RoyaltyData(artist, 7000); // 70% to artist
mintRoyalties[1] = KamiNFTLibrary.RoyaltyData(platform, 3000); // 30% to platform

royaltyConfig.setMintRoyalties(mintRoyalties, platformConfig, address(this));
```

##### `setTransferRoyalties`

Configure transfer royalty receivers and percentages.

```solidity
function setTransferRoyalties(
    RoyaltyConfig storage config,
    RoyaltyData[] calldata royalties,
    address accessControl
) internal
```

##### `setTokenMintRoyalties`

Set token-specific mint royalties.

```solidity
function setTokenMintRoyalties(
    RoyaltyConfig storage config,
    uint256 tokenId,
    RoyaltyData[] calldata royalties,
    PlatformConfig storage platformConfig,
    address accessControl,
    function(uint256) view returns (bool) exists
) internal
```

##### `setTokenTransferRoyalties`

Set token-specific transfer royalties.

```solidity
function setTokenTransferRoyalties(
    RoyaltyConfig storage config,
    uint256 tokenId,
    RoyaltyData[] calldata royalties,
    address accessControl,
    function(uint256) view returns (bool) exists
) internal
```

#### Payment Distribution

##### `distributeMintRoyalties`

Distribute royalties and platform commission during minting.

```solidity
function distributeMintRoyalties(
    RoyaltyConfig storage config,
    PlatformConfig storage platformConfig,
    IERC20 paymentToken,
    uint256 tokenId,
    uint256 mintPrice
) internal
```

##### `distributeTransferRoyalties`

Distribute royalties and platform commission during transfers.

```solidity
function distributeTransferRoyalties(
    RoyaltyConfig storage config,
    PlatformConfig storage platformConfig,
    IERC20 paymentToken,
    uint256 tokenId,
    uint256 salePrice
) internal
```

#### Token Sales

##### `sellToken`

Sell a token with automatic royalty distribution.

```solidity
function sellToken(
    RoyaltyConfig storage config,
    PlatformConfig storage platformConfig,
    IERC20 paymentToken,
    TransferTracker storage tracker,
    uint256 tokenId,
    address to,
    uint256 salePrice,
    address seller,
    mapping(uint256 => Rental) storage rentals
) internal
```

**Example:**

```solidity
// Seller calls this function to sell their token
royaltyConfig.sellToken(
    platformConfig,
    paymentToken,
    tracker,
    tokenId,
    buyer,
    salePrice,
    msg.sender,
    rentals
);
```

#### Rental System

##### `rentToken`

Rent a token for a specified duration.

```solidity
function rentToken(
    mapping(uint256 => Rental) storage rentals,
    PlatformConfig storage platformConfig,
    IERC20 paymentToken,
    uint256 tokenId,
    uint256 duration,
    uint256 rentalPrice,
    address tokenOwner,
    address accessControl
) internal
```

**Example:**

```solidity
// Renter calls this function to rent a token
rentals.rentToken(
    platformConfig,
    paymentToken,
    tokenId,
    7 days, // duration
    rentalPrice,
    tokenOwner,
    address(this)
);
```

##### `endRental`

End a rental early (owner or renter can call).

```solidity
function endRental(
    mapping(uint256 => Rental) storage rentals,
    uint256 tokenId,
    address tokenOwner,
    address accessControl,
    function(address) view returns (bool) hasActiveRentals
) internal
```

##### `extendRental`

Extend an existing rental period.

```solidity
function extendRental(
    mapping(uint256 => Rental) storage rentals,
    PlatformConfig storage platformConfig,
    IERC20 paymentToken,
    uint256 tokenId,
    uint256 additionalDuration,
    uint256 additionalPayment,
    address tokenOwner
) internal
```

##### `isRented`

Check if a token is currently rented.

```solidity
function isRented(mapping(uint256 => Rental) storage rentals, uint256 tokenId) internal view returns (bool)
```

##### `getRentalInfo`

Get detailed rental information for a token.

```solidity
function getRentalInfo(
    mapping(uint256 => Rental) storage rentals,
    uint256 tokenId,
    function(uint256) view returns (bool) exists
) internal view returns (Rental memory)
```

#### Transfer Validation

##### `validateTransfer`

Validate a transfer with rental and royalty checks.

```solidity
function validateTransfer(
    mapping(uint256 => Rental) storage rentals,
    RoyaltyConfig storage config,
    TransferTracker storage tracker,
    uint256 tokenId,
    address from,
    address to,
    address tokenOwner,
    function(address, address) view returns (bool) isApprovedForAll,
    function(uint256) view returns (address) getApproved
) internal view
```

##### `initiateTransferWithRoyalty`

Initiate a transfer that requires royalty payment.

```solidity
function initiateTransferWithRoyalty(
    TransferTracker storage tracker,
    uint256 tokenId,
    address to,
    uint256 salePrice,
    address owner,
    mapping(uint256 => Rental) storage rentals
) internal
```

##### `payTransferRoyalty`

Pay the required royalty for a transfer.

```solidity
function payTransferRoyalty(
    TransferTracker storage tracker,
    RoyaltyConfig storage config,
    PlatformConfig storage platformConfig,
    IERC20 paymentToken,
    uint256 tokenId,
    address from,
    address to,
    uint256 salePrice
) internal
```

#### Utility Functions

##### `calculateTransferPayment`

Calculate total required payment including royalties and platform commission.

```solidity
function calculateTransferPayment(
    RoyaltyConfig storage config,
    PlatformConfig storage platformConfig,
    uint256 salePrice
) internal view returns (uint256 totalRequired)
```

##### `hasActiveRentals`

Check if a user has any active rentals.

```solidity
function hasActiveRentals(
    mapping(uint256 => Rental) storage rentals,
    address user,
    function() view returns (uint256) totalSupply,
    function(uint256) view returns (uint256) tokenByIndex
) internal view returns (bool)
```

### Events

The library emits comprehensive events for tracking:

-   `MintRoyaltiesUpdated(RoyaltyData[] royalties)`
-   `TransferRoyaltiesUpdated(RoyaltyData[] royalties)`
-   `TokenMintRoyaltiesUpdated(uint256 indexed tokenId, RoyaltyData[] royalties)`
-   `TokenTransferRoyaltiesUpdated(uint256 indexed tokenId, RoyaltyData[] royalties)`
-   `TransferRoyaltyDistributed(uint256 indexed tokenId, address indexed receiver, uint256 amount)`
-   `PlatformCommissionPaid(uint256 indexed tokenId, address indexed platformAddress, uint256 amount)`
-   `RoyaltyPercentageUpdated(uint96 newPercentage)`
-   `PlatformCommissionUpdated(uint96 newPercentage, address newPlatformAddress)`
-   `TokenSold(uint256 indexed tokenId, address indexed from, address indexed to, uint256 salePrice)`
-   `TokenRented(uint256 indexed tokenId, address indexed owner, address indexed renter, uint256 startTime, uint256 endTime, uint256 rentalPrice)`
-   `RentalEnded(uint256 indexed tokenId, address indexed owner, address indexed renter)`
-   `RentalExtended(uint256 indexed tokenId, address indexed renter, uint256 newEndTime)`
-   `TransferRoyaltyRequired(uint256 indexed tokenId, address indexed from, address indexed to, uint256 requiredAmount)`
-   `TransferRoyaltyPaid(uint256 indexed tokenId, address indexed from, address indexed to, uint256 amount)`

### Roles

The library defines three main roles:

-   `OWNER_ROLE`: Can update royalty and platform configurations
-   `RENTER_ROLE`: Granted to users who rent tokens
-   `PLATFORM_ROLE`: Platform-specific permissions

## Usage Examples

### Complete NFT Contract Integration

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@paulstinchcombe/kaminftlibrary/contracts/KamiNFTLibrary.sol";

contract AdvancedNFT is ERC721, AccessControl {
    using KamiNFTLibrary for *;

    // Library storage
    KamiNFTLibrary.PlatformConfig public platformConfig;
    KamiNFTLibrary.RoyaltyConfig public royaltyConfig;
    KamiNFTLibrary.TransferTracker public transferTracker;
    mapping(uint256 => KamiNFTLibrary.Rental) public rentals;

    // Payment token
    IERC20 public paymentToken;

    constructor(address _paymentToken) ERC721("AdvancedNFT", "ANFT") {
        paymentToken = IERC20(_paymentToken);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KamiNFTLibrary.OWNER_ROLE, msg.sender);

        // Initialize platform (5% commission)
        platformConfig.initializePlatform(msg.sender, 500);

        // Initialize royalties (10% default)
        royaltyConfig.initializeRoyaltyConfig();
    }

    function mint(address to, uint256 tokenId, uint256 mintPrice) external {
        require(mintPrice > 0, "Invalid mint price");

        // Transfer payment
        paymentToken.safeTransferFrom(msg.sender, address(this), mintPrice);

        // Distribute royalties
        royaltyConfig.distributeMintRoyalties(
            platformConfig,
            paymentToken,
            tokenId,
            mintPrice
        );

        _mint(to, tokenId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);

        // Validate transfer
        royaltyConfig.validateTransfer(
            rentals,
            transferTracker,
            firstTokenId,
            from,
            to,
            ownerOf(firstTokenId),
            isApprovedForAll,
            getApproved
        );

        // Update rental status
        rentals.updateRentalOnTransfer(
            firstTokenId,
            from,
            to,
            address(this),
            hasActiveRentals
        );
    }

    function hasActiveRentals(address user) public view returns (bool) {
        return rentals.hasActiveRentals(user, totalSupply, tokenByIndex);
    }
}
```

### Setting Up Royalties

```solidity
// Set global transfer royalties
KamiNFTLibrary.RoyaltyData[] memory transferRoyalties = new KamiNFTLibrary.RoyaltyData[](2);
transferRoyalties[0] = KamiNFTLibrary.RoyaltyData(artist, 6000); // 60% to artist
transferRoyalties[1] = KamiNFTLibrary.RoyaltyData(creator, 4000); // 40% to creator

royaltyConfig.setTransferRoyalties(transferRoyalties, address(this));

// Set token-specific royalties
KamiNFTLibrary.RoyaltyData[] memory tokenRoyalties = new KamiNFTLibrary.RoyaltyData[](1);
tokenRoyalties[0] = KamiNFTLibrary.RoyaltyData(specialArtist, 10000); // 100% to special artist

royaltyConfig.setTokenTransferRoyalties(tokenId, tokenRoyalties, address(this), _exists);
```

### Rental Operations

```solidity
// Rent a token for 7 days
rentals.rentToken(
    platformConfig,
    paymentToken,
    tokenId,
    7 days,
    rentalPrice,
    tokenOwner,
    address(this)
);

// Extend rental for additional 3 days
rentals.extendRental(
    platformConfig,
    paymentToken,
    tokenId,
    3 days,
    additionalPayment,
    tokenOwner
);

// End rental early
rentals.endRental(tokenId, tokenOwner, address(this), hasActiveRentals);
```

## Security Considerations

1. **Access Control**: Always use proper role-based access control
2. **Royalty Validation**: Ensure royalty percentages don't exceed reasonable limits
3. **Rental Security**: Validate rental durations and prices
4. **Payment Verification**: Always verify payment transfers
5. **Reentrancy**: Use reentrancy guards where appropriate

## Gas Optimization

-   Use `uint96` for percentages to pack structs efficiently
-   Batch operations where possible
-   Use events for off-chain tracking instead of storage
-   Optimize loops and avoid unnecessary storage reads

## Testing

```bash
# Run tests
npm run test:unit

# Run with gas reporting
REPORT_GAS=true npm run test:unit

# Run coverage
npm run coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:

-   Create an issue on GitHub
-   Check the documentation
-   Review the test files for usage examples
