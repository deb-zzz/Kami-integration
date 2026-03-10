# API Reference

## Contract Interfaces

### KAMI721C

#### Constructor

```solidity
constructor(
    address paymentToken_,
    string memory name_,
    string memory symbol_,
    string memory baseTokenURI_,
    address platformAddress_,
    uint96 platformCommissionPercentage_,
    address adminAddress_
)
```

#### Core Functions

##### Minting

```solidity
function mint(address recipient, uint256 tokenPrice, string calldata uri, KamiNFTCore.RoyaltyData[] calldata mintRoyalties) external whenNotPaused
```

-   **Purpose**: Mint a new token to a specific recipient
-   **Parameters**:
    -   `recipient`: Address to receive the minted token
    -   `tokenPrice`: Price for this specific token (can be 0 for free minting)
    -   `uri`: Token metadata URI
    -   `mintRoyalties`: Array of royalty recipients for mint royalties
-   **Requirements**:
    -   Contract not paused
    -   Sufficient payment token balance and allowance (if tokenPrice > 0)
    -   `recipient != address(0)`
    -   `uri` not empty

```solidity
function mintFor(address recipient, uint256 tokenPrice, string calldata uri, KamiNFTCore.RoyaltyData[] calldata mintRoyalties) external whenNotPaused
```

-   **Purpose**: Mint a token for a specific recipient (alternative interface)
-   **Parameters**: Same as `mint()`
-   **Requirements**: Same as `mint()`

##### Selling

```solidity
function sellToken(address to, uint256 tokenId, address seller) external whenNotPaused
```

-   **Purpose**: Sell a token to a buyer
-   **Parameters**:
    -   `to`: Buyer address
    -   `tokenId`: Token ID to sell
    -   `seller`: Address of the token owner
-   **Requirements**:
    -   Contract not paused
    -   Token exists
    -   `seller` is the token owner
    -   `to != address(0)`
    -   `seller != address(0)`
    -   Token price is set

##### Renting

```solidity
function rentToken(
    uint256 tokenId,
    uint256 duration,
    uint256 rentalPrice,
    address renter
) external whenNotPaused
```

-   **Purpose**: Rent a token for a specific duration
-   **Parameters**:
    -   `tokenId`: Token ID to rent
    -   `duration`: Rental duration in seconds
    -   `rentalPrice`: Total rental price
    -   `renter`: Address that will receive rental access
-   **Requirements**:
    -   Contract not paused
    -   Token exists
    -   `renter != address(0)`
    -   Token owner is not the renter
    -   Token not already rented

##### Price Management

```solidity
function setPrice(uint256 tokenId, uint256 newPrice) external onlyRole(OWNER_ROLE)
```

-   **Purpose**: Set the price for a specific token
-   **Parameters**:
    -   `tokenId`: Token ID to update
    -   `newPrice`: New price for the token
-   **Requirements**: Caller has OWNER_ROLE

```solidity
function tokenPrices(uint256 tokenId) external view returns (uint256)
```

-   **Purpose**: Get the price of a specific token
-   **Returns**: Token price

##### Royalty Management

```solidity
function setRoyaltyPercentage(uint256 percentage) external onlyRole(OWNER_ROLE)
```

-   **Purpose**: Set global royalty percentage
-   **Parameters**: `percentage` in basis points (100 = 1%)

```solidity
function setMintRoyalty(uint256 tokenId, uint256 percentage) external onlyRole(OWNER_ROLE)
```

-   **Purpose**: Set mint royalty for specific token
-   **Parameters**:
    -   `tokenId`: Token ID
    -   `percentage`: Royalty percentage in basis points

```solidity
function setTransferRoyalty(uint256 tokenId, uint256 percentage) external onlyRole(OWNER_ROLE)
```

-   **Purpose**: Set transfer royalty for specific token
-   **Parameters**:
    -   `tokenId`: Token ID
    -   `percentage`: Royalty percentage in basis points

##### Rental Management

```solidity
function endRental(uint256 tokenId) external whenNotPaused
```

-   **Purpose**: End a rental early
-   **Parameters**: `tokenId` to end rental for
-   **Requirements**: Contract not paused

```solidity
function isTokenRented(uint256 tokenId) external view returns (bool)
```

-   **Purpose**: Check if token is currently rented
-   **Returns**: `true` if rented, `false` otherwise

```solidity
function getRentalInfo(uint256 tokenId) external view returns (Rental memory)
```

-   **Purpose**: Get rental information for a token
-   **Returns**: Rental struct with start time, end time, and renter

### KAMI1155C

#### Constructor

```solidity
constructor(
    string memory uri_,
    address paymentToken_,
    uint256 initialMintPrice_,
    address platformAddress_,
    uint256 platformCommissionPercentage_,
    address owner_
)
```

#### Core Functions

##### Minting

