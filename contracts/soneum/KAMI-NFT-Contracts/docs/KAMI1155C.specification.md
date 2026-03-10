# KAMI1155C Contract Specification

## Overview

`KAMI1155C` is an advanced ERC1155 multi-token contract that supports both fungible and non-fungible tokens in a single contract. It implements comprehensive features including programmable royalties, rental functionality, platform commissions, and dual-level supply management (contract-wide and per-tokenId).

## Use Cases

### Primary Use Cases
- **Gaming Assets**: Both unique items (NFTs) and stackable resources (Fungible Tokens)
- **Digital Collectibles**: Multiple editions of the same artwork
- **Membership Cards**: Multiple tiers with different quantities
- **In-Game Currency**: Fungible tokens alongside NFT assets
- **Bundle Sales**: Sell multiple token types in one transaction

### Key Differentiators
- ✅ **Multi-token standard**: Fungible and non-fungible in one contract
- ✅ **Dual supply limits**: Contract-wide AND per-tokenId limits
- ✅ **Per-tokenId pricing**: Each token type has independent pricing
- ✅ **Batch operations**: Efficient multi-token transfers
- ✅ **Flexible minting**: Auto-incrementing or specific tokenIds

## Contract Structure

### Inheritance
```
KAMI1155C
├── ERC1155                  # Multi-token standard
├── ERC1155Supply           # Supply tracking extension
├── ERC2981                 # Royalty standard
├── AccessControl           # Role-based access
└── Pausable                # Emergency pause
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
    string memory baseTokenURI_,        // Base URI for token metadata
    address platformAddress_,          // Platform commission recipient
    uint96 platformCommissionPercentage_,  // Platform fee (basis points, max 2000 = 20%)
    address adminAddress_,             // Admin/owner address
    uint256 totalSupply_               // Optional: contract-wide supply limit (0 = unlimited)
)
```

### Parameters
- `paymentToken_`: Must be valid ERC20 contract (non-zero address)
- `platformCommissionPercentage_`: Maximum 2000 (20%)
- `totalSupply_`: If > 0, sets contract-wide maximum across all tokenIds. Value of 0 means unlimited.

## Core Features

### 1. Minting System

#### Single Token Mint
```solidity
function mint(
    address recipient,
    uint256 amount,
    uint256 tokenPrice,
    string calldata tokenURI,
    KamiNFTCore.RoyaltyData[] calldata mintRoyalties
) external whenNotPaused
```
- **Auto-incrementing**: Uses `_tokenIdCounter` for new tokenId
- **Any amount**: Can mint multiple copies of same token
- **Per-tokenId price**: Sets price for this specific tokenId
- **Supply limits**: Checks both contract-wide and per-tokenId limits

#### Mint Specific Amount
```solidity
function mintAmount(
    address recipient,
    uint256 tokenId,
    uint256 amount,
    uint256 tokenPrice,
    string calldata tokenURI,
    KamiNFTCore.RoyaltyData[] calldata mintRoyalties
) external whenNotPaused
```
- **Specific tokenId**: Mints more of existing token type
- **Amount increment**: Adds to existing supply

#### Mint For Recipient
```solidity
function mintFor(
    address recipient,
    uint256 amount,
    uint256 tokenPrice,
    string calldata tokenURI,
    KamiNFTCore.RoyaltyData[] calldata mintRoyalties
) external whenNotPaused
```
- **Same as mint()**: Alternative naming for clarity
- **Auto tokenId**: Uses counter for new tokenId

#### Batch Mint
```solidity
function mintBatch(
    address[] calldata recipients,
    uint256[] calldata amounts,
    uint256[] calldata prices,
    string[] calldata uris,
    KamiNFTCore.RoyaltyData[] calldata mintRoyalties
) external whenNotPaused
```
- **Multiple tokens**: Creates multiple different tokenIds
- **Individual pricing**: Each token type has own price
- **Gas efficient**: Single transaction for multiple mints

### 2. Dual Supply Management

#### Contract-Wide Supply Limit
```solidity
function setTotalSupply(uint256 maxSupply) external onlyRole(OWNER_ROLE)
function maxTotalSupply() public view returns (uint256)
```
- **Global limit**: Maximum tokens across ALL tokenIds
- **0 = unlimited**: Setting to 0 removes limit
- **Enforced on mint**: All mint functions check this first

#### Per-TokenId Supply Limit
```solidity
function setTokenTotalSupply(uint256 tokenId, uint256 maxSupply) external onlyRole(OWNER_ROLE)
function totalSupply(uint256 tokenId) public view returns (uint256)
function getTotalMinted(uint256 tokenId) public view returns (uint256)
```

