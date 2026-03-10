# KAMI721C Contract Specification

## Overview

`KAMI721C` is a standard ERC721 NFT contract with comprehensive features for royalty management, platform commissions, rental functionality, and flexible minting. Unlike `KAMI721AC`, this contract allows unlimited minting per address and is optimized for general-purpose NFT collections.

## Use Cases

### Primary Use Cases
- **General NFT Collections**: No restrictions on minting per address
- **Art Collections**: Individual artworks with royalties
- **Gaming Items**: In-game assets and collectibles
- **Digital Art Marketplace**: Full-featured trading platform
- **Membership Programs**: Multiple tiers with different features

### Key Differentiators
- ✅ **Unlimited minting**: No per-address restrictions
- ✅ **Flexible minting**: Mint to any recipient
- ✅ **Per-token pricing**: Each token has independent price
- ✅ **Full royalty support**: Mint and transfer royalties
- ✅ **Rental system**: Time-based token rental

## Contract Structure

### Inheritance
```
KAMI721C
├── ERC721Enumerable          # ERC721 with enumeration
├── ERC2981                   # Royalty standard
├── AccessControl             # Role-based access
└── Pausable                  # Emergency pause
```

### Libraries
- `KamiNFTCore`: Core data structures and storage
- `KamiPlatform`: Platform commission management
- `KamiRoyalty`: Royalty distribution logic
- `KamiRental`: Rental system management
- `KamiTransfer`: Transfer validation

## Constructor

```solidity
constructor(
    address paymentToken_,              // ERC20 payment token address
    string memory name_,                // Token name
    string memory symbol_,              // Token symbol
    string memory baseTokenURI_,        // Base URI for metadata
    address platformAddress_,          // Platform commission recipient
    uint96 platformCommissionPercentage_,  // Platform fee (basis points, max 2000 = 20%)
    address adminAddress_              // Admin/owner address
)
```

### Parameters
- `paymentToken_`: Must be valid ERC20 contract (non-zero address)
- `platformCommissionPercentage_`: Maximum 2000 (20%)
- No supply limits: Contract does not enforce supply restrictions

## Core Features

### 1. Minting System

#### Standard Mint
```solidity
function mint(
    address recipient,
    uint256 tokenPrice,
    string calldata uri,
    KamiNFTCore.RoyaltyData[] calldata mintRoyalties
) external whenNotPaused
```
- **Any recipient**: Mint to any address
- **Auto-incrementing**: Uses `_tokenIdCounter`
- **Payment required**: Transfers payment token from caller
- **Per-token pricing**: Each token has its own price

#### Mint For Recipient
```solidity
function mintFor(
    address recipient,
    uint256 tokenPrice,
    string calldata uri,
    KamiNFTCore.RoyaltyData[] calldata mintRoyalties
) external whenNotPaused
```
- **Alternative naming**: Same as `mint()` for API clarity
- **Same behavior**: Identical functionality

### 2. Royalty System

#### ERC2981 Compliance
```solidity
function royaltyInfo(uint256 tokenId, uint256 /* salePrice */)
    public view returns (address receiver, uint256 royaltyAmount)
```
- **Price from mapping**: Uses `tokenPrices[tokenId]`, not parameter
- **First receiver**: Returns first receiver for ERC2981 compatibility
- **Token-specific**: Can configure per-token royalties

#### Extended Royalty Info
```solidity
function getRoyaltyInfo(uint256 tokenId)
    public view returns (address[] memory receivers, uint256[] memory amounts)
```
- **All receivers**: Returns complete royalty breakdown
- **Calculated amounts**: Based on token price

#### Configuration
```solidity
function setRoyaltyPercentage(uint96 newRoyaltyPercentage) external onlyRole(OWNER_ROLE)
function setMintRoyalties(KamiNFTCore.RoyaltyData[] calldata royalties) external onlyRole(OWNER_ROLE)
function setTransferRoyalties(KamiNFTCore.RoyaltyData[] calldata royalties) external onlyRole(OWNER_ROLE)
function setTokenTransferRoyalties(uint256 tokenId, KamiNFTCore.RoyaltyData[] calldata royalties) external onlyRole(OWNER_ROLE)
```

**Royalty Distribution:**
- **Mint**: Platform commission (20%) → Remaining to mint royalty receivers
- **Transfer/Sale**: Platform commission (20%) → Royalty (10% of remaining) → Seller (72%)

### 3. Rental System

```solidity
function rentToken(
    uint256 tokenId,
    uint256 duration,
    uint256 rentalPrice
) external whenNotPaused

function endRental(uint256 tokenId) external onlyOwnerOrRenter(tokenId)
function extendRental(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment) external
function getRentalInfo(uint256 tokenId) external view returns (Rental memory)
function isRented(uint256 tokenId) external view returns (bool)
```

