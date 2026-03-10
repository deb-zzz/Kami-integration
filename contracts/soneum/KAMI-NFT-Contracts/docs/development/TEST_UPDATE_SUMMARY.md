# Hardhat Test Update Summary

## ✅ Successfully Updated and Passing

### 1. Flow Tests (9/9 passing)

-   ✅ `test/KAMI721C_flow.test.ts` - All 3 passing
-   ✅ `test/KAMI1155C_flow.test.ts` - All 3 passing
-   ✅ `test/KAMI721AC_flow.test.ts` - All 3 passing

These verify the correct distribution:

-   **Mint**: Platform gets 20, receivers get 40 each (total remaining 80)
-   **Claim**: Platform gets 20, receivers get 40 each (mint logic)
-   **Sale**: Platform gets 20, receivers get 4 each, seller gets 72
-   **Rental**: Platform gets 20, receivers get 4 each, owner gets 72

### 2. Main Contract Tests

-   ✅ `test/KAMI721C.test.ts` - Updated platform commission to 20%, rental price to 100, fixed royalty distribution test
-   ✅ `test/KAMI1155C.test.ts` - Updated platform commission to 20%, rental price to 100

### 3. Core Logic Changes

-   ✅ Updated rental flow to distribute royalties correctly
-   ✅ Updated KAMI721AC claim to follow mint logic (not sale logic)
-   ✅ Fixed `_beforeTokenTransfer` hook to skip validation for minting

## ⚠️ Remaining Work

### Upgradeable Test Files (7 failing tests)

-   `test/KAMI721CUpgradeable.test.ts` - Needs similar updates to rental calculations
-   `test/KAMI1155CUpgradeable.test.ts` - Needs rental/royalty test updates

These files need the same updates applied to the non-upgradeable versions:

1. Update PLATFORM_COMMISSION from 1000 (10%) to 2000 (20%)
2. Update RENTAL_PRICE from 10 to 100
3. Update rental distribution calculations to account for royalties
4. Update sale distribution tests to match new logic

### Test Pattern to Apply

For rental tests, the expected distribution should be:

```typescript
// Platform commission: 100 * 20% = 20
const platformCommission = (rentalPrice * BigInt(PLATFORM_COMMISSION)) / 10000n;

// Remaining: 100 - 20 = 80
const remainingAfterCommission = rentalPrice - platformCommission;

// Royalty: 80 * 10% = 8
const royaltyAmount = (remainingAfterCommission * BigInt(1000)) / 10000n; // 10% royalty

// Owner gets: 80 - 8 = 72
const ownerProceeds = remainingAfterCommission - royaltyAmount;
```

For sale tests, the expected distribution should be:

```typescript
// Platform commission: 100 * 20% = 20
const expectedPlatformCommission = ethers.parseUnits('20', 6);

// Remaining: 100 - 20 = 80
// Royalty: 80 * 10% = 8
const expectedRoyalty = ethers.parseUnits('8', 6);

// Seller gets: 80 - 8 = 72
const expectedSellerAmount = ethers.parseUnits('72', 6);
```

## Key Changes Made

### Constants Updated

-   `PLATFORM_COMMISSION`: 1000 (10%) → 2000 (20%)
-   `RENTAL_PRICE`: 10 tokens → 100 tokens
-   All tests now use consistent values matching flow tests

### Logic Updates

1. **Rental Flow** (`contracts/libraries/KamiRental.sol`):

    - Now calculates royalties on remaining amount after platform commission
    - Distributes royalties to mint royalty receivers
    - Owner receives: `remainingAmount - royaltyAmount`

2. **Claim Flow** (`contracts/KAMI721AC.sol`):

    - Changed from sale logic to mint logic
    - Entire remaining amount distributed to mint royalty receivers
    - No royalty percentage calculation - full amount distributed

3. **Sale Flow** (All contracts):
    - Platform gets commission (20%)
    - Royalty calculated on remaining (80 × 10% = 8)
    - Seller gets the remainder (72)

## Running Tests

```bash
# Run all flow tests (should pass)
npm test -- test/*_flow.test.ts

# Run main contract tests
npm test -- test/KAMI721C.test.ts test/KAMI1155C.test.ts

# Run upgradeable tests (some failures expected)
npm test -- test/*Upgradeable.test.ts
```

## Summary

-   ✅ **Core logic updated**: Rental and claim flows now work correctly
-   ✅ **Flow tests passing**: All 9 flow tests verify correct distribution
-   ✅ **Main tests updated**: KAMI721C and KAMI1155C tests updated
-   ⚠️ **Upgradeable tests**: 7 tests still need manual updates (similar pattern as above)
