# KAMI NFT Contracts Documentation

This directory contains comprehensive documentation for the KAMI NFT Contracts project.

## 📚 Documentation Index

### Getting Started

-   **[Main README](../README.md)** - Project overview and quick start guide
-   **[API Reference](API_REFERENCE.md)** - Complete function reference
-   **[Examples](EXAMPLES.md)** - Code examples and use cases
-   **[Upgradeable Architecture](README_UPGRADEABLE.md)** - UUPS proxy pattern guide
-   **[Changelog](CHANGELOG.md)** - Version history and changes
-   **[Migration Guide](CHANGES.md)** - Breaking changes and migration instructions

### Deployment

-   **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Step-by-step deployment instructions
-   **[Upgradeable Architecture](README_UPGRADEABLE.md)** - UUPS proxy pattern and upgrade process
-   **[Security Audit](SECURITY_AUDIT.md)** - Security considerations and best practices
-   **[Test Coverage](TEST_COVERAGE.md)** - Comprehensive test suite documentation

### Development

-   **[Development Folder](development/)** - Technical development documentation

## 🔍 Documentation Structure

```
docs/
├── README.md                          # This file - documentation index
├── API_REFERENCE.md                   # Function reference
├── DEPLOYMENT_GUIDE.md                # Deployment instructions
├── EXAMPLES.md                        # Code examples
├── SECURITY_AUDIT.md                  # Security considerations
├── TEST_COVERAGE.md                   # Test suite documentation
├── README_UPGRADEABLE.md              # Upgradeable architecture guide
├── CHANGELOG.md                       # Version history and changes
├── CHANGES.md                         # Migration guide and breaking changes
└── development/                       # Development documentation
    ├── OPENZEPPELIN_V5_UPGRADE_SUMMARY.md
    ├── BASE_DEPLOYMENT_GUIDE.md
    ├── CONVERSION_TO_SHARED_LIBRARIES_COMPLETE.md
    ├── FINAL_FIXES_SUMMARY.md
    ├── LIBRARY_SHARING_APPROACH.md
    ├── LIBRARY_SIZE_ANALYSIS.md
    ├── DEPLOYMENT_NOTES.md
    ├── EDGE_CASE_FIX_SUMMARY.md
    ├── FLOW_TEST_SUMMARY.md
    └── TEST_UPDATE_SUMMARY.md
```

## 📖 Quick Links

### For Developers

-   Start with [API Reference](API_REFERENCE.md) to understand all functions
-   Review [Examples](EXAMPLES.md) for usage patterns
-   Check [Test Coverage](TEST_COVERAGE.md) for test examples

### For Deployers

-   Follow [Deployment Guide](DEPLOYMENT_GUIDE.md) for deployment steps
-   Read [Upgradeable Architecture](README_UPGRADEABLE.md) for upgradeable contracts
-   Review [Changelog](CHANGELOG.md) for version history
-   Check [Migration Guide](CHANGES.md) for breaking changes
-   Read [Security Audit](SECURITY_AUDIT.md) for security considerations
-   Review [Development Notes](development/) for technical details

### For Security Auditors

-   Review [Security Audit](SECURITY_AUDIT.md)
-   Check [Test Coverage](TEST_COVERAGE.md) for security test cases
-   Review development notes in [development/](development/)

## 🚀 Quick Start

1. Read the [Main README](../README.md) for project overview
2. Review [API Reference](API_REFERENCE.md) for available functions
3. Check [Examples](EXAMPLES.md) for usage patterns
4. Follow [Deployment Guide](DEPLOYMENT_GUIDE.md) to deploy

## 📝 Documentation by Topic

### Contracts

-   **KAMI721C**: ERC721 NFT contract (non-upgradeable)
-   **KAMI721CUpgradeable**: ERC721 NFT contract (upgradeable)
-   **KAMI1155C**: ERC1155 multi-token contract (non-upgradeable)
-   **KAMI1155CUpgradeable**: ERC1155 multi-token contract (upgradeable)
-   **KAMI721AC**: ERC721 with Allowlist/Claim
-   **KAMI721ACUpgradeable**: ERC721AC upgradeable version

### Features

-   **Royalty Distribution**: ERC2981 compliant royalty system
-   **Rental System**: Time-based token rental functionality
-   **Platform Commissions**: Automatic fee collection
-   **Access Control**: Role-based permission system
-   **Pausable**: Emergency stop functionality
-   **Separate Mint and Sale Prices**: Global mint price (creator controlled) and per-token sale prices (owner controlled)

## 🔄 Recent Updates

-   **Separate Mint and Sale Prices**: Added global `mintPrice` (OWNER_ROLE controlled) and per-token `salePrices` (token owner controlled)
-   **Price Independence**: Token owners can set their own sale prices independently of creator's mint price
-   **Backward Compatibility**: Maintained `tokenPrices` mapping and `setPrice()` function for compatibility
-   Upgraded to OpenZeppelin v5
-   Added comprehensive totalSupply tests
-   All 151 tests passing
-   Improved gas optimization
-   Enhanced documentation

## 📞 Support

For questions or issues:

-   Review the documentation
-   Check [Development Notes](development/)
-   Open a GitHub issue

---

**Last Updated**: 2024
