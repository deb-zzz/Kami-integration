# KAMI721-C Examples

This folder contains TypeScript examples demonstrating how to interact with the KAMI721C smart contract. Each example is self-contained and shows different aspects of the contract functionality.

## 📁 Examples Overview

### 🚀 `deploy.ts` - Contract Deployment

Demonstrates how to deploy the KAMI721C contract with proper configuration:

-   Deploy MockERC20 payment token
-   Deploy KAMI721C with initial parameters
-   Set up royalty configuration
-   Configure mint and transfer royalties
-   Verify deployment

**Key Features:**

-   Platform commission setup
-   Royalty percentage configuration
-   Multiple royalty receivers
-   Base URI configuration

### 🎨 `mint.ts` - NFT Minting

Shows how to mint NFTs with payment token approval:

-   Set up payment tokens for minter
-   Approve tokens for minting
-   Mint NFT and get token ID
-   Verify ownership and token URI
-   Check royalty distribution

**Key Features:**

-   Payment token approval workflow
-   Mint price verification
-   Royalty calculation
-   Balance tracking

### 🛒 `buy.ts` - NFT Buying/Selling

Demonstrates the complete buy/sell process:

-   Mint NFT to seller
-   List NFT for sale
-   Buyer purchases NFT
-   Royalty and commission distribution
-   Rental system testing

**Key Features:**

-   Transfer validation
-   Royalty distribution
-   Platform commission
-   Rental functionality
-   Balance tracking

## 🛠️ Running Examples

### Prerequisites

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile
```

### Running Individual Examples

```bash
# Deploy contract
npx hardhat run examples/deploy.ts

# Mint NFT
npx hardhat run examples/mint.ts

# Buy/Sell NFT
npx hardhat run examples/buy.ts
```

### Running All Examples

```bash
# Run all examples in sequence
npx hardhat run examples/deploy.ts && \
npx hardhat run examples/mint.ts && \
npx hardhat run examples/buy.ts
```

## 📊 Example Outputs

### Deploy Example

```
🚀 Starting KAMI721C deployment...
📝 Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
🏢 Platform: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
💰 Deploying MockERC20 payment token...
✅ Payment token deployed: 0x5FbDB2315678afecb367f032d93F642f64180aa3
🎨 Deploying KAMI721C contract...
✅ KAMI721C deployed: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
👑 Setting up royalty configuration...
✅ Royalty percentage set to 10%
✅ Mint royalties configured
✅ Transfer royalties configured
🎉 Deployment completed successfully!
```

### Mint Example

```
🎨 Starting NFT minting process...
💸 Setting up payment tokens...
✅ Minted 1000.0 tokens to minter
💰 Minter balance: 1000.0 tokens
🎯 Mint price: 0.1 tokens
✅ Approving payment tokens...
✅ Approved 0.1 tokens for minting
🎨 Minting NFT...
✅ NFT minted successfully!
🆔 Token ID: 1
👤 Token owner: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
✅ Ownership verified: true
🔗 Token URI: https://api.kami.com/metadata/1
💰 Balance Summary:
   Minter: 999.9 tokens
   Platform: 0.025 tokens
   Creator: 0.025 tokens
```

### Buy Example

```
🛒 Starting NFT buying/selling process...
🚀 Deploying contracts...
✅ Payment token deployed: 0x5FbDB2315678afecb367f032d93F642f64180aa3
✅ KAMI721C deployed: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
💸 Setting up payment tokens...
✅ Minted 1000.0 tokens to seller and buyer
🎨 Minting NFT to seller...
✅ NFT minted to seller with Token ID: 1
👤 Current owner: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
✅ Ownership verified: true
💰 Sale price: 0.5 tokens
✅ Buyer approving payment tokens...
✅ Buyer approved 0.5 tokens
🛒 Selling NFT...
✅ NFT listed for sale successfully!
🛒 Buying NFT...
✅ NFT purchased successfully!
👤 New owner: 0x90F79bf6EB2c4f870365E785982E1f101E93b906
✅ Ownership transferred: true
📊 Sale Breakdown:
   Sale Price: 0.5 tokens
   Royalty (10%): 0.05 tokens
   Platform Commission (5%): 0.025 tokens
   Seller Net: 0.425 tokens
```

## 🔧 Configuration Options

### Contract Parameters

-   **Name**: NFT collection name
-   **Symbol**: NFT collection symbol
-   **Payment Token**: ERC20 token for payments
-   **Platform Address**: Platform fee recipient
-   **Mint Price**: Cost to mint one NFT
-   **Platform Commission**: Platform fee percentage
-   **Base URI**: Metadata base URL

### Royalty Configuration

-   **Royalty Percentage**: Global royalty percentage (basis points)
-   **Mint Royalties**: Royalty receivers for minting
-   **Transfer Royalties**: Royalty receivers for transfers

### Rental Configuration

-   **Rental Duration**: Time period for rental
-   **Rental Price**: Cost to rent NFT
-   **Rental Extension**: Extend existing rental

## 🧪 Testing Examples

Each example can be used as a test case:

```bash
# Run with specific network
npx hardhat run examples/deploy.ts --network localhost

# Run with custom signers
npx hardhat run examples/mint.ts --network hardhat
```

## 📝 Notes

-   Examples use MockERC20 for testing
-   All examples are self-contained
-   Error handling is included
-   Detailed logging for debugging
-   Balance tracking throughout processes

## 🔗 Related Files

-   `../contracts/KAMI721C.sol` - Main contract
-   `../contracts/KAMI721CUpgradeable.sol` - Upgradeable version
-   `../test/` - Comprehensive test suite
-   `../scripts/` - Deployment scripts