**Important Distinction:**
- `totalSupply(tokenId)`: Returns the **limit** for that tokenId (0 = unlimited)
- `getTotalMinted(tokenId)`: Returns **actual minted count** for that tokenId

**Supply Check Logic:**
1. Check contract-wide limit: `getTotalMinted() < maxTotalSupply()` (if set)
2. Check per-tokenId limit: `getTotalMinted(tokenId) + amount <= totalSupply(tokenId)` (if set)

### 3. Royalty System

#### ERC2981 Compliance
```solidity
function royaltyInfo(uint256 tokenId, uint256 /* salePrice */)
    public view returns (address receiver, uint256 royaltyAmount)
```
- **Price from mapping**: Uses `tokenPrices[tokenId]`, not parameter
- **First receiver**: Returns first receiver for ERC2981 compatibility
- **Token-specific**: Each tokenId can have different royalties

#### Extended Royalty Info
```solidity
function getRoyaltyInfo(uint256 tokenId)
    public view returns (address[] memory receivers, uint256[] memory amounts)
```
- **All receivers**: Complete royalty breakdown
- **Calculated amounts**: Based on token price

#### Configuration
```solidity
function setRoyaltyPercentage(uint96 newRoyaltyPercentage) external onlyRole(OWNER_ROLE)
function setMintRoyalties(KamiNFTCore.RoyaltyData[] calldata royalties) external onlyRole(OWNER_ROLE)
function setTransferRoyalties(KamiNFTCore.RoyaltyData[] calldata royalties) external onlyRole(OWNER_ROLE)
function setTokenMintRoyalties(uint256 tokenId, KamiNFTCore.RoyaltyData[] calldata royalties) external onlyRole(OWNER_ROLE)
function setTokenTransferRoyalties(uint256 tokenId, KamiNFTCore.RoyaltyData[] calldata royalties) external onlyRole(OWNER_ROLE)
```

**Royalty Distribution:**
- **Mint**: Platform commission (20%) → Remaining to mint royalty receivers
- **Transfer/Sale**: Platform commission (20%) → Royalty (10% of remaining) → Seller (72%)

### 4. Rental System

```solidity
function rentToken(
    uint256 tokenId,
    uint256 amount,
    uint256 duration,
    uint256 rentalPrice,
    address renter
) external whenNotPaused

function endRental(uint256 tokenId) external onlyOwnerOrRenter(tokenId)
function extendRental(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment) external
function getRentalInfo(uint256 tokenId) external view returns (Rental memory)
function isRented(uint256 tokenId) external view returns (bool)
```

**Features:**
- **Amount-based**: Rent specific quantity of a tokenId
- **Time-based**: Start and end timestamps
- **Role assignment**: Automatic `RENTER_ROLE` grant
- **Transfer blocking**: Rented tokens cannot be transferred
- **Batch rental**: Can rent multiple amounts

### 5. Selling & Transfers

```solidity
function sellToken(
    address to,
    uint256 tokenId,
    uint256 amount,
    address seller
) external whenNotPaused
```
- **Amount-based**: Sell specific quantity
- **Marketplace support**: Seller can be different from caller
- **Automatic distribution**: Platform commission + transfer royalties
- **Rental protection**: Cannot sell rented tokens

### 6. Burning

```solidity
function burn(uint256 tokenId, uint256 amount) external whenNotPaused
function burnBatch(uint256[] memory tokenIds, uint256[] memory amounts) external whenNotPaused
```
- **Amount-based**: Burn specific quantity
- **Balance check**: Must own sufficient tokens
- **Rental protection**: Cannot burn rented tokens
- **Supply tracking**: Updates actual minted count

### 7. Transfer Royalty Enforcement

```solidity
function initiateTransferWithRoyalty(address to, uint256 tokenId, uint256 price) external
function payTransferRoyalty(address seller, uint256 tokenId, uint256 price) external
function isTransferRoyaltyRequired(address from, address to, uint256 tokenId, uint256 price) external view returns (bool)
```
- **Two-step process**: Initiate, then pay before transfer
- **Enforced on transfer**: Standard transfers blocked until paid
- **Flexible pricing**: Price set at initiation time

### 8. Token Metadata

```solidity
function uri(uint256 tokenId) public view returns (string memory)
function setTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyRole(OWNER_ROLE)
function setBaseURI(string memory newBaseTokenURI) external onlyRole(OWNER_ROLE)
```

**Priority:**
1. Individual token URI (if set)
2. Base URI + token ID

### 9. Pricing Management

