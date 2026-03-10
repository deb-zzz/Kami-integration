"use client";
import { Tooltip, AvatarIcon, Avatar } from "@nextui-org/react";
import { useGlobalState } from "@/lib/GlobalContext";
import { ToastMessage } from "@/components/ToastMessage";
import { truncateTextCenter } from "@/lib/Util";
import { useEffect, useState } from "react";
import Image from "next/image";

import Dashboard from "./Dashboard";
import Transfer from "./Transfer";
import History from "./History";
import Settings from "./Settings";
import { getBlockchains } from "@/apihandler/Wallet";
import { useWalletData } from "@/hooks/useWalletData";

type WalletView = "dashboard" | "transfer" | "history" | "settings";

interface WalletProps {
  onViewChange?: (view: WalletView) => void;
}

export default function Wallet({ onViewChange }: WalletProps = {}) {
  const [gs, setGs] = useGlobalState();
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [activeView, setActiveView] = useState<WalletView>("dashboard");
  const [chainId, setChainId] = useState<string>("");

  // Notify parent component when view changes
  useEffect(() => {
    if (onViewChange) {
      onViewChange(activeView);
    }
  }, [activeView, onViewChange]);

  // Use the custom hook to fetch wallet data - automatically refetches when chainId changes
  const { walletData, loading: walletLoading, refetch } = useWalletData(gs?.walletAddress, chainId);

  /**
   * Fetches blockchains using hybrid approach:
   * 1. Check Global State (fastest, in-memory)
   * 2. Check Session Storage (fast, persists across navigation)
   * 3. Fetch from API (slowest, but most up-to-date)
   *
   * This provides optimal performance while maintaining data freshness
   */
  useEffect(() => {
    const BLOCKCHAINS_STORAGE_KEY = "kami_blockchains";
    const CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache duration

    const fetchBlockchains = async () => {
      try {
        // Priority 1: Check Global State (instant, already in memory)
        if (gs?.blockchains && gs.blockchains.length > 0) {
          // Set default chainId if not already set
          if (!gs?.chainId) {
            const defaultChainId = gs.blockchains[0]?.chainId;
            setChainId(defaultChainId);
            setGs({ ...gs, chainId: defaultChainId });
          } else {
            setChainId(gs.chainId);
          }
          return; // Exit early, data already available
        }

        // Priority 2: Check Session Storage (fast, survives navigation)
        const cachedData = sessionStorage.getItem(BLOCKCHAINS_STORAGE_KEY);

        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            const { data, timestamp } = parsed;

            // Check if cache is still valid (within 1 hour)
            const isExpired = Date.now() - timestamp > CACHE_DURATION;

            if (!isExpired && data && Array.isArray(data) && data.length > 0) {
              // Store in Global State for future use
              setGs({ ...gs, blockchains: data });

              // Set default chainId if not already set
              if (!gs?.chainId) {
                const defaultChainId = data[0]?.chainId;
                setChainId(defaultChainId);
                setGs({ ...gs, chainId: defaultChainId, blockchains: data });
              } else {
                setChainId(gs.chainId);
              }
              return; // Exit early, valid cache found
            }
          } catch (parseError) {
            console.warn(
              "Failed to parse cached blockchains, fetching fresh data:",
              parseError
            );
            // Continue to fetch from API
          }
        }

        // Priority 3: Fetch from API (slowest, but most up-to-date)
        const blockchainRes = await getBlockchains();

        if (blockchainRes.success && blockchainRes.data.length > 0) {
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

          // Set default chainId if not already set
          if (!gs?.chainId) {
            const defaultChainId = blockchainRes.data[0]?.chainId;
            setChainId(defaultChainId);
          } else {
            setChainId(gs.chainId);
          }
        }
      } catch (error) {
        console.error("Error fetching blockchains:", error);

        // Fallback: Try to use expired cache if API fails
        const cachedData = sessionStorage.getItem(BLOCKCHAINS_STORAGE_KEY);
        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            if (parsed.data && Array.isArray(parsed.data)) {
              setGs({ ...gs, blockchains: parsed.data });
            }
          } catch (e) {
            console.error("Failed to use fallback cache:", e);
          }
        }
      }
    };

    fetchBlockchains();
  }, []);

  // Update chainId when global state changes
  useEffect(() => {
    if (gs?.chainId) {
      setChainId(gs.chainId);
    }
  }, [gs?.chainId]);

  const copyWalletAddress = (currentWalletAddress: string = "") => {
    if (currentWalletAddress !== "") {
      navigator.clipboard.writeText(currentWalletAddress);
    } else {
      navigator.clipboard.writeText(gs?.walletAddress || "");
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1700); // Reset after 2 seconds
    ToastMessage("success", "Wallet address copied to clipboard!");
  };

  const renderActiveView = () => {
    switch (activeView) {
      case "dashboard":
        return (
          <Dashboard
            isBalanceVisible={isBalanceVisible}
            chainId={chainId}
            blockchains={gs?.blockchains || []}
            walletAddress={gs?.walletAddress}
            onChainChange={setChainId}
            activeView={activeView}
            setActiveView={setActiveView}
            walletData={walletData.wallets}
            loading={walletLoading}
          />
        );
      case "transfer":
        return (
          <Transfer
            setActiveView={setActiveView}
            blockchains={gs?.blockchains || []}
            chainId={chainId}
            wallets={walletData.wallets}
            onChainChange={setChainId}
            loading={walletLoading}
            refetchWalletData={refetch}
          />
        );
      case "history":
        return (
          <History
            walletAddress={gs?.walletAddress || ""}
            chainId={chainId}
            blockchains={gs?.blockchains || []}
            onChainChange={setChainId}
            setActiveView={setActiveView}
          />
        );
      case "settings":
        return <Settings setActiveView={setActiveView} />;
      default:
        return (
          <Dashboard
            isBalanceVisible={isBalanceVisible}
            chainId={chainId}
            blockchains={gs?.blockchains || []}
            walletAddress={gs?.walletAddress}
            onChainChange={setChainId}
            activeView={activeView}
            setActiveView={setActiveView}
            walletData={walletData.wallets}
            loading={walletLoading}
          />
        );
    }
  };

  return (
    <div className="w-[25rem]">
      <div className="flex flex-col h-full py-5 px-5 bg-black">
        <div className="flex flex-row border-b border-dashed border-[#A79755] p-2 align-items-center align-middle">
          <Avatar
            className="w-[35px] h[35px] me-3"
            size={"sm"}
            icon={<AvatarIcon />}
            src={gs?.profile?.avatarUrl ?? undefined}
          />
          <div className="flex flex-col grow align-content-center">
            <p className="text-xs font-semibold">@{gs?.userId}</p>
            <div className="flex flex-row gap-2 align-baseline">
              <span className="align-baseline">
                {truncateTextCenter(gs?.walletAddress || "", 30)}
              </span>
              <Tooltip
                content="Copied"
                isOpen={isCopied}
                size="sm"
                className="bg-[#323131] text-[#F1F0EB] "
              >
                <Image
                  src={"/copy.svg"}
                  alt={"cup"}
                  width={17}
                  height={17}
                  className="cursor-pointer mt-1"
                  onClick={() => copyWalletAddress(gs?.walletAddress)}
                />
              </Tooltip>
            </div>
          </div>
          <div className="flex gap-2 align-middle">
            <button
              className="focus:outline-none"
              type="button"
              onClick={() => setIsBalanceVisible(!isBalanceVisible)}
              aria-label="toggle password visibility"
            >
              {isBalanceVisible ? (
                <Image
                  alt="eyeOff"
                  draggable="false"
                  width={17}
                  height={17}
                  src={"/settings/eyeOffIcon.svg"}
                />
              ) : (
                <Image
                  alt="eye"
                  draggable="false"
                  width={17}
                  height={17}
                  src={"/settings/eyeIcon.svg"}
                />
              )}
            </button>
            <button
              className="focus:outline-none"
              type="button"
              aria-label="pin to sidebar"
            >
              <Image
                alt="layout"
                draggable="false"
                width={17}
                height={17}
                src={"/layout.svg"}
              />
            </button>
          </div>
        </div>

        {renderActiveView()}
      </div>
    </div>
  );
}
