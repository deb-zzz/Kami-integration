# KAMI Platform Web3 Service - Business Overview

## What is KAMI?

KAMI is a next-generation NFT platform that enables creators to publish and sell digital assets with a completely gasless experience. The platform abstracts away blockchain complexity, providing a Web2-like experience for both creators and collectors while leveraging the security and transparency of blockchain technology.

## Value Proposition

### For Creators
- **Zero Gas Fees**: Publish and manage NFTs without paying blockchain gas fees
- **Flexible Pricing Models**: Set prices, royalties, and revenue splits
- **Multi-Edition Support**: Create unique 1:1 pieces or unlimited editions
- **Retain Ownership**: Keep ownership of concepts while selling individual tokens

### For Collectors
- **Simple Purchasing**: Buy NFTs like any e-commerce product
- **No Wallet Setup Required**: Platform handles blockchain interactions
- **Transparent Ownership**: Blockchain-verified ownership of digital assets
- **Secondary Market**: Resell tokens on the marketplace

### For Platform Operators
- **Complete Backend Solution**: Full API for building NFT marketplaces
- **Multi-Chain Support**: Deploy on multiple blockchain networks
- **Scalable Architecture**: Handle high transaction volumes
- **Comprehensive Analytics**: Track sales, minting, and user activity

---

## Token Types

KAMI supports three distinct token types, each designed for specific use cases:

### KAMI721C (Standard ERC721)

**Use Case**: Unique, one-of-a-kind digital assets

| Characteristic | Description |
|----------------|-------------|
| **Supply** | 1 token per product |
| **Ownership** | Transfers to buyer on sale |
| **Best For** | Unique artworks, collectibles, certificates |

**Example**: A digital artist creates a unique piece. When sold, the buyer becomes the sole owner of that specific NFT.

### KAMI721AC (Claimable ERC721)

**Use Case**: Multi-edition releases with controlled or unlimited supply

| Characteristic | Description |
|----------------|-------------|
| **Supply** | Multiple tokens per product (limited or unlimited) |
| **Ownership** | Creator retains product ownership; buyers own individual tokens |
| **Best For** | Music releases, event tickets, merchandise, memberships |

**Example**: A musician releases an album as 1,000 limited edition NFTs. Each buyer owns their individual token, but the artist retains the master product listing.

**Supply Options**:
- **Limited**: Set a maximum quantity (e.g., 100 editions)
- **Unlimited**: No cap on minting (`maxQuantity = 0`)

### KAMI1155C (ERC1155 Multi-Token)

**Use Case**: Fungible or semi-fungible tokens

| Characteristic | Description |
|----------------|-------------|
| **Supply** | Multiple tokens with quantities |
| **Ownership** | Quantity-based ownership |
| **Best For** | Gaming items, access passes, utility tokens |

**Example**: A game studio creates in-game items where players can own multiple copies of the same item type.

---

## Core Workflows

### 1. Publishing (Creator Flow)

```
┌──────────────────────────────────────────────────────────────────┐
│                      PUBLISHING WORKFLOW                          │
└──────────────────────────────────────────────────────────────────┘

 Creator          Platform API          Database         Blockchain
    │                  │                   │                  │
    │  Upload Content  │                   │                  │
    ├─────────────────►│                   │                  │
    │                  │  Create Product   │                  │
    │                  ├──────────────────►│                  │
    │                  │                   │                  │
    │                  │  Create Voucher   │                  │
    │                  ├──────────────────►│                  │
    │                  │                   │                  │
    │  Listed ✓        │                   │                  │
    │◄─────────────────┤                   │                  │
    │                  │                   │                  │
    │                  │      (Lazy Minting - No blockchain    │
    │                  │       interaction until first sale)   │
    │                  │                   │                  │
```

**Key Points**:
- Content is uploaded and listed without blockchain fees
- "Lazy minting" defers on-chain operations until purchase
- Creator sets price, quantity, and royalty structure

### 2. Purchasing (Collector Flow)

```
┌──────────────────────────────────────────────────────────────────┐
│                      PURCHASING WORKFLOW                          │
└──────────────────────────────────────────────────────────────────┘

 Buyer            Platform API          Database         Blockchain
    │                  │                   │                  │
    │  Add to Cart     │                   │                  │
    ├─────────────────►│                   │                  │
    │                  │                   │                  │
    │  Checkout        │                   │                  │
    ├─────────────────►│                   │                  │
    │                  │                   │                  │
    │                  │              First Purchase?          │
    │                  │                   │                  │
    │                  │  ┌────────────────┼────────────────┐ │
    │                  │  │ YES            │            NO  │ │
    │                  │  ▼                │                ▼ │
    │                  │  Deploy Contract  │    Transfer    │ │
    │                  │  + Mint Token     │    Token       │ │
    │                  ├──────────────────────────────────►│ │
    │                  │                   │                  │
    │                  │  Create Asset     │                  │
    │                  ├──────────────────►│                  │
    │                  │                   │                  │
    │  Owned ✓         │                   │                  │
    │◄─────────────────┤                   │                  │
    │                  │                   │                  │
```

