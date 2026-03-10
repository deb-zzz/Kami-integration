# KamiNFTLibrary Migration Guide

## Overview

This document outlines the changes required when migrating from the original `KamiNFTLibrary` to the new `KamiNFTLibrary` for contracts such as `KAMI1155C` and `KAMI1155CUpgradeable`. The new library introduces significant architectural changes to support proxy compatibility and improved storage management.

## Key Architectural Changes

### 1. Storage Management Revolution

**Original Library (KamiNFTLibrary):**

-   Used direct storage structs passed as parameters
-   Required explicit storage management in calling contracts
-   Not proxy-compatible due to storage layout conflicts

**New Library (KamiNFTLibrary):**

-   Uses deterministic storage slots for proxy compatibility
-   Implements storage slot pattern with assembly access
-   All storage is managed internally by the library

### 2. Function Signature Changes

The new library eliminates the need to pass storage structs as parameters, making function calls much cleaner.

## Detailed Migration Changes

### Import Statement Changes

**Before:**

```solidity
import "@paulstinchcombe/kaminftlibrary/contracts/KamiNFTLibrary.sol";
```

**After:**

```solidity
import "@paulstinchcombe/kaminftlibrary/contracts/KamiNFTLibrary.sol";
```

**Note:** The import statement remains the same, but the library version and functionality have been updated.

### Storage Declaration Changes

**Before (KAMI1155C):**

```solidity
// Library storage
KamiNFTLibrary.PlatformConfig private _platformConfig;
KamiNFTLibrary.RoyaltyConfig private _royaltyConfig;
mapping(uint256 => KamiNFTLibrary.Rental) private _rentals;
KamiNFTLibrary.TransferTracker private _transferTracker;
```

**After:**

```solidity
// Library storage (only for transfer tracker)
KamiNFTLibrary.TransferTracker private _transferTracker;
```

**Note:** The new library manages `PlatformConfig` and `RoyaltyConfig` internally using storage slots. The `_rentals` mapping is also managed internally by the library.

### Function Call Changes

#### 1. Platform Initialization

**Before:**

```solidity
KamiNFTLibrary.initializePlatform(_platformConfig, platformAddress_, platformCommissionPercentage_);
```

**After:**

```solidity
KamiNFTLibrary.initializePlatform(platformAddress_, platformCommissionPercentage_);
```

#### 2. Royalty Configuration Initialization

**Before:**

```solidity
KamiNFTLibrary.initializeRoyaltyConfig(_royaltyConfig);
```

**After:**

```solidity
KamiNFTLibrary.initializeRoyaltyConfig();
```

#### 3. Platform Commission Updates

**Before:**

```solidity
KamiNFTLibrary.updatePlatformCommission(_platformConfig, newPlatformCommissionPercentage, newPlatformAddress, address(this));
```

**After:**

```solidity
KamiNFTLibrary.updatePlatformCommission(newPlatformCommissionPercentage, newPlatformAddress, address(this));
```

#### 4. Royalty Percentage Setting

**Before:**

```solidity
KamiNFTLibrary.setRoyaltyPercentage(_royaltyConfig, newRoyaltyPercentage, address(this));
```

**After:**

```solidity
KamiNFTLibrary.setRoyaltyPercentage(newRoyaltyPercentage, address(this));
```

#### 5. Mint Royalties Setting

**Before:**

```solidity
KamiNFTLibrary.setMintRoyalties(_royaltyConfig, royalties, _platformConfig, address(this));
```

**After:**

```solidity
KamiNFTLibrary.setMintRoyalties(royalties, address(this));
```

#### 6. Transfer Royalties Setting

**Before:**

```solidity
KamiNFTLibrary.setTransferRoyalties(_royaltyConfig, royalties, address(this));
```

**After:**

```solidity
KamiNFTLibrary.setTransferRoyalties(royalties, address(this));
```

#### 7. Token-Specific Mint Royalties

