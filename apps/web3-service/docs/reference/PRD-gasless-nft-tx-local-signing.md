# Product Requirements Document: Local Signing for gasless-nft-tx (Fix RPC personal_sign / eth_sendTransaction)

## Overview

Update the `@paulstinchcombe/gasless-nft-tx` library so that all signing performed by the platform account (EOA derived from `platformPrivateKey`) is done **locally** using the account’s private key, and never delegated to the RPC via `personal_sign` or `eth_sendTransaction`. This ensures the library works with **public RPC endpoints** (e.g. drpc.org, Alchemy, Infura) that do not support these methods.

## Background

The library uses viem’s `createWalletClient` with `account: privateKeyToAccount(platformPrivateKey)` and `transport: http(config.rpcUrl)`. When the code calls:

-   `walletClient.signMessage({ message, account: ownerAccount })` (e.g. in `submitExecuteViaEntryPoint` for UserOp signing), or
-   `walletClient.writeContract(… { account: ownerAccount })` (e.g. for `handleOps`),

viem can send `personal_sign` and `eth_sendTransaction` to the RPC. Many **public** RPC providers reject these with:

-   **Status:** 400
-   **Details:** `{"message":"method is not available","code":-32601}`

As a result, any flow that uses the EntryPoint path (UserOperations) or that relies on the wallet client to sign fails in production when using a public RPC URL (e.g. `https://base-sepolia.drpc.org/`).

## Problem Statement

-   **Symptom:** Sponsored operations that use the EntryPoint (e.g. `transferPaymentToken` with `useEntryPointForExecute`, or mint flow that transfers tokens from user then executes via UserOp) fail with:
    -   `HTTP request failed`, `method is not available` (-32601), and a request body showing `personal_sign` or similar.
-   **Root cause:** The wallet client’s transport is plain `http(rpcUrl)`. Viem uses the RPC for signing when the API is used in a way that doesn’t force use of the in-process account (e.g. passing `account: ownerAccount` as an address).
-   **Impact:** Deployments using public RPCs cannot complete sponsored mints, payment token transfers via EntryPoint, or any other operation that goes through `submitExecuteViaEntryPoint` or equivalent signing paths.

## Goals

1. **Compatibility with public RPCs:** The library must work when `SponsoredOperationsConfig.rpcUrl` points to a public RPC that does **not** support `personal_sign` or `eth_sendTransaction`.
2. **No API changes:** The fix is internal to the library (transport / wallet client construction). No changes to `SponsoredOperationsConfig`, method signatures, or consumer code.
3. **Single source of truth:** The fix lives in the library so that consumers (e.g. kami-platform-web3-service) do not need to maintain a pnpm patch.

## Non-Goals

-   Supporting RPCs that do not support `eth_sendRawTransaction` (required for sending signed transactions).
-   Changing how user/client signatures are produced or verified; only **platform** signing behavior is in scope.

---

## Requirements

### Functional Requirements

1. **Local handling of `personal_sign`**

    - When the wallet client’s transport receives a request with `method: 'personal_sign'` and the signer address (second parameter) matches the platform account’s address, the transport must:
        - Sign the message locally using the platform account’s `signMessage` (EIP-191).
        - Return the signature to the caller without calling the RPC for `personal_sign`.
    - All other `personal_sign` requests (e.g. different address) should be forwarded to the RPC as today.

2. **Local handling of `eth_sendTransaction` / `wallet_sendTransaction`**

    - When the transport receives a request with `method: 'eth_sendTransaction'` or `'wallet_sendTransaction'` and the transaction’s `from` is the platform account’s address, the transport must:
        - Sign the transaction locally using the platform account’s `signTransaction` (with appropriate nonce and gas fields from the RPC as needed).
        - Send the signed transaction via `eth_sendRawTransaction` on the RPC.
        - Return the result of `eth_sendRawTransaction` to the caller.
    - All other send requests should be forwarded to the RPC as today.

3. **Scope of the custom transport**

    - The custom transport must be used for the **wallet client** used by:
        - `KamiSponsoredOperations` (and any code paths that use its internal `walletClient`, including `submitExecuteViaEntryPoint`).
    - The **public client** (read-only) should continue to use `http(config.rpcUrl)` with no interceptors.

4. **Backward compatibility**
    - Behavior when using an RPC that **does** support `personal_sign` / `eth_sendTransaction` must remain correct (local signing is still valid and preferred).
    - No new required fields in `SponsoredOperationsConfig`; optional fields (e.g. custom transport) are acceptable if documented.

### Technical Requirements

