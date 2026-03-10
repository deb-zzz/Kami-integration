# pnpm patches

No patches are currently applied. The `gasless-nft-tx` library now supports a configurable **handleOpsGasLimit** (and **callGasLimit**) in `SponsoredOperationsConfig`, so we pass those from this service and no longer need a patch for the outer handleOps transaction gas limit.

**If you need to patch again** (e.g. for a different fix before the library supports it):

1. `pnpm patch @paulstinchcombe/gasless-nft-tx`
2. Edit the package in the path printed.
3. `pnpm patch-commit <path-from-step-1>`
4. Re-add `patchedDependencies` in `package.json` and ensure `COPY patches ./patches` runs before each `pnpm install` in the Dockerfile.

**Historical:** A previous patch raised the handleOps outer gas limit (1.5M → 4M) to fix AA95 out of gas; that is now handled by the library’s `handleOpsGasLimit` option. Another earlier patch added local-sign transport for the user wallet client; if needed again, regenerate it against the current package version (see git history).
