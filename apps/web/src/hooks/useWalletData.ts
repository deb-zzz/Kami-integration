import { useState, useEffect } from "react";
import { Wallet as WalletType, Blockchain, CurrencyType } from "@/types";
import { getWalletBalance, getBlockchains } from "@/apihandler/Wallet";
import { ToastMessage } from "@/components/ToastMessage";
import { useGlobalState } from "@/lib/GlobalContext";

const BLOCKCHAINS_STORAGE_KEY = "kami_blockchains";
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache duration

interface WalletData {
  value: string;
  currency: string;
  wallets: WalletType[];
}

interface UseWalletDataReturn {
  walletData: WalletData;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch and manage wallet data
 * Automatically refetches when walletAddress or chainId changes
 * 
 * @param walletAddress - The wallet address to fetch data for
 * @param chainId - The blockchain chain ID (optional, fetches all if not provided)
 * @returns Wallet data, loading state, error state, and refetch function
 */
export function useWalletData(
  walletAddress: string | undefined,
  chainId?: string
): UseWalletDataReturn {
  const [gs, setGs] = useGlobalState();
  const [walletData, setWalletData] = useState<WalletData>({
    value: "$0.00",
    currency: CurrencyType.USDC,
    wallets: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWalletData = async () => {
    if (!walletAddress) {
      console.warn("Cannot fetch wallet data: missing walletAddress");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get blockchains using hybrid approach (GS -> Session Storage -> API)
      let blockchains: Blockchain[] = [];

      // Priority 1: Check Global State (instant, already in memory)
      if (gs?.blockchains && gs.blockchains.length > 0) {
        blockchains = gs.blockchains;
      } else {
        // Priority 2: Check Session Storage (fast, survives navigation)
        const cachedData = sessionStorage.getItem(BLOCKCHAINS_STORAGE_KEY);

        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            const { data, timestamp } = parsed;

            // Check if cache is still valid (within 1 hour)
            const isExpired = Date.now() - timestamp > CACHE_DURATION;

            if (
              !isExpired &&
              data &&
              Array.isArray(data) &&
              data.length > 0
            ) {
              blockchains = data;
              // Store in Global State for future use
              setGs({ ...gs, blockchains: data });
            }
          } catch (parseError) {
            console.warn("Failed to parse cached blockchains:", parseError);
          }
        }

        // Priority 3: Fetch from API if no valid cache found
        if (blockchains.length === 0) {
          const blockchainRes = await getBlockchains();

          if (blockchainRes.success && blockchainRes.data.length > 0) {
            blockchains = blockchainRes.data;

            // Store in Global State (primary storage)
            setGs({
              ...gs,
              blockchains: blockchainRes.data,
              chainId: gs?.chainId || blockchainRes.data[0]?.chainId,
            });

            // Backup to Session Storage (survives page refresh)
            sessionStorage.setItem(
              BLOCKCHAINS_STORAGE_KEY,
              JSON.stringify({
                data: blockchainRes.data,
                timestamp: Date.now(),
              })
            );
          }
        }
      }

      if (blockchains.length === 0) {
        console.warn("No blockchains available");
        setWalletData({
          value: "$0.00",
          currency: CurrencyType.USDC,
          wallets: [],
        });
        setLoading(false);
        return;
      }

      // Filter blockchains if chainId is provided
      const blockchainsToFetch = chainId
        ? blockchains.filter((b) => b.chainId === chainId)
        : blockchains;

      if (blockchainsToFetch.length === 0) {
        console.warn(`No blockchain found for chainId: ${chainId}`);
        setWalletData({
          value: "$0.00",
          currency: CurrencyType.USDC,
          wallets: [],
        });
        setLoading(false);
        return;
      }

      // Fetch wallet balances for selected blockchains in parallel
      const balancePromises = blockchainsToFetch.map((blockchain) =>
        getWalletBalance(walletAddress, blockchain.chainId)
          .then((response) => ({ blockchain, response }))
          .catch((error) => {
            console.error(
              `Error fetching balance for ${blockchain.name}:`,
              error
            );
            return { blockchain, response: null };
          })
      );

      const balanceResults = await Promise.all(balancePromises);

      // Process the wallet balance data from all blockchains
      const wallets: WalletType[] = [];
      let totalValue = 0;

      balanceResults.forEach(({ blockchain, response }) => {
        if (!response || !response.success || !response.data) {
          return;
        }

        // Add USDC wallet if available
        if (response.data.usdcBalance) {
          const usdcBalance = parseFloat(response.data.usdcBalance) || 0;
          const formattedBalance = response.data.usdcBalanceFormatted
            ? parseFloat(response.data.usdcBalanceFormatted) || 0
            : usdcBalance / 1e6; // Assuming 1:1 USD value for USDC

          wallets.push({
            type: CurrencyType.USDC,
            balance: usdcBalance,
            value: formattedBalance,
            icon: "/crypto/usdc-icon.svg",
            walletAddress: walletAddress,
          });
          totalValue += formattedBalance;
        }

        // remove ETH as no API transfer supported yet
        /* // Add ETH/native token wallet if available
        if (response.data.ethBalance) {
          const ethBalance = parseFloat(response.data.ethBalance) || 0;
          const formattedBalance = response.data.ethBalanceFormatted
            ? parseFloat(response.data.ethBalanceFormatted) || 0
            : ethBalance;

          // Only add if balance is non-zero
          if (ethBalance > 0) {
            wallets.push({
              type: CurrencyType.ETH,
              balance: ethBalance,
              value: formattedBalance,
              icon: blockchain.logoUrl || "/crypto/usdc-icon.svg",
              walletAddress: walletAddress,
            });
            // Note: Not adding to totalValue as we don't have USD conversion for native tokens
          }
        } */
      });

      setWalletData({
        value: `$ ${totalValue.toFixed(2)}`,
        currency: CurrencyType.USDC,
        wallets: wallets,
      });
    } catch (error) {
      console.error("Error fetching wallet data:", error);
      const errorMessage = "Failed to fetch wallet data";
      setError(errorMessage);
      ToastMessage("error", errorMessage);
      setWalletData({
        value: "$0.00",
        currency: CurrencyType.USDC,
        wallets: [],
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch wallet data when walletAddress or chainId changes
  useEffect(() => {
    fetchWalletData();
  }, [walletAddress, chainId]);

  return {
    walletData,
    loading,
    error,
    refetch: fetchWalletData,
  };
}