1. **Implementation location**

    - **Package:** `@paulstinchcombe/gasless-nft-tx`
    - **File(s):** Where the wallet client is created (e.g. `kami-sponsored-operations.ts` and any other classes that create a wallet client with `platformPrivateKey`).
    - Prefer a small, reusable helper (e.g. `createHttpTransportWithLocalSign(rpcUrl, account)`) so the same logic can be used in all such places.

2. **Transport contract**

    - The helper creates a transport that:
        - Wraps `http(rpcUrl)` for all non-signing and non-send requests.
        - Intercepts `request({ method, params })` and:
            - For `personal_sign` with matching account: call `account.signMessage({ message: { raw: messageHex } })` and return the signature.
            - For `eth_sendTransaction` / `wallet_sendTransaction` with `from === account.address`: resolve nonce/gas if needed via the underlying transport, sign with `account.signTransaction`, then call `eth_sendRawTransaction` via the underlying transport and return the result.
            - Otherwise: forward to the underlying transport’s `request`.

3. **Dependencies**

    - Use only viem and viem/accounts already in the package. No new dependencies.

4. **Chain / nonce / gas**

    - When implementing the `eth_sendTransaction` intercept, ensure:
        - Nonce is fetched (e.g. `eth_getTransactionCount`) so repeated sends are correct.
        - Gas fields (e.g. `maxFeePerGas`, `maxPriorityFeePerGas`) are set if missing (e.g. from `eth_gasPrice` or chain defaults) so the signed transaction is valid.
        - Transaction type (e.g. EIP-1559) is set so viem’s serializer accepts it.

5. **Error handling**
    - If the account does not support `signMessage` or `signTransaction`, throw a clear error.
    - If the underlying RPC fails (e.g. for `eth_sendRawTransaction` or for nonce/gas), propagate the error; no silent fallback to RPC `personal_sign`/`eth_sendTransaction`.

---

## Acceptance Criteria

1. **Unit / integration**

    - With a wallet client created using the new transport and `privateKeyToAccount(platformPrivateKey)`:
        - A call that triggers `personal_sign` for the platform account returns a valid signature without sending `personal_sign` to the RPC.
        - A call that triggers `eth_sendTransaction` for the platform account results in a single `eth_sendRawTransaction` (and supporting `eth_getTransactionCount` / `eth_gasPrice` as needed) and no `eth_sendTransaction` to the RPC.

2. **End-to-end**

    - Sponsored mint flow that:
        - Uses a public RPC URL that does **not** support `personal_sign`, and
        - Includes payment token transfer then execution via EntryPoint (UserOp),
    - completes successfully (mint + token transfer) without any `method is not available` (-32601) errors.

3. **Regression**
    - Existing tests that use a local or signing-capable RPC continue to pass.
    - Direct execution path (non-EntryPoint) and EntryPoint path both work when the RPC supports only standard read + `eth_sendRawTransaction`.

---

## Implementation Notes

1. **Reference implementation**  
   The consumer repo (kami-platform-web3-service) already implements this behavior in:

    - `src/lib/gasless-nft/operations.ts`: `createHttpTransportWithLocalSign(rpcUrl, account)` and its use for the setSalePrice EntryPoint path.
    - A pnpm patch applied to `@paulstinchcombe/gasless-nft-tx@0.15.2` adds the same helper and uses it in `KamiSponsoredOperations` constructor when creating `this.walletClient`.  
      The library implementation can mirror this logic so the patch can be removed from the consumer.

2. **Where to apply**

    - In `KamiSponsoredOperations` (and any similar class that holds a wallet client backed by `platformPrivateKey`): replace `transport: http(config.rpcUrl)` with `transport: createHttpTransportWithLocalSign(config.rpcUrl, this.platformAccount)` when creating the wallet client.
    - If other modules (e.g. deployment, payment handler) create their own wallet client from the same config, they should use the same transport for consistency.

3. **Viem version**
    - Match the transport’s `request` signature and the way viem passes `chain` and serializers (e.g. for `signTransaction`) to the version of viem the library targets, so that nonce and gas handling remain correct across viem upgrades.

---

## Out of Scope

-   Changing how **user** (buyer/minter) signatures are created or verified.
-   Adding optional custom transport injection in the config (can be a follow-up if desired).
-   Supporting RPCs that do not support `eth_sendRawTransaction`, or that lack `eth_getTransactionCount` / `eth_gasPrice`.

---

## Success Criteria

-   The library works with public RPC URLs (e.g. Base Sepolia via drpc.org) for all sponsored operations that use the platform wallet client, including EntryPoint (UserOp) flows.
-   Consumers can remove any pnpm patch that was added solely to work around the `personal_sign` / `eth_sendTransaction` RPC limitation.
-   No breaking API or config changes for existing consumers.
