import { useEffect } from "react";
import {
  Accordion,
  AccordionItem,
  Select,
  SelectItem,
  Avatar,
  AvatarIcon,
  Switch,
  Skeleton,
} from "@nextui-org/react";
import { CurrencyType } from "@/types";
import { TransferStepProps } from "../types";
import { BlockchainItem } from "../components/BlockchainItem";
import { getAllCachedProfiles } from "@/lib/mention-cache";

export const TokenSelectionStep: React.FC<TransferStepProps> = ({
  state,
  setState,
  setActiveView,
  blockchains,
  onChainChange,
  wallets,
  loading,
  showZeroBalance,
  setShowZeroBalance,
}) => {
  // Prefetch all profiles when component mounts
  useEffect(() => {
    getAllCachedProfiles().catch((error) => {
      console.error("Error prefetching profiles:", error);
    });
  }, []);

  const handleChainChange = (value: string) => {
    setState((prev) => ({ ...prev, selectedChainId: value }));
    onChainChange(value);
  };

  const handleTokenSelect = (wallet: any) => {
    setState((prev) => ({ ...prev, selectedToken: wallet }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 mt-4">
        {blockchains.length > 0 && (
          <Select
            placeholder="Choose a blockchain"
            selectedKeys={state.selectedChainId ? [state.selectedChainId] : []}
            onChange={(e) => handleChainChange(e.target.value)}
            classNames={{
              base: "w-1/3",
              trigger:
                "bg-[#323131] border-[#A79755]/40 hover:bg-[#404040] data-[hover=true]:bg-[#404040]",
              label: "text-[#AFAB99] text-sm",
              value: "!text-[#F1F0EB]",
              listbox: "bg-[#323131]",
              popoverContent: "bg-[#323131] border border-[#A79755]/40",
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
        )}
        <h2 className="text-xl text-[#F1F0EB] font-semibold">SEND</h2>
        <button
          onClick={() => setActiveView("dashboard")}
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

      {/* Token List Accordion */}
      <Accordion
        defaultExpandedKeys={["tokens"]}
        variant="shadow"
        className="bg-[#7AAC8A] px-1 mb-4"
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
                  className="flex flex-row gap-2 align-self-center h-14 py-2 border-b-1 cursor-pointer hover:bg-[#6A9C7A] transition-colors"
                  onClick={() => handleTokenSelect(w)}
                >
                  <Avatar
                    className="w-[35px] h-[35px] mx-2"
                    size={"sm"}
                    icon={<AvatarIcon />}
                    src={w.icon ?? undefined}
                  />
                  <div className="flex flex-col grow text-black">
                    <p className="font-bold text-[16px]">{w.type}</p>
                    <p className="text-[14px]">{`${
                      w.type == CurrencyType.USDC
                        ? w.value.toFixed(2)
                        : w.value.toFixed(6)
                    } ${w.type}`}</p>
                  </div>
                  <div className="flex items-center me-2">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
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
                </div>
              ))
          )}
        </AccordionItem>
      </Accordion>

      <button
        onClick={() => setActiveView("dashboard")}
        className="w-full bg-[#323131] hover:bg-[#11FF49] hover:text-black text-[#F1F0EB] py-3 rounded-md transition-colors mt-4"
      >
        Close
      </button>
    </div>
  );
};
