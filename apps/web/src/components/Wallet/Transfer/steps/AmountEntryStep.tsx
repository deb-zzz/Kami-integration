import { useEffect } from "react";
import Image from "next/image";
import { TransferStepProps } from "../types";
import { CancelTransferDialog } from "../components/CancelTransferDialog";
import {
  getTextSizeClass,
  handleNumberInput,
  handleBackspaceInput,
  calculatePercentage,
  getMaxAmount,
} from "../utils";

export const AmountEntryStep: React.FC<TransferStepProps> = ({
  state,
  setState,
  setActiveView,
}) => {
  // Handle keyboard input
  useEffect(() => {
    if (!state.selectedToken) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleNumberClick(e.key);
      } else if (e.key === "." || e.key === ",") {
        handleNumberClick(".");
      } else if (e.key === "Backspace") {
        handleBackspace();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.selectedToken, state.amount]);

  const handleNumberClick = (num: string) => {
    const result = handleNumberInput(num, state.amount, state.selectedToken);
    if (result) {
      setState((prev) => ({
        ...prev,
        amount: result.newAmount,
        isValid: result.isValid,
      }));
    }
  };

  const handleBackspace = () => {
    const result = handleBackspaceInput(state.amount);
    setState((prev) => ({
      ...prev,
      amount: result.newAmount,
      isValid: result.isValid,
    }));
  };

  const handlePercentage = (percentage: number) => {
    const result = calculatePercentage(percentage, state.selectedToken);
    if (result) {
      setState((prev) => ({
        ...prev,
        amount: result.amount,
        isValid: result.isValid,
      }));
    }
  };

  const handleMax = () => {
    const result = getMaxAmount(state.selectedToken);
    if (result) {
      setState((prev) => ({
        ...prev,
        amount: result.amount,
        isValid: result.isValid,
      }));
    }
  };

  const handleContinue = () => {
    setState((prev) => ({ ...prev, transferStep: "recipient" }));
  };

  const handleBack = () => {
    setState((prev) => ({
      ...prev,
      selectedToken: null,
      amount: "0",
      isValid: false,
      transferStep: "amount",
    }));
  };

  const handleCancelConfirm = () => {
    setState((prev) => ({ ...prev, showCancelDialog: false }));
    setActiveView("dashboard");
  };

  if (!state.selectedToken) return null;

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

      {/* Amount Display */}
      <div className="flex flex-col items-center justify-center mb-8">
        <div className="flex items-center gap-2 mb-2">
          <h1
            className={`${getTextSizeClass(state.amount)} font-light ${
              state.isValid ? "text-[#F1F0EB]" : "text-[#6E6E6E]"
            }`}
          >
            {state.amount}
          </h1>
          <span className="text-2xl text-[#F1F0EB] font-medium">
            {state.selectedToken.type}
          </span>
        </div>
      </div>

      {/* Available Balance */}
      <div className="text-center mb-8">
        <p className="text-[#F1F0EB] text-lg">
          {state.selectedToken.value.toLocaleString()} {state.selectedToken.type}{" "}
          available
        </p>
      </div>

      {/* Continue Button - Only show when amount is valid */}
      <div
        className={`transition-all duration-300 ease-in-out mx-2 mb-4 ${
          state.isValid
            ? "opacity-100 translate-y-0 max-h-20"
            : "opacity-0 translate-y-4 max-h-0 pointer-events-none overflow-hidden"
        }`}
      >
        <button
          className="w-full bg-white hover:bg-gray-100 text-black font-semibold py-4 rounded-lg text-lg transition-colors"
          onClick={handleContinue}
          disabled={!state.isValid}
        >
          Continue
        </button>
      </div>

      {/* Percentage Buttons */}
      <div className="grid grid-cols-4 gap-3 mb-6 px-2">
        <button
          onClick={() => handlePercentage(25)}
          className="bg-[#323131] hover:bg-[#404040] hover:border-1 hover:border-[#11FF49] text-[#F1F0EB] py-3 rounded-lg font-medium transition-colors"
        >
          25%
        </button>
        <button
          onClick={() => handlePercentage(50)}
          className="bg-[#323131] hover:bg-[#404040] hover:border-1 hover:border-[#11FF49] text-[#F1F0EB] py-3 rounded-lg font-medium transition-colors"
        >
          50%
        </button>
        <button
          onClick={() => handlePercentage(75)}
          className="bg-[#323131] hover:bg-[#404040] hover:border-1 hover:border-[#11FF49] text-[#F1F0EB] py-3 rounded-lg font-medium transition-colors"
        >
          75%
        </button>
        <button
          onClick={handleMax}
          className="bg-[#323131] hover:bg-[#404040] hover:border-1 hover:border-[#11FF49] text-[#F1F0EB] py-3 rounded-lg font-medium transition-colors"
        >
          Max
        </button>
      </div>

      {/* Numeric Keypad */}
      <div className="grid grid-cols-3 gap-3 px-2 mb-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleNumberClick(num.toString())}
            className="bg-[#323131] hover:bg-[#404040] text-[#F1F0EB] text-2xl py-2 rounded-lg font-light transition-colors"
          >
            {num}
          </button>
        ))}
        <button
          onClick={() => handleNumberClick(".")}
          className="bg-[#323131] hover:bg-[#404040] text-[#F1F0EB] text-2xl py-2 rounded-lg font-light transition-colors"
        >
          .
        </button>
        <button
          onClick={() => handleNumberClick("0")}
          className="bg-[#323131] hover:bg-[#404040] text-[#F1F0EB] text-2xl py-2 rounded-lg font-light transition-colors"
        >
          0
        </button>
        <button
          onClick={handleBackspace}
          className="bg-[#323131] hover:bg-[#404040] text-[#F1F0EB] py-2 rounded-lg flex items-center justify-center transition-colors"
        >
          <Image
            src={"/backspace.svg"}
            alt={"backspace"}
            width={20}
            height={19}
          />
        </button>
      </div>

      {/* Cancel Transfer Dialog */}
      <CancelTransferDialog
        isOpen={state.showCancelDialog}
        onClose={() => setState((prev) => ({ ...prev, showCancelDialog: false }))}
        onConfirm={handleCancelConfirm}
      />
    </div>
  );
};