**Before:**

```solidity
KamiNFTLibrary.setTokenMintRoyalties(_royaltyConfig, tokenId, royalties, _platformConfig, address(this), _exists);
```

**After:**

```solidity
KamiNFTLibrary.setTokenMintRoyalties(tokenId, royalties, address(this), _exists);
```

#### 8. Token-Specific Transfer Royalties

**Before:**

```solidity
KamiNFTLibrary.setTokenTransferRoyalties(_royaltyConfig, tokenId, royalties, address(this), _exists);
```

**After:**

```solidity
KamiNFTLibrary.setTokenTransferRoyalties(tokenId, royalties, address(this), _exists);
```

#### 9. Mint Royalty Distribution

**Before:**

```solidity
KamiNFTLibrary.distributeMintRoyalties(_royaltyConfig, _platformConfig, paymentToken, tokenId, mintPrice);
```

**After:**

```solidity
KamiNFTLibrary.distributeMintRoyalties(tokenId, mintPrice, paymentToken);
```

#### 10. Token Selling

**Before:**

```solidity
KamiNFTLibrary.sellToken(_royaltyConfig, _platformConfig, paymentToken, _transferTracker, tokenId, to, salePrice, seller, _rentals);
```

**After:**

```solidity
KamiNFTLibrary.sellToken(paymentToken, tokenId, to, salePrice, seller);
```

#### 11. Token Renting

**Before:**

```solidity
KamiNFTLibrary.rentToken(_rentals, _platformConfig, paymentToken, tokenId, duration, rentalPrice, tokenOwner, address(this));
```

**After:**

```solidity
KamiNFTLibrary.rentToken(paymentToken, tokenId, duration, rentalPrice, tokenOwner, address(this), true);
```

**Note:** The new library adds an `isERC1155` parameter to distinguish between ERC721 and ERC1155 behavior. For ERC1155 contracts, this should be set to `true`.

#### 12. Rental Ending

**Before:**

```solidity
KamiNFTLibrary.endRental(_rentals, tokenId, tokenOwner, address(this), hasActiveRentals);
```

**After:**

```solidity
KamiNFTLibrary.endRental(tokenId, tokenOwner, address(this), hasActiveRentals, true);
```

#### 13. Rental Extension

**Before:**

```solidity
KamiNFTLibrary.extendRental(_rentals, _platformConfig, paymentToken, tokenId, additionalDuration, additionalPayment, tokenOwner);
```

**After:**

```solidity
KamiNFTLibrary.extendRental(paymentToken, tokenId, additionalDuration, additionalPayment, tokenOwner, true);
```

**Note:** Rental extension functionality has been fixed and now works correctly with the library's internal storage management.

#### 14. Rental Status Check

**Before:**

```solidity
KamiNFTLibrary.isRented(_rentals, tokenId)
```

**After:**

```solidity
KamiNFTLibrary.isRented(tokenId)
```

#### 15. Rental Information

**Before:**

```solidity
KamiNFTLibrary.getRentalInfo(_rentals, tokenId, _exists)
```

**After:**

```solidity
KamiNFTLibrary.getRentalInfo(KamiNFTLibrary._getRentals(), tokenId, _exists)
```

#### 16. Active Rentals Check

**Before:**

```solidity
KamiNFTLibrary.hasActiveRentals(_rentals, user, totalSupply, tokenByIndex);
```

**After:**

```solidity
KamiNFTLibrary.hasActiveRentalsERC1155(KamiNFTLibrary._getRentals(), user, totalSupply, _dummyTokenByIndex, _tokenIdCounter.current() - 1);
```

**Note:** For ERC1155 contracts, use `hasActiveRentalsERC1155` instead of `hasActiveRentals`.

#### 17. Transfer Validation

**Before:**

```solidity
KamiNFTLibrary.validateTransfer(_rentals, _royaltyConfig, _transferTracker, tokenId, from, to, ownerOf(tokenId), isApprovedForAll, getApproved);
```

