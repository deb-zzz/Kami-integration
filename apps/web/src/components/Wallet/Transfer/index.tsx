import { useState, useEffect } from "react";
import { TransferProps, TransferState } from "./types";
import { validateWalletAddress } from "./utils";
import {
  TokenSelectionStep,
  AmountEntryStep,
  RecipientEntryStep,
  ReviewStep,
} from "./steps";

export default function Transfer({
  setActiveView,
  blockchains,
  chainId,
  wallets,
  onChainChange,
  loading,
  onBack,
  refetchWalletData,
}: TransferProps) {
  const [showZeroBalance, setShowZeroBalance] = useState(false);
  const [state, setState] = useState<TransferState>({
    selectedChainId: chainId,
    selectedToken: null,
    amount: "0",
    isValid: false,
    transferStep: "amount",
    recipientAddress: "",
    isAddressValid: false,
    isValidatingAddress: false,
    addressValidationError: null,
    showOffPlatformWarning: false,
    offPlatformConfirmed: false,
    showCancelDialog: false,
    transferStatus: "idle",
    transferError: null,
    transactionHash: null,
  });

  // Validate recipient address and handle off-platform transfers
  useEffect(() => {
    // Skip validation if address is empty
    if (!state.recipientAddress) {
      setState((prev) => ({
        ...prev,
        isAddressValid: false,
        isValidatingAddress: false,
        addressValidationError: null,
        showOffPlatformWarning: false,
        offPlatformConfirmed: false,
      }));
      return;
    }

    // Use abort flag to prevent state updates after unmount or when address changes
    let isCancelled = false;

    // Debounce timer to avoid excessive API calls
    const timeoutId = setTimeout(async () => {
      // Set loading state
      setState((prev) => ({
        ...prev,
        isValidatingAddress: true,
        addressValidationError: null,
        showOffPlatformWarning: false,
      }));

      try {
        const result = await validateWalletAddress(
          state.recipientAddress,
          state.cachedRecentRecipients
        );

        // Only update state if this validation is still relevant
        if (!isCancelled) {
          if (!result.isFormatValid) {
            // Invalid format
            setState((prev) => ({
              ...prev,
              isAddressValid: false,
              isValidatingAddress: false,
              addressValidationError: "Invalid wallet address format",
              showOffPlatformWarning: false,
              offPlatformConfirmed: false,
            }));
          } else if (result.hasProfile) {
            // Valid address with platform profile
            setState((prev) => ({
              ...prev,
              isAddressValid: true,
              isValidatingAddress: false,
              addressValidationError: null,
              showOffPlatformWarning: false,
              offPlatformConfirmed: false,
            }));

            // Auto-navigate to review if valid and on recipient step
            if (state.transferStep === "recipient") {
              setState((prev) => ({ 
                ...prev, 
                transferStep: "review",
                // Keep cached recipients when auto-navigating
              }));
            }
          } else {
            // Valid format but no profile - show warning
            setState((prev) => ({
              ...prev,
              isAddressValid: false,
              isValidatingAddress: false,
              addressValidationError: null,
              showOffPlatformWarning: true,
              offPlatformConfirmed: false,
            }));
          }
        }
      } catch (error) {
        // Handle unexpected errors
        if (!isCancelled) {
          setState((prev) => ({
            ...prev,
            isAddressValid: false,
            isValidatingAddress: false,
            addressValidationError:
              "Unable to validate address. Please check your connection and try again.",
            showOffPlatformWarning: false,
            offPlatformConfirmed: false,
          }));
        }
      }
    }, 500); // 500ms debounce

    // Cleanup function
    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [state.recipientAddress, state.transferStep]);

  // Update selected chain when chainId prop changes
  useEffect(() => {
    setState((prev) => ({ ...prev, selectedChainId: chainId }));
  }, [chainId]);

  // Reset skipRecipientsFetch flag when Transfer component unmounts
  useEffect(() => {
    return () => {
      // Cleanup: reset the flag when exiting the entire Transfer flow
      setState((prev) => ({ ...prev, skipRecipientsFetch: false }));
    };
  }, []);

  const commonProps = {
    state,
    setState,
    setActiveView,
    blockchains,
    onChainChange,
    wallets,
    loading,
    showZeroBalance,
    setShowZeroBalance,
    refetchWalletData,
  };

  // If a token is selected, show the appropriate transfer step
  if (state.selectedToken) {
    switch (state.transferStep) {
      case "review":
        return <ReviewStep {...commonProps} />;
      case "recipient":
        return <RecipientEntryStep {...commonProps} />;
      case "amount":
      default:
        return <AmountEntryStep {...commonProps} />;
    }
  }

  // Token selection view
  return <TokenSelectionStep {...commonProps} />;
}
