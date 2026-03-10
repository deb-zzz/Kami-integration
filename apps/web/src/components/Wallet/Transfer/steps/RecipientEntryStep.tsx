import { useEffect, useState } from "react";
import { Skeleton } from "@nextui-org/react";
import { TransferStepProps, Recipient } from "../types";
import { CancelTransferDialog, OffPlatformWarningDialog } from "../components";
import { truncateTextCenter } from "@/lib/Util";
import { useGlobalState } from "@/lib/GlobalContext";
import { getRecentTransferRecipients } from "@/apihandler/Wallet";
import { getCachedProfiles } from "@/lib/mention-cache";
import { Profile } from "@/types";

export const RecipientEntryStep: React.FC<TransferStepProps> = ({
  state,
  setState,
  setActiveView,
}) => {
  const [gs] = useGlobalState();
  const [recentRecipients, setRecentRecipients] = useState<Recipient[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);

  // Fetch recent transfer recipients once on mount
  useEffect(() => {
    // Skip fetching if returning from review step and use cached data
    if (state.skipRecipientsFetch) {
      // Restore cached recipients if available
      if (state.cachedRecentRecipients) {
        setRecentRecipients(state.cachedRecentRecipients);
      }
      // Don't reset the flag here - it will be reset when Transfer component unmounts
      return;
    }

    // Early return if required data is not available
    if (!gs?.walletAddress || !state.selectedChainId) {
      setIsLoadingRecipients(false);
      setRecentRecipients([]);
      setRecipientsError(null);
      return;
    }

    let isMounted = true;

    const fetchRecentRecipients = async () => {
      if (!isMounted) return;

      // Store values to avoid accessing potentially undefined properties
      const walletAddress = gs.walletAddress;
      const chainId = state.selectedChainId;

      try {
        setIsLoadingRecipients(true);
        setRecipientsError(null);
          
        if (walletAddress == undefined) return;
        
        // Get unique recipient wallet addresses
        const uniqueAddresses = await getRecentTransferRecipients(
          walletAddress,
          chainId
        );

        // Only update state if component is still mounted
        if (!isMounted) return;

        // Get cached profiles
        const cachedProfiles = getCachedProfiles();
        
        // Create a map for O(1) lookup by wallet address
        const profileMap = new Map<string, Profile>();
        cachedProfiles.forEach((profile) => {
          if (profile.walletAddress) {
            profileMap.set(profile.walletAddress.toLowerCase(), profile);
          }
        });
        
        // Map unique addresses to cached profiles and filter out those without profiles
        const recipients: Recipient[] = uniqueAddresses
          .map((walletAddress) => {
            const profile = profileMap.get(walletAddress.toLowerCase());
            if (profile) {
              return {
                userName: profile.userName,
                walletAddress: profile.walletAddress,
                avatarUrl: profile.avatarUrl || null,
              };
            }
            return null;
          })
          .filter((recipient): recipient is Recipient => recipient !== null);
        
        setRecentRecipients(recipients);
      } catch (error) {
        // Only update state if component is still mounted
        if (!isMounted) return;

        if (process.env.NODE_ENV === "development") {
          console.error("Error fetching recent recipients:", error);
        }
        setRecipientsError("Unable to load recent recipients");
        setRecentRecipients([]);
      } finally {
        if (isMounted) {
          setIsLoadingRecipients(false);
        }
      }
    };

    fetchRecentRecipients();

    return () => {
      isMounted = false;
    };
  }, []);

  // Cache recipients in state whenever they change (after successful fetch)
  useEffect(() => {
    if (recentRecipients.length > 0 && !state.skipRecipientsFetch) {
      setState((prev) => ({ ...prev, cachedRecentRecipients: recentRecipients }));
    }
  }, [recentRecipients]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setState((prev) => ({ ...prev, recipientAddress: text }));
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  const handleRecipientSelect = (address: string) => {
    setState((prev) => ({ ...prev, recipientAddress: address }));
  };

  const handleBack = () => {
    setState((prev) => ({
      ...prev,
      transferStep: "amount",
      recipientAddress: "",
      showOffPlatformWarning: false,
      offPlatformConfirmed: false,
    }));
  };

  const handleCancelConfirm = () => {
    setState((prev) => ({ ...prev, showCancelDialog: false }));
    setActiveView("dashboard");
  };

  const handleOffPlatformConfirm = () => {
    setState((prev) => ({
      ...prev,
      showOffPlatformWarning: false,
      offPlatformConfirmed: true,
      isAddressValid: true,
      transferStep: "review",
      cachedRecentRecipients: recentRecipients,
    }));
  };

  const handleOffPlatformCancel = () => {
    setState((prev) => ({
      ...prev,
      showOffPlatformWarning: false,
      offPlatformConfirmed: false,
      recipientAddress: "",
    }));
  };

  return (
    <div className="relative flex flex-col h-full bg-black">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 mt-4">
        <button onClick={handleBack} className="text-[#F1F0EB] hover:text-[#11FF49]">
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
        <h2 className="text-xl text-[#F1F0EB] font-semibold">SEND</h2>
        <button
          onClick={() => setState((prev) => ({ ...prev, showCancelDialog: true }))}
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
              d="M18 6L6 18M6 6L18 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Wallet Address Input */}
      <div className="mb-6">
        <label className="text-[#6E6E6E] text-sm mb-2 block">To</label>
        <div className="relative">
          <input
            type="text"
            value={state.recipientAddress}
            onChange={(e) =>
              setState((prev) => ({ ...prev, recipientAddress: e.target.value }))
            }
            placeholder="Enter wallet address to send to"
            className="w-full bg-[#1A1A1A] text-[#F1F0EB] px-4 py-3 pr-20 rounded-lg border border-[#323131] focus:border-[#11FF49] focus:outline-none placeholder:text-[#6E6E6E]"
          />
          <button
            onClick={handlePaste}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#323131] hover:bg-[#404040] text-[#F1F0EB] px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            Paste
          </button>
        </div>
        
        {/* Validation Status Messages */}
        {state.recipientAddress && !state.isValidatingAddress && (
          <div className="mt-2">
            {state.isAddressValid && !state.showOffPlatformWarning ? (
              <p className="text-[#11FF49] text-sm flex items-center gap-2">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M20 6L9 17L4 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Valid wallet address
              </p>
            ) : state.addressValidationError ? (
              <p className="text-red-500 text-sm flex items-center gap-2">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {state.addressValidationError}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Recent Recipients */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="text-[#6E6E6E] text-sm mb-3">Recent</h3>
        
        {/* Loading State */}
        {isLoadingRecipients ? (
          <div className="space-y-2">
            {[1, 2, 3].map((index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-[#1A1A1A] rounded-lg"
              >
                {/* Avatar Skeleton */}
                <Skeleton className="w-10 h-10 rounded-full">
                  <div className="w-10 h-10 rounded-full bg-default-300"></div>
                </Skeleton>

                {/* Name and Address Skeleton */}
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24 rounded-lg">
                    <div className="h-4 w-24 rounded-lg bg-default-300"></div>
                  </Skeleton>
                  <Skeleton className="h-3 w-40 rounded-lg">
                    <div className="h-3 w-40 rounded-lg bg-default-200"></div>
                  </Skeleton>
                </div>

                {/* Arrow Skeleton */}
                <Skeleton className="w-5 h-5 rounded">
                  <div className="w-5 h-5 rounded bg-default-300"></div>
                </Skeleton>
              </div>
            ))}
          </div>
        ) : recipientsError ? (
          /* Error State */
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-red-500"
            >
              <path
                d="M12 9V11M12 15H12.01M5.07183 19H18.9282C20.4678 19 21.4301 17.3333 20.6603 16L13.7321 4C12.9623 2.66667 11.0377 2.66667 10.2679 4L3.33975 16C2.56995 17.3333 3.53223 19 5.07183 19Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-red-500 text-sm text-center font-medium">{recipientsError}</p>
            <p className="text-[#6E6E6E] text-xs text-center px-4">
              Please try again later
            </p>
          </div>
        ) : recentRecipients.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-[#323131]"
            >
              <path
                d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13M16 3.13C16.8604 3.3503 17.623 3.8507 18.1676 4.55231C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-[#6E6E6E] text-sm text-center">No recent recipients</p>
            <p className="text-[#6E6E6E] text-xs text-center px-4">
              Your recent transfer recipients will appear here
            </p>
          </div>
        ) : (
          /* Recipients List */
          <div className="space-y-2">
            {recentRecipients.map((recipient, index) => (
              <div
                key={index}
                onClick={() => handleRecipientSelect(recipient.walletAddress)}
                className="flex items-center gap-3 p-3 bg-[#1A1A1A] hover:bg-[#323131] rounded-lg cursor-pointer transition-colors"
              >
                {/* Avatar */}
                {recipient.avatarUrl ? (
                  <img
                    src={recipient.avatarUrl}
                    alt={recipient.userName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#323131] flex items-center justify-center text-[#F1F0EB] font-semibold">
                    {recipient.userName.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Name and Address */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[#F1F0EB] font-medium">{recipient.userName}</p>
                  </div>
                  <p className="text-[#6E6E6E] text-sm">
                    {truncateTextCenter(recipient.walletAddress, 30)}
                  </p>
                </div>

                {/* Arrow */}
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Transfer Dialog */}
      <CancelTransferDialog
        isOpen={state.showCancelDialog}
        onClose={() => setState((prev) => ({ ...prev, showCancelDialog: false }))}
        onConfirm={handleCancelConfirm}
      />

      {/* Off-Platform Warning Dialog */}
      <OffPlatformWarningDialog
        isOpen={state.showOffPlatformWarning}
        address={state.recipientAddress}
        onConfirm={handleOffPlatformConfirm}
        onCancel={handleOffPlatformCancel}
      />

      {/* Validation Loading Modal */}
      {state.isValidatingAddress && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40 p-4">
          <div className="bg-[#1A1A1A] border border-[#323131] rounded-lg p-6 max-w-sm w-full">
            <div className="flex flex-col items-center gap-4">
              {/* Spinner */}
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-[#323131] rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#11FF49] border-t-transparent rounded-full animate-spin"></div>
              </div>
              
              {/* Text */}
              <div className="text-center">
                <h3 className="text-[#F1F0EB] text-lg font-semibold mb-1">
                  Validating Address
                </h3>
                <p className="text-[#6E6E6E] text-sm">
                  Checking wallet address...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