**After:**

```solidity
KamiNFTLibrary.validateTransfer(tokenId, from, to, from == address(0) ? address(0) : msg.sender, isApprovedForAll, _dummyGetApproved);
```

**Note:** For ERC1155, use `msg.sender` as the token owner since ERC1155 doesn't have a single owner per token.

#### 18. Rental Update on Transfer

**Before:**

```solidity
KamiNFTLibrary.updateRentalOnTransfer(_rentals, tokenId, from, to, address(this), hasActiveRentals);
```

**After:**

```solidity
KamiNFTLibrary.updateRentalOnTransfer(tokenId, from, to, address(this), hasActiveRentals);
```

#### 19. Burn Validation

**Before:**

```solidity
KamiNFTLibrary.validateBurn(tokenId, ownerOf(tokenId), _rentals);
```

**After:**

```solidity
KamiNFTLibrary.validateBurn(tokenId, msg.sender);
```

#### 20. Transfer Royalty Initiation

**Before:**

```solidity
KamiNFTLibrary.initiateTransferWithRoyalty(_transferTracker, tokenId, to, salePrice, ownerOf(tokenId), _rentals);
```

**After:**

```solidity
KamiNFTLibrary.initiateTransferWithRoyalty(tokenId, to, salePrice, msg.sender);
```

#### 21. Transfer Royalty Payment

**Before:**

```solidity
KamiNFTLibrary.payTransferRoyalty(_transferTracker, _royaltyConfig, _platformConfig, paymentToken, tokenId, to, salePrice, ownerOf(tokenId));
```

**After:**

```solidity
KamiNFTLibrary.payTransferRoyalty(paymentToken, tokenId, to, salePrice, msg.sender, seller);
```

**Note:** The new library requires the buyer address as a parameter.

#### 22. Transfer Royalty Requirement Check

**Before:**

```solidity
KamiNFTLibrary.isTransferRoyaltyRequired(_transferTracker, tokenId, from, to, salePrice)
```

**After:**

```solidity
KamiNFTLibrary.isTransferRoyaltyRequired(tokenId, from, to, salePrice)
```

### Getter Function Changes

#### Platform Commission Percentage

**Before:**

```solidity
function platformCommissionPercentage() public view returns (uint96) {
    return _platformConfig.commissionPercentage;
}
```

**After:**

```solidity
function platformCommissionPercentage() public view returns (uint96) {
    return KamiNFTLibrary.platformCommission();
}
```

#### Platform Address

**Before:**

```solidity
function platformAddress() public view returns (address) {
    return _platformConfig.platformAddress;
}
```

**After:**

```solidity
function platformAddress() public view returns (address) {
    return KamiNFTLibrary.platformAddress();
}
```

#### Royalty Percentage

**Before:**

```solidity
function royaltyPercentage() public view returns (uint96) {
    return _royaltyConfig.royaltyPercentage;
}
```

**After:**

```solidity
function royaltyPercentage() public view returns (uint96) {
    return KamiNFTLibrary.royaltyPercentage();
}
```

#### Mint Royalty Receivers

**Before:**

```solidity
function getMintRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTLibrary.RoyaltyData[] memory) {
    return KamiNFTLibrary.getMintRoyaltyReceivers(_royaltyConfig, tokenId);
}
```

**After:**

```solidity
function getMintRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTLibrary.RoyaltyData[] memory) {
    return KamiNFTLibrary.getMintRoyaltyReceivers(tokenId);
}
```

#### Transfer Royalty Receivers

**Before:**

```solidity
function getTransferRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTLibrary.RoyaltyData[] memory) {
    return KamiNFTLibrary.getTransferRoyaltyReceivers(_royaltyConfig, tokenId);
}
```

**After:**

```solidity
function getTransferRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTLibrary.RoyaltyData[] memory) {
    return KamiNFTLibrary.getTransferRoyaltyReceivers(tokenId);
}
```

