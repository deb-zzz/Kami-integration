import { useEffect, useState } from "react";
import Image from "next/image";
import TransactionSummary from "./TransactionSummary";
import '@/styles/scrollbar.css';
import { getTransactions } from "@/apihandler/Wallet";
import { CryptoTransaction, Blockchain } from "@/types";
import { Select, SelectItem } from "@nextui-org/react";

type TransactionStatus = "Success" | "Failed" | "Pending";
type WalletView = "dashboard" | "transfer" | "history" | "settings";

interface HistoryProps {
  walletAddress: string;
  chainId: string;
  blockchains: Blockchain[];
  onChainChange: (chainId: string) => void;
  setActiveView: (view: WalletView) => void;
}

export default function History({
  walletAddress,
  chainId,
  blockchains,
  onChainChange,
  setActiveView,
}: HistoryProps) {
  const [selectedTx, setSelectedTx] = useState<CryptoTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<CryptoTransaction[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<string>(chainId);

  /**
   * Fetches transactions for the selected blockchain and wallet address
   */
  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        if (selectedChainId && walletAddress) {
          const res = await getTransactions(walletAddress, selectedChainId);
          if (res.success) {
            setTransactions(res.data);
          } else {
            setTransactions([]);
          }
        }
      } catch (error) {
        console.error("Error fetching transactions:", error);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [selectedChainId, walletAddress]);

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

  // Group transactions by month
  const groupTransactionsByMonth = (transactions: CryptoTransaction[]) => {
    const grouped: { [key: string]: CryptoTransaction[] } = {};

    transactions.forEach((transaction) => {
      let time = parseInt(transaction.timestamp);

      // If timestamp is in seconds (10 digits), convert to milliseconds
      if (time < 1e12) {
        time *= 1000;
      }

      const date = new Date(time);
      const monthYear = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });

      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      grouped[monthYear].push(transaction);
    });

    // Sort transactions within each month by date (newest first)
    Object.keys(grouped).forEach((month) => {
      grouped[month].sort(
        (a, b) => parseInt(b.timestamp) - parseInt(a.timestamp)
      );
    });

    return grouped;
  };

  function mapToTransactionStatus(value: any): TransactionStatus {
    if (value === 1) return "Success";
    if (value === 0) return "Failed";
    // handles null, undefined, ""
    return "Pending";
  }
    
  const formatAmount = (amount: string, currency: string) => {
    const value = parseFloat(amount);

    // Check if value has significant decimals beyond 2 places
    const valueStr = value.toString();
    let decimals = 2;
    let shouldRemoveTrailingZeros = false;

    if (valueStr.includes(".")) {
      const decimalPart = valueStr.split(".")[1];
      if (decimalPart.length > 2) {
        // Has more than 2 decimals, use up to 6 and remove trailing zeros
        decimals = Math.min(decimalPart.length, 6);
        shouldRemoveTrailingZeros = true;
      }
    }

    // Format number with fixed decimals
    let formatted = value.toFixed(decimals);

    // Split into integer and decimal parts
    const [intPart, decPart] = formatted.split(".");

    // Add commas only to integer part
    const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // Recombine
    formatted = decPart ? `${intWithCommas}.${decPart}` : intWithCommas;

    // Only remove trailing zeros if we have more than 2 decimal places
    if (shouldRemoveTrailingZeros) {
      formatted = formatted.replace(/\.?0+$/, "");
    }

    return `${formatted} ${currency}`;
  };

  const formatDateTime = (timestamp: string) => {
    let time = parseInt(timestamp);

    // If timestamp is in seconds (10 digits), convert to milliseconds
    if (time < 1e12) {
      time *= 1000;
    }

    const date = new Date(time);

    return (
      <div className="flex flex-row text-xs gap-1 items-center justify-center">
        <Image src="./calendar.svg" alt="calendar" width={12} height={12} />
        {date.toLocaleDateString("en-GB", {
          month: "numeric",
          day: "numeric",
          year: "numeric",
        })}
        &nbsp; &nbsp;
        <Image src="./walletNav/clock.svg" alt="clock" width={12} height={12} />
        {date.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}
      </div>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Success":
        return "text-[#11FF49]";
      case "Pending":
        return "text-[#FFA500]";
      case "Failed":
        return "text-[#FF4444]";
      default:
        return "text-[#AFAB99]";
    }
  };

  const groupedTransactions = groupTransactionsByMonth(transactions);
  const sortedMonths = Object.keys(groupedTransactions).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  return (
    <div className="flex flex-col h-full">
      {!selectedTx && (
        <>
          <div className="flex justify-between items-center mt-4 mb-4">
            <h2 className="text-xl text-[#A79755] font-semibold">History</h2>
          </div>

          {/* Blockchain Selector Dropdown */}
          {blockchains.length > 0 && (
            <div className="mb-4">
              <Select
                label="Select Blockchain"
                placeholder="Choose a blockchain"
                selectedKeys={selectedChainId ? [selectedChainId] : []}
                onChange={(e) => handleChainChange(e.target.value)}
                classNames={{
                  base: "max-w-full",
                  trigger:
                    "bg-[#323131] border-[#A79755]/40 hover:bg-[#404040] data-[hover=true]:bg-[#404040]",
                  label: "text-[#AFAB99] text-sm",
                  value: "!text-[#F1F0EB]",
                  listbox: "bg-[#323131]",
                  popoverContent: "bg-[#323131] border border-[#A79755]/40",
                }}
                aria-label="Select blockchain network"
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
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center bg-[#1A1A1A] rounded-lg border border-[#A79755]/40 p-6 text-center shadow-md animate-pulse mt-6">
              <div className="w-10 h-10 border-2 border-[#A79755] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-[#EAE6DA] text-[14px] font-medium">
                Loading transaction history...
              </p>
              <p className="text-[#AFA892] text-[12px] mt-1">
                Please wait a moment
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col overflow-y-auto max-h-[20rem] custom-scrollbar">
                {sortedMonths.map((month) => (
                  <div key={month} className="mb-6">
                    {/* Month Header */}
                    <div className="sticky top-0 bg-black z-10 pb-2">
                      <h3 className="text-lg font-semibold text-[#F1F0EB] border-b border-[#323131] pb-2">
                        {month}
                      </h3>
                    </div>

                    {/* Transactions for this month */}
                    <div className="space-y-3 mt-3">
                      {groupedTransactions[month].map((transaction) => (
                        <div
                          key={transaction.hash}
                          className="bg-[#323131] rounded-lg px-4 py-3 hover:bg-[#404040] transition-colors cursor-pointer"
                          onClick={() => setSelectedTx(transaction)}
                        >
                          {/* Line 1: Type (Left) & Amount (Right) */}
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[#F1F0EB] font-medium">
                              {transaction.type}
                            </span>
                            <div className="text-right">
                              <span
                                className={`font-semibold ${
                                  transaction.type === "Sell" ||
                                  transaction.type === "Receive"
                                    ? "text-[#11FF49]"
                                    : "text-[#F1F0EB]"
                                }`}
                              >
                                {transaction.type === "Sell" ||
                                transaction.type === "Receive"
                                  ? "+"
                                  : "-"}
                                {formatAmount(
                                  transaction.total_amount?.toString() ?? "0",
                                  transaction.tokenData.find(
                                    (t) =>
                                      t.tokenType === "ERC20" && t.tokenSymbol
                                  )?.tokenSymbol ?? ""
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Line 2: Date & Time */}
                          <div className="flex justify-between text-sm text-[#AFAB99] ">
                            {formatDateTime(transaction.timestamp)}
                            {transaction.status !== 1 && (
                              <span
                                className={`text-sm mt-1 ${getStatusColor(
                                  mapToTransactionStatus(transaction.status)
                                )}`}
                              >
                                {mapToTransactionStatus(transaction.status)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Empty state if no transactions */}
                {transactions.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="mb-4">
                      <svg
                        width="64"
                        height="64"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="mx-auto text-[#AFAB99]"
                      >
                        <path
                          d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-[#F1F0EB] mb-2">
                      No Transactions
                    </h3>
                    <p className="text-[#AFAB99]">
                      Your transaction history will appear here
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          <button
            onClick={() => setActiveView("dashboard")}
            className="w-full bg-[#323131] hover:bg-[#11FF49] hover:text-black text-[#F1F0EB] py-3 rounded-md transition-colors mt-4"
          >
            Close
          </button>
        </>
      )}

      {/* Transaction Summary */}
      {selectedTx && (
        <TransactionSummary
          transaction={selectedTx}
          setSelectedTx={setSelectedTx}
        />
      )}
    </div>
  );
}
