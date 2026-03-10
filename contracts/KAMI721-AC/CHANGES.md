# CHANGES.md - KAMI721AC Project Change Log

## [2.0.0] - 2024-12-19

### Major Changes

#### 🚀 KamiNFTLibrary v2.0.0 Migration

-   **BREAKING CHANGE**: Migrated from KamiNFTLibrary v1.x to v2.0.0
-   **Storage Management**: Library now manages all storage internally
-   **Function Signatures**: Updated all library function calls to match new API
-   **Removed Storage Parameters**: No longer need to pass storage structs to library functions
-   **Proxy Compatibility**: Improved compatibility with upgradeable contracts

#### Key Migration Changes:

```solidity
// OLD (v1.x)
KamiNFTLibrary.distributeMintRoyalties(_royaltyConfig, _platformConfig, paymentToken, tokenId, mintPrice);

// NEW (v2.0.0)
KamiNFTLibrary.distributeMintRoyalties(tokenId, mintPrice, paymentToken);
```

#### Updated Functions:

-   `initializePlatform()` - No longer requires storage parameter
-   `initializeRoyaltyConfig()` - No longer requires storage parameter
-   `distributeMintRoyalties()` - Simplified signature
-   `distributeTransferRoyalties()` - Simplified signature
-   `setRoyaltyPercentage()` - Simplified signature
-   `setMintRoyalties()` - Simplified signature
-   `setTransferRoyalties()` - Simplified signature
-   `setTokenMintRoyalties()` - Simplified signature
-   `setTokenTransferRoyalties()` - Simplified signature
-   `sellToken()` - Simplified signature
-   `rentToken()` - Simplified signature
-   `endRental()` - Replaced with `endRentalSimple()`
-   `extendRental()` - Simplified signature
-   `validateTransfer()` - Simplified signature
-   `updateRentalOnTransfer()` - Replaced with `updateRentalOnTransferSimple()`
-   `initiateTransferWithRoyalty()` - Simplified signature
-   `payTransferRoyalty()` - Simplified signature
-   `isTransferRoyaltyRequired()` - Simplified signature

### New Features

#### 📦 Batch Claim Operations

-   **batchClaimFor()**: Owner pays for multiple recipients (up to 100 per transaction)
-   **batchClaim()**: Each recipient pays for themselves (up to 100 per transaction)
-   **Gas Optimization**: Efficient batch operations for multiple recipients
-   **Event Logging**: Comprehensive events for batch operations

```solidity
// Owner pays for all recipients
function batchClaimFor(address[] calldata recipients) external {
    require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
    require(recipients.length > 0, "Empty recipients array");
    require(recipients.length <= 100, "Too many recipients");
    // ... implementation
}

// Each recipient pays for themselves
function batchClaim(address[] calldata recipients) external {
    require(recipients.length > 0, "Empty recipients array");
    require(recipients.length <= 100, "Too many recipients");
    // ... implementation
}
```

#### 📚 Comprehensive Documentation

-   **Full NatSpec Documentation**: Added detailed documentation to all functions
-   **Parameter Descriptions**: Clear descriptions for all function parameters
-   **Return Value Documentation**: Documented all return values
-   **Requirements Documentation**: Clear requirements for each function
-   **Business Logic Explanations**: Detailed explanations of function behavior

### Improvements

#### 🔧 Contract Architecture

-   **Library Integration**: Improved integration with KamiNFTLibrary v2.0.0
-   **Storage Efficiency**: Library-managed storage reduces contract complexity
-   **Function Simplification**: Cleaner function signatures and implementations
-   **Error Handling**: Improved error messages and validation

#### 🧪 Testing Enhancements

-   **Batch Claim Tests**: Comprehensive tests for both batch claim scenarios
-   **Library Integration Tests**: Updated tests for v2.0.0 API
-   **Royalty Distribution Tests**: Enhanced royalty calculation tests
-   **Edge Case Testing**: Additional edge case coverage
-   **BigInt Arithmetic**: Fixed BigInt vs BigNumber arithmetic issues

#### 🔒 Security Improvements

-   **Access Control**: Enhanced role-based permissions
-   **Input Validation**: Improved parameter validation
-   **Gas Optimization**: Better gas efficiency for batch operations
-   **Event Logging**: Enhanced event emission for better tracking

### Bug Fixes

#### 🐛 Compilation Issues

-   **Function Signature Mismatches**: Fixed all library function call signatures
-   **Storage Parameter Removal**: Removed outdated storage parameters
-   **Type Conversion Issues**: Fixed BigInt arithmetic in tests
-   **Royalty Calculation**: Fixed royalty distribution calculations

