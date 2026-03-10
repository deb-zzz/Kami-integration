# KAMI721AC Contract Specification

## Overview

`KAMI721AC` is an advanced ERC721 NFT contract that implements a **claimable token system** where each address can claim exactly one token. This contract includes comprehensive features for royalty management, platform commissions, rental functionality, and supply management.

## Use Cases

### Primary Use Cases

-   **Allowlist/Whitelist Systems**: One token per address guarantees fair distribution
-   **Airdrops with Payment**: Users can claim tokens while paying a fee
-   **Community Rewards**: Batch distribution to multiple recipients
-   **Limited Edition Collections**: Control total supply with contract-wide limits
-   **Exclusive Access Tokens**: One token per user for access control

### Key Differentiators

-   ✅ **One claim per address**: Enforced at contract level
-   ✅ **Claim-first architecture**: Primary mechanism is `claim()`, with `mint()` for compatibility
-   ✅ **Batch claiming**: Efficient bulk distribution (owner pays or each pays)
-   ✅ **Contract-wide supply limits**: Control total collection size
-   ✅ **Per-token pricing**: Each token has its own price

## Contract Structure

### Inheritance

```
KAMI721AC
├── ERC721Enumerable          # ERC721 with enumeration
├── ERC2981                   # Royalty standard
├── AccessControl             # Role-based access
└── Pausable                  # Emergency pause
```

### Libraries

-   `KamiNFTCore`: Core data structures and storage
-   `KamiPlatform`: Platform commission management
-   `KamiRoyalty`: Royalty distribution logic
-   `KamiRental`: Rental system management
-   `KamiTransfer`: Transfer validation

## Constructor

```solidity
constructor(
    address paymentToken_,              // ERC20 payment token address
    string memory name_,                // Token name
    string memory symbol_,              // Token symbol
    string memory baseTokenURI_,        // Base URI for metadata
    address platformAddress_,          // Platform commission recipient
    uint96 platformCommissionPercentage_,  // Platform fee (basis points, max 2000 = 20%)
    address adminAddress_,             // Admin/owner address
    uint256 totalSupply_,              // Optional: contract-wide supply limit (0 = unlimited)
    uint256 mintPrice_                 // Optional: initial global mint/claim price (default 0)
)
```

### Parameters

-   `paymentToken_`: Must be valid ERC20 contract (non-zero address)
-   `platformCommissionPercentage_`: Maximum 2000 (20%)
-   `totalSupply_`: If > 0, sets contract-wide maximum supply. Value of 0 means unlimited.
-   `mintPrice_`: Initial global mint/claim price. Can be updated later via `setMintPrice()`. Value of 0 means minting/claiming is disabled until price is set.

## Core Features

### 1. Claiming System

#### Single Claim

```solidity
function claim(
    string calldata uri,
    KamiNFTCore.RoyaltyData[] calldata mintRoyalties
) external
```

-   **One claim per address**: Enforced via `hasClaimed` mapping
-   **Uses global mint price**: Payment amount comes from `mintPrice` (must be set)
-   **Initial sale price**: Token's sale price is set to `mintPrice` upon claim
-   **Payment required**: Transfers payment token from caller (if `mintPrice > 0`)
-   **Supply limit check**: Validates against `maxTotalSupply` if set
-   **Automatic distribution**: Platform commission + mint royalties

#### Batch Claim (Owner Pays)

```solidity
function batchClaimFor(
    address[] calldata recipients,
    string[] calldata uris,
    KamiNFTCore.RoyaltyData[] calldata mintRoyalties
) external onlyRole(OWNER_ROLE)
```

-   **Owner role required**: Only contract owner can call
-   **Owner pays total**: Single payment for all tokens (uses `mintPrice * recipients.length`)
-   **Uses global mint price**: All tokens use the same `mintPrice`
-   **Max 100 recipients**: Gas optimization limit
-   **Initial sale prices**: Each token's sale price is set to `mintPrice` upon claim

#### Batch Claim (Each Pays)

