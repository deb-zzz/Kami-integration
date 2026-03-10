# Product Requirements Document: Sponsored Payment Token Transfer

## Overview

Add a public method to the `KamiSponsoredOperations` class in the `gasless-nft-tx` library to enable gasless payment token transfers between addresses. The platform pays ALL gas fees, users pay ZERO.

## Background

Currently, the `gasless-nft-tx` library supports sponsored operations for NFT-related functions (mint, sell, setPrice, etc.) but does not provide a public method for transferring payment tokens (ERC20) between addresses with sponsored gas.

The KAMI platform needs this functionality to enable gasless payment token transfers for various use cases such as:

-   Refunding users
-   Transferring tokens between platform accounts
-   Facilitating payments without requiring users to hold native tokens for gas

## Requirements

### Functional Requirements

1. **Method Signature**

    ```typescript
    transferPaymentToken(
      paymentTokenAddress: Address,
      params: SponsoredPaymentTokenTransferParams,
      userSignature: SponsoredOperationSignature
    ): Promise<SponsoredOperationResult>
    ```

    **Parameters:**

    - `paymentTokenAddress`: The ERC20 payment token contract address (e.g., USDC, USDT)
    - `params`: Transfer parameters object (see below)
    - `userSignature`: User's signed authorization for the transfer

    **New Type Definition:**

    ```typescript
    interface SponsoredPaymentTokenTransferParams {
    	from: Address; // Source wallet address (must match signature)
    	to: Address; // Destination wallet address
    	amount: bigint | string; // Amount to transfer (in token's smallest unit)
    }
    ```

    **Note:** The `KamiSponsoredOperations` instance is already configured with:

    - `chain`: Chain configuration (from `SponsoredOperationsConfig`)
    - `rpcUrl`: RPC endpoint URL
    - `platformSimpleAccountAddress`: Platform's SimpleAccount address
    - `paymentToken`: Default payment token (may differ from `paymentTokenAddress` parameter)

    The `chainId` and other blockchain configuration are provided via the constructor's `SponsoredOperationsConfig`, not as method parameters.

2. **Operation Flow**

    - User signs a message authorizing the transfer (from, to, amount, nonce, timestamp)
    - Platform verifies the signature
    - Platform checks if SimpleAccount has sufficient allowance from `fromAddress`
    - If insufficient allowance, platform executes approval via SimpleAccount (sponsored)
    - Platform executes `transferFrom(fromAddress, toAddress, amount)` via SimpleAccount (sponsored)
    - Platform pays ALL gas fees
    - Returns transaction hash and success status

3. **Signature Parameters**
   The user signature should be generated client-side using the user's private key and include:

    - `userAddress`: Source wallet address (must match `params.from`)
    - `operation`: "transferPaymentToken"
    - `contractAddress`: The payment token contract address (same as `paymentTokenAddress` parameter)
    - `parameters`: Object containing:
        - `from`: Source wallet address
        - `to`: Destination wallet address
        - `amount`: Amount to transfer (as string for JSON serialization to handle BigInt)
    - `signature`: EIP-191 signed message hash
    - `timestamp`: Current timestamp (Unix epoch in seconds)
    - `nonce`: Unique nonce to prevent replay attacks (optional but recommended)

    **Signature Generation (Client-Side):**

    ```typescript
    // Client-side example (not in library)
    const message = `Execute transferPaymentToken on ${paymentTokenAddress} with params: ${JSON.stringify({
    	from: fromAddress,
    	to: toAddress,
    	amount: amount.toString(),
    })}`;

    const signature = await walletClient.signMessage({
    	account: userAccount,
    	message,
    });

    const userSignature = createSponsoredOperationSignature(
    	fromAddress,
    	'transferPaymentToken',
    	paymentTokenAddress,
    	{ from: fromAddress, to: toAddress, amount: amount.toString() },
    	signature
    );
    ```

    **Important:** The library method should NOT require or accept private keys. All signatures must be generated client-side and passed in as `SponsoredOperationSignature` objects.

4. **Error Handling**

    - Invalid signature → Return error
    - Insufficient balance → Return error
    - Insufficient allowance → Auto-approve (sponsored) then retry transfer
    - Transaction failure → Return error with details

