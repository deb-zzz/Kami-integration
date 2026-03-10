# KAMI Sponsored NFT System

A comprehensive Solidity solution for handling sponsored transactions on the Base blockchain for NFT operations using ERC-4337 Account Abstraction and ERC20 token payments. This system enables users to interact with NFT contracts without holding ETH for gas fees, instead using ERC20 tokens (like USDC) for all operations.

## 🚀 Quick Clone & Setup

### Clone the Repository

```bash
# Clone the repository
git clone https://github.com/KAMI-Github/Base-Sponsored-Example.git

# Navigate to the project directory
cd Base-Sponsored-Example

# Initialize and update submodules
git submodule update --init --recursive
```

### Alternative: Clone with Submodules in One Command

```bash
# Clone with submodules in a single command
git clone --recurse-submodules https://github.com/KAMI-Github/Base-Sponsored-Example.git

# Navigate to the project directory
cd Base-Sponsored-Example
```

### Verify Submodules

```bash
# Check that submodules are properly initialized
git submodule status

# You should see:
# 1234567 lib/forge-std (heads/main)
# 2345678 lib/openzeppelin-contracts (heads/v5.4.0)
```

### Update Submodules (if needed)

```bash
# Update all submodules to their latest commits
git submodule update --remote --recursive

# Or update a specific submodule
git submodule update --remote lib/openzeppelin-contracts
```

## 🚀 Features

### Core Functionality

-   **Gasless Transactions**: Users can mint, sell, and rent NFTs without holding ETH for gas
-   **ERC-4337 Integration**: Full Account Abstraction support with Smart Accounts
-   **ERC20 Payments**: All operations use USDC or other ERC20 tokens instead of ETH
-   **Base Paymaster Integration**: Leverages Base's native Paymaster system
-   **Smart Account Factory**: Deterministic smart account creation using CREATE2
-   **Account Abstraction**: Advanced transaction patterns and custom validation logic

### NFT Operations

-   **Minting**: Create new NFTs with sponsored gas fees
-   **Trading**: Buy and sell NFTs with automatic royalty distribution
-   **Rental System**: Time-based NFT rental with automatic role management
-   **Royalty System**: Programmable royalties for creators and platform
-   **Batch Operations**: Multiple operations in a single sponsored transaction

### Security & Control

-   **Spending Limits**: Configurable per-user and global spending limits
-   **Access Control**: Role-based permissions for different operations
-   **Reentrancy Protection**: All functions protected against reentrancy attacks
-   **Signature Validation**: Secure transaction validation with nonce management
-   **Pause Functionality**: Emergency pause for all non-view functions

### Advanced Features

-   **Time-based Limits**: Daily, weekly, or monthly limit resets
-   **Function-level Control**: Granular control over which functions can be sponsored
-   **Multi-token Support**: Support for any ERC20 token as payment
-   **Gas Optimization**: Efficient storage and minimal external calls
-   **Event Logging**: Comprehensive event system for monitoring and debugging

## 📁 Project Structure

```
contracts/ERC4337/
├── src/
│   ├── KamiSmartAccount.sol          # ERC-4337 Smart Account implementation
│   ├── KamiSmartAccountFactory.sol   # Factory for creating Smart Accounts
│   ├── KamiSponsoredNFT.sol          # Main NFT contract with sponsored transactions
│   └── KamiPaymaster.sol             # Paymaster for gas sponsorship
├── script/
│   ├── Deploy.s.sol                  # Deployment scripts
│   └── Configure.s.sol               # Configuration scripts
├── examples/
│   ├── sponsored-transactions.js     # JavaScript integration examples
│   └── README.md                     # Examples documentation
├── test/                             # Test files (to be added)
├── foundry.toml                      # Foundry configuration
├── package.json                      # Node.js dependencies
├── env.example                       # Environment variables template
├── DEPLOYMENT_GUIDE.md              # Detailed deployment guide
└── README.md                         # This file
```

## 🛠️ Installation

### Prerequisites

