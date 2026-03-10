# Separate Mint Price and Sale Price Implementation

## Overview

Currently, `tokenPrices` mapping serves dual purpose - it's used for both mint/claim prices and sale prices. This creates a problem where the creator changing mint prices affects existing token sale prices. We need to separate these concerns.

## Changes Required

### Storage Variables

- Add `uint256 public mintPrice` - global mint/claim price (settable by OWNER_ROLE)
- Rename `tokenPrices` to `salePrices` - per-token sale prices (settable by token owner)
- Keep backward compatibility considerations for existing deployments

### Functions to Modify

#### KAMI721AC.sol and KAMI721ACUpgradable.sol:

1. **Add `setMintPrice(uint256 newMintPrice)` function** (OWNER_ROLE only)

   - Sets the global mint price for all future mints/claims

2. **Update `mint()` function**

   - Use `mintPrice` instead of `tokenPrice` parameter
   - Set `salePrices[tokenId] = mintPrice` after minting
   - Use `mintPrice` for payment and royalty calculations during mint

3. **Update `claim()` function**

   - Use `mintPrice` instead of `tokenPrice` parameter
   - Set `salePrices[tokenId] = mintPrice` after claiming
   - Use `mintPrice` for payment and royalty calculations during claim

4. **Update `batchClaimFor()` and `batchClaim()` functions**

   - Use `mintPrice` instead of `prices[]` parameter
   - Set `salePrices[tokenId] = mintPrice` for each token
   - Use `mintPrice` for payment and royalty calculations

5. **Update `setPrice()` function**

   - Rename to `setSalePrice(uint256 tokenId, uint256 newSalePrice)`
   - Change access control: only token owner can set (not OWNER_ROLE)
   - Update `salePrices[tokenId]` instead of `tokenPrices[tokenId]`

6. **Update `sellToken()` function**

   - Use `salePrices[tokenId]` instead of `tokenPrices[tokenId]`
   - Use sale price for royalty calculations

7. **Update `royaltyInfo()` function**

   - Use `salePrice` parameter if provided (for actual sales)
   - Fallback to `salePrices[tokenId]` if salePrice is 0
   - This handles both mint-time (mint price) and sell-time (sale price) contexts

8. **Update `getRoyaltyInfo()` function**

   - Use `salePrices[tokenId]` for royalty calculations
   - Add optional parameter to specify which price to use, or always use sale price

### Events

- Add `MintPriceUpdated(uint256 oldPrice, uint256 newPrice)` event
- Add `SalePriceUpdated(uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice)` event

### Error Messages

- Add `MintPriceNotSet()` error
- Update `TokenPriceNotSet()` to `SalePriceNotSet()` for consistency

## Implementation Details

### Initialization

- For KAMI721AC: Set `mintPrice` in constructor (optional parameter, default 0)
- For KAMI721ACUpgradable: Set `mintPrice` in `initialize()` function (optional parameter, default 0)

### Backward Compatibility

- Consider keeping `tokenPrices` as a view function that returns `salePrices` for backward compatibility
- Or add a migration path if needed

## Files to Modify

1. `contracts/KAMI721AC.sol`
2. `contracts/KAMI721ACUpgradable.sol`

### To-dos

- [ ] Add mintPrice storage variable and setSalePrice/setMintPrice functions to KAMI721AC.sol
- [ ] Update mint(), claim(), batchClaimFor(), and batchClaim() functions in KAMI721AC.sol to use global mintPrice
- [ ] Update sellToken(), royaltyInfo(), and getRoyaltyInfo() functions in KAMI721AC.sol to use salePrices
- [ ] Add mintPrice storage variable and setSalePrice/setMintPrice functions to KAMI721ACUpgradable.sol
- [ ] Update mint(), claim(), batchClaimFor(), and batchClaim() functions in KAMI721ACUpgradable.sol to use global mintPrice
- [ ] Update sellToken(), royaltyInfo(), and getRoyaltyInfo() functions in KAMI721ACUpgradable.sol to use salePrices