```solidity
function batchClaim(
    address[] calldata recipients,
    string[] calldata uris,
    KamiNFTCore.RoyaltyData[] calldata mintRoyalties
) external
```

-   **Each recipient pays**: Payment collected individually (each pays `mintPrice`)
-   **Uses global mint price**: All tokens use the same `mintPrice`
-   **No role requirement**: Public function
-   **Max 100 recipients**: Same gas limit
-   **Initial sale prices**: Each token's sale price is set to `mintPrice` upon claim

### 2. Minting (Compatibility)

```solidity
function mint(
    address recipient,
    string calldata uri,
    KamiNFTCore.RoyaltyData[] calldata mintRoyalties
) external whenNotPaused
```

-   **Compatibility function**: For KAMI721C compatibility
-   **Uses global mint price**: Payment amount comes from `mintPrice` (must be set)
-   **Any recipient**: No claim restrictions
-   **Initial sale price**: Token's sale price is set to `mintPrice` upon mint
-   **Supply limit**: Checks `maxTotalSupply` if set

### 3. Total Supply Management

#### Contract-Wide Supply Limits

```solidity
function setTotalSupply(uint256 maxSupply) external onlyRole(OWNER_ROLE)
function maxTotalSupply() public view returns (uint256)
function getTotalMinted() public view returns (uint256)
```

**Behavior:**

-   `maxTotalSupply = 0`: Unlimited supply
-   `maxTotalSupply > 0`: Enforced maximum
-   `getTotalMinted()`: Returns actual count via `ERC721Enumerable.totalSupply()`
-   All mint/claim functions check limit before creating tokens

### 4. Royalty System

#### ERC2981 Compliance

```solidity
function royaltyInfo(uint256 tokenId, uint256 salePrice)
    public view returns (address receiver, uint256 royaltyAmount)
```

-   **Uses sale price**: Uses `salePrice` parameter if provided, otherwise falls back to `salePrices[tokenId]`
-   **First receiver**: Returns first receiver for ERC2981 compatibility
-   **Automatic calculation**: Based on sale price and royalty percentage
-   **Context aware**: During mint/claim, uses mint price; during sale, uses sale price

#### Extended Royalty Info

```solidity
function getRoyaltyInfo(uint256 tokenId)
    public view returns (address[] memory receivers, uint256[] memory amounts)
```

-   **All receivers**: Returns complete royalty breakdown
-   **Calculated amounts**: Based on token's sale price (`salePrices[tokenId]`)

#### Configuration

```solidity
function setRoyaltyPercentage(uint96 newRoyaltyPercentage) external onlyRole(OWNER_ROLE)
function setMintRoyalties(KamiNFTCore.RoyaltyData[] calldata royalties) external onlyRole(OWNER_ROLE)
function setTransferRoyalties(KamiNFTCore.RoyaltyData[] calldata royalties) external onlyRole(OWNER_ROLE)
function setTokenTransferRoyalties(uint256 tokenId, KamiNFTCore.RoyaltyData[] calldata royalties) external onlyRole(OWNER_ROLE)
```

**Royalty Distribution:**

-   **Mint**: Platform commission deducted first, remaining amount distributed to mint royalty receivers
-   **Transfer/Sale**: Platform commission (20%) → Royalty (10% of remaining) → Seller (72%)

### 5. Rental System