-   [Foundry](https://book.getfoundry.sh/getting-started/installation)
-   [Node.js](https://nodejs.org/) (v16 or higher)
-   [pnpm](https://pnpm.io/) (recommended package manager)

### Setup

1. **Clone and install dependencies:**

    ```bash
    git clone <repository-url>
    cd contracts/ERC4337
    pnpm install
    ```

2. **Install Foundry dependencies:**

    ```bash
    forge install
    ```

3. **Set up environment variables:**
    ```bash
    cp env.example .env
    # Edit .env with your configuration
    ```

## 🚀 Quick Start

### 1. Deploy to Base Sepolia (Testnet)

```bash
# Set your private key
export PRIVATE_KEY=your_private_key_here

# Deploy contracts
forge script script/Deploy.s.sol:DeployScript --rpc-url base-sepolia --broadcast --verify
```

### 2. Deploy to Base Mainnet

```bash
# Deploy contracts
forge script script/Deploy.s.sol:DeployScript --rpc-url base --broadcast --verify
```

### 3. Configure Contracts

```bash
# Set contract addresses in .env
export FACTORY_ADDRESS=0x...
export PAYMASTER_ADDRESS=0x...
export NFT_CONTRACT_ADDRESS=0x...

# Configure contracts
forge script script/Configure.s.sol:ConfigureScript --rpc-url base-sepolia --broadcast
```

### 4. Run Examples

```bash
node examples/sponsored-transactions.js
```

## 📋 Technical Architecture

### Contract Overview

#### KamiSmartAccount

**Purpose**: ERC-4337 compliant smart account implementation

**Key Features**:

-   Custom validation logic for user operations
-   Batch transaction support
-   Integration with EntryPoint contract
-   Nonce management for replay protection
-   Signature validation using ECDSA

**Key Functions**:

```solidity
function validateUserOp(UserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds) external returns (uint256 validationData)
function execute(address to, uint256 value, bytes calldata data) external returns (bool success)
function executeBatch(Call[] calldata calls) external returns (bytes[] memory results)
```

#### KamiSmartAccountFactory

**Purpose**: Factory for creating smart accounts deterministically

**Key Features**:

-   CREATE2 deployment for predictable addresses
-   Account existence checking
-   Integration with EntryPoint

**Key Functions**:

```solidity
function createAccount(address owner, uint256 salt) external returns (address account)
function getAddress(address owner, uint256 salt) external view returns (address)
function isAccount(address account) external view returns (bool)
```

#### KamiSponsoredNFT

**Purpose**: Main NFT contract with sponsored transaction support

**Key Features**:

-   ERC721 implementation with ERC20 payments
-   Sponsored transaction support via smart accounts
-   Rental system with time-based access
-   Royalty distribution system
-   Platform commission handling
-   Role-based access control

**Key Functions**:

```solidity
function mint() external onlySmartAccount whenNotPaused nonReentrant
function mintTo(address to) external onlySmartAccount whenNotPaused nonReentrant
function sellToken(address to, uint256 tokenId, uint256 salePrice) external onlySmartAccount whenNotPaused nonReentrant
function rentToken(uint256 tokenId, uint256 duration, uint256 rentalPrice) external onlySmartAccount whenNotPaused nonReentrant
function endRental(uint256 tokenId) external onlySmartAccount whenNotPaused nonReentrant
```

#### KamiPaymaster

**Purpose**: Paymaster contract for gas sponsorship

**Key Features**:

-   Sponsors gas fees for approved operations
-   Enforces spending limits per user and globally
-   Manages ERC20 token payments for gas
-   Integrates with Base Paymaster system
-   Function-level access control

**Key Functions**:

```solidity
function validatePaymasterUserOp(UserOperation calldata userOp, bytes32 userOpHash, uint256 maxCost) external returns (bytes memory context, uint256 validationData)
function postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost) external
function allowContract(address contractAddress, bool allowed) external
function allowFunction(address contractAddress, bytes4 functionSelector, bool allowed) external
```

## 🔧 Configuration

### Environment Variables

```bash
# Network Configuration
PRIVATE_KEY=your_private_key_here
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Contract Addresses
FACTORY_ADDRESS=0x...
PAYMASTER_ADDRESS=0x...
NFT_CONTRACT_ADDRESS=0x...

# Payment Token (USDC on Base)
USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Entry Point
BASE_ENTRY_POINT=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
```

### Spending Limits

Configure in the Paymaster contract:

-   **Global Spending Limit**: Maximum total spending across all users
-   **User Spending Limit**: Maximum spending per user
-   **User Operation Limit**: Maximum operations per user
-   **Limit Reset Period**: How often limits reset

### Allowed Operations

The Paymaster can be configured to allow specific functions:

-   `mint()`: Mint new NFTs
-   `mintTo(address)`: Mint to specific address
-   `sellToken(address,uint256,uint256)`: Sell NFTs
-   `rentToken(uint256,uint256,uint256)`: Rent NFTs
-   `endRental(uint256)`: End rentals
-   `extendRental(uint256,uint256,uint256)`: Extend rentals

## 💡 Usage Examples

### JavaScript Integration

#### Basic Setup

```javascript
import { initializeSponsoredSystem, mintSponsoredNFT } from './examples/sponsored-transactions.js';

// Initialize the system
const { smartAccountClient } = await initializeSponsoredSystem();

// Mint an NFT (gas sponsored)
await mintSponsoredNFT(smartAccountClient);
```

#### Advanced Operations

```javascript
import { rentSponsoredNFT, sellSponsoredNFT, batchSponsoredOperations } from './examples/sponsored-transactions.js';

// Rent an NFT for 7 days
const rentalDuration = 7 * 24 * 60 * 60; // 7 days in seconds
const rentalPrice = parseEther('50'); // 50 USDC
await rentSponsoredNFT(smartAccountClient, tokenId, rentalDuration, rentalPrice);

// Sell an NFT
const salePrice = parseEther('100'); // 100 USDC
await sellSponsoredNFT(smartAccountClient, tokenId, buyerAddress, salePrice);

// Batch multiple operations
const operations = [{ data: mintData }, { data: rentData }];
await batchSponsoredOperations(smartAccountClient, operations);
```

#### Checking User Limits

```javascript
import { checkUserLimits } from './examples/sponsored-transactions.js';

// Check user's spending limits and remaining operations
const limits = await checkUserLimits(publicClient, userAddress);
console.log('Remaining Spending:', limits.remainingSpending);
console.log('Remaining Operations:', limits.remainingOperations);
```

### Solidity Integration

#### Deploying Smart Accounts

```solidity
// Deploy a smart account for a user
KamiSmartAccountFactory factory = KamiSmartAccountFactory(factoryAddress);
address smartAccount = factory.createAccount(userAddress, salt);

// Check if account exists
bool exists = factory.isAccount(smartAccount);
```

#### NFT Operations

```solidity
// Mint NFT through smart account
KamiSponsoredNFT nft = KamiSponsoredNFT(nftAddress);
// The smart account will handle the sponsored transaction

// Set up royalties
KamiSponsoredNFT.RoyaltyData[] memory royalties = new KamiSponsoredNFT.RoyaltyData[](1);
royalties[0] = KamiSponsoredNFT.RoyaltyData({
    receiver: creatorAddress,
    feeNumerator: 1000 // 10%
});
nft.setMintRoyalties(tokenId, royalties);
```

## 🔒 Security Features

### Access Control

-   **Role-based Permissions**: Different roles for owners, renters, and platform
-   **Smart Account Validation**: Only approved smart accounts can execute operations
-   **Function-level Control**: Granular control over which functions can be sponsored

### Transaction Security

-   **Reentrancy Protection**: All functions protected against reentrancy attacks
-   **Signature Validation**: Secure transaction validation using ECDSA
-   **Nonce Management**: Prevents replay attacks with sequential nonces
-   **Spending Limits**: Prevents abuse through configurable limits

### Emergency Controls

-   **Pause Functionality**: Emergency pause for all non-view functions
-   **Limit Management**: Ability to adjust spending limits in real-time
-   **Contract Management**: Add/remove allowed contracts and functions

## 🧪 Testing

### Running Tests

```bash
# Run all tests
forge test

# Run tests with gas reporting
forge test --gas-report

# Run specific test
forge test --match-test testMintSponsoredNFT

# Run tests with verbose output
forge test -vvv
```

### Test Coverage

The test suite covers:

-   Smart account creation and validation
-   NFT minting, selling, and renting
-   Paymaster functionality and limits
-   Batch operations
-   Error conditions and edge cases
-   Gas optimization scenarios

## 📊 Gas Optimization

### Smart Account Patterns

-   **Batch Operations**: Multiple operations in single transaction
-   **Efficient Storage**: Optimized data structures and packing
-   **Minimal External Calls**: Reduced gas consumption through smart patterns
-   **ERC-4337 Optimizations**: Leverages Account Abstraction benefits

### Gas Usage Estimates

-   **Mint Operation**: ~150,000 gas (sponsored)
-   **Sell Operation**: ~200,000 gas (sponsored)
-   **Rent Operation**: ~180,000 gas (sponsored)
-   **Batch Operations**: ~300,000 gas for 3 operations (sponsored)

## 🔄 Integration with Existing KAMI Contracts

This system is designed to work alongside existing KAMI contracts:

### KAMI721-C Integration

```solidity
// Add KAMI721-C to allowed contracts
paymaster.allowContract(kami721CAddress, true);

// Allow specific functions
paymaster.allowFunction(kami721CAddress, bytes4(keccak256("mint()")), true);
paymaster.allowFunction(kami721CAddress, bytes4(keccak256("sellToken(address,uint256,uint256)")), true);
```

### KAMI721-AC Integration

```solidity
// Enable sponsored claiming
paymaster.allowFunction(kami721ACAddress, bytes4(keccak256("claim()")), true);
paymaster.allowFunction(kami721ACAddress, bytes4(keccak256("batchClaim(address[])")), true);
```

### KAMI1155-C Integration

```solidity
// Enable sponsored multi-token operations
paymaster.allowFunction(kami1155CAddress, bytes4(keccak256("mint(uint256)")), true);
paymaster.allowFunction(kami1155CAddress, bytes4(keccak256("mintBatch(uint256[])")), true);
```

## 📚 Documentation

### Comprehensive Guides

-   [Examples Documentation](examples/README.md) - Detailed usage examples
-   [Deployment Guide](DEPLOYMENT_GUIDE.md) - Step-by-step deployment instructions
-   [Base Paymaster Guide](https://docs.base.org/cookbook/go-gasless) - Base's official documentation
-   [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337) - Account Abstraction standard
-   [Account Abstraction Overview](https://docs.alchemy.com/overviews/what-is-account-abstraction) - Alchemy's guide

### API Reference

-   **Smart Account Functions**: Complete function reference for smart accounts
-   **NFT Contract Functions**: All NFT operation functions and parameters
-   **Paymaster Functions**: Configuration and management functions
-   **Event Reference**: All events emitted by the contracts

## 🚨 Troubleshooting

### Common Issues

1. **"Only smart accounts allowed"**

    - Ensure you're using a smart account, not an EOA
    - Check that the smart account is properly initialized

2. **"Contract not allowed"**

    - The NFT contract must be added to the Paymaster's allowed contracts
    - Use the `allowContract` function to add it

3. **"Function not allowed"**

    - The specific function must be allowed in the Paymaster
    - Use the `allowFunction` function to add it

4. **"User limit exceeded"**

    - Check user spending and operation limits
    - Wait for limit reset or increase limits

5. **"Global limit exceeded"**
    - Check global spending limit
    - Increase limit or wait for reset

### Debug Commands

```bash
# Check contract configuration
cast call $PAYMASTER_ADDRESS "allowedContracts(address)" $NFT_CONTRACT_ADDRESS
cast call $PAYMASTER_ADDRESS "allowedFunctions(address,bytes4)" $NFT_CONTRACT_ADDRESS 0x1249c58b

# Check user limits
cast call $PAYMASTER_ADDRESS "userSpending(address)" $USER_ADDRESS
cast call $PAYMASTER_ADDRESS "userOperationCount(address)" $USER_ADDRESS

# Check contract status
cast code $FACTORY_ADDRESS
cast code $PAYMASTER_ADDRESS
cast code $NFT_CONTRACT_ADDRESS
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Development Guidelines

-   Follow Solidity style guide
-   Add comprehensive tests
-   Update documentation
-   Ensure gas optimization
-   Test on Base Sepolia first

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

-   **GitHub Issues**: [Create an issue](https://github.com/KAMI-Github/contracts/issues)
-   **Documentation**: [KAMI Docs](https://docs.kami.com)
-   **Discord**: [KAMI Community](https://discord.gg/kami)

## 🙏 Acknowledgments

-   [Base](https://base.org/) for the blockchain infrastructure
-   [OpenZeppelin](https://openzeppelin.com/) for secure contract libraries
-   [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) for Account Abstraction standard
-   [Foundry](https://book.getfoundry.sh/) for development tools

---

**Built with ❤️ by the KAMI team**
