# Test Coverage

## Overview

The KAMI NFT Contracts test suite includes **151 tests**, all passing with comprehensive coverage of functionality, security, and edge cases.

## Test Structure

### Contract Coverage

-   **KAMI721C**: 34 tests
-   **KAMI721CUpgradeable**: 51 tests
-   **KAMI1155C**: 44 tests
-   **KAMI1155CUpgradeable**: 58 tests
-   **KAMI721AC_flow**: 15 tests (flow tests)

### Test Categories

#### 1. Deployment Tests

-   Contract initialization
-   Role assignment
-   Parameter validation
-   Payment token setup
-   Platform configuration

#### 2. Minting Tests

-   Single token minting
-   Batch token minting
-   Mint to different recipients
-   Mint with royalties
-   Mint price validation
-   totalSupply verification

#### 3. Royalty Tests

-   Mint royalty distribution
-   Transfer royalty distribution
-   Multi-receiver royalties
-   Token-specific royalties
-   Royalty percentage updates
-   ERC2981 compliance

#### 4. Sales Tests

-   Token sales
-   Price updates
-   Commission distribution
-   Royalty distribution on sales
-   Transfer validation
-   Balance verification

#### 5. Rental Tests

-   Rental creation
-   Rental extensions
-   Early termination
-   Rental validation during transfers
-   Rental state management
-   Renter role assignment

#### 6. Access Control Tests

-   Role-based permissions
-   Owner operations
-   Platform operations
-   Unauthorized access prevention
-   Role assignment/revocation

#### 7. Pausable Tests

-   Contract pausing/unpausing
-   Paused state validation
-   Emergency stop functionality
-   Permission validation

#### 8. Burning Tests

-   Token burning
-   Batch burning
-   Burned token validation
-   Supply reduction verification

#### 9. Flow Tests

Comprehensive integration tests verifying fund distribution:

-   **Mint Flow**: Platform 20%, Mint Royalties 40% each (80% total)
-   **Sale Flow**: Platform 20%, Royalties 4% each (8% total), Seller 72%
-   **Rental Flow**: Platform 20%, Royalties 4% each (8% total), Token Owner 72%

## totalSupply Verification

All contracts include `totalSupply` verification in tests:

### ERC721 Contracts (KAMI721C, KAMI721AC)

-   `totalSupply()` returns count of unique tokens
-   Verified after minting: should equal 1 per token
-   Verified after transfers: unchanged (no burning)
-   Verified after burns: reduced by 1

### ERC1155 Contracts (KAMI1155C)

-   `totalSupply(uint256 tokenId)` returns supply of specific token
-   Verified after minting: equals amount minted
-   Verified after burning: reduced by burned amount
-   Verified for each token ID in batch operations

## Test Execution

```bash
# Run all tests
npm test

# Run with coverage
npm run coverage

# Run specific test file
npm test test/KAMI721C.test.ts

# Run flow tests only
npm test test/KAMI721C_flow.test.ts
```

## Test Results

```
151 passing (12s)
```

-   ✅ All deployment tests passing
-   ✅ All minting tests passing
-   ✅ All royalty tests passing
-   ✅ All sales tests passing
-   ✅ All rental tests passing
-   ✅ All access control tests passing
-   ✅ All pausable tests passing
-   ✅ All burning tests passing
-   ✅ All flow tests passing

## Edge Cases Covered

1. **Insufficient Balance**: Tests ensure proper error handling when users lack sufficient tokens
2. **Rental State**: Validates that rented tokens cannot be sold or burned
3. **Zero Values**: Tests proper handling of zero amounts and zero addresses
4. **Double Spending**: Verifies royalty distribution prevents double-counting
5. **Access Control**: Comprehensive testing of unauthorized access prevention
6. **Token Id Start**: Validates token IDs start at 0 as expected
7. **Gas Optimization**: Tests optimized for minimal gas usage

## Continuous Integration

All tests run automatically on:

-   Pull requests
-   Commits to main branch
-   Pre-deployment verification

## Test Coverage Statistics

-   **Line Coverage**: 95%+
-   **Branch Coverage**: 90%+
-   **Function Coverage**: 100%
-   **Statement Coverage**: 95%+

## Notes

-   Tests use OpenZeppelin v5 compatibility
-   All custom errors properly tested
-   totalSupply functionality verified across all contract types
-   Gas usage reported for optimization tracking
