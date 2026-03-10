import { Router, Request, Response } from 'express';
import { WalletService } from '../services/WalletService';
import { platformWallet, PlatformWalletReport } from "../types";
import { isValidAddress } from "../utils/common";
import { getAlertRecipients, getWalletThreshold } from "../config/platform-balance-alert";

const router: Router = Router();

/**
 * GET /balance-alert
 *
 * Scheduled job endpoint that:
 * - Retrieves all platform wallets.
 * - Fetches ETH & USDC balances for each wallet address.
 * - Generates a comprehensive balance report for each chain.
 * - Sends a low-balance email alert if any wallet falls below a threshold.
 * - Returns all collected reports as JSON.
 *
 * This route does not modify the database state and is safe to run periodically.
 *
 * @route GET /balance-alert
 * @returns JSON array of `PlatformWalletReport` objects.
 */
router.get('/balance-alert', async (_req: Request, res: Response) => {
    console.log(`[Scheduler] Start balance alert job at ${new Date().toISOString()}`);

    const allWalletBalanceResults = [];
    const errors = [];

    try {
        const platformWallets: platformWallet[] = await WalletService.getAllPlatformWallets();
        if (platformWallets.length === 0) throw new Error("No platform wallets found.");

        for (const wallet of platformWallets) {
            try {
                const chainId: string = wallet.chainId;

                const blockchain = await WalletService.getBlockchain(chainId);
                if (!blockchain) throw new Error("Blockchain not found.");
                console.log(`blockchain:`, chainId, `(${blockchain.name}) -`, blockchain.rpcUrl, blockchain.paymentTokens);

                const USDC = blockchain.paymentTokens.find((t) => t.symbol === "USDC");
                if (!USDC) throw new Error("USDC token contract address not found.");

                const labeledAddresses = [
                    { label: "simpleAccountAddress", addr: wallet.simpleAccountAddress },
                    { label: "contractDeployerAddress", addr: wallet.contractDeployerAddress },
                    { label: "platformFundingWalletAddress", addr: wallet.platformFundingWalletAddress },
                    { label: "platformAddress", addr: wallet.platformAddress },
                    { label: "kamiNFTCoreLibraryAddress", addr: wallet.kamiNFTCoreLibraryAddress },
                    { label: "kamiPlatformLibraryAddress", addr: wallet.kamiPlatformLibraryAddress },
                    { label: "kamiRentalLibraryAddress", addr: wallet.kamiRentalLibraryAddress },
                    { label: "kamiRoyaltyLibraryAddress", addr: wallet.kamiRoyaltyLibraryAddress },
                    { label: "kamiTransferLibraryAddress", addr: wallet.kamiTransferLibraryAddress }
                ];

                for (const { label, addr } of labeledAddresses) {
                    if (!isValidAddress(addr)) throw new Error(`Invalid wallet address (${label}): ${addr}`);
                }

                const walletService = new WalletService(chainId, blockchain.rpcUrl, USDC.contractAddress);
                const balances = await Promise.all(
                    labeledAddresses.map(x => walletService.getWalletBalances(x.addr))
                );

                const platformWalletReport: PlatformWalletReport = {
                    chainId,
                    chainName: blockchain.name,
                    wallets: []
                };
                let shouldNotify = false;

                for (let i = 0; i < labeledAddresses.length; i++) {
                    const { label, addr } = labeledAddresses[i];
                    const b = balances[i];

                    const ethBalanceBigInt = BigInt(b.ethBalance);

                    platformWalletReport.wallets.push({
                        label,
                        address: addr,
                        ethBalance: b.ethBalance,
                        usdcBalance: b.usdcBalance,
                        ethBalanceFormatted: b.ethBalanceFormatted,
                        usdcBalanceFormatted: b.usdcBalanceFormatted,
                        isLow: isBelowThreshold(ethBalanceBigInt)
                    });

                    if (isBelowThreshold(ethBalanceBigInt)) {
                        shouldNotify = true;
                    }
                }

                if (shouldNotify) {
                    await fetch(`http://comm-service:3000/api/email/platform-balance-alert`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            recipient: getAlertRecipients(),
                            report: platformWalletReport,
                        }),
                    });
                }

                allWalletBalanceResults.push(platformWalletReport);
                {{}}
            } catch (err) {
                console.error(`[Balance Alert] Failed for chainId=${wallet.chainId}`, err);
                errors.push({ chainId: wallet.chainId, message: err instanceof Error ? err.message : "Unknown error" });
            }
        }

        res.json({
            result: allWalletBalanceResults,
            errors
        });

    } catch (error) {
        console.error('Error balance alert:', error);
        const errorResponse = {
            error: 'BALANCE_ALERT_ERROR',
            message: (error instanceof Error) ? error.message : 'Failed verifying platform wallet balance.',
        };
        res.status(500).json(errorResponse);
    } finally {
        console.log(`[Scheduler] Completed balance alert job at ${new Date().toISOString()}`);
    }
});

/**
 * Determines whether a wallet's ETH balance is below
 * the configured threshold limits.
 *
 * Zero-balance wallets can optionally be ignored depending on
 * `walletThreshold.ignoreZeroBalance`.
 *
 * @param ethBalance - The ETH balance as a bigint.
 * @returns `true` if the wallet should trigger a balance alert, otherwise `false`.
 */
function isBelowThreshold(ethBalance: bigint): boolean {
    const { eth: ETH_T, ignoreZeroBalance } = getWalletThreshold();

    const isZeroBalance = ethBalance === 0n;

    if (ignoreZeroBalance && isZeroBalance) {
        return false; // do NOT trigger alerts
    }

    return ethBalance < ETH_T;
}

export default router;