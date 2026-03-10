"use client";
import { ToastMessage } from "@/components/ToastMessage";
import { CurrencyType, Wallet } from "@/types";
import { Image } from "@nextui-org/react";
import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";

interface QRViewProps {
  wallet: Wallet | null;
  onBack: () => void;
}

const logoMap: Record<CurrencyType, string> = {
  USDC: "/crypto/usdc-icon.svg",
  KAMI: "/Kami.png",
  ETH: "/crypto/eth-icon.svg",
  KVT: "/crypto/kvt-icon.svg",
};

export default function QRView({ wallet, onBack }: QRViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);

  // base options; we'll update data and image dynamically
  const baseOptions = {
    width: 280,
    height: 280,
    type: "svg" as const,
    data: "",
    dotsOptions: {
      color: "#000000",
      type: "square" as const,
    },
    backgroundOptions: {
      color: "#ffffff",
    },
    cornersSquareOptions: {
      color: "#000000",
      type: "square" as const,
    },
    cornersDotOptions: {
      color: "#000000",
      type: "dot" as const,
    },
    imageOptions: {
      crossOrigin: "anonymous" as const,
      margin: 8,
    },
  };

  const copyWalletAddress = () => {
    navigator.clipboard.writeText(wallet?.walletAddress || "");
    ToastMessage("success", "Wallet address copied to clipboard!");
  };

  useEffect(() => {
    qrRef.current = new QRCodeStyling(baseOptions);
    return () => {
      qrRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    const qr = qrRef.current;
    if (el && qr) {
      el.innerHTML = "";
      qr.append(el);
    }
    return () => {
      if (el) el.innerHTML = "";
    };
  }, [containerRef.current, qrRef.current]);

  useEffect(() => {
    if (!qrRef.current) return;
    const data = wallet?.walletAddress ?? "";
    const image = wallet?.type ? logoMap[wallet.type] : undefined;

    qrRef.current.update({
      data,
      image,
    });
  }, [wallet?.walletAddress, wallet?.type]);

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="relative flex justify-center items-center mb-6 mt-4">
        <button
          onClick={onBack}
          className="absolute left-0 flex items-center gap-2 text-[#F1F0EB] hover:text-[#11FF49] transition-colors">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path
              d="M19 12H5M5 12L12 19M5 12L12 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h2 className="text-xl font-semibold text-[#F1F0EB]">
          Receive Address
        </h2>
      </div>

      {/* QR Code Container */}
      <div className="flex justify-center mb-6">
        <div className="bg-white rounded-lg p-4">
          <div ref={containerRef} />
        </div>
      </div>

      {/* Wallet Info */}
      <div className="flex flex-col text-center mb-6 gap-2">
        <p className="text-[#AFAB99]">Your {wallet?.type} Address</p>
        <p className="font-bold text-[#F1F0EB] text-sm break-all px-4">
          {wallet?.walletAddress}
        </p>
      </div>

      {/* Copy Button */}
      <div className="flex justify-center mb-4">
        <button
          className="flex flex-row gap-2 items-center bg-[#323131] px-4 py-2 rounded-md hover:bg-[#404040] transition-colors text-[#F1F0EB]"
          type="button"
          onClick={copyWalletAddress}
          aria-label="copy wallet address">
          <Image src={"/copy.svg"} alt={"copy"} width={20} height={20} />
          Copy Address
        </button>
      </div>

      {/* Warning Text */}
      <p className="text-xs text-center italic text-[#6E6E6E] px-4">
        This address can only be used to receive compatible tokens.
      </p>
    </div>
  );
}
