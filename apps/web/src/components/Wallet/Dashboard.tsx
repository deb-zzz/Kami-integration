import {
  Accordion,
  AccordionItem,
  Select,
  SelectItem,
  Chip,
  AvatarIcon,
  Avatar,
  Switch,
  Skeleton,
} from "@nextui-org/react";
import { CurrencyType, Wallet as WalletType, Blockchain } from "@/types";
import { useState, useEffect } from "react";
import { ToastMessage } from "../ToastMessage";
import Image from "next/image";
import QRView from "./QRView";

type WalletView = "dashboard" | "transfer" | "history" | "settings";

interface DashboardProps {
  isBalanceVisible: boolean;
  walletAddress: string | undefined;
  chainId: string;
  blockchains: Blockchain[];
  onChainChange: (chainId: string) => void;
  activeView: WalletView;
  setActiveView: (view: WalletView) => void;
  walletData: WalletType[];
  loading: boolean;
}

export default function Dashboard({
  isBalanceVisible,
  walletAddress,
  chainId,
  blockchains,
  onChainChange,
  activeView,
  setActiveView,
  walletData: wallets,
  loading,
}: DashboardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [showZeroBalance, setShowZeroBalance] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState<string>(chainId);

  const currencies: { key: CurrencyType; label: string }[] = [
    { key: CurrencyType.USDC, label: "USDC" },
    // { key: CurrencyType.ETH, label: "ETH" },
    // { key: CurrencyType.KAMI, label: "KAMI" },
    // { key: CurrencyType.KVT, label: "KVT" },
  ];

  const [walletData, setWalletData] = useState({
    value: "$ 0.00",
    currency: CurrencyType.USDC,
  });

  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);

  /**
   * Updates local state when chainId prop changes
   */
  useEffect(() => {
    setSelectedChainId(chainId);
  }, [chainId]);

  /**
   * Handles blockchain selection change from dropdown
   */
  const handleChainChange = (value: string) => {
    setSelectedChainId(value);
    onChainChange(value);
  };

  // Calculate total value when wallets change
  useEffect(() => {
    // Calculate total value from USDC wallets
    const totalValue = wallets
      .filter((w) => w.type === CurrencyType.USDC)
      .reduce((sum, w) => sum + w.value, 0);

    setWalletData({
      value: `$ ${totalValue.toFixed(2)}`,
      currency: CurrencyType.USDC,
    });

    // Set the first wallet as selected if available
    if (wallets.length > 0 && !selectedWallet) {
      setSelectedWallet(wallets[0]);
    }
  }, [wallets]);

  const switchCurrency = (currency: CurrencyType) => {
    setWalletData({ ...walletData, currency });
    ToastMessage("success", `Switched to ${currency}`);
  };

  const copyWalletAddress = (currentWalletAddress: string = "") => {
    if (currentWalletAddress !== "") {
      navigator.clipboard.writeText(currentWalletAddress);
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1700); // Reset after 2 seconds
    ToastMessage("success", "Wallet address copied to clipboard!");
  };

  const handleQROpen = (wallet: WalletType) => {
    setSelectedWallet(wallet);
    setIsQROpen(true);
  };

  const handleQRClose = () => {
    setIsQROpen(false);
  };

  // Conditionally render QR view or dashboard content
  if (isQROpen) {
    return <QRView wallet={selectedWallet} onBack={handleQRClose} />;
  }

  // Reusable component for rendering blockchain items with logo and name
  const BlockchainItem = ({ blockchain }: { blockchain: Blockchain }) => (
    <div className="flex items-center gap-2">
      {blockchain.logoUrl && (
        <Image
          src={blockchain.logoUrl}
          alt={blockchain.name}
          width={20}
          height={20}
          className="rounded-full"
        />
      )}
      <span>{blockchain.name}</span>
    </div>
  );

  return (
    <>
      {blockchains.length > 0 && (
        <div className="mt-2 mb-4 w-1/2">
          <Select
            placeholder="Choose a blockchain"
            selectedKeys={selectedChainId ? [selectedChainId] : []}
            onChange={(e) => handleChainChange(e.target.value)}
            classNames={{
              base: "max-w-1/3",
              trigger:
                "bg-inherit border border-[#454343] hover:bg-[#404040] data-[hover=true]:bg-[#404040]",
              value: "!text-[#F1F0EB]",
              listbox: "bg-inherit",
              popoverContent: "bg-black border border-[#454343]",
            }}
            aria-label="Select blockchain network"
            renderValue={(items) => {
              const selectedItem = items[0];
              if (!selectedItem) return null;
              const blockchain = blockchains.find(
                (b) => b.chainId === selectedItem.key
              );
              return blockchain ? (
                <BlockchainItem blockchain={blockchain} />
              ) : (
                selectedItem.textValue
              );
            }}
          >
            {blockchains.map((blockchain) => (
              <SelectItem
                key={blockchain.chainId}
                value={blockchain.chainId}
                textValue={blockchain.name}
                classNames={{
                  base: "data-[hover=true]:bg-[#404040] data-[selected=true]:bg-[#A79755]/20",
                  title: "text-[#F1F0EB]",
                }}
              >
                <BlockchainItem blockchain={blockchain} />
              </SelectItem>
            ))}
          </Select>
        </div>
      )}

      <div className="flex flex-row my-6 justify-center items-start">
        {loading ? (
          <div className="w-10 h-10 border-2 border-[#A79755] border-t-transparent rounded-full animate-spin mb-3"></div>
        ) : (
          <>
            <h2 className="text-5xl text-[#AFAB99]">
              {isBalanceVisible ? "*****" : walletData.value}
            </h2>
            <Select
              size="sm"
              className="w-[6rem] flex-row"
              aria-label="currency"
              disallowEmptySelection
              defaultSelectedKeys={[walletData.currency]}
              classNames={{
                label: "group-data-[filled=true]:-translate-y-5 text-[#6E6E6E]",
                popoverContent: "bg-black border-none",
                trigger: "bg-transparent data-[hover=true]:bg-transparent",
                innerWrapper: "text-[#6E6E6E]",
                value:
                  "text-[#6E6E6E] text-[13px] group-data-[has-value=true]:text-[#6E6E6E]",
                listboxWrapper: "border border-[#AFAB994d] rounded-lg",
              }}
              onChange={(e) => switchCurrency(e.target.value as CurrencyType)}
            >
              {currencies.map((curr) => (
                <SelectItem key={curr.key}>{curr.label}</SelectItem>
              ))}
            </Select>
          </>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4 text-[#AFAB99] my-3">
        <button className="group flex flex-col bg-[#323131] py-3 gap-2 hover:shadow-md hover:bg-[#11FF49] hover:text-black disabled:opacity-50 min-w-20 rounded-md transition-colors">
          <div className="flex justify-center">
            <svg
              width="45"
              height="45"
              viewBox="0 0 30 31"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="group-hover:[&_path]:stroke-black transition-colors"
            >
              <path
                d="M10 15.8672L15 20.8672M15 20.8672L20 15.8672M15 20.8672V10.8672M27.5 15.8672C27.5 22.7707 21.9036 28.3672 15 28.3672C8.09644 28.3672 2.5 22.7707 2.5 15.8672C2.5 8.96363 8.09644 3.36719 15 3.36719C21.9036 3.36719 27.5 8.96363 27.5 15.8672Z"
                stroke="#11FF49"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          Receive
        </button>
        <button
          className="group flex flex-col bg-[#323131] py-3 gap-2 hover:shadow-md hover:bg-[#11FF49] hover:text-black disabled:opacity-50 min-w-20 rounded-md transition-colors"
          onClick={() => setActiveView("transfer")}
        >
          <div className="flex justify-center">
            <svg
              width="45"
              height="45"
              viewBox="0 0 30 31"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="group-hover:[&_path]:stroke-black transition-colors"
            >
              <path
                d="M20 15.8672L15 10.8672M15 10.8672L10 15.8672M15 10.8672V20.8672M27.5 15.8672C27.5 22.7707 21.9036 28.3672 15 28.3672C8.09644 28.3672 2.5 22.7707 2.5 15.8672C2.5 8.96363 8.09644 3.36719 15 3.36719C21.9036 3.36719 27.5 8.96363 27.5 15.8672Z"
                stroke="#11FF49"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          Send
        </button>
        <button
          className="group flex flex-col bg-[#323131] py-3 gap-2 hover:shadow-md hover:bg-[#11FF49] hover:text-black disabled:opacity-50 min-w-20 rounded-md transition-colors"
          disabled
        >
          <div className="flex justify-center">
            <svg
              width="45"
              height="45"
              viewBox="0 0 22 22"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="group-hover:[&_path]:stroke-black transition-colors"
            >
              <path
                d="M5 5L7 3M7 3L5 1M7 3H5C2.79086 3 1 4.79086 1 7M17 17L15 19M15 19L17 21M15 19H17C19.2091 19 21 17.2091 21 15M9.18903 5.5C9.85509 2.91216 12.2042 1 15 1C18.3137 1 21 3.68629 21 7C21 9.79574 19.0879 12.1449 16.5001 12.811M13 15C13 18.3137 10.3137 21 7 21C3.68629 21 1 18.3137 1 15C1 11.6863 3.68629 9 7 9C10.3137 9 13 11.6863 13 15Z"
                stroke="#11FF49"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          Buy/Sell
        </button>
        <button
          className="group flex flex-col bg-[#323131] py-3 gap-2 hover:shadow-md hover:bg-[#11FF49] hover:text-black disabled:opacity-50 min-w-20 rounded-md transition-colors"
          disabled
        >
          <div className="flex justify-center">
            <svg
              width="45"
              height="45"
              viewBox="0 0 30 30"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="group-hover:[&_path]:stroke-black transition-colors"
            >
              <path
                d="M16.25 6.25C16.25 7.63071 13.172 8.75 9.375 8.75C5.57804 8.75 2.5 7.63071 2.5 6.25M16.25 6.25C16.25 4.86929 13.172 3.75 9.375 3.75C5.57804 3.75 2.5 4.86929 2.5 6.25M16.25 6.25V8.125M2.5 6.25V21.25C2.5 22.6307 5.57804 23.75 9.375 23.75M9.375 13.75C9.16432 13.75 8.95585 13.7466 8.75 13.7398C5.24594 13.625 2.5 12.5541 2.5 11.25M9.375 18.75C5.57804 18.75 2.5 17.6307 2.5 16.25M27.5 14.375C27.5 15.7557 24.422 16.875 20.625 16.875C16.828 16.875 13.75 15.7557 13.75 14.375M27.5 14.375C27.5 12.9943 24.422 11.875 20.625 11.875C16.828 11.875 13.75 12.9943 13.75 14.375M27.5 14.375V23.75C27.5 25.1307 24.422 26.25 20.625 26.25C16.828 26.25 13.75 25.1307 13.75 23.75V14.375M27.5 19.0625C27.5 20.4432 24.422 21.5625 20.625 21.5625C16.828 21.5625 13.75 20.4432 13.75 19.0625"
                stroke="#11FF49"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          Grow
        </button>
      </div>

      <div className="justify-end flex mb-2">
        <Switch
          className="inline-flex flex-row-reverse gap-1"
          size="sm"
          isSelected={showZeroBalance}
          onValueChange={setShowZeroBalance}
        >
          <span className="text-[#6E6E6E]">Show zero balance</span>
        </Switch>
      </div>

      <Accordion
        defaultExpandedKeys={["tokens"]}
        variant="shadow"
        className="bg-[#7AAC8A] px-1"
        itemClasses={{
          content: "bg-[#7AAC8A]",
        }}
      >
        <AccordionItem
          key="tokens"
          title="TOKENS"
          aria-label="tokens"
          classNames={{
            title: "text-lg font-bold text-black ps-3",
            base: "bg-[#7AAC8A] px-1 rounded-lg",
            indicator: "text-black text-[20px] font-bold",
          }}
        >
          {loading ? (
            <div className="space-y-0">
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="flex flex-row gap-2 align-self-center h-14 py-2 border-b-1"
                >
                  {/* Avatar Skeleton */}
                  <Skeleton className="w-[35px] h-[35px] mx-2 rounded-full">
                    <div className="w-[35px] h-[35px] rounded-full bg-default-300"></div>
                  </Skeleton>

                  {/* Text Content Skeleton */}
                  <div className="flex flex-col grow justify-center gap-2">
                    <Skeleton className="h-4 w-16 rounded-lg">
                      <div className="h-4 w-16 rounded-lg bg-default-300"></div>
                    </Skeleton>
                    <Skeleton className="h-3 w-24 rounded-lg">
                      <div className="h-3 w-24 rounded-lg bg-default-200"></div>
                    </Skeleton>
                  </div>

                  {/* Arrow Skeleton */}
                  <div className="flex items-center me-2">
                    <Skeleton className="w-5 h-5 rounded">
                      <div className="w-5 h-5 rounded bg-default-300"></div>
                    </Skeleton>
                  </div>
                </div>
              ))}
            </div>
          ) : wallets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-black/40"
              >
                <path
                  d="M21 16V8C20.9996 7.64927 20.9071 7.30481 20.7315 7.00116C20.556 6.69751 20.3037 6.44536 20 6.27L13 2.27C12.696 2.09446 12.3511 2.00205 12 2.00205C11.6489 2.00205 11.304 2.09446 11 2.27L4 6.27C3.69626 6.44536 3.44398 6.69751 3.26846 7.00116C3.09294 7.30481 3.00036 7.64927 3 8V16C3.00036 16.3507 3.09294 16.6952 3.26846 16.9988C3.44398 17.3025 3.69626 17.5546 4 17.73L11 21.73C11.304 21.9055 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9055 13 21.73L20 17.73C20.3037 17.5546 20.556 17.3025 20.7315 16.9988C20.9071 16.6952 20.9996 16.3507 21 16Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3.27002 6.96L12 12.01L20.73 6.96"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 22.08V12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-center">
                <p className="text-black font-semibold text-base mb-1">No Tokens Available</p>
                <p className="text-black/60 text-sm px-4">
                  {`Your wallet doesn't have any tokens on this network`}
                </p>
              </div>
            </div>
          ) : (
            wallets
              .filter((w) => showZeroBalance || w.balance > 0)
              .map((w, index) => (
                <div
                  key={index}
                  className="flex flex-row gap-2 align-self-center h-14 py-2 border-b-1"
                >
                  <Avatar
                    className="w-[35px] h-[35px] mx-2"
                    size={"sm"}
                    icon={<AvatarIcon />}
                    src={w.icon ?? undefined}
                  />
                  <div className="flex flex-col grow text-black">
                    <p className="font-bold text-[16px]">{w.type}</p>
                    <p className="text-[14px]">{`${w.type == CurrencyType.USDC ? w.value.toFixed(2) : w.value.toFixed(6)} ${
                      w.type
                    }`}</p>
                  </div>
                  <div className="flex flex-row gap-2 me-2">
                    <Chip
                      variant="flat"
                      radius="lg"
                      className="cursor-pointer"
                      onClick={() => handleQROpen(w)}
                    >
                      <Image
                        src={"/crypto/qr-code.svg"}
                        alt={"QR"}
                        width={17}
                        height={17}
                        className="slate-50"
                      />
                    </Chip>
                    <Chip
                      variant="flat"
                      radius="lg"
                      className="cursor-pointer"
                      onClick={() => copyWalletAddress(w.walletAddress)}
                    >
                      <Image
                        src={"/copy.svg"}
                        alt={"cup"}
                        width={17}
                        height={17}
                        className="slate-50"
                      />
                    </Chip>
                  </div>
                </div>
              ))
          )}
        </AccordionItem>
      </Accordion>

      <div className="h-auto w-full flex flex-row justify-around bg-[#323131] rounded-md mt-4">
        <button
          className={`px-4 py-3 rounded-md transition-colors ${
            activeView === "dashboard"
              ? "bg-[#11FF49] bg-opacity-20"
              : "hover:bg-[#404040]"
          }`}
          onClick={() => setActiveView("dashboard")}
        >
          <Image
            src={"/walletNav/home.svg"}
            alt="wallet home"
            width={24}
            height={24}
          />
        </button>
        <button
          className={`px-4 py-3 rounded-md transition-colors ${
            activeView === "transfer"
              ? "bg-[#11FF49] bg-opacity-20"
              : "hover:bg-[#404040]"
          }`}
          onClick={() => setActiveView("transfer")}
        >
          <Image
            src={"/walletNav/coinswap.svg"}
            alt="wallet transfer"
            width={24}
            height={24}
          />
        </button>
        <button
          className={`px-4 py-3 rounded-md transition-colors ${
            activeView === "history"
              ? "bg-[#11FF49] bg-opacity-20"
              : "hover:bg-[#404040]"
          }`}
          onClick={() => setActiveView("history")}
        >
          <Image
            src={"/walletNav/clock.svg"}
            alt="wallet transaction history"
            width={24}
            height={24}
          />
        </button>
        <button
          className={`px-4 py-3 rounded-md transition-colors ${
            activeView === "settings"
              ? "bg-[#11FF49] bg-opacity-20"
              : "hover:bg-[#404040]"
          }`}
          onClick={() => setActiveView("settings")}
        >
          <Image
            src={"/walletNav/cog.svg"}
            alt="wallet settings"
            width={24}
            height={24}
          />
        </button>
      </div>
    </>
  );
}