```solidity
mapping(uint256 => uint256) public tokenPrices;
function setPrice(uint256 tokenId, uint256 newPrice) external onlyRole(OWNER_ROLE)
```
- **Per-tokenId pricing**: Each token type has independent price
- **Used for royalties**: `royaltyInfo()` uses token price
- **Updatable**: Owner can change prices after mint

### 10. Gasless (EIP-712 Signature) Entrypoints

KAMI1155C provides **WithSignature** variants for gasless submission by a relayer. EIP-712 domain: `name = "KAMI1155C"`, `version = "1"`. All WithSignature functions require `block.timestamp <= deadline`.

| Entrypoint | Authorized party | Typed data (struct) |
| ---------- | ----------------- | ------------------- |
| `sellTokenWithSignature(to, tokenId, amount, seller, deadline, signature)` | Seller (must own token) | `SellToken1155(address to, uint256 tokenId, uint256 amount, address seller, uint256 deadline)` |
| `setTokenURIWithSignature(tokenId, newTokenURI, deadline, signature)` | Token owner (balanceOf(signer, tokenId) > 0) | `SetTokenURI1155(uint256 tokenId, string newTokenURI, uint256 deadline)` |
| `rentTokenWithSignature(tokenId, duration, rentalPrice, renter, tokenOwner, deadline, signature)` | Renter (signer must equal `renter`) | `RentToken1155(uint256 tokenId, uint256 duration, uint256 rentalPrice, address renter, uint256 deadline)` |
| `extendRentalWithSignature(tokenId, additionalDuration, additionalPayment, tokenOwner, deadline, signature)` | Token owner (extends rental they granted) | `ExtendRental1155(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment, address tokenOwner, uint256 deadline)` |
| `endRentalWithSignature(tokenId, signer, deadline, signature)` | Owner or current renter | `EndRental1155(uint256 tokenId, address signer, uint256 deadline)` |
| `initiateTransferWithRoyaltyWithSignature(to, tokenId, price, tokenOwner, deadline, signature)` | Token owner | `InitiateTransferWithRoyalty1155(address to, uint256 tokenId, uint256 price, address tokenOwner, uint256 deadline)` |
| `payTransferRoyaltyWithSignature(tokenId, price, buyer, seller, deadline, signature)` | Buyer (signer must equal `buyer`) | `PayTransferRoyalty1155(uint256 tokenId, uint256 price, address buyer, address seller, uint256 deadline)` |
| `burnWithSignature(tokenId, amount, owner, deadline, signature)` | Token owner (balanceOf(owner, tokenId) >= amount) | `Burn1155(uint256 tokenId, uint256 amount, address owner, uint256 deadline)` |

**Transfer royalty:** For the non-signature flow, the buyer calls `payTransferRoyalty(seller, tokenId, price)` so the contract can attribute payment to the correct seller (ERC1155 has no single owner per tokenId).

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
| `mintAmount()` | ✅ | ✅ | ✅ |
| `mintBatch()` | ✅ | ✅ | ✅ |
| `setTotalSupply()` | ✅ | ❌ | ❌ |
| `setTokenTotalSupply()` | ✅ | ❌ | ❌ |
| `setPrice()` | ✅ | ❌ | ❌ |
| `setTokenURI()` | ✅ | ❌ | ❌ |
| `setRoyaltyPercentage()` | ✅ | ❌ | ❌ |
| `pause()` | ✅ | ❌ | ❌ |
| `sellToken()` | ✅ | ✅ | ✅ |
| `rentToken()` | ✅ | ✅ | ✅ |
| `burn()` | ✅ | ✅ | ✅ |

## Events

```solidity
event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 amount, uint256 price);
event TokenSold(address indexed from, address indexed to, uint256 indexed tokenId, uint256 amount, uint256 price);
event RentalStarted(uint256 indexed tokenId, address indexed renter, uint256 startTime, uint256 endTime, uint256 rentalPrice);
event RentalEnded(uint256 indexed tokenId, address indexed renter, address indexed caller);
event RentalExtended(uint256 indexed tokenId, uint256 newEndTime, uint256 rentalPrice, uint256 additionalPayment);
```

## Error Handling

### Custom Errors
- `TokenSupplyExceeded()`: Supply limit reached (contract-wide or per-tokenId)
- `InvalidPaymentTokenAddress()`: Zero address for payment token
- `InvalidPlatformAddress()`: Zero address for platform
- `TokenDoesNotExist()`: TokenId has not been minted
- `CallerNotOwner()`: Unauthorized owner action
- `SignatureExpired()`: EIP-712 signature past deadline (gasless entrypoints)
- `InvalidSigner()`: Recovered signer does not match required role (gasless entrypoints)