```solidity
function rentToken(
    uint256 tokenId,
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

-   **Time-based**: Rentals have start and end timestamps
-   **Role assignment**: Automatic `RENTER_ROLE` grant
-   **Transfer blocking**: Rented tokens cannot be transferred
-   **Early termination**: Owner or renter can end rental
-   **Extensions**: Renter can extend with additional payment

### 6. Selling & Transfers

```solidity
function sellToken(address to, uint256 tokenId, address seller) external whenNotPaused
```

-   **Marketplace support**: Seller can be different from caller
-   **Automatic distribution**: Platform commission + transfer royalties
-   **Rental protection**: Cannot sell rented tokens

### 7. Transfer Royalty Enforcement

```solidity
function initiateTransferWithRoyalty(address to, uint256 tokenId, uint256 price) external
function payTransferRoyalty(address seller, uint256 tokenId, uint256 price) external
function isTransferRoyaltyRequired(address from, address to, uint256 tokenId, uint256 price) external view returns (bool)
```

-   **Two-step process**: Initiate, then pay before transfer
-   **Enforced on transfer**: Standard transfers blocked until paid
-   **Flexible pricing**: Price set at initiation time

### 8. Token Metadata

```solidity
function tokenURI(uint256 tokenId) public view returns (string memory)
function setTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyRole(OWNER_ROLE)
function setBaseURI(string memory newBaseTokenURI) external onlyRole(OWNER_ROLE)
```

**Priority:**

1. Individual token URI (if set)
2. Base URI + token ID

### 9. Pricing Management

#### Global Mint Price

```solidity
uint256 public mintPrice;
function setMintPrice(uint256 newMintPrice) external onlyRole(OWNER_ROLE)
```

-   **Global mint/claim price**: Single price for all new mints and claims
-   **Creator controlled**: Only OWNER_ROLE can update
-   **Used for minting/claiming**: All new tokens use this price
-   **Initial sale price**: New tokens' sale price is set to `mintPrice` upon creation

#### Per-Token Sale Price

```solidity
mapping(uint256 => uint256) public salePrices;
function setSalePrice(uint256 tokenId, uint256 newSalePrice) external
```

-   **Per-token sale price**: Each token has independent sale price (settable by token owner)
-   **Owner controlled**: Token owner can set their own sale price
-   **Used for selling**: `sellToken()` uses the token's sale price
-   **Used for royalties**: `royaltyInfo()` and `getRoyaltyInfo()` use sale price
-   **Initialized on mint**: Set to `mintPrice` when token is minted/claimed

#### Backward Compatibility

```solidity
mapping(uint256 => uint256) public tokenPrices;  // Deprecated, use salePrices
function setPrice(uint256 tokenId, uint256 newPrice) external onlyRole(OWNER_ROLE)  // Deprecated
```

-   **`tokenPrices` mapping**: Kept for backward compatibility, synced with `salePrices`
-   **`setPrice()` function**: Deprecated, kept for backward compatibility (OWNER_ROLE only)

### 10. Gasless (EIP-712 Signature) Entrypoints

All user-facing actions that require the caller to be the token owner, renter, buyer, or claimer have a **WithSignature** variant. A relayer (e.g. SimpleAccount) can submit the transaction and pay gas; the contract recovers the signer from an EIP-712 signature and treats that address as the authorized party.

**EIP-712 domain:** `name = "KAMI721AC"`, `version = "1"`, plus `chainId` and `verifyingContract`.

**Replay protection:** Every WithSignature function requires `block.timestamp <= deadline`; the signed struct includes `deadline`.

| Entrypoint | Authorized party | Typed data (struct) |
| ---------- | ----------------- | ------------------- |
| `setSalePriceWithSignature(tokenId, newSalePrice, deadline, signature)` | Token owner | `SetSalePrice(uint256 tokenId, uint256 newSalePrice, uint256 deadline)` |
| `burnWithSignature(tokenId, deadline, signature)` | Token owner | `Burn(uint256 tokenId, uint256 deadline)` |
| `initiateTransferWithRoyaltyWithSignature(to, tokenId, price, deadline, signature)` | Token owner | `InitiateTransferWithRoyalty(address to, uint256 tokenId, uint256 price, uint256 deadline)` |
| `sellTokenWithSignature(to, tokenId, deadline, signature)` | Token owner (seller) | `SellToken(address to, uint256 tokenId, uint256 deadline)` |
| `setTokenURIWithSignature(tokenId, newTokenURI, deadline, signature)` | Token owner | `SetTokenURI(uint256 tokenId, string newTokenURI, uint256 deadline)` |
| `rentTokenWithSignature(tokenId, duration, rentalPrice, renter, deadline, signature)` | Renter (signer must equal `renter`) | `RentToken(uint256 tokenId, uint256 duration, uint256 rentalPrice, address renter, uint256 deadline)` |
| `extendRentalWithSignature(tokenId, additionalDuration, additionalPayment, renter, deadline, signature)` | Current renter | `ExtendRental(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment, address renter, uint256 deadline)` |
| `endRentalWithSignature(tokenId, renter, deadline, signature)` | Current renter | `EndRental(uint256 tokenId, address renter, uint256 deadline)` |
| `payTransferRoyaltyWithSignature(to, tokenId, price, buyer, deadline, signature)` | Buyer (signer must equal `buyer`) | `PayTransferRoyalty(uint256 tokenId, uint256 price, address buyer, uint256 deadline)` |
| `claimWithSignature(claimer, uri, mintRoyalties, deadline, signature)` | Claimer (signer must equal `claimer`) | `Claim(address claimer, string uri, uint256 deadline)` |

**Custom errors:** `SignatureExpired()` when `block.timestamp > deadline`; `InvalidSigner()` when the recovered signer does not match the required role (owner/renter/buyer/claimer).

**Off-chain:** The user signs the EIP-712 typed data (same type names and struct as above). The relayer calls the corresponding `*WithSignature` with the same parameters plus the signature. Payment-token approvals (for claim, rent, extend, payTransferRoyalty) must still be set by the user; only gas is sponsored.

## Access Control

### Roles

-   **OWNER_ROLE**: Full contract administration
-   **PLATFORM_ROLE**: Receives platform commissions
-   **RENTER_ROLE**: Automatically assigned during rentals
-   **DEFAULT_ADMIN_ROLE**: Can grant/revoke roles

### Permission Matrix

| Function                 | Owner | Platform | Public |
| ------------------------ | ----- | -------- | ------ |
| `claim()`                | ✅    | ✅       | ✅     |
| `mint()`                 | ✅    | ✅       | ✅     |
| `batchClaimFor()`        | ✅    | ❌       | ❌     |
| `batchClaim()`           | ✅    | ✅       | ✅     |
| `setTotalSupply()`       | ✅    | ❌       | ❌     |
| `setMintPrice()`         | ✅    | ❌       | ❌     |
| `setSalePrice()`         | ❌    | ❌       | ✅*    |
| `setPrice()` (deprecated)| ✅    | ❌       | ❌     |
| `setTokenURI()`          | ✅    | ❌       | ❌     |
| `setRoyaltyPercentage()` | ✅    | ❌       | ❌     |
| `pause()`                | ✅    | ❌       | ❌     |
| `sellToken()`            | ✅    | ✅       | ✅     |
| `rentToken()`            | ✅    | ✅       | ✅     |

## Events

```solidity
event TokenClaimed(address indexed claimer, uint256 indexed tokenId, uint256 paymentAmount);
event BatchClaimedFor(address indexed owner, address[] recipients, uint256 totalPayment);
event BatchClaimed(address indexed caller, address[] recipients);
event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
event SalePriceUpdated(uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice);
event TokenSold(address indexed seller, address indexed buyer, uint256 indexed tokenId, uint256 price);
event RentalStarted(uint256 indexed tokenId, address indexed renter, uint256 startTime, uint256 endTime, uint256 rentalPrice);
event RentalEnded(uint256 indexed tokenId, address indexed renter, address indexed caller);
event RentalExtended(uint256 indexed tokenId, uint256 newEndTime, uint256 rentalPrice, uint256 additionalPayment);
```

## Error Handling

### Custom Errors

-   `AlreadyClaimed()`: Address attempted second claim
-   `RecipientAlreadyClaimed()`: Batch claim recipient already claimed
-   `TokenSupplyExceeded()`: Maximum supply limit reached
-   `MintPriceNotSet()`: Global mint price is 0 when attempting to mint/claim
-   `SalePriceNotSet()`: Token's sale price is 0 when attempting to sell
-   `InvalidPaymentTokenAddress()`: Zero address for payment token
-   `InvalidPlatformAddress()`: Zero address for platform
-   `PlatformCommissionTooHigh()`: Commission exceeds 20%
-   `CallerNotOwner()`: Unauthorized owner action
-   `CallerNotTokenOwnerOrApproved()`: Unauthorized sale price update
-   `QueryForNonexistentToken()`: Token doesn't exist
-   `EmptyTokenURI()`: URI is empty
-   `ArrayLengthMismatch()`: Array sizes don't match
-   `SignatureExpired()`: EIP-712 signature past deadline (gasless entrypoints)
-   `InvalidSigner()`: Recovered signer does not match required role (gasless entrypoints)

## Payment Flow

### Claim Payment Flow

1. User calls `claim()` with price and URI
2. Payment token transferred from user to contract
3. Platform commission deducted and transferred
4. Remaining amount distributed to mint royalty receivers (if configured)

### Example Distribution (100 USDC mint price, 20% platform, 10% royalty)

**During Mint/Claim:**
```
Total: 100 USDC (from mintPrice)
├── Platform: 20 USDC (20%)
└── Remaining: 80 USDC
    ├── Royalty Receivers: 8 USDC (10% of remaining)
    └── Creator/Contract: 72 USDC