5. **Security Considerations**

    - **Signature Verification:**

        - Verify `userSignature.userAddress` matches `params.from`
        - Verify `userSignature.contractAddress` matches `paymentTokenAddress`
        - Verify `userSignature.operation` is "transferPaymentToken"
        - Verify signature parameters match method parameters (from, to, amount)
        - Verify signature timestamp is recent (e.g., within 5 minutes)
        - Verify signature nonce (if provided) to prevent replay attacks
        - Use existing `verifyUserSignature` method for cryptographic verification

    - **Access Control:**

        - Only allow transfers from addresses that have signed the operation
        - Reject if `fromAddress` doesn't match signature
        - Reject if signature is expired (> 5 minutes old)

    - **Input Validation:**

        - Validate all addresses are valid Ethereum addresses
        - Validate amount is positive and non-zero
        - Validate payment token address is a contract
        - Check balance before attempting transfer

    - **Private Key Security:**
        - **CRITICAL:** Method must NOT accept or require user private keys
        - All signatures must be generated client-side
        - Library should only verify signatures, never generate them

### Technical Requirements

1. **Implementation Location**

    - File: `kami-sponsored-operations.ts` (or `.js`)
    - Class: `KamiSponsoredOperations`
    - Visibility: Public method

2. **Dependencies**

    - Use existing `executeViaPlatformSimpleAccount` private method
    - Use existing `verifyUserSignature` private method
    - Use existing ERC20 ABI definitions
    - Use existing `createSponsoredOperationSignature` utility function (for client-side signature creation)

3. **Configuration Requirements**
   The `KamiSponsoredOperations` instance must be initialized with `SponsoredOperationsConfig` containing:

    - `rpcUrl`: RPC endpoint for the target blockchain
    - `platformPrivateKey`: Platform's funding wallet private key (for gas payments)
    - `platformSimpleAccountAddress`: Platform's SimpleAccount contract address
    - `paymentToken`: Default payment token address (may be overridden by `paymentTokenAddress` parameter)
    - `chain`: Viem chain configuration object

    **Example:**

    ```typescript
    const config: SponsoredOperationsConfig = {
    	rpcUrl: 'https://sepolia.base.org',
    	platformPrivateKey: '0x...',
    	platformSimpleAccountAddress: '0x...',
    	paymentToken: '0x...', // Default payment token
    	chain: baseSepolia,
    };
    const handler = new KamiSponsoredOperations(config);
    ```

4. **ERC20 Functions Used**

    - `allowance(owner, spender)`: Check if SimpleAccount has approval
    - `approve(spender, amount)`: Approve SimpleAccount to spend tokens (if needed)
    - `transferFrom(from, to, amount)`: Execute the actual transfer

5. **Transaction Flow**

    ```
    1. Verify user signature matches fromAddress and parameters
    2. Validate signature timestamp (reject if > 5 minutes old)
    3. Check fromAddress token balance on paymentTokenAddress
    4. Check SimpleAccount allowance from fromAddress
    5. If allowance < amount:
       a. Execute approve(spender=SimpleAccount, amount) via SimpleAccount.execute
       b. Wait for approval transaction confirmation
       c. Verify approval was successful
    6. Execute transferFrom(fromAddress, toAddress, amount) via SimpleAccount.execute
    7. Wait for transfer transaction confirmation
    8. Parse and log Transfer event from payment token
    9. Return SponsoredOperationResult with transaction hash
    ```

6. **Required Fields Summary**

    - **Method Parameters:**

        - `paymentTokenAddress`: ERC20 token contract address
        - `params.from`: Source wallet address
        - `params.to`: Destination wallet address
        - `params.amount`: Transfer amount (bigint or string)
        - `userSignature`: Pre-generated signature object

    - **Constructor Configuration (via SponsoredOperationsConfig):**

        - `rpcUrl`: Blockchain RPC endpoint
        - `platformPrivateKey`: Platform's private key for gas payments
        - `platformSimpleAccountAddress`: SimpleAccount contract address
        - `paymentToken`: Default payment token (optional, can be overridden)
        - `chain`: Viem chain configuration

    - **NOT Required (should be rejected if provided):**
        - User's private key (signatures must be client-side)
        - ChainId (already in config)
        - RPC URL (already in config)

### Non-Functional Requirements

1. **Performance**

    - Should complete within reasonable time (< 30 seconds for approval + transfer)
    - Handle network congestion gracefully

2. **Logging**

    - Log all steps of the transfer process
    - Log approval transactions separately
    - Log transfer transactions with clear indicators

3. **Error Messages**
    - Provide clear, actionable error messages
    - Include transaction hashes in error responses when available

## Implementation Status

✅ **COMPLETED** - The `transferPaymentToken` method has been implemented in the `gasless-nft-tx` library.

The implementation in `src/lib/gasless-nft.ts` has been updated to use the library's `transferPaymentToken` method instead of the previous workaround.

