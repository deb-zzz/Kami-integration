import { Wallet as WalletType, Profile, NotificationEntityType, NotificationEntitySubType } from "@/types";
import { getProfile } from "@/apihandler/Profile";
import { postCryptoTransfer } from "@/apihandler/Wallet";
import { createActivity } from "@/apihandler/Activity";
import { GlobalState } from "@/lib/GlobalContext";
import { TransferState, Recipient } from "./types";

// Cache for recipient profile data
export interface RecipientProfile {
  walletAddress: string;
  userName: string;
  avatarUrl: string;
}

export interface AddressValidationResult {
  isValid: boolean;
  hasProfile: boolean;
  isFormatValid: boolean;
  profile?: RecipientProfile;
}

const recipientCache = new Map<string, RecipientProfile>();

/**
 * Format amount with max 6 decimal places
 */
export const formatAmount = (value: string): string => {
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  // Round to 6 decimal places if needed
  const rounded = Math.round(num * 1000000) / 1000000;
  return rounded.toString();
};

/**
 * Determine text size class based on amount length
 */
export const getTextSizeClass = (value: string): string => {
  const displayValue = formatAmount(value);
  const length = displayValue.length;

  if (length <= 6) return "text-6xl";
  if (length <= 8) return "text-5xl";
  if (length <= 10) return "text-4xl";
  if (length <= 12) return "text-3xl";
  if (length <= 15) return "text-2xl";
  return "text-xl";
};

/**
 * Handle number input for amount field
 */
export const handleNumberInput = (
  num: string,
  currentAmount: string,
  selectedToken: WalletType | null
): { newAmount: string; isValid: boolean } | null => {
  let newAmount = currentAmount;

  if (currentAmount === "0" && num !== ".") {
    newAmount = num;
  } else if (num === "." && currentAmount.includes(".")) {
    return null; // Don't allow multiple decimal points
  } else if (num === "." && currentAmount === "0") {
    newAmount = "0.";
  } else {
    newAmount = currentAmount + num;
  }

  // Check if decimal places exceed 6
  if (newAmount.includes(".")) {
    const decimalPlaces = newAmount.split(".")[1]?.length || 0;
    if (decimalPlaces > 6) {
      return null; // Don't allow more than 6 decimal places
    }
  }

  // Validate against available balance
  if (selectedToken && parseFloat(newAmount) > selectedToken.value) {
    return null;
  }

  return {
    newAmount,
    isValid: parseFloat(newAmount) > 0,
  };
};

/**
 * Handle backspace for amount field
 */
export const handleBackspaceInput = (
  currentAmount: string
): { newAmount: string; isValid: boolean } => {
  let newAmount = "0";

  if (currentAmount.length === 1) {
    newAmount = "0";
  } else {
    newAmount = currentAmount.slice(0, -1);
  }

  return {
    newAmount,
    isValid: parseFloat(newAmount) > 0,
  };
};

/**
 * Calculate percentage of token value
 */
export const calculatePercentage = (
  percentage: number,
  selectedToken: WalletType | null
): { amount: string; isValid: boolean } | null => {
  if (!selectedToken) return null;

  const calculatedAmount = (selectedToken.value * percentage) / 100;
  const formattedAmount = calculatedAmount.toFixed(6);

  return {
    amount: formattedAmount,
    isValid: parseFloat(formattedAmount) > 0,
  };
};

/**
 * Get max amount for selected token
 */
export const getMaxAmount = (
  selectedToken: WalletType | null
): { amount: string; isValid: boolean } | null => {
  if (!selectedToken) return null;

  const maxAmount = selectedToken.value.toFixed(6);

  return {
    amount: maxAmount,
    isValid: parseFloat(maxAmount) > 0,
  };
};

/**
 * Validate wallet address
 * Returns detailed validation result including format check and profile lookup
 * Caches recipient profile data if profile exists
 * @param address - Wallet address to validate
 * @param cachedRecentRecipients - Optional array of cached recent recipients to check before API call
 */
export const validateWalletAddress = async (
  address: string,
  cachedRecentRecipients?: Recipient[]
): Promise<AddressValidationResult> => {
  // Check wallet address format (Ethereum format)
  const isFormatValid = /^0x[a-fA-F0-9]{40}$/.test(address);
  
  if (!isFormatValid) {
    return {
      isValid: false,
      hasProfile: false,
      isFormatValid: false,
    };
  }

  // Check if address exists in cached recent recipients (skip API call)
  if (cachedRecentRecipients && cachedRecentRecipients.length > 0) {
    const cachedRecipient = cachedRecentRecipients.find(
      (recipient) => recipient.walletAddress.toLowerCase() === address.toLowerCase()
    );
    
    if (cachedRecipient) {
      const profile: RecipientProfile = {
        walletAddress: cachedRecipient.walletAddress,
        userName: cachedRecipient.userName,
        avatarUrl: cachedRecipient.avatarUrl || '',
      };
      
      // Cache the recipient profile data for use in ReviewStep
      recipientCache.set(address, profile);
      
      return {
        isValid: true,
        hasProfile: true,
        isFormatValid: true,
        profile,
      };
    }
  }

  // Check if profile exists in platform
  try {
    const response = await getProfile(address);
    
    if (response.success === true && response.profile) {
      const profile: RecipientProfile = {
        walletAddress: response.profile.walletAddress,
        userName: response.profile.userName,
        avatarUrl: response.profile.avatarUrl,
      };
      
      // Cache the recipient profile data for use in ReviewStep
      recipientCache.set(address, profile);
      
      return {
        isValid: true,
        hasProfile: true,
        isFormatValid: true,
        profile,
      };
    }
    
    // Valid format but no profile
    return { isValid: true, hasProfile: false, isFormatValid: true };
  } catch (error) {
    // Valid format but profile check failed
    return { isValid: true, hasProfile: false, isFormatValid: true };
  }
};

