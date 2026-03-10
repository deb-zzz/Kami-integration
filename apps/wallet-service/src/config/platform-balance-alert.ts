/**
 * Configuration object defining wallet balance thresholds and behavior
 * used for evaluating whether a wallet requires a balance alert.
 *
 * Values can be overridden via environment variables:
 * - `ETH_THRESHOLD`: Minimum ETH balance required.
 * - `IGNORE_ZERO_BALANCE`: When set to `true`, wallets with zero balances
 *   will not trigger notifications.
 */
export function getWalletThreshold() {
    return {
        eth: BigInt(process.env.ETH_THRESHOLD || "1000000000000000"), // Fallback to 0.001 ETH in wei
        ignoreZeroBalance: process.env.IGNORE_ZERO_BALANCE === "true",
    }
}

/**
 * Retrieves the list of email recipients for alerts from the environment variable.
 *
 * Reads `process.env.ALERT_RECIPIENTS`, splits it by commas, trims whitespace,
 * and filters out any empty strings.
 *
 * @returns {string[]} An array of alert recipient email addresses.
 */
export function getAlertRecipients(): string[] {
    return (process.env.ALERT_RECIPIENTS || "")
        .split(",")
        .map(x => x.trim())
        .filter(Boolean);
}