**Previous Workaround (Replaced):**
- Manual SimpleAccount execution pattern
- Manual approval handling
- Not using library's retry logic
- Missing proper error handling patterns

**Current Implementation:**
- Uses library's `transferPaymentToken` method
- Integrated with library's signature verification
- Automatic approval handling via library
- Uses library's retry logic
- Proper error handling via library

## Acceptance Criteria

-   [x] Method is publicly accessible on `KamiSponsoredOperations` class
-   [x] Method accepts `paymentTokenAddress`, `SponsoredPaymentTokenTransferParams`, and `userSignature`
-   [x] Method does NOT accept private keys (signatures must be client-side) - Note: `userPrivateKey` is optional in params but should not be used
-   [x] Method verifies user signature matches `fromAddress` and parameters
-   [x] Method validates signature timestamp (rejects expired signatures)
-   [x] Method checks token balance before transfer
-   [x] Method automatically handles approval if needed (sponsored)
-   [x] Method executes transfer via SimpleAccount (sponsored)
-   [x] Method returns `SponsoredOperationResult` with success status and transaction hash
-   [x] Method includes comprehensive logging
-   [x] Method handles all error cases gracefully
-   [x] TypeScript types are exported (`SponsoredPaymentTokenTransferParams`)
-   [ ] Documentation is updated with usage examples (library documentation)
-   [x] Client-side signature generation example is provided (in PRD)

## Implementation Notes

1. **Approval Handling**

    - The approval step requires the `fromAddress` to approve the SimpleAccount
    - If not approved, the method should execute an approval transaction first (sponsored)
    - Consider using `type(uint256).max` for approval to avoid repeated approvals
    - Approval must be executed via SimpleAccount.execute, not directly
    - Wait for approval transaction confirmation before proceeding with transfer

2. **Signature Verification**

    - Reuse existing `verifyUserSignature` private method
    - Ensure signature includes all transfer parameters (from, to, amount)
    - Verify signature matches `fromAddress` (userSignature.userAddress === params.from)
    - Verify signature contract address matches paymentTokenAddress
    - Verify signature operation is "transferPaymentToken"
    - Check timestamp is within acceptable window (e.g., 5 minutes)

3. **Gas Optimization**

    - Approval and transfer must be sequential (can't batch)
    - Consider caching allowance checks to avoid unnecessary reads
    - Use existing retry logic from `sendTransactionWithRetry`

4. **Error Handling**

    - Invalid signature → Return error immediately
    - Insufficient balance → Return clear error message
    - Insufficient allowance → Auto-approve, then retry transfer
    - Approval failure → Return error with approval transaction hash
    - Transfer failure → Return error with transfer transaction hash
    - Network errors → Use existing retry mechanisms

5. **Testing Considerations**

    - Test with insufficient allowance (should auto-approve then transfer)
    - Test with sufficient allowance (should skip approval, transfer directly)
    - Test with insufficient balance (should fail gracefully with clear error)
    - Test signature verification:
        - Valid signature with matching parameters
        - Invalid signature (wrong private key)
        - Signature with mismatched fromAddress
        - Signature with mismatched parameters
        - Expired signature (old timestamp)
    - Test replay attack prevention (nonce/timestamp validation)
    - Test with different payment tokens (USDC, USDT, etc.)
    - Test on different chains (Base Sepolia, Base Mainnet, etc.)

6. **Usage Example**

    ```typescript
    // Client-side: Generate signature
    const params = {
    	from: '0x...',
    	to: '0x...',
    	amount: BigInt('1000000'), // 1 USDC (6 decimals)
    };

    const userSignature = await generateSignature(userPrivateKey, 'transferPaymentToken', paymentTokenAddress, params);

    // Server-side: Execute transfer
    const config: SponsoredOperationsConfig = {
    	rpcUrl: 'https://sepolia.base.org',
    	platformPrivateKey: platformKey,
    	platformSimpleAccountAddress: simpleAccountAddress,
    	paymentToken: defaultPaymentToken,
    	chain: baseSepolia,
    };

    const handler = new KamiSponsoredOperations(config);
    const result = await handler.transferPaymentToken(paymentTokenAddress, params, userSignature);
    ```

## Related Issues

-   Current implementation: `src/lib/gasless-nft.ts::transferPaymentToken()`
-   Route using this: `src/app/api/blockchain/[walletAddress]/sponsoredPaymentTokenTransfer/route.ts`

## Priority

**High** - This functionality is needed for the KAMI platform's payment token transfer features.

## Timeline

-   Implementation: 2-3 days
-   Testing: 1-2 days
-   Documentation: 1 day
-   **Total: ~1 week**