**Features:**
- **Time-based**: Rentals have start and end timestamps
- **Role assignment**: Automatic `RENTER_ROLE` grant
- **Transfer blocking**: Rented tokens cannot be transferred
- **Early termination**: Owner or renter can end rental
- **Extensions**: Renter can extend with additional payment

### 4. Selling & Transfers

```solidity
function sellToken(address to, uint256 tokenId, address seller) external whenNotPaused
```
- **Marketplace support**: Seller can be different from caller
- **Automatic distribution**: Platform commission + transfer royalties
- **Rental protection**: Cannot sell rented tokens

### 5. Transfer Royalty Enforcement

```solidity
function initiateTransferWithRoyalty(address to, uint256 tokenId, uint256 price) external
function payTransferRoyalty(address seller, uint256 tokenId, uint256 price) external
function isTransferRoyaltyRequired(address from, address to, uint256 tokenId, uint256 price) external view returns (bool)
```
- **Two-step process**: Initiate, then pay before transfer
- **Enforced on transfer**: Standard transfers blocked until paid
- **Flexible pricing**: Price set at initiation time

### 6. Token Metadata

```solidity
function tokenURI(uint256 tokenId) public view returns (string memory)
function setTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyRole(OWNER_ROLE)
function setBaseURI(string memory newBaseTokenURI) external onlyRole(OWNER_ROLE)
```

**Priority:**
1. Individual token URI (if set)
2. Base URI + token ID

### 7. Pricing Management

```solidity
mapping(uint256 => uint256) public tokenPrices;
function setPrice(uint256 tokenId, uint256 newPrice) external onlyRole(OWNER_ROLE)
```
- **Per-token pricing**: Each token has independent price
- **Used for royalties**: `royaltyInfo()` uses token price
- **Updatable**: Owner can change prices after mint

### 8. Burning

```solidity
function burn(uint256 tokenId) external
```
- **Owner only**: Must be token owner or approved
- **Rental protection**: Cannot burn rented tokens
- **Transfer validation**: Checks transfer royalties paid

## Access Control

### Roles
- **OWNER_ROLE**: Full contract administration
- **PLATFORM_ROLE**: Receives platform commissions
- **RENTER_ROLE**: Automatically assigned during rentals
- **DEFAULT_ADMIN_ROLE**: Can grant/revoke roles

### Permission Matrix

| Function | Owner | Platform | Public |
|----------|-------|----------|--------|
| `mint()` | ✅ | ✅ | ✅ |
| `mintFor()` | ✅ | ✅ | ✅ |
| `setPrice()` | ✅ | ❌ | ❌ |
| `setTokenURI()` | ✅ | ❌ | ❌ |
| `setBaseURI()` | ✅ | ❌ | ❌ |
| `setRoyaltyPercentage()` | ✅ | ❌ | ❌ |
| `pause()` | ✅ | ❌ | ❌ |
| `sellToken()` | ✅ | ✅ | ✅ |
| `rentToken()` | ✅ | ✅ | ✅ |
| `burn()` | ✅ | ✅ | ✅ |

## Events

```solidity
event TokenSold(address indexed seller, address indexed buyer, uint256 indexed tokenId, uint256 price);
event RentalStarted(uint256 indexed tokenId, address indexed renter, uint256 startTime, uint256 endTime, uint256 rentalPrice);
event RentalEnded(uint256 indexed tokenId, address indexed renter, address indexed caller);
event RentalExtended(uint256 indexed tokenId, uint256 newEndTime, uint256 rentalPrice, uint256 additionalPayment);
```

## Error Handling

### Custom Errors
- `ZeroAddress()`: Zero address provided
- `InvalidPlatformCommission()`: Commission exceeds 20%
- `CallerNotOwner()`: Unauthorized owner action
- `TokenPriceNotSet()`: Token price is zero
- `EmptyTokenURI()`: URI is empty
- `QueryForNonexistentToken()`: Token doesn't exist
- `SellerNotTokenOwner()`: Seller is not token owner
- `OwnerCannotRentOwnToken()`: Cannot rent own token
- `CallerNotTokenOwnerOrApproved()`: Unauthorized burn/transfer
- `SignatureExpired()`: EIP-712 signature past deadline
- `InvalidSigner()`: Recovered signer does not match required role

### Gasless (EIP-712 Signature) Entrypoints

KAMI721C provides **WithSignature** variants for gasless submission by a relayer. EIP-712 domain: `name = "KAMI721C"`, `version = "1"`. All WithSignature functions require `block.timestamp <= deadline`.