**Key Points**:
- Platform handles all blockchain interactions
- Smart contracts deployed automatically on first sale
- Buyer receives on-chain ownership proof

---

## Business Models Supported

### Direct Sales
- Fixed price listings
- Immediate purchase and transfer
- Platform commission on sales

### Edition Drops
- Limited quantity releases
- FIFO (first-in-first-out) minting
- Scarcity-driven pricing

### Open Editions
- Unlimited minting during a time period
- Time-based scarcity
- Lower barriers to entry

### Secondary Market
- Peer-to-peer token transfers
- Creator royalties on resales
- Price discovery through market

### Subscriptions & Memberships
- Token-gated access
- Recurring revenue for creators
- Community building tools

---

## Revenue Streams

### Platform Revenue
| Revenue Type | Description |
|--------------|-------------|
| **Primary Sales Commission** | Percentage of initial sales |
| **Secondary Sales Commission** | Percentage of resales |
| **Gas Fee Margin** | Spread between actual gas cost and charged fee |
| **Premium Features** | Advanced listing options, analytics |

### Creator Revenue
| Revenue Type | Description |
|--------------|-------------|
| **Primary Sales** | Direct sales proceeds minus platform commission |
| **Royalties** | Percentage of secondary sales |
| **Tips** | Direct contributions from collectors |
| **Subscriptions** | Recurring payments for exclusive content |

---

## Supported Blockchains

| Network | Chain ID | Status | Use Case |
|---------|----------|--------|----------|
| **Base Mainnet** | 8453 | Production | Primary mainnet deployment |
| **Base Sepolia** | 84532 | Testnet | Development and testing |
| **Soneium** | 1947 | Production | Asian market expansion |
| **Soneium Minato** | 1946 | Testnet | Soneium testing |
| **Ethereum Mainnet** | 1 | Production | High-value assets |
| **Ethereum Sepolia** | 11155111 | Testnet | Ethereum testing |

---

## Key Metrics & Analytics

### Creator Metrics
- Total sales volume
- Number of unique collectors
- Average sale price
- Royalty earnings

### Collector Metrics
- Portfolio value
- Collection size
- Purchase history

### Platform Metrics
- Total transactions
- Gas fees sponsored
- Active users (DAU/MAU)
- Revenue by chain

---

## Competitive Advantages

1. **True Gasless Experience**: Platform pays all gas fees, not users
2. **Multi-Chain Flexibility**: Deploy on the chain that fits your needs
3. **Web2 Simplicity**: No wallet management required for users
4. **Comprehensive API**: Build any NFT experience with our backend
5. **Creator-Friendly**: Flexible pricing, royalties, and revenue splits
6. **Scalable Infrastructure**: Handle enterprise-level transaction volumes

---

## Getting Started

### For Business Integration
Contact the KAMI team for:
- API access and documentation
- Custom deployment options
- Enterprise licensing
- Technical support SLAs

### For Developers
See the technical documentation:
- [API Reference](./api/API_REFERENCE.md) - Complete API documentation
- [Client Integration Guide](./api/CLIENT_INTEGRATION.md) - Frontend development guide
- [Development Guide](./development/DEVELOPMENT.md) - Module development

---

## Glossary

| Term | Definition |
|------|------------|
| **Asset** | An on-chain minted token owned by a wallet |
| **Collection** | A group of products deployed to the same smart contract |
| **Gasless** | Operations where the platform pays blockchain transaction fees |
| **Lazy Minting** | Deferring on-chain minting until the first purchase |
| **Product** | The master record representing an NFT listing |
| **Voucher** | Metadata template used for lazy minting |
| **Primary Sale** | First sale of an NFT from creator to collector |
| **Secondary Sale** | Resale of an NFT between collectors |
| **Royalty** | Percentage of sales paid to the original creator |

---

**See also**: [README](../README.md) (quick start, API list, tech stack) | [API Reference](api/API_REFERENCE.md) | [Architecture](development/ARCHITECTURE.md) | [Database Schema](development/DATABASE_SCHEMA.md)

**Version**: 1.0.0  
**Last Updated**: February 2026