```solidity
function mint(address recipient, uint256 amount, uint256 tokenPrice) external whenNotPaused
```

-   **Purpose**: Mint tokens to a specific recipient
-   **Parameters**:
    -   `recipient`: Address to receive tokens
    -   `amount`: Number of tokens to mint
    -   `tokenPrice`: Price per token
-   **Requirements**: Same as ERC721 minting

```solidity
function mintBatch(
    address[] memory recipients,
    uint256[] memory amounts,
    uint256[] memory prices
) external whenNotPaused
```

-   **Purpose**: Batch mint tokens to multiple recipients
-   **Parameters**:
    -   `recipients`: Array of recipient addresses
    -   `amounts`: Array of amounts per recipient
    -   `prices`: Array of prices per token
-   **Requirements**: Arrays have same length, all values > 0

##### Selling

```solidity
function sellToken(
    address to,
    uint256 tokenId,
    uint256 amount,
    address seller
) external whenNotPaused
```

-   **Purpose**: Sell tokens to a buyer
-   **Parameters**:
    -   `to`: Buyer address
    -   `tokenId`: Token ID to sell
    -   `amount`: Number of tokens to sell
    -   `seller`: Address of the token owner
-   **Requirements**: Same as ERC721 selling

##### Renting

```solidity
function rentToken(
    uint256 tokenId,
    uint256 duration,
    uint256 rentalPrice,
    address renter,
    address tokenOwner
) external whenNotPaused
```

-   **Purpose**: Rent tokens for a specific duration
-   **Parameters**:
    -   `tokenId`: Token ID to rent
    -   `duration`: Rental duration in seconds
    -   `rentalPrice`: Total rental price
    -   `renter`: Address that will receive rental access
    -   `tokenOwner`: Address that owns the tokens
-   **Requirements**: Same as ERC721 renting

### KAMI721AC (Allowlist/Claim)

#### Constructor

```solidity
constructor(
    address paymentToken_,
    string memory name_,
    string memory symbol_,
    string memory baseTokenURI_,
    address platformAddress_,
    uint96 platformCommissionPercentage_,
    address adminAddress_,
    uint256 totalSupply_,
    uint256 mintPrice_
)
```

-   **Purpose**: Deploy KAMI721AC contract
-   **Parameters**:
    -   `paymentToken_`: ERC20 payment token address
    -   `name_`: Token collection name
    -   `symbol_`: Token collection symbol
    -   `baseTokenURI_`: Base URI for token metadata
    -   `platformAddress_`: Platform commission recipient
    -   `platformCommissionPercentage_`: Platform fee in basis points (max 2000 = 20%)
    -   `adminAddress_`: Admin/owner address
    -   `totalSupply_`: Optional total supply limit (0 = unlimited)
    -   `mintPrice_`: Optional initial global mint/claim price (0 = disabled until set)

#### Core Functions

##### Claiming

```solidity
function claim(
    string calldata uri,
    KamiNFTCore.RoyaltyData[] calldata mintRoyalties
) external
```

-   **Purpose**: Claim a single token (one per address)
-   **Parameters**:
    -   `uri`: Token metadata URI
    -   `mintRoyalties`: Array of mint royalty receivers
-   **Requirements**:
    -   Address hasn't claimed before
    -   Global `mintPrice` must be set (not 0)
    -   Sufficient payment token balance and allowance
-   **Payment**: Uses global `mintPrice` for payment
-   **Sale Price**: Token's sale price is initialized to `mintPrice`

```solidity
function batchClaimFor(
    address[] calldata recipients,
    string[] calldata uris,
    KamiNFTCore.RoyaltyData[] calldata mintRoyalties
) external onlyRole(OWNER_ROLE)
```

-   **Purpose**: Owner claims tokens for multiple recipients (owner pays)
-   **Parameters**:
    -   `recipients`: Array of recipient addresses
    -   `uris`: Array of token URIs
    -   `mintRoyalties`: Array of mint royalty receivers
-   **Requirements**: Caller has OWNER_ROLE, global `mintPrice` must be set
-   **Payment**: Owner pays `mintPrice * recipients.length`

```solidity
function batchClaim(
    address[] calldata recipients,
    string[] calldata uris,
    KamiNFTCore.RoyaltyData[] calldata mintRoyalties
) external
```

-   **Purpose**: Recipients claim tokens for themselves (each pays)
-   **Parameters**: Same as `batchClaimFor`
-   **Requirements**: Global `mintPrice` must be set
-   **Payment**: Each recipient pays `mintPrice`

##### Minting

```solidity
function mint(
    address recipient,
    string calldata uri,
    KamiNFTCore.RoyaltyData[] calldata mintRoyalties
) external whenNotPaused
```

-   **Purpose**: Mint a token (compatibility function)
-   **Parameters**:
    -   `recipient`: Address to receive token
    -   `uri`: Token metadata URI
    -   `mintRoyalties`: Array of mint royalty receivers
