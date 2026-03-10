import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { Avatar, AvatarIcon } from "@nextui-org/react";
import { TransferStepProps } from "../types";
import { CancelTransferDialog } from "../components/CancelTransferDialog";
import {
  TransferLoadingModal,
  TransferSuccessModal,
  TransferFailureModal,
} from "../components/TransferStatusModals";
import { executeCryptoTransfer, getCachedRecipientProfile } from "../utils";
import { useGlobalState } from "@/lib/GlobalContext";
import { truncateTextCenter } from "@/lib/Util";
import { getEstimateGas } from "@/apihandler/Wallet";
import { PlatformFeeType } from "@/types";
import { getChargeByLocation } from "@/apihandler/Admin";

export const ReviewStep: React.FC<TransferStepProps> = ({
  state,
  setState,
  setActiveView,
  blockchains,
  refetchWalletData,
}) => {
  const [gs] = useGlobalState();
  const [estimatedGas, setEstimatedGas] = useState<string | null>(null);
  const [gasLoading, setGasLoading] = useState<boolean>(false);
  const [gasError, setGasError] = useState<string | null>(null);
  const [platformCharges, setPlatformCharges] = useState<PlatformFeeType[]>([]);
  const [chargesLoading, setChargesLoading] = useState<boolean>(false);
    const hasEstimatedGas = useRef<boolean>(false);
    // Calculate off-platform status once on mount
  const isOffPlatform = useMemo(() => state.offPlatformConfirmed, []);

  // Lookup recipient profile once on mount - skip if off-platform to prevent race condition
  const cachedRecipient = useMemo(() => {
    if (isOffPlatform) {
      return null;
    }
    return getCachedRecipientProfile(state.recipientAddress);
  }, []);

  // Calculate recipient name once on mount
  const recipientName = useMemo(() => {
    if (isOffPlatform) {
      return truncateTextCenter(state.recipientAddress, 20);
    }
    return cachedRecipient?.userName || "Unknown";
  }, []);
  
  const recipientAvatar = cachedRecipient?.avatarUrl || null;

  // Get selected blockchain
  const selectedBlockchain = blockchains.find(
    (b) => b.chainId === state.selectedChainId
  );

  // Fetch gas estimate once on component mount with validation
  useEffect(() => {
    const fetchEstimateGas = async () => {
      // Skip if already estimated
      if (hasEstimatedGas.current) {
        return;
      }

      // Validate gs object and required properties
      if (!gs || typeof gs !== "object") {
        console.warn("Global state (gs) is not available");
        return;
      }

      if (!gs.walletAddress || typeof gs.walletAddress !== "string") {
        console.warn("Wallet address is not available in global state");
        return;
      }

      // Validate state object and required properties
      if (!state || typeof state !== "object") {
        console.warn("Transfer state is not available");
        return;
      }

      if (
        !state.recipientAddress ||
        typeof state.recipientAddress !== "string"
      ) {
        console.warn("Recipient address is not available");
        return;
      }

      if (!state.selectedChainId || typeof state.selectedChainId !== "string") {
        console.warn("Chain ID is not available");
        return;
      }

      if (
        !state.amount ||
        typeof state.amount !== "string" ||
        state.amount === "0"
      ) {
        console.warn("Valid amount is not available");
        return;
      }

      // Mark as attempting to estimate
      hasEstimatedGas.current = true;
      setGasLoading(true);
      setGasError(null);

      try {
        const response = await getEstimateGas(
          gs.walletAddress,
          state.recipientAddress,
          state.selectedChainId,
          state.amount
        );

        if (response && response.success && response.data?.estimatedGas) {
          setEstimatedGas(response.data.estimatedGas);
          console.debug(
            "Gas estimation successful:",
            response.data.estimatedGas
          );
        } else {
          // Use the error message from the API response if available
          setGasError("Unable to estimate gas fees");
          console.error("Gas estimation failed:", {
            error: response?.error,
            message: response?.message,
            fullResponse: response,
          });
        }
      } catch (error) {
        setGasError("Failed to fetch gas estimate");
        console.error("Error fetching gas estimate:", error);
      } finally {
        setGasLoading(false);
      }
    };

    const fetchPlatformCharges = async () => {
      setChargesLoading(true);
      try {
        const res = await getChargeByLocation("CryptoTransfer");
        if (res && Array.isArray(res)) {
          setPlatformCharges(res);
        }
      } catch (error) {
        console.error("Error fetching platform charges:", error);
        setPlatformCharges([]);
      } finally {
        setChargesLoading(false);
      }
    };

    fetchEstimateGas();
    fetchPlatformCharges();
  }, []);

  const handleBack = () => {
    setState((prev) => ({
      ...prev,
      recipientAddress: "",
      offPlatformConfirmed: false,
      showOffPlatformWarning: false,
      transferStep: "recipient",
      skipRecipientsFetch: true,
    }));
  };

  const calculateChargeAmount = (charge: PlatformFeeType): number => {
    if (charge.fixedAmount && charge.fixedAmount > 0) {
      return charge.fixedAmount;
    } else if (charge.percentage && charge.percentage > 0) {
      return (parseFloat(state.amount) * charge.percentage) / 100;
    }
    return 0;
  };

  const formatChargeValue = (charge: PlatformFeeType): string => {
    if (charge.fixedAmount && charge.fixedAmount > 0) {
      return `${charge.fixedAmount} ${state.selectedToken?.type || "USDC"}`;
    } else if (charge.percentage && charge.percentage > 0) {
      return `${charge.percentage}%`;
    }
    return "0";
  };

  const numberWithCommas = (value: number, decimals: number = 2): string => {
    return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const calculateTotalCharges = (): number => {
    const transferAmount = parseFloat(state.amount) || 0;
    const platformFees = platformCharges.reduce((total, charge) => {
      return total + calculateChargeAmount(charge);
    }, 0);
    return transferAmount + platformFees;
  };

  const handleConfirm = async () => {
    if (!state.selectedToken) return;

    // Set status to processing
    setState((prev) => ({ ...prev, transferStatus: "processing" }));

    try {
      // Validate gs object and required properties
      if (!gs || typeof gs !== "object") {
        console.warn("Global state (gs) is not available");
        return;
      }

      if (!gs.walletAddress || typeof gs.walletAddress !== "string") {
        console.warn("Wallet address is not available in global state");
        return;
      }

      // Execute crypto transfer
      const result = await executeCryptoTransfer(gs, state);

      if (result.success) {
        // Set success status
        setState((prev) => ({
          ...prev,
          transferStatus: "success",
          transactionHash: result.transactionHash || null,
        }));

        // Refetch wallet data to update balance
        if (refetchWalletData) {
          try {
            await refetchWalletData();
          } catch (error) {
            console.error("Error refetching wallet data:", error);
          }
        }
      } else {
        // Set failed status
        setState((prev) => ({
          ...prev,
          transferStatus: "failed",
          transferError: result.error || "Transfer failed",
        }));
      }
    } catch (error) {
      // Handle unexpected errors
      setState((prev) => ({
        ...prev,
        transferStatus: "failed",
        transferError: "An unexpected error occurred",
      }));
    }
  };

  const handleCancelConfirm = () => {
    setState((prev) => ({ ...prev, showCancelDialog: false }));
    setActiveView("dashboard");
  };

  const handleCloseSuccessModal = () => {
    setState((prev) => ({
      ...prev,
      transferStatus: "idle",
      transactionHash: null,
    }));
    setActiveView("dashboard");
  };

  const handleCloseFailureModal = () => {
    setState((prev) => ({
      ...prev,
      transferStatus: "idle",
      transferError: null,
    }));
  };

  if (!state.selectedToken) return null;

  return (
    <div className="relative flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 mt-4">
        <button
          onClick={handleBack}
          className="text-[#F1F0EB] hover:text-[#11FF49]"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M19 12H5M5 12L12 19M5 12L12 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h2 className="text-xl text-[#F1F0EB] font-semibold">REVIEW</h2>
        <div className="w-6"></div>
      </div>

      {/* Amount Display with Icon */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center">
            <Image
              src={state.selectedToken.icon}
              alt={state.selectedToken.type}
              width={40}
              height={40}
              className="rounded-full"
            />
          </div>
          {/* Checkmark badge */}
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-500 border-2 border-black flex items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-white"
            >
              <path
                d="M20 6L9 17L4 12"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <h1 className="text-4xl font-bold text-[#F1F0EB] mb-1">
          {state.amount} {state.selectedToken.type}
        </h1>
      </div>

      {/* Transfer Details */}
      <div className="space-y-3 mb-6">
        {/* Sender to Recipient */}
        <div className="bg-[#1A1A1A] rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar
              className="w-10 h-10"
              size={"sm"}
              icon={<AvatarIcon />}
              showFallback
              name={gs?.profile?.userName.charAt(0)}
              src={gs?.profile?.avatarUrl ?? undefined}
            />
            <span className="text-[#F1F0EB] font-medium">
              {gs?.profile?.userName}
            </span>
          </div>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-[#6E6E6E]"
          >
            <path
              d="M9 5L16 12L9 19"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="flex items-center gap-3">
            <span className="text-[#F1F0EB] font-medium">{recipientName}</span>
            <Avatar
              className="w-10 h-10"
              size={"sm"}
              icon={<AvatarIcon />}
              showFallback
              name={recipientName.charAt(0)}
              src={recipientAvatar ?? undefined}
            />
          </div>
        </div>

        {/* Off-Platform Warning Banner */}
        {isOffPlatform && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-yellow-500 flex-shrink-0 mt-0.5"
            >
              <path
                d="M12 9V11M12 15H12.01M5.07183 19H18.9282C20.4678 19 21.4301 17.3333 20.6603 16L13.7321 4C12.9623 2.66667 11.0377 2.66667 10.2679 4L3.33975 16C2.56995 17.3333 3.53223 19 5.07183 19Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex-1">
              <p className="text-yellow-500 text-sm font-medium">Off-Platform Transfer</p>
              <p className="text-yellow-500/80 text-xs mt-1">
                This is a direct blockchain transfer to an external wallet
              </p>
            </div>
          </div>
        )}

        {/* Network */}
        <div className="bg-[#1A1A1A] rounded-lg p-4 flex items-center justify-between">
          <span className="text-[#6E6E6E]">Network</span>
          <div className="flex items-center gap-2">
            {selectedBlockchain?.logoUrl && (
              <Image
                src={selectedBlockchain.logoUrl}
                alt={selectedBlockchain.name}
                width={20}
                height={20}
                className="rounded-full"
              />
            )}
            <span className="text-[#F1F0EB] font-medium">
              {selectedBlockchain?.name || "Base"}
            </span>
          </div>
        </div>

        {/* Fees */}
        <div className="bg-[#1A1A1A] rounded-lg p-4">
          {/* Platform Fees */}
          {chargesLoading ? (
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#6E6E6E]">Platform fees</span>
              <span className="text-[#6E6E6E]">Loading...</span>
            </div>
          ) : platformCharges.length > 0 ? (
            <div className="space-y-2 mb-2">
              {platformCharges.map((charge, index) => (
                <div
                  key={charge.id || index}
                  className="flex items-center justify-between"
                >
                  <div className="flex-1">
                    <span className="text-[#6E6E6E]">
                      {charge.chargeType.name}
                    </span>
                    <span className="text-[#6E6E6E]/60 ml-1 text-sm">
                      ({formatChargeValue(charge)})
                    </span>
                  </div>
                  <span className="text-[#F1F0EB] font-medium">
                    {numberWithCommas(calculateChargeAmount(charge), 6)}{" "}
                    {charge.currency}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#6E6E6E]">Platform fees</span>
              <span className="text-[#F1F0EB]">
                0.00 {state.selectedToken.type}
              </span>
            </div>
          )}

          {/* Gas Fees */}
          <div className="flex items-center justify-between">
            <span className="text-[#6E6E6E]">Gas fees</span>
            <span className="text-[#F1F0EB]">
              {gasLoading ? (
                <span className="text-[#6E6E6E]">Estimating...</span>
              ) : gasError ? (
                <span className="text-red-500 text-sm">{gasError}</span>
              ) : estimatedGas ? (
                `${estimatedGas} ETH`
              ) : (
                <span className="text-[#6E6E6E]">--</span>
              )}
            </span>
          </div>
        </div>

        {/* Total */}
        <div className="bg-[#1A1A1A] rounded-lg p-4 border-t-2 border-[#11FF49]/20">
          <div className="flex items-center justify-between">
            <span className="text-[#6E6E6E] font-semibold text-lg">Total</span>
            <span className="text-[#11FF49] font-bold text-xl">
              {numberWithCommas(calculateTotalCharges(), 6)}{" "}
              {state.selectedToken.type}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[#6E6E6E]/60 text-xs">
              Transfer amount + Platform fees
            </span>
          </div>
        </div>
      </div>

      {/* Cancel Transfer Dialog */}
      <CancelTransferDialog
        isOpen={state.showCancelDialog}
        onClose={() =>
          setState((prev) => ({ ...prev, showCancelDialog: false }))
        }
        onConfirm={handleCancelConfirm}
      />

      {/* Transfer Status Modals */}
      <TransferLoadingModal
        isOpen={state.transferStatus === "processing"}
        onClose={() => {}}
      />

      <TransferSuccessModal
        isOpen={state.transferStatus === "success"}
        onClose={handleCloseSuccessModal}
        amount={state.amount}
        tokenType={state.selectedToken.type}
        recipientName={recipientName}
        recipientAddress={state.recipientAddress}
        networkName={selectedBlockchain?.name || "Base"}
        transactionHash={state.transactionHash || undefined}
      />

      <TransferFailureModal
        isOpen={state.transferStatus === "failed"}
        onClose={handleCloseFailureModal}
        errorMessage={state.transferError || undefined}
      />

      {/* Action Buttons */}
      <div className="mt-auto pb-4 grid grid-cols-2 gap-3">
        <button
          onClick={() =>
            setState((prev) => ({ ...prev, showCancelDialog: true }))
          }
          className="bg-[#6E6E6E] hover:bg-[#9E9E9D] focus:bg-[#F1F0EB] text-black font-semibold py-2 rounded-lg text-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          className="bg-[#D9D9D9] hover:bg-[#F1F0EB] focus:bg-[#11FF49] text-black font-semibold py-2 rounded-lg text-lg transition-colors disabled:bg-[#6E6E6E] disabled:text-[#9E9E9D] disabled:cursor-not-allowed"
          disabled={!hasEstimatedGas}
        >
          Confirm
        </button>
      </div>
    </div>
  );
};