| Entrypoint | Authorized party | Typed data (struct) |
| ---------- | ----------------- | ------------------- |
| `burnWithSignature(tokenId, deadline, signature)` | Token owner | `Burn(uint256 tokenId, uint256 deadline)` |
| `initiateTransferWithRoyaltyWithSignature(to, tokenId, price, deadline, signature)` | Token owner | `InitiateTransferWithRoyalty(address to, uint256 tokenId, uint256 price, uint256 deadline)` |
| `sellTokenWithSignature(to, tokenId, deadline, signature)` | Token owner (seller) | `SellToken(address to, uint256 tokenId, uint256 deadline)` |
| `setTokenURIWithSignature(tokenId, newTokenURI, deadline, signature)` | Token owner | `SetTokenURI(uint256 tokenId, string newTokenURI, uint256 deadline)` |
| `rentTokenWithSignature(tokenId, duration, rentalPrice, renter, deadline, signature)` | Renter | `RentToken(uint256 tokenId, uint256 duration, uint256 rentalPrice, address renter, uint256 deadline)` |
| `extendRentalWithSignature(tokenId, additionalDuration, additionalPayment, renter, deadline, signature)` | Current renter | `ExtendRental(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment, address renter, uint256 deadline)` |
| `endRentalWithSignature(tokenId, renter, deadline, signature)` | Current renter | `EndRental(uint256 tokenId, address renter, uint256 deadline)` |
| `payTransferRoyaltyWithSignature(seller, tokenId, price, buyer, deadline, signature)` | Buyer (signer must equal `buyer`) | `PayTransferRoyalty(uint256 tokenId, uint256 price, address buyer, uint256 deadline)` |

Note: KAMI721C has no token-owner `setSalePrice` (admin `setPrice` only) and no `claim()`, so there are no `setSalePriceWithSignature` or `claimWithSignature` entrypoints.

## Payment Flow

### Mint Payment Flow
1. User calls `mint()` with price and URI
2. Payment token transferred from user to contract
3. Platform commission deducted and transferred
4. Remaining amount distributed to mint royalty receivers (if configured)

### Example Distribution (100 USDC, 20% platform, 10% royalty)
```
Total: 100 USDC
├── Platform: 20 USDC (20%)
└── Remaining: 80 USDC
    ├── Royalty Receivers: 8 USDC (10% of remaining)
    └── Creator/Contract: 72 USDC
```

## Gas Optimization

- **Library usage**: Shared code reduces contract size
- **Enumerable**: Efficient token tracking
- **Custom errors**: Gas-efficient error reporting
- **Optimized storage**: Efficient state variable layout

## Security Considerations

1. **Reentrancy**: SafeERC20 and checks-effects-interactions pattern
2. **Access Control**: Role-based permissions
3. **Input Validation**: All parameters validated
4. **Pausable**: Emergency stop mechanism
5. **Rental Protection**: Prevents transfer/burn during rentals

## Integration Examples

### Basic Mint
```solidity
// Mint a token
await kami721c.mint(
    recipient.address,
    ethers.parseUnits('100', 6),  // 100 USDC
    'https://api.kami.com/metadata/1',
    []  // No mint royalties
);
```

### Mint with Royalties
```solidity
const mintRoyalties = [
    { receiver: creator.address, feeNumerator: 5000 },  // 50%
    { receiver: coCreator.address, feeNumerator: 5000 }  // 50%
];

await kami721c.mint(
    recipient.address,
    ethers.parseUnits('200', 6),
    'https://api.kami.com/metadata/2',
    mintRoyalties
);
```

### Rent Token
```solidity
await kami721c.rentToken(
    tokenId,
    86400,  // 1 day in seconds
    ethers.parseUnits('10', 6)  // 10 USDC rental fee
);
```

### Sell Token
```solidity
await kami721c.sellToken(
    buyer.address,
    tokenId,
    seller.address  // Original owner
);
```

### Update Token Price
```solidity
await kami721c.setPrice(
    tokenId,
    ethers.parseUnits('500', 6)  // Update to 500 USDC
);
```

## Comparison with KAMI721AC

| Feature | KAMI721C | KAMI721AC |
|---------|----------|-----------|
| Minting per address | Unlimited | One claim per address |
| Primary function | `mint()` | `claim()` |
| Batch operations | No | Yes (`batchClaim`, `batchClaimFor`) |
| Supply limits | No | Yes (contract-wide) |
| Use case | General collections | Allowlist/airdrops |

## Upgradeable Version

`KAMI721CUpgradeable` provides identical functionality using the UUPS proxy pattern:
- Same methods and features
- Upgradeable implementation
- Storage gaps for future upgrades
- See deployment guide for proxy setup

## Additional Resources

- [API Reference](API_REFERENCE.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Examples](EXAMPLES.md)
- [Security Audit](SECURITY_AUDIT.md)

