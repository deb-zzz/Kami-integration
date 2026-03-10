import { ToastMessage } from "@/components/ToastMessage";
import { Chip, Image } from "@nextui-org/react";
import React from "react";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Loading Modal - Shows during transfer processing
export const TransferLoadingModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-[#1A1A1A] border border-[#323131] rounded-lg p-8 max-w-md w-full mx-4 text-center">
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto mb-4 relative">
            <div className="w-24 h-24 border-4 border-[#323131] rounded-full"></div>
            <div className="w-24 h-24 border-4 border-[#11FF49] rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
          </div>
          <h2 className="text-2xl font-semibold text-[#11FF49] mb-2">
            Transaction processing
          </h2>
          <p className="text-[#6E6E6E]">Please wait...</p>
        </div>
      </div>
    </div>
  );
};

// Success Modal - Shows after successful transfer
interface TransferSuccessModalProps extends TransferModalProps {
  amount: string;
  tokenType: string;
  recipientName: string;
  recipientAddress: string;
  networkName: string;
  transactionHash?: string;
}

export const TransferSuccessModal: React.FC<TransferSuccessModalProps> = ({
  isOpen,
  onClose,
  amount,
  tokenType,
  recipientName,
  recipientAddress,
  networkName,
  transactionHash,
}) => {
  const copyString = (inputString: string = "") => {
    if (inputString !== "") {
      navigator.clipboard.writeText(inputString);
    }
    setTimeout(() => {}, 1700); // Reset after 2 seconds
    ToastMessage("success", "Copied successfully!");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-[#1A1A1A] border border-[#323131] rounded-lg p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="w-24 h-24 mx-auto mb-4 bg-[#11FF49] rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-black"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-[#11FF49] mb-2">
            Transfer successful!
          </h2>
          <p className="text-[#6E6E6E]">Your transaction has been completed</p>
        </div>

        <div className="space-y-3 mb-6">
          {/* Amount */}
          <div className="bg-[#0A0A0A] rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-[#6E6E6E]">Amount</span>
              <span className="text-[#F1F0EB] font-semibold text-lg">
                {amount} {tokenType}
              </span>
            </div>
          </div>

          {/* Recipient */}
          <div className="bg-[#0A0A0A] rounded-lg p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[#6E6E6E]">To</span>
              <span className="text-[#F1F0EB] font-medium">
                {recipientName}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#6E6E6E] text-sm font-mono">
                {recipientAddress.slice(0, 6)}...{recipientAddress.slice(-4)}
              </span>
              <Image
                onClick={() => copyString(recipientAddress)}
                src={"/copy.svg"}
                alt={"cup"}
                width={14}
                height={14}
                className="slate-50"
              />
            </div>
          </div>

          {/* Network */}
          <div className="bg-[#0A0A0A] rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-[#6E6E6E]">Network</span>
              <span className="text-[#F1F0EB]">{networkName}</span>
            </div>
          </div>

          {/* Transaction Hash */}
          {transactionHash && (
            <div className="bg-[#0A0A0A] rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-[#6E6E6E]">Transaction Hash</span>
                <span className="text-[#11FF49] text-sm font-mono">
                  {transactionHash.slice(0, 6)}...{transactionHash.slice(-4)}
                </span>
                <Image
                  onClick={() => copyString(transactionHash)}
                  src={"/copy.svg"}
                  alt={"cup"}
                  width={14}
                  height={14}
                  className="slate-50"
                />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full bg-[#11FF49] text-black py-3 rounded-lg font-semibold hover:bg-[#0FE040] transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};

// Failure Modal - Shows when transfer fails
interface TransferFailureModalProps extends TransferModalProps {
  errorMessage?: string;
}

export const TransferFailureModal: React.FC<TransferFailureModalProps> = ({
  isOpen,
  onClose,
  errorMessage = "Something went wrong, please try again later",
}) => {
  if (!isOpen) return null;

  // Safely handle error message
  const safeMessage = (() => {
    try {
      if (typeof errorMessage === "string") return errorMessage;
      if (errorMessage == null)
        return "Something went wrong, please try again later";
      if (
        (errorMessage as any)?.message &&
        typeof (errorMessage as any).message === "string"
      ) {
        return (errorMessage as any).message as string;
      }
      try {
        return JSON.stringify(errorMessage);
      } catch {
        return String(errorMessage);
      }
    } catch {
      return "Something went wrong, please try again later";
    }
  })();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-[#1A1A1A] border border-[#323131] rounded-lg p-8 max-w-md w-full mx-4 text-center">
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto mb-4 bg-red-500 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-red-500 mb-2">
            Transfer failed
          </h2>
          <p className="text-[#6E6E6E]">{safeMessage}</p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-[#6E6E6E] text-[#F1F0EB] py-3 rounded-lg font-semibold hover:bg-[#808080] transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
