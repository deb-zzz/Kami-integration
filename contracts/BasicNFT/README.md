# BasicNFT - ERC721 with ERC20 Payment Integration

A Solidity smart contract implementation of an NFT collection that accepts ERC20 tokens as payment for minting. The contract allows users to mint NFTs by paying with a specified ERC20 token.

## Features

-   **ERC721 NFT Standard**: Full compliance with the ERC721 standard for non-fungible tokens
-   **ERC20 Payment Integration**: Accepts any ERC20 token as payment for minting
-   **Flexible Token Configuration**: Payment token address and decimals are set during contract initialization
-   **Two Minting Options**:
    -   `mint(tokenURI, tokenId)`: Mint with a specific token ID
    -   `mintWithAutoId(tokenURI)`: Mint with auto-incrementing token ID
-   **Owner Controls**: Contract owner can update payment token and mint price
-   **Reentrancy Protection**: Uses OpenZeppelin's ReentrancyGuard for security
-   **URI Storage**: Supports token metadata via URI storage extension

## Contract Architecture

### PaymentToken.sol

A simple ERC20 token contract used for testing and demonstration purposes.

**Key Features:**

-   Standard ERC20 implementation
-   Configurable decimals
-   Owner-only minting and burning functions
-   Initial supply minted to deployer

### BasicNFT.sol

The main NFT contract that integrates ERC20 payment functionality.

**Key Features:**

-   Inherits from ERC721 and ERC721URIStorage
-   Configurable payment token (address and decimals)
-   Configurable mint price
-   Payment validation and transfer
-   Owner-only administrative functions

## Installation

1. Install dependencies using pnpm:

```bash
pnpm install
```

2. Compile the contracts:

```bash
pnpm run compile
```

## Metadata Templates

The project includes metadata templates in the `metadata/` directory:

-   **`template.json`** - Basic template with common metadata fields
-   **`example-1.json`** - KAMI Warrior example with animation support
-   **`example-2.json`** - KAMI Mage example with detailed attributes
-   **`example-3.json`** - KAMI Guardian example with defensive traits

These templates follow OpenSea metadata standards and can be customized for your NFT collection. See `metadata/README.md` for detailed usage instructions.

## Deployment

Deploy the contracts to a local Hardhat network:

```bash
pnpm run deploy:local
```

Or deploy to the default Hardhat network:

```bash
pnpm run deploy
```

The deployment script will:

1. Deploy a PaymentToken contract (KAMI token)
2. Deploy the BasicNFT contract with the payment token configuration
3. Save deployment addresses to `deployment.json`

## Usage

### For Users

1. **Get Payment Tokens**: Users need to have the payment token (KAMI) in their wallet
2. **Approve Spending**: Users must approve the NFT contract to spend their payment tokens:
    ```javascript
    await paymentToken.approve(nftContractAddress, mintPrice);
    ```
3. **Mint NFT**: Call the mint function with token URI and ID:
    ```javascript
    await basicNFT.mint('https://example.com/metadata/1', 1);
    ```
    Or use auto-incrementing ID:
    ```javascript
    await basicNFT.mintWithAutoId('https://example.com/metadata/1');
    ```

### For Contract Owner

**Update Payment Token:**

```javascript
await basicNFT.updatePaymentToken(newTokenAddress, newDecimals);
```

**Update Mint Price:**

```javascript
await basicNFT.updateMintPrice(newPrice);
```

## Contract Functions

### Public Functions

-   `mint(string tokenURI, uint256 tokenId)`: Mint NFT with specific ID
-   `mintWithAutoId(string tokenURI)`: Mint NFT with auto-incrementing ID
-   `getNextTokenId()`: Get the next token ID that will be minted
-   `tokenExists(uint256 tokenId)`: Check if a token ID exists

### Owner-Only Functions

-   `updatePaymentToken(address newPaymentToken, uint8 newDecimals)`: Update payment token
-   `updateMintPrice(uint256 newMintPrice)`: Update mint price

### View Functions

-   `paymentToken()`: Get payment token address
-   `paymentTokenDecimals()`: Get payment token decimals
-   `mintPrice()`: Get current mint price
-   `tokenURI(uint256 tokenId)`: Get token metadata URI

## Events

-   `NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint256 price)`: Emitted when an NFT is minted
-   `PaymentTokenUpdated(address indexed oldToken, address indexed newToken)`: Emitted when payment token is updated
-   `MintPriceUpdated(uint256 oldPrice, uint256 newPrice)`: Emitted when mint price is updated

## Security Features

-   **ReentrancyGuard**: Prevents reentrancy attacks during minting
-   **Input Validation**: Validates token IDs, URIs, and payment amounts
-   **Access Control**: Owner-only functions for administrative tasks
-   **Safe Transfers**: Uses OpenZeppelin's safe transfer functions

## Testing

Run the test suite:

```bash
pnpm run test
```

## Interaction Example

Run the interaction script to see the contracts in action:

```bash
pnpm run interact
```

This script demonstrates:

-   Contract deployment
-   Token transfers
-   NFT minting with specific IDs
-   NFT minting with auto-incrementing IDs
-   Balance checking
-   Ownership verification

## Configuration

The contracts are configured with the following default values:

-   **Payment Token**: KAMI (18 decimals)
-   **Initial Supply**: 1,000,000 KAMI tokens
-   **Mint Price**: 10 KAMI tokens per NFT
-   **NFT Collection**: "KAMI NFT Collection" (KAMINFT)

## Network Support

The contracts are configured to work with:

-   Hardhat local network
-   Any EVM-compatible network (Ethereum, Polygon, BSC, etc.)

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Support

For questions or issues, please open an issue in the repository.
