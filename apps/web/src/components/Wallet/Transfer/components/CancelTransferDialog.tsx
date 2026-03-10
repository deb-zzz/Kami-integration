interface CancelTransferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const CancelTransferDialog: React.FC<CancelTransferDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40 p-4">
      <div className="bg-[#1A1A1A] border border-[#323131] rounded-lg p-6 max-w-sm w-full">
        <h3 className="text-[#F1F0EB] text-xl font-semibold mb-4">
          Cancel Transfer?
        </h3>
        <p className="text-[#6E6E6E] mb-6">
          Are you sure you want to cancel this transfer and return to the
          dashboard?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="bg-[#323131] hover:bg-[#404040] text-[#F1F0EB] font-semibold py-2 rounded-lg transition-colors"
          >
            No
          </button>
          <button
            onClick={onConfirm}
            className="bg-[#D9D9D9] hover:bg-[#F1F0EB] text-black font-semibold py-2 rounded-lg transition-colors"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
};
