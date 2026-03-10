export type WalletBalance = {
    address: string;
    ethBalance: string;
    usdcBalance: string;
    ethBalanceFormatted: string;
    usdcBalanceFormatted: string;
}

export type WalletBalanceResponse = {
    success: boolean;
    data: WalletBalance;
    message: string;
}

export type ChainAndWalletInfo = {
    chainId: string;
    walletAddress: string;
    balances: WalletBalance;
}

export type MultiWalletsBalanceResponse = {
    success: boolean;
    data: ChainAndWalletInfo[];
    message: string;
}