### Royalty Info Function Changes

**Before:**

```solidity
function royaltyInfo(uint256 tokenId, uint256 salePrice)
    public
    view
    override
    returns (address receiver, uint256 royaltyAmount)
{
    uint256 totalRoyaltyAmount = (salePrice * _royaltyConfig.royaltyPercentage) / 10000;
    KamiNFTLibrary.RoyaltyData[] memory royalties = _royaltyConfig.tokenTransferRoyalties[tokenId].length > 0
        ? _royaltyConfig.tokenTransferRoyalties[tokenId]
        : _royaltyConfig.transferRoyaltyReceivers;
    if (royalties.length > 0) {
        KamiNFTLibrary.RoyaltyData memory info = royalties[0];
        uint256 receiverShare = (totalRoyaltyAmount * info.feeNumerator) / 10000;
        return (info.receiver, receiverShare);
    }
    return (address(0), 0);
}
```

**After:**

```solidity
function royaltyInfo(uint256 tokenId, uint256 salePrice)
    public
    view
    override
    returns (address receiver, uint256 royaltyAmount)
{
    uint256 totalRoyaltyAmount = (salePrice * KamiNFTLibrary.royaltyPercentage()) / 10000;
    KamiNFTLibrary.RoyaltyData[] memory royalties = KamiNFTLibrary.getTransferRoyaltyReceivers(tokenId);
    if (royalties.length > 0) {
        KamiNFTLibrary.RoyaltyData memory info = royalties[0];
        uint256 receiverShare = (totalRoyaltyAmount * info.feeNumerator) / 10000;
        return (info.receiver, receiverShare);
    }
    return (address(0), 0);
}
```

### ERC1155-Specific Changes

For ERC1155 contracts, additional changes are needed:

#### 1. Rental Functions with ERC1155 Flag

All rental-related functions need the `isERC1155` parameter set to `true`:

```solidity
// Rent token
KamiNFTLibrary.rentToken(paymentToken, tokenId, duration, rentalPrice, msg.sender, address(this), true);

// End rental
KamiNFTLibrary.endRental(tokenId, tokenOwner, address(this), hasActiveRentals, true);

// Extend rental
KamiNFTLibrary.extendRental(paymentToken, tokenId, additionalDuration, additionalPayment, tokenOwner, true);
```

#### 2. Active Rentals Check for ERC1155

**Before:**

```solidity
KamiNFTLibrary.hasActiveRentals(_rentals, user, totalSupply, tokenByIndex);
```

**After:**

```solidity
KamiNFTLibrary.hasActiveRentalsERC1155(KamiNFTLibrary._getRentals(), user, totalSupply, _dummyTokenByIndex, _tokenIdCounter.current() - 1);
```

#### 3. Transfer Validation for ERC1155

The `validateTransfer` function needs to handle ERC1155's different ownership model:

```solidity
KamiNFTLibrary.validateTransfer(
    tokenId,
    from,
    to,
    from == address(0) ? address(0) : msg.sender, // Use msg.sender for ERC1155
    isApprovedForAll,
    _dummyGetApproved
);
```

#### 4. Dummy Functions for ERC1155 Compatibility

ERC1155 contracts need to provide dummy functions for library compatibility:

```solidity
// Dummy tokenByIndex for ERC1155 (not used, but required for library compatibility)
function _dummyTokenByIndex(uint256) public pure returns (uint256) {
    revert("tokenByIndex not supported in ERC1155");
}

// Dummy getApproved for ERC1155 (not used, but required for library compatibility)
function _dummyGetApproved(uint256) public pure returns (address) {
    return address(0);
}
```

## New Features in KamiNFTLibrary

### 1. Debug Events

The new library includes debug events for better monitoring:

