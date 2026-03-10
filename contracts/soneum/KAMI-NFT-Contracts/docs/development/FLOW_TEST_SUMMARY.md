# Royalty and Commission Distribution Flow Tests - Summary

## Overview

Tests verify the distribution of platform commission and royalties for minting, claiming, selling, and renting operations across all KAMI NFT contracts.

## Test Parameters

-   **Mint Price**: 100 tokens (6 decimals)
-   **Platform Commission**: 20% (2000 basis points)
-   **Royalty Percentage**: 10% (1000 basis points)
-   **Royalty Receivers**: 2 receivers, each with 50% (5000 basis points)

## Test Results ✅

### ✅ Mint Flow (KAMI721C, KAMI1155C)

**Expected Distribution:**

-   Platform receives: 20 tokens
-   Receiver 1 receives: 40 tokens
-   Receiver 2 receives: 40 tokens

**How it works:**

1. User pays 100 tokens for minting
2. Platform commission calculated: 100 × 20% = 20 tokens
3. Remaining amount: 100 - 20 = 80 tokens
4. Total remaining (80 tokens) is distributed to mint royalty receivers based on their percentages:
    - Receiver 1: 80 × 50% = 40 tokens
    - Receiver 2: 80 × 50% = 40 tokens

**Status**: ✅ **PASSING** - Funds are correctly distributed to platform and royalty receivers.

### ✅ Claim Flow (KAMI721AC)

**Expected Distribution:**

-   Platform receives: 20 tokens
-   Receiver 1 receives: 40 tokens
-   Receiver 2 receives: 40 tokens

**How it works:**

1. User pays 100 tokens to claim
2. Platform commission: 100 × 20% = 20 tokens
3. Remaining amount: 100 - 20 = 80 tokens
4. Entire remaining amount (80 tokens) is distributed to mint royalty receivers based on their percentages:
    - Receiver 1: 80 × 50% = 40 tokens
    - Receiver 2: 80 × 50% = 40 tokens
5. Claimer receives the NFT

**Status**: ✅ **PASSING** - Funds are correctly distributed to platform and mint royalty receivers (follows mint logic, not sale logic).

### ✅ Sale Flow (All Contracts)

**Expected Distribution:**

-   Platform receives: 20 tokens
-   Receiver 1 receives: 4 tokens
-   Receiver 2 receives: 4 tokens
-   Seller receives: 72 tokens

**How it works:**

1. Sale price: 100 tokens
2. Platform commission: 100 × 20% = 20 tokens
3. Remaining amount: 100 - 20 = 80 tokens
4. Royalty calculated on remaining: 80 × 10% = 8 tokens
5. Royalty distributed to transfer royalty receivers:
    - Receiver 1: 8 × 50% = 4 tokens
    - Receiver 2: 8 × 50% = 4 tokens
6. Seller receives: 80 - 8 = 72 tokens

**Status**: ✅ **PASSING** - Funds are correctly distributed to platform, royalty receivers, and seller.

### ✅ Rental Flow (All Contracts)

**Expected Distribution:**

-   Platform receives: 20 tokens
-   Receiver 1 receives: 4 tokens
-   Receiver 2 receives: 4 tokens
-   Token owner receives: 72 tokens

**How it works:**

1. Rental price: 100 tokens
2. Platform commission: 100 × 20% = 20 tokens
3. Remaining amount: 100 - 20 = 80 tokens
4. Royalty calculated on remaining: 80 × 10% = 8 tokens
5. Royalty distributed to mint royalty receivers (rental uses mint royalties):
    - Receiver 1: 8 × 50% = 4 tokens
    - Receiver 2: 8 × 50% = 4 tokens
6. Token owner receives: 80 - 8 = 72 tokens

**Status**: ✅ **PASSING** - Funds are correctly distributed to platform, royalty receivers, and token owner.

## Test Files Created

1. **test/KAMI721C_flow.test.ts** - 3 tests passing ✅
2. **test/KAMI1155C_flow.test.ts** - 3 tests passing ✅
3. **test/KAMI721AC_flow.test.ts** - 3 tests passing ✅

## Changes Made

### 1. Fixed Rental Flow Implementation

Updated `contracts/libraries/KamiRental.sol`:

-   `rentToken()` and `extendRental()` now calculate and distribute royalties on remaining amount after platform commission
-   Royalties are distributed to mint royalty receivers
-   Token owner receives the remainder (80 - 8 = 72)

### 2. Fixed KAMI721AC Claim Flow

Updated `contracts/KAMI721AC.sol`:

-   **claim()** function now follows **mint distribution pattern** (not sale):
    -   Pays platform commission
    -   Distributes entire remaining amount to mint royalty receivers
    -   Uses mint royalties, not transfer royalties
    -   No royalty percentage calculation - full amount distributed
-   **Fixed \_beforeTokenTransfer hook**:
    -   Added check to skip validation for minting operations (`from == address(0)`)
    -   This was causing "Transfer from zero address" errors during claim

### 3. Created Comprehensive Tests

All tests verify:

-   Platform receives correct commission (20)
-   Royalty receivers receive correct amounts:
    -   Mint/Claim: 40 each (entire remaining 80 distributed)
    -   Sale/Rental: 4 each (8 royalty from remaining 80)
-   Sellers/owners receive correct amounts
-   All calculations use the specified percentages

## Total Test Results

-   **KAMI721C**: 3/3 tests passing ✅
-   **KAMI1155C**: 3/3 tests passing ✅
-   **KAMI721AC**: 3/3 tests passing ✅
-   **Total**: 9/9 tests passing ✅

## Running the Tests

```bash
# Run all flow tests
npm test -- test/KAMI721C_flow.test.ts
npm test -- test/KAMI1155C_flow.test.ts
npm test -- test/KAMI721AC_flow.test.ts

# Run all flow tests together
npm test -- test/*_flow.test.ts
```

## Conclusion

All tests successfully verify that platform commission and royalties are distributed correctly for all three operations (minting, claiming, selling, and renting) across all contract types. The distribution logic is now consistent and follows the specified patterns.
