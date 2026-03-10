"use client";
import { ToastMessage } from "@/components/ToastMessage";
import { CurrencyType, Wallet } from "@/types";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalHeader,
  Image,
} from "@nextui-org/react";
import { useEffect, useRef } from "react";
import QRCodeStyling, { Options } from "qr-code-styling";

interface QRModalProp {
  isOpen: boolean;
  onOpenChange: (e: boolean) => void;
  wallet: Wallet;
}

const logoMap: Record<CurrencyType, string> = {
  USDC: "/crypto/usdc-icon.svg",
  KAMI: "/Kami.png",
  ETH: "/crypto/eth-icon.svg",
  KVT: "/crypto/kvt-icon.svg",
};

// Base options defined outside component to prevent recreation on every render
const baseOptions: Options = {
  width: 300,
  height: 300,
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

export default function QRModal({ isOpen, onOpenChange, wallet }: QRModalProp) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);

  const copyWalletAddress = () => {
    try {
      if (!wallet?.walletAddress) {
        ToastMessage("error", "No wallet address available to copy");
        return;
      }
      navigator.clipboard.writeText(wallet.walletAddress);
      ToastMessage("success", "Wallet address copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy wallet address:", error);
      ToastMessage("error", "Failed to copy wallet address");
    }
  };

  // Initialize QR code instance once
  useEffect(() => {
    try {
      qrRef.current = new QRCodeStyling(baseOptions);
    } catch (error) {
      console.error("Failed to initialize QR code:", error);
      ToastMessage("error", "Failed to initialize QR code");
    }
    return () => {
      qrRef.current = null;
    };
  }, []);

  // Update QR code data and image when wallet changes
  useEffect(() => {
    if (!qrRef.current) return;
    
    try {
      const data = wallet?.walletAddress ?? "";
      const image = wallet?.type ? logoMap[wallet.type] : undefined;

      qrRef.current.update({
        data,
        image,
      });
    } catch (error) {
      console.error("Failed to update QR code:", error);
    }
  }, [wallet?.walletAddress, wallet?.type]);

  // Handle QR code rendering when modal opens/closes
  useEffect(() => {
    const container = containerRef.current;
    const qr = qrRef.current;

    if (!container || !qr) return;

    if (isOpen) {
      // Clear container and append QR code when modal opens
      container.innerHTML = "";
      try {
        qr.append(container);
      } catch (error) {
        console.error("Failed to render QR code:", error);
        ToastMessage("error", "Failed to render QR code");
      }
    } else {
      // Clear container when modal closes
      container.innerHTML = "";
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent className="bg-slate-900">
        <ModalHeader>Receive Address</ModalHeader>
        <ModalBody>
          <div className="flex justify-center py-3 mx-6 bg-white rounded-lg" ref={containerRef} />
          <div className="flex flex-col text-center my-3 gap-2">
            <p>Your {wallet?.type} Address</p>
            <p className="font-bold">{wallet?.walletAddress}</p>
          </div>
          <div className="flex justify-center mb-3">
            <button
              className="flex flex-row gap-2 align-middle focus:outline-none"
              type="button"
              onClick={copyWalletAddress}
              aria-label="copy wallet address">
              <Image
                src={"/copy.svg"}
                alt={"cup"}
                width={20}
                height={20}
              />
              Copy
            </button>
          </div>
          <p className="text-sm text-center italic">
            This address can only be used to receive compatible tokens.
          </p>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