/**
 * Get cached recipient profile data
 * Returns the cached profile data for a given wallet address
 */
export const getCachedRecipientProfile = (address: string): RecipientProfile | null => {
  return recipientCache.get(address) || null;
};

/**
 * Clear cached recipient profile data
 * Optionally clear a specific address or all cached data
 */
export const clearRecipientCache = (address?: string): void => {
  if (address) {
    recipientCache.delete(address);
  } else {
    recipientCache.clear();
  }
};

/**
 * Execute crypto transfer transaction
 * Calls the postCryptoTransfer API to perform the actual blockchain transaction
 * Creates activity log based on transfer status with both parties' usernames
 * @param gs - Global state object containing user information
 * @param state - Transfer state object containing transaction details
 */
export const executeCryptoTransfer = async (
  gs: GlobalState | undefined,
  state: TransferState
): Promise<{ success: boolean; transactionHash?: string; error?: string }> => {
  // Extract relevant variables from gs and state
  const fromAddress = gs?.walletAddress;
  const fromUsername = gs?.profile?.userName || "Unknown";
  const toAddress = state.recipientAddress;
  const chainId = state.selectedChainId;
  const currency = state.selectedToken?.type;
  const amount = state.amount;

  // Get recipient username from cache
  const cachedRecipient = getCachedRecipientProfile(toAddress);
  const toUsername = cachedRecipient?.userName || "Unknown";

  // Validate required fields
  if (!fromAddress || !toAddress || !chainId || !currency || !amount) {
    return {
      success: false,
      error: "Missing required transfer information",
    };
  }

  try {
    const response = await postCryptoTransfer(
      fromAddress,
      toAddress,
      chainId,
      currency,
      amount
    );

    // Callback function to create activity based on response status
    const createTransferActivity = async (success: boolean, transactionHash?: string, errorMessage?: string) => {
      if (success && transactionHash) {
        // Success activity for sender
        const senderMessage = `Transfer of ${amount} ${currency} to @${toUsername} completed successfully`;
        const senderPayload = {
          walletAddress: toAddress,
          message: senderMessage,
          from: {
            avatarUrl: gs?.profile?.avatarUrl || '',
            userName: fromUsername,
            description: gs?.profile?.description || '',
            walletAddress: fromAddress,
          },
          amount,
          currency,
          transactionHash,
          chainId,
        };

        await createActivity(
          fromAddress,
          senderMessage,
          senderPayload,
          NotificationEntityType.User,
          NotificationEntitySubType.Transferred,
          fromAddress
        );

        // Success activity for recipient (only if they have a profile)
        if (cachedRecipient) {
          const recipientMessage = `Received ${amount} ${currency} from @${fromUsername}`;
          const recipientPayload = {
            walletAddress: fromAddress,
            message: recipientMessage,
            from: {
              avatarUrl: gs?.profile?.avatarUrl || '',
              userName: fromUsername,
              description: gs?.profile?.description || '',
              walletAddress: fromAddress,
            },
            amount,
            currency,
            transactionHash,
            chainId,
          };

          await createActivity(
            toAddress,
            recipientMessage,
            recipientPayload,
            NotificationEntityType.User,
            NotificationEntitySubType.Transferred,
            fromAddress
          );
        }
      } else {
        // Failure activity (only for sender)
        const message = `Transfer of ${amount} ${currency} to @${toUsername} failed: ${errorMessage || 'Unknown error'}`;
        const payload = {
          walletAddress: toAddress,
          message,
          from: {
            avatarUrl: gs?.profile?.avatarUrl || '',
            userName: fromUsername,
            description: gs?.profile?.description || '',
            walletAddress: fromAddress,
          },
          amount,
          currency,
          error: errorMessage,
          chainId,
        };

        await createActivity(
          fromAddress,
          message,
          payload,
          NotificationEntityType.User,
          NotificationEntitySubType.Failed,
          fromAddress
        );
      }
    };

    if (response.success && response.data) {
      // Create success activity
      await createTransferActivity(true, response.data.hash);
      
      return {
        success: true,
        transactionHash: response.data.hash,
      };
    } else {
      const errorMessage = response.message || "Transfer failed";
      
      // Create failure activity
      await createTransferActivity(false, undefined, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    
    // Create failure activity for caught exceptions
    const message = `Transfer of ${amount} ${currency} to @${toUsername} failed: ${errorMessage}`;
    const payload = {
      walletAddress: toAddress,
      message,
      from: {
        avatarUrl: gs?.profile?.avatarUrl || '',
        userName: fromUsername,
        description: gs?.profile?.description || '',
        walletAddress: fromAddress,
      },
      amount,
      currency,
      error: errorMessage,
      chainId,
    };

    await createActivity(
      fromAddress,
      message,
      payload,
      NotificationEntityType.User,
      NotificationEntitySubType.Failed,
      fromAddress
    );
    
    return {
      success: false,
      error: errorMessage,
    };
  }
};