```

**During Sale:**
```
Total: 150 USDC (from salePrices[tokenId], set by token owner)
├── Platform: 30 USDC (20%)
└── Remaining: 120 USDC
    ├── Royalty Receivers: 12 USDC (10% of remaining)
    └── Seller: 108 USDC
```

**Key Points:**
- Mint/claim uses `mintPrice` (creator controlled)
- Sale uses `salePrices[tokenId]` (token owner controlled)
- Token owner can set their own sale price independently

## Gas Optimization

-   **Batch operations**: Reduces gas per token
-   **Library usage**: Shared code reduces contract size
-   **Enumerable**: Efficient token tracking
-   **Custom errors**: Gas-efficient error reporting

## Security Considerations

1. **Reentrancy**: SafeERC20 and checks-effects-interactions pattern
2. **Access Control**: Role-based permissions
3. **Input Validation**: All parameters validated
4. **Pausable**: Emergency stop mechanism
5. **Supply Limits**: Prevents unbounded minting

## Integration Examples

### Basic Claim

```solidity
// First, set the global mint price (owner only)
await kami721ac.setMintPrice(ethers.parseUnits('100', 6));  // 100 USDC

// User claims their token (uses global mint price)
await kami721ac.claim(
    'https://api.kami.com/metadata/1',
    []  // No mint royalties
);
```

### Batch Distribution

```solidity
// Set global mint price first (owner only)
await kami721ac.setMintPrice(ethers.parseUnits('100', 6));  // 100 USDC