## Payment Flow

### Mint Payment Flow
1. User calls `mint()` with amount, price, and URI
2. Payment token transferred: `amount * price * quantity`
3. Platform commission deducted and transferred
4. Remaining amount distributed to mint royalty receivers (if configured)

### Example Distribution (Mint 10 tokens @ 100 USDC each, 20% platform, 10% royalty)
```
Total: 1000 USDC
├── Platform: 200 USDC (20%)
└── Remaining: 800 USDC
    ├── Royalty Receivers: 80 USDC (10% of remaining)
    └── Creator/Contract: 720 USDC
```

## Supply Limit Examples

### Contract-Wide Limit Only
```solidity
// Deploy with 10,000 total tokens max
const kami1155c = await KAMI1155C.deploy(
    paymentToken,
    baseURI,
    platformAddress,
    2000,
    adminAddress,
    10000  // Maximum 10,000 tokens across all tokenIds
);

// Mint 100 of tokenId 0 (allowed if total < 10,000)
await kami1155c.mint(recipient, 100, price, uri, []);

// Mint 100 of tokenId 1 (allowed if total < 10,000)
await kami1155c.mint(recipient, 100, price, uri, []);
```

### Per-TokenId Limit Only
```solidity
// Deploy with unlimited contract-wide supply
const kami1155c = await KAMI1155C.deploy(..., 0);

// Set limit for tokenId 0: 1000 max
await kami1155c.setTokenTotalSupply(0, 1000);

// Mint 500 of tokenId 0 (allowed)
await kami1155c.mintAmount(recipient, 0, 500, price, uri, []);

// Try to mint 600 more (reverts: would exceed 1000)
await kami1155c.mintAmount(recipient, 0, 600, price, uri, []);
```

### Both Limits
```solidity
// Contract-wide: 10,000 max
// Per tokenId 0: 1,000 max
// Per tokenId 1: 2,000 max

// Must satisfy BOTH:
// - getTotalMinted() < 10000 (contract-wide)
// - getTotalMinted(0) + amount <= 1000 (per-tokenId)
```

## Gas Optimization

- **Batch operations**: `mintBatch()` and `burnBatch()` reduce gas
- **Library usage**: Shared code reduces contract size
- **Supply tracking**: Efficient `_actualMintedCount` mapping
- **Custom errors**: Gas-efficient error reporting

## Security Considerations

1. **Reentrancy**: SafeERC20 and checks-effects-interactions pattern
2. **Access Control**: Role-based permissions
3. **Input Validation**: All parameters validated
4. **Pausable**: Emergency stop mechanism
5. **Supply Limits**: Prevents unbounded minting at both levels
6. **Rental Protection**: Prevents transfer/burn during rentals

## Integration Examples

### Mint Unique NFTs
```solidity
// Create 10 unique token types
for (uint i = 0; i < 10; i++) {
    await kami1155c.mint(
        recipient,
        1,  // Amount: 1 = NFT
        ethers.parseUnits('100', 6),
        `https://api.kami.com/metadata/${i}`,
        []
    );
}
```

### Mint Fungible Tokens
```solidity
// Create 1000 copies of tokenId 5
await kami1155c.mintAmount(
    recipient,
    5,  // Existing tokenId
    1000,  // Amount: 1000 = fungible
    ethers.parseUnits('10', 6),
    'https://api.kami.com/metadata/5',
    []
);
```

### Batch Mint
```solidity
await kami1155c.mintBatch(
    [recipient1, recipient2, recipient3],
    [1, 1, 1],  // One each
    [100, 150, 200].map(p => ethers.parseUnits(p.toString(), 6)),
    ['uri1', 'uri2', 'uri3'],
    []
);
```

### Supply Management
```solidity
// Set contract-wide limit
await kami1155c.setTotalSupply(10000);

// Set per-tokenId limit
await kami1155c.setTokenTotalSupply(5, 1000);

// Check limits
const contractMax = await kami1155c.maxTotalSupply();  // 10000
const tokenMax = await kami1155c.totalSupply(5);       // 1000 (limit)
const tokenMinted = await kami1155c.getTotalMinted(5); // 500 (actual)
```

## Upgradeable Version

`KAMI1155CUpgradeable` provides identical functionality using the UUPS proxy pattern:
- Same methods and features
- Upgradeable implementation
- Storage gaps for future upgrades
- See deployment guide for proxy setup

## Additional Resources

- [API Reference](API_REFERENCE.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Examples](EXAMPLES.md)
- [Security Audit](SECURITY_AUDIT.md)

