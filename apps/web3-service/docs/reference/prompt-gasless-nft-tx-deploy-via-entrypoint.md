# Cursor prompt: Add EntryPoint path for sponsored deployment (gasless-nft-tx)

Use this prompt when working in the **gasless-nft-tx** library repo to add support for deploying via the EntryPoint so that standard ERC-4337 v0.7 SimpleAccounts that only allow EntryPoint (or owner) to call `execute()` no longer revert with "Account: not Owner or EntryPoint".

---

## Prompt (copy below)

**Goal:** Support deploying KAMI contracts via the EntryPoint (UserOperation) in `KamiSponsoredDeployment`, so that it works with a **standard ERC-4337 v0.7 SimpleAccount** that only accepts `execute()` calls from the **EntryPoint** or the **owner** EOA. Currently the library sends a **direct transaction** from the platform EOA to `SimpleAccount.execute(contractDeployer, 0, deployCalldata)`. On some chains the SimpleAccount reverts with **"Account: not Owner or EntryPoint"** because the account is configured to allow only the EntryPoint (or a different owner). We need an optional path that uses the EntryPoint instead of a direct tx.

**Context:**

-   We use a **standard v0.7 SimpleAccount** (ERC-4337). Its `execute()` is restricted so only the **owner** EOA or the **EntryPoint** can call it.
-   **KamiSponsoredOperations** already supports this via `SponsoredOperationsConfig.useEntryPointForExecute` and `entryPointAddress`. When `useEntryPointForExecute === true`, it calls `submitExecuteViaEntryPoint()` from `SmartContractWallet/simpleAccountUserOp` (build UserOp with `callData = execute(dest, value, func)`, sign as owner, submit via `EntryPoint.handleOps`). The deployment module does **not** have this yet.
-   **KamiSponsoredDeployment** currently only does: platform EOA → `SimpleAccount.execute(contractDeployerAddress, 0, deployCalldata)`. So if the SimpleAccount only allows EntryPoint, deployment fails.

**Requirements:**

1. **SponsoredDeploymentConfig** (in `kami-sponsored-deployment`): Add optional `useEntryPointForExecute?: boolean` and `entryPointAddress?: Address` (same semantics as in SponsoredOperationsConfig). Default behaviour remains direct EOA → SimpleAccount.execute() when these are not set.
2. **deployViaPlatformSimpleAccount(bytecode)** in the same module: When `config.useEntryPointForExecute === true`, do **not** send a direct tx. Instead:
    - Build the same `executeCalldata` as today: `SimpleAccount.execute(contractDeployerAddress, 0n, deployCalldata)` where `deployCalldata = encodeFunctionData({ abi: ContractDeployer.deploy ABI, functionName: 'deploy', args: [bytecode] })`.
    - Call **submitExecuteViaEntryPoint** (from `SmartContractWallet/simpleAccountUserOp`) with: `executeCalldata` = that execute calldata, `simpleAccountAddress` = config.platformSimpleAccountAddress, `ownerAccount` = platform EOA address (from platformPrivateKey), `beneficiary` = platform EOA, `chainId`, and the same gas/fee hints you use for the direct tx path. Use `config.entryPointAddress ?? ENTRY_POINT_V07_ADDRESS`.
    - On success, get `transactionHash` from the result and then wait for the receipt and extract the deployed contract address from logs (same as today). On failure, return `{ success: false, error: result.error }`.
3. Ensure the SimpleAccount has a **deposit in the EntryPoint** when using this path (document this in JSDoc / README: user must call `addDeposit()` for the SimpleAccount if using `useEntryPointForExecute`).
4. **No breaking changes:** existing callers that do not set `useEntryPointForExecute` keep the current direct-tx behaviour.

**Implementation notes:**

-   Reuse `submitExecuteViaEntryPoint` from `simpleAccountUserOp`; no need to duplicate UserOp building.
-   **handleOps gas limit:** The tx that calls `EntryPoint.handleOps([userOp], beneficiary)` must use a gas limit high enough for the UserOp calldata (deployment bytecode is large). The library currently uses `gas: 500000n` in `simpleAccountUserOp.js`; this can fail with "insufficient gas for floor data gas cost: gas 500000, minimum needed 1075550". Use at least **1500000** (1.5M) for the handleOps writeContract call when deploying via EntryPoint.
-   The deploy flow already has `publicClient`, `walletClient`, and the platform account; pass those plus the new config flags into the EntryPoint path.
-   Keep existing retry and receipt handling; only the way the tx is sent changes when `useEntryPointForExecute` is true.

Implement the above so that when a consumer sets `useEntryPointForExecute: true` (and optionally `entryPointAddress`) on `SponsoredDeploymentConfig`, deployment goes through the EntryPoint and works with SimpleAccounts that only allow EntryPoint (or owner) to call `execute()`.