-   **Requirements**: Global `mintPrice` must be set, contract not paused
-   **Payment**: Uses global `mintPrice` for payment

##### Price Management

```solidity
function setMintPrice(uint256 newMintPrice) external onlyRole(OWNER_ROLE)
```

-   **Purpose**: Set global mint/claim price
-   **Parameters**: `newMintPrice`: New mint price in payment token units
-   **Requirements**: Caller has OWNER_ROLE
-   **Effect**: Updates price for all future mints/claims

```solidity
function setSalePrice(uint256 tokenId, uint256 newSalePrice) external
```

-   **Purpose**: Set sale price for a specific token
-   **Parameters**:
    -   `tokenId`: Token ID
    -   `newSalePrice`: New sale price in payment token units
-   **Requirements**: Caller must be token owner
-   **Effect**: Updates token's sale price (used for selling)

```solidity
function mintPrice() external view returns (uint256)
function salePrices(uint256 tokenId) external view returns (uint256)
```

-   **Purpose**: Get mint price or token sale price
-   **Returns**: Current mint price or token's sale price

## Events

### Minting Events

```solidity
event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 amount, uint256 price);
```

### Selling Events

```solidity
event TokenSold(address indexed seller, address indexed buyer, uint256 indexed tokenId, uint256 amount, uint256 price);
```

### Rental Events

```solidity
event TokenRented(
    address indexed renter,
    address indexed owner,
    uint256 indexed tokenId,
    uint256 startTime,
    uint256 endTime,
    uint256 price
);
```

### Royalty Events

```solidity
event RoyaltySet(uint256 indexed tokenId, uint256 percentage);
event MintRoyaltySet(uint256 indexed tokenId, uint256 percentage);
event TransferRoyaltySet(uint256 indexed tokenId, uint256 percentage);
```

### Price Management Events

```solidity
event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
event SalePriceUpdated(uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice);
```

-   **MintPriceUpdated**: Emitted when global mint price is updated (OWNER_ROLE only)
-   **SalePriceUpdated**: Emitted when a token's sale price is updated (token owner only)

## Data Structures

### Rental

```solidity
struct Rental {
    address renter;
    uint256 startTime;
    uint256 endTime;
    uint256 price;
}
```

### RoyaltyInfo

```solidity
struct RoyaltyInfo {
    address receiver;
    uint256 royaltyAmount;
}
```

## Error Messages

### Common Errors

-   `"Recipient cannot be zero address"`
-   `"Price must be greater than 0"`
-   `"Token does not exist"`
-   `"Seller is not token owner"`
-   `"Owner cannot rent their own token"`
-   `"Token is already rented"`
-   `"Insufficient token balance"`
-   `"Contract is paused"`

### Access Control Errors

-   `"Caller is not an owner"`
-   `"Caller is not a platform"`
-   `"Caller is not a renter"`
-   `"Caller is not an upgrader"`

### Validation Errors

-   `"Amount must be greater than 0"`
-   `"Duration must be greater than 0"`
-   `"Arrays must have same length"`
-   `"Token price not set"` (deprecated)
-   `"Mint price not set"`: Global mint price is 0 when attempting to mint/claim
-   `"Sale price not set"`: Token's sale price is 0 when attempting to sell

## Gas Estimates

### ERC721 Operations

-   `mint()`: ~180,000 gas
-   `sellToken()`: ~120,000 gas
-   `rentToken()`: ~150,000 gas
-   `setPrice()`: ~50,000 gas

### ERC1155 Operations

-   `mint()`: ~200,000 gas
-   `mintBatch()`: ~150,000 gas per token
-   `sellToken()`: ~140,000 gas
-   `rentToken()`: ~160,000 gas

### Batch Operations

-   `mintBatch()`: More efficient than multiple individual mints
-   `burnBatch()`: Efficient cleanup of multiple tokens
-   `batchClaim()`: Efficient for multiple claims

## Integration Examples

### Web3 Integration

```javascript
// Connect to contract
const contract = new ethers.Contract(address, abi, signer);

// Mint token
const tx = await contract.mint(recipient, ethers.parseUnits('100', 6));
await tx.wait();

// Sell token
const sellTx = await contract.sellToken(buyer, tokenId, seller);
await sellTx.wait();

// Rent token
const rentTx = await contract.rentToken(
	tokenId,
	86400, // 1 day
	ethers.parseUnits('10', 6), // 10 USDC
	renter
);
await rentTx.wait();
```

### React Integration

```jsx
import { useContract, useContractWrite } from 'wagmi';

function MintButton({ recipient, price }) {
	const { write: mint } = useContractWrite({
		address: contractAddress,
		abi: contractABI,
		functionName: 'mint',
		args: [recipient, price],
	});

	return <button onClick={() => mint()}>Mint Token</button>;
}
```