```solidity
event DebugMintRoyalties(uint256 indexed tokenId, uint256 amount, uint256 platformAmount, uint256 remainingAmount, uint256 royaltiesLength);
event DebugRoyaltyDistributed(uint256 indexed tokenId, address indexed receiver, uint256 amount);
```

### 2. Enhanced Royalty Distribution

The new library includes improved royalty distribution logic with better dust handling and debug logging.

### 3. ERC1155 Support

The library now natively supports ERC1155 contracts with the `isERC1155` parameter in rental functions.

### 4. Internal Storage Management

The library now manages all storage internally using storage slots, eliminating the need for external storage management.

## Migration Checklist

### For KAMI1155C Contracts:

-   [x] Update import statement
-   [x] Remove storage declarations for `_platformConfig` and `_royaltyConfig`
-   [x] Remove storage declaration for `_rentals` mapping
-   [x] Update all function calls to remove storage parameters
-   [x] Update getter functions to use library functions
-   [x] Update `royaltyInfo` function
-   [x] Add `isERC1155: true` parameter to rental functions
-   [x] Use `hasActiveRentalsERC1155` instead of `hasActiveRentals`
-   [x] Update transfer validation for ERC1155 ownership model
-   [x] Add dummy functions for ERC1155 compatibility
-   [x] Test all functionality after migration

### For KAMI1155CUpgradeable Contracts:

-   [x] Follow all KAMI1155C changes
-   [x] Ensure storage gap is maintained for upgradeability
-   [x] Test upgrade functionality after migration

## Current Status

### ✅ Completed Migrations

-   **KAMI1155C.sol**: Successfully migrated to new library architecture
-   **KAMI1155CUpgradeable.sol**: Successfully migrated to new library architecture
-   **Test Suite**: All 63 tests passing
-   **Rental Extension**: Fixed and working correctly
-   **Debug Logs**: Commented out in test files for clean output

### 🧪 Test Results

All tests are currently passing:

```bash
# All tests passing
63 passing (2s)

# Rental tests
14 passing (937ms)

# Royalty tests
9 passing (723ms)
```

### 🔧 Recent Fixes

1. **Rental Extension Logic**: Fixed rental extension functionality by using library's internal storage management
2. **Debug Logs**: Commented out all debug console.log statements in test files
3. **Library Integration**: Successfully integrated with latest KamiNFTLibrary version
4. **ERC1155 Support**: Full support for ERC1155-specific functionality

## Benefits of Migration

1. **Proxy Compatibility**: The new library is fully compatible with upgradeable contracts
2. **Cleaner Code**: Eliminates the need to pass storage structs around
3. **Better Gas Efficiency**: Optimized storage access patterns
4. **Enhanced Debugging**: Additional debug events for monitoring
5. **ERC1155 Support**: Native support for ERC1155 contracts
6. **Improved Royalty Handling**: Better dust handling and distribution logic
7. **Internal Storage Management**: Library manages all storage internally

## Testing Recommendations

After migration, thoroughly test:

1. **Minting**: Ensure royalties are distributed correctly
2. **Selling**: Verify royalty payments and platform commissions
3. **Renting**: Test rental creation, extension, and ending
4. **Transfers**: Validate transfer restrictions and royalty enforcement
5. **Upgrades**: For upgradeable contracts, test upgrade functionality
6. **Role Management**: Verify access control still works correctly
7. **Batch Operations**: Test ERC1155 batch minting and transfers
8. **Rental Extension**: Verify rental extension works correctly

## Conclusion

The migration from the original `KamiNFTLibrary` to the new `KamiNFTLibrary` represents a significant architectural improvement that provides better proxy compatibility, cleaner code, and enhanced functionality. The KAMI1155C contracts have been successfully migrated and all functionality is working correctly with 63 tests passing.

The new library architecture eliminates storage management complexity while providing better gas efficiency and enhanced debugging capabilities. The rental extension functionality has been fixed and now works correctly with the library's internal storage management.

For any questions or issues during migration, refer to the test files for working examples of the new library usage patterns.