#### 🧪 Test Fixes

-   **BigInt Arithmetic**: Fixed BigInt vs BigNumber mismatches in tests
-   **Royalty Expectations**: Updated test expectations for new royalty behavior
-   **Batch Claim Setup**: Fixed token minting for batch claim tests
-   **Royalty Receiver Configuration**: Ensured tests always have royalty receivers

### Technical Details

#### Library API Changes

The migration to KamiNFTLibrary v2.0.0 involved significant API changes:

1. **Storage Management**: Library now manages all storage internally
2. **Function Simplification**: Removed storage parameters from all function calls
3. **Proxy Compatibility**: Better support for upgradeable contracts
4. **Default Royalty**: Library now sets a default 10% royalty percentage

#### Batch Claim Implementation

```solidity
// Events for batch operations
event BatchClaimedFor(address indexed owner, address[] recipients, uint256 totalPayment);
event BatchClaimed(address indexed caller, address[] recipients);

// Implementation includes:
// - Gas limit protection (max 100 recipients)
// - Input validation
// - Payment token transfers
// - Royalty distribution
// - Claim tracking
// - Event emission
```

#### Documentation Standards

All functions now include comprehensive NatSpec documentation:

-   `@notice` - Function purpose and behavior
-   `@param` - Parameter descriptions
-   `@return` - Return value descriptions
-   `@dev` - Implementation details and requirements

### Migration Guide

#### For Existing Users

1. **Update Library**: Upgrade to KamiNFTLibrary v2.0.0
2. **Update Function Calls**: Remove storage parameters from all library calls
3. **Test Thoroughly**: Run comprehensive tests after migration
4. **Deploy New Contracts**: Deploy updated contracts with new functionality

#### Breaking Changes

-   All library function signatures have changed
-   Storage parameters are no longer required
-   Default royalty percentage is now 10%
-   Some function names have changed (e.g., `endRental` → `endRentalSimple`)

### Future Plans

#### 🚀 Upcoming Features

-   **Enhanced Batch Operations**: Support for larger batch sizes
-   **Advanced Royalty Features**: More sophisticated royalty calculations
-   **Gas Optimizations**: Further gas efficiency improvements
-   **Additional Payment Methods**: Support for more payment tokens

#### 🔧 Planned Improvements

-   **Documentation**: Enhanced documentation and examples
-   **Testing**: Additional test coverage
-   **Security**: Enhanced security features
-   **Performance**: Further performance optimizations

---

## [1.0.0] - 2024-12-18

### Initial Release

#### 🎉 Core Features

-   **Claimable NFT System**: One claim per address functionality
-   **ERC721/ERC2981 Compliance**: Full NFT standard compliance
-   **ERC20 Payment Support**: Generic payment token support
-   **Platform Commissions**: Automated commission distribution
-   **Programmable Royalties**: Flexible royalty system
-   **Rental System**: Time-based token rental
-   **Transfer Validation**: Royalty enforcement
-   **Access Control**: Role-based permissions
-   **Pausable Functionality**: Emergency controls
-   **Direct Sales**: Built-in marketplace functionality

#### 🏗 Architecture

-   **KAMI721AC.sol**: Standard implementation
-   **KAMI721ACUpgradable.sol**: Upgradeable implementation
-   **KamiNFTLibrary Integration**: Modular library design
-   **Comprehensive Testing**: Full test coverage
-   **Documentation**: Initial documentation

#### 📦 Dependencies

-   **@openzeppelin/contracts**: 4.9.3
-   **@openzeppelin/contracts-upgradeable**: 4.9.3
-   **@paulstinchcombe/kaminftlibrary**: 1.x

---

## Version History

| Version | Date       | Description                                                                         |
| ------- | ---------- | ----------------------------------------------------------------------------------- |
| 2.0.0   | 2024-12-19 | Major migration to KamiNFTLibrary v2.0.0, batch claims, comprehensive documentation |
| 1.0.0   | 2024-12-18 | Initial release with core claimable functionality                                   |

---

## Contributing

When contributing to this project, please:

1. **Update CHANGES.md**: Document all changes in this file
2. **Follow Semantic Versioning**: Use semantic versioning for releases
3. **Test Thoroughly**: Ensure all tests pass before submitting
4. **Document Changes**: Provide clear documentation for new features
5. **Maintain Backwards Compatibility**: When possible, maintain API compatibility

## Support

For questions about these changes or the migration process:

-   Open an issue on GitHub
-   Check the test files for usage examples
-   Review the updated documentation
-   Consult the KamiNFTLibrary v2.0.0 documentation
