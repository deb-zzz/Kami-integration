# Changelog

All notable changes to the KamiNFTLibrary project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.3] - 2024-12-19

### Added

-   **Comprehensive NatSpec Documentation**: Added detailed documentation to all functions, structs, and events
-   **Complete API Reference**: Documented all library functions with parameters, return values, and usage examples
-   **Enhanced README**: Comprehensive documentation with usage examples, deployment guides, and troubleshooting
-   **Storage Slot Pattern**: Implemented proxy-compatible storage using dedicated slots for all configurations
-   **Simplified Rental Functions**: Added `endRentalSimple` and `updateRentalOnTransferSimple` without callback requirements
-   **Debug Log Removal**: Commented out debug events for production-ready code
-   **Gas Optimization**: Enabled IR optimizer to resolve "stack too deep" compilation errors

### Changed

-   **TestNFT Contract**: Updated to use storage slot pattern and correct library function calls
-   **Owner Pattern**: Changed from AccessControl `getRoleMember` to state variable storage
-   **Function Signatures**: Fixed `accessControl` parameter references in royalty functions
-   **Test Suite**: Enhanced with comprehensive edge case testing and rounding validation
-   **Package Configuration**: Updated package.json with proper npm package metadata

### Fixed

-   **Compilation Errors**: Resolved "stack too deep" errors with IR optimizer
-   **Test Failures**: Fixed 5 failing tests related to rounding, BigInt normalization, and missing variables
-   **Function Calls**: Corrected library function usage in TestNFT contract
-   **Balance Calculations**: Fixed buyer-as-royalty-receiver edge case handling
-   **Rounding Issues**: Implemented proper rounding tolerance in tests
-   **Missing Variables**: Added `seller` variable to test fixture

### Technical Improvements

-   **Gas Efficiency**: Optimized functions for better gas usage
    -   `distributeMintRoyalties`: ~104k gas (down from ~110k)
    -   `distributeTransferRoyalties`: ~125k gas
    -   `rentToken`: ~213k gas
    -   `sellToken`: ~182k gas
-   **Test Coverage**: 20/20 tests passing with comprehensive coverage
-   **Code Quality**: Removed unused variables and improved code structure
-   **Documentation**: Added inline comments and comprehensive function documentation

## [0.0.2] - 2024-12-19

### Added

-   **MockERC20 Contract**: Created for testing with 6-decimal precision (USDC-like)
-   **TestNFT Contract**: Example implementation using the library
-   **Comprehensive Test Suite**: 20 tests covering all library functionality
-   **Edge Case Testing**: Rounding, buyer-as-royalty-receiver, maximum rates
-   **Gas Reporting**: Added gas usage metrics for all functions

### Changed

-   **Test Structure**: Organized tests into logical groups
-   **Error Handling**: Improved error messages and validation
-   **Royalty Calculations**: Enhanced precision and rounding handling

### Fixed

-   **Library Integration**: Corrected function calls and inheritance patterns
-   **Token Distribution**: Fixed token transfer logic in distribution functions
-   **Test Assertions**: Corrected balance calculations and expectations

## [0.0.1] - 2024-12-19

### Added

-   **Initial Library Implementation**: Core KamiNFTLibrary with all major features
-   **Royalty System**: Programmable royalties with multiple receivers
-   **Platform Commission**: Built-in platform fee collection
-   **Rental System**: Time-based NFT rental functionality
-   **Transfer Validation**: Mandatory royalty enforcement
-   **Role-based Access Control**: Secure permission management
-   **Event System**: Comprehensive event emission for transparency
-   **Storage Management**: Proxy-compatible storage slot pattern

### Features

-   **Programmable Royalties**: Up to 30% with multiple receivers
-   **Platform Commission**: Up to 20% platform fee collection
-   **ERC20 Integration**: Native support for ERC20 payment tokens
-   **Rental Management**: Extend, end, and track rental periods
-   **Token-specific Royalties**: Individual token royalty configurations
-   **Dual Royalty Types**: Separate mint and transfer royalty systems
-   **Rounding & Dust Handling**: Robust handling of calculation precision

### Technical Specifications

-   **Solidity Version**: 0.8.24
-   **OpenZeppelin**: v5.0.0 compatibility
-   **Hardhat**: Development and testing framework
-   **TypeScript**: Test suite implementation
-   **Gas Optimization**: IR optimizer enabled

## Version History

### [0.0.3] - Current Release

-   Production-ready with comprehensive documentation
-   All tests passing (20/20)
-   Optimized gas usage
-   Complete API reference
-   Enhanced error handling

### [0.0.2] - Testing Release

-   Comprehensive test suite
-   Mock contracts for testing
-   Gas optimization
-   Edge case coverage

### [0.0.1] - Initial Release

-   Core library functionality
-   Basic documentation
-   Initial test coverage

## Migration Guide

### From 0.0.2 to 0.0.3

-   No breaking changes
-   Enhanced documentation and examples
-   Improved gas efficiency
-   Better error handling

### From 0.0.1 to 0.0.2

-   Added comprehensive test suite
-   Improved function signatures
-   Enhanced error messages
-   Better integration examples

## Future Roadmap

### Planned Features

-   **Batch Operations**: Support for batch minting and transfers
-   **Advanced Rental Features**: Auction-based rentals, dynamic pricing
-   **Cross-chain Support**: Multi-chain royalty distribution
-   **Governance Integration**: DAO-based royalty management
-   **Analytics Events**: Enhanced event emission for analytics

### Technical Improvements

-   **Further Gas Optimization**: Additional gas efficiency improvements
-   **Formal Verification**: Mathematical proof of correctness
-   **Audit Preparation**: Security audit readiness
-   **Documentation**: Additional examples and tutorials

## Contributing

When contributing to this project, please:

1. Update this CHANGES.md file with your changes
2. Follow the existing versioning scheme
3. Add tests for new functionality
4. Update documentation as needed
5. Ensure all tests pass before submitting

## Support

For questions about changes or migration assistance:

-   Create an issue on GitHub
-   Check the README.md for documentation
-   Review the test suite for usage examples
