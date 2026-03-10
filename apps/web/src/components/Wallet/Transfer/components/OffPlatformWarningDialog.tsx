interface OffPlatformWarningDialogProps {
  isOpen: boolean;
  address: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const OffPlatformWarningDialog: React.FC<OffPlatformWarningDialogProps> = ({
  isOpen,
  address,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] border border-[#323131] rounded-lg p-6 max-w-md w-full">
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-yellow-500"
            >
              <path
                d="M12 9V11M12 15H12.01M5.07183 19H18.9282C20.4678 19 21.4301 17.3333 20.6603 16L13.7321 4C12.9623 2.66667 11.0377 2.66667 10.2679 4L3.33975 16C2.56995 17.3333 3.53223 19 5.07183 19Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-[#F1F0EB] text-xl font-semibold text-center mb-2">
          Off-Platform Transfer
        </h3>

        {/* Message */}
        <div className="space-y-3 mb-6">
          <p className="text-[#6E6E6E] text-sm text-center">
            This wallet address is not registered on our platform:
          </p>
          <div className="bg-[#0A0A0A] border border-[#323131] rounded-lg p-3">
            <p className="text-[#F1F0EB] text-sm font-mono text-center break-all">
              {address}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-[#F1F0EB] text-sm">
              <span className="font-semibold">Important:</span>
            </p>
            <ul className="text-[#6E6E6E] text-sm space-y-1 list-disc list-inside">
              <li>This will be a direct blockchain transfer</li>
              <li>Make sure the address is correct</li>
              <li>Transactions cannot be reversed</li>
              <li>{`The recipient won't receive platform notifications`}</li>
            </ul>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-[#323131] hover:bg-[#404040] text-[#F1F0EB] py-3 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black py-3 rounded-lg font-medium transition-colors"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );
};