// Owner distributes to multiple addresses (all use same mint price)
await kami721ac.batchClaimFor(
    [addr1, addr2, addr3],
    ['uri1', 'uri2', 'uri3'],
    []  // No mint royalties
);
```

### With Supply Limit and Mint Price

```solidity
// Deploy with 1000 token limit and initial mint price
const kami721ac = await KAMI721AC.deploy(
    paymentToken,
    'KAMI Collection',
    'KAMI',
    'https://api.kami.com/metadata/',
    platformAddress,
    2000,  // 20% platform commission
    adminAddress,
    1000,  // Maximum 1000 tokens
    ethers.parseUnits('100', 6)  // Initial mint price: 100 USDC
);

// Later update mint price
await kami721ac.setMintPrice(ethers.parseUnits('150', 6));  // Increase to 150 USDC

// Later increase supply limit
await kami721ac.setTotalSupply(2000);
```

## Upgradeable Version

`KAMI721ACUpgradable` provides identical functionality using the UUPS proxy pattern:

-   Same methods and features
-   Upgradeable implementation
-   Storage gaps for future upgrades
-   See deployment guide for proxy setup

## Additional Resources

-   [API Reference](API_REFERENCE.md)
-   [Deployment Guide](DEPLOYMENT_GUIDE.md)
-   [Examples](EXAMPLES.md)
-   [Security Audit](SECURITY_AUDIT.md)
