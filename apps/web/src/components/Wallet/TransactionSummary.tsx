"use client";
import { useEffect, useState } from "react";
import { getTransactionSummary } from "@/apihandler/Wallet";
import { truncateTextCenter } from "@/lib/Util";
import { Tooltip } from "@nextui-org/react";
import Image from "next/image";
import '@/styles/scrollbar.css';
import { CryptoTransaction } from "@/types";

interface TransactionSummaryProps {
  transaction: CryptoTransaction;
  setSelectedTx: (e: any) => void;
}

interface SummaryResponse {
  transaction: CryptoTransaction;
  checkout: any | null;
}

export default function TransactionSummary({
  transaction,
  setSelectedTx,
}: TransactionSummaryProps) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<{
    [key: string]: boolean;
  }>({});

  // toggle collapse state for a given order
  const toggleOrder = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const copyData = (data: string = "", key: string) => {
    navigator.clipboard.writeText(data);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1700);
  };

  useEffect(() => {
    // Skip fetch for Received or Sent transactions
    if (transaction.type === "Receive" || transaction.type === "Sent") {
      setSummary({ transaction: transaction, checkout: null });
      return;
    }

    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await getTransactionSummary(
          transaction.chainId,
          transaction.hash
        );
        if (res.success) setSummary(res.data);
      } catch (err) {
        console.error("Failed to load transaction summary", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [transaction.chainId, transaction.hash, transaction.type]);

  function formatDate(timestamp: string | number) {
    const num = Number(timestamp);
    if (!num || isNaN(num)) return "-";
    const date = new Date(num < 1e12 ? num * 1000 : num);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  function groupItemsByCollection(orderItems: any[]) {
    return orderItems.reduce((groups, item) => {
      const col = item.product.collection;
      const key = col?.collectionId || "unknown";
      if (!groups[key]) {
        groups[key] = {
          collectionId: col?.collectionId,
          collectionName: col?.name || "Unknown Collection",
          collectionAvatar: col?.avatarUrl || null,
          items: [],
        };
      }
      groups[key].items.push(item);
      return groups;
    }, {});
  }

  function Row({
    label,
    value,
    fullValue,
    copyable = false,
    copyKey,
  }: {
    label: string;
    value: string;
    fullValue?: string;
    copyable?: boolean;
    copyKey?: string;
  }) {
    return (
      <div className="flex justify-between text-[#EAE6DA] text-[13px] border-b border-[#454343] last:border-0 py-1 items-center">
        <span className="text-[#AFA892]">{label}:</span>
        <div className="flex items-center gap-1 max-w-[160px] text-right truncate">
          <span className="font-medium truncate">{value}</span>
          {copyable && fullValue && (
            <Tooltip
              content="Copied"
              isOpen={copiedKey === copyKey}
              size="sm"
              className="bg-[#323131] text-[#F1F0EB]"
            >
              <Image
                src={"/copy.svg"}
                alt="copy"
                width={13}
                height={13}
                className="cursor-pointer opacity-80 hover:opacity-100"
                onClick={() => copyData(fullValue, copyKey || fullValue)}
              />
            </Tooltip>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="relative text-l text-[#A79755] font-semibold mt-4 mb-4 flex items-center gap-2">
        <button
          onClick={() => setSelectedTx(null)}
          className="left-0 text-[#F1F0EB] hover:text-[#11FF49] transition-colors"
        >
          <svg
            width="20"
            height="20"
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
        Transaction ID: {truncateTextCenter(transaction.hash || "", 30)}
        <Tooltip
          content="Copied"
          isOpen={copiedKey === "tx-hash"}
          size="sm"
          className="bg-[#323131] text-[#F1F0EB] "
        >
          <Image
            src={"/copy.svg"}
            alt={"cup"}
            width={14}
            height={14}
            className="cursor-pointer mt-1"
            onClick={() => copyData(transaction.hash, "tx-hash")}
          />
        </Tooltip>
      </h2>

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center bg-[#1A1A1A] rounded-lg border border-[#A79755]/40 p-6 text-center shadow-md animate-pulse mt-6">
          <div className="w-10 h-10 border-2 border-[#A79755] border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-[#EAE6DA] text-[14px] font-medium">
            Loading transaction summary...
          </p>
          <p className="text-[#AFA892] text-[12px] mt-1">
            Please wait a moment
          </p>
        </div>
      ) : !summary ? (
        // No summary found
        <div className="flex flex-col items-center justify-center bg-[#2A2A2A] rounded-lg border border-[#AFAB99]/30 p-6 text-center shadow-sm mt-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-10 h-10 text-[#A79755] mb-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-[#EAE6DA] text-[14px] font-medium">
            Details not available
          </p>
          <p className="text-[#AFA892] text-[12px] mt-1 max-w-[240px]">
            This transaction might not contain any related transaction data.
          </p>
        </div>
      ) : (
        <div className="custom-scrollbar max-h-[450px] overflow-y-auto text-[#EAE6DA] rounded-lg shadow-md">
          <div className="space-y-4">
            {summary?.checkout?.orders?.length ? (
              <>
                {/* Order Summary */}
                <div className="bg-[#2A2A2A] rounded-[8px] overflow-hidden border border-[#AFAB99]">
                  <div className="bg-[#1A1A1A] px-3 py-2 font-semibold text-[14px] text-[#A79755]">
                    Order Summary
                  </div>
                  <div className="p-3 text-[13px] space-y-1 bg-[#323131]">
                    <Row
                      label="Subtotal"
                      value={`${summary.checkout.subtotal ?? "-"} ${
                        summary.checkout.orders[0]?.currency ?? ""
                      }`}
                    />
                    <Row
                      label="Total Charges"
                      value={`${summary.checkout.totalCharges ?? "-"} ${
                        summary.checkout.orders[0]?.currency ?? ""
                      }`}
                    />
                    <Row
                      label="Total Amount"
                      value={`${summary.checkout.totalAmount ?? "-"} ${
                        summary.checkout.orders[0]?.currency ?? ""
                      }`}
                    />
                  </div>
                </div>

                {/* Orders list */}
                {summary.checkout.orders.map((order: any) => {
                  const isExpanded = expandedOrders[order.id] ?? false;
                  return (
                    <div
                      key={order.id}
                      className="bg-[#2A2A2A] rounded-[8px] overflow-hidden border border-[#AFAB99]"
                    >
                      {/* Header */}
                      <div className="bg-[#1A1A1A] px-3 py-2 font-semibold text-[14px] text-[#A79755] flex justify-between">
                        <span>Order ID:</span>
                        <span className="max-w-[70%] break-all">
                          {order.id}
                        </span>
                      </div>

                      {/* Order info */}
                      <div className="p-3 space-y-1 text-[13px] bg-[#323131]">
                        <Row label="Receiver" value={order.seller.userName} />
                        <Row
                          label="Receiver Wallet"
                          value={truncateTextCenter(
                            order.toWalletAddress || "",
                            30
                          )}
                          fullValue={order.toWalletAddress}
                          copyable
                          copyKey={`receiver-wallet-${order.id}`}
                        />
                        <Row label="Payment Token" value={order.currency} />
                        <Row
                          label="Total Amount"
                          value={`${order.amount} ${order.currency}`}
                        />
                        <Row label="Status" value={order.status} />
                        <Row
                          label="Created"
                          value={formatDate(order.createdAt)}
                        />
                        <Row
                          label="Updated"
                          value={formatDate(order.updatedAt)}
                        />
                      </div>

                      {/* Collapse header */}
                      <button
                        onClick={() => toggleOrder(order.id)}
                        className="w-full bg-[#1A1A1A] text-[#A79755] px-3 py-2 font-semibold text-[14px] flex justify-between items-center hover:bg-[#252525] transition"
                      >
                        <span>Order Items</span>
                        <span
                          className={`text-[#EAE6DA] text-sm transform transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        >
                          <Image
                            alt="chevron"
                            width={16}
                            height={16}
                            src={"/walletNav/chevron.svg"}
                          />
                        </span>
                      </button>

                      {/* Items section */}
                      {isExpanded && (
                        <div>
                          {Object.values(
                            groupItemsByCollection(order.orderItems)
                          ).map((collection: any) => (
                            <div
                              key={collection.collectionId}
                              className="border-t border-[#444] bg-[#2A2A2A]"
                            >
                              {/* Collection header */}
                              <div className="flex justify-between items-center p-3 text-[#F1F0EB] font-bold text-[13px]">
                                <span>Collection Name:</span>
                                <span>{collection.collectionName}</span>
                              </div>

                              {/* Items in collection */}
                              {collection.items.map((item: any) => (
                                <div
                                  key={item.id}
                                  className="p-3 border-b border-[#FFFFFF33] text-[13px]"
                                >
                                  <div className="flex justify-between mb-2">
                                    <span className="text-[12px] bg-[#514F3E] px-2 py-[1px] rounded text-[#EAE6DA] font-semibold uppercase tracking-wide">
                                      {item.checkoutAction === "Rent"
                                        ? "Rent"
                                        : "Purchase"}
                                    </span>
                                  </div>
                                  <Row
                                    label="Product Name"
                                    value={item.product.name}
                                  />
                                  <Row
                                    label="Product ID"
                                    value={`#${item.productId}`}
                                  />
                                  <Row
                                    label="Unit Price"
                                    value={`${item.unitPrice} ${order.currency}`}
                                  />
                                  <Row label="Quantity" value={item.quantity} />
                                  <Row
                                    label="Subtotal"
                                    value={`${item.subtotal} ${order.currency}`}
                                  />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                {/* No checkout order — show blockchain transaction details */}
                <div className="bg-[#2A2A2A] rounded-[8px] overflow-hidden border border-[#AFAB99]">
                  <div className="bg-[#1A1A1A] px-3 py-2 font-semibold text-[14px] text-[#A79755]">
                    Transaction Details
                  </div>
                  <div className="p-3 text-[13px] space-y-1 bg-[#323131]">
                    <Row
                      label="From"
                      value={truncateTextCenter(summary.transaction.from, 30)}
                      fullValue={summary.transaction.from}
                      copyable
                      copyKey="from-address"
                    />
                    <Row
                      label="To"
                      value={truncateTextCenter(summary.transaction.to, 30)}
                      fullValue={summary.transaction.to}
                      copyable
                      copyKey="to-address"
                    />
                    <Row
                      label="Token"
                      value={
                        summary.transaction.tokenData?.[0]?.tokenSymbol || "-"
                      }
                    />
                    <Row
                      label="Amount"
                      value={
                        summary.transaction.tokenData?.[0]
                          ?.tokenAmountFormatted || "0"
                      }
                    />
                    <Row
                      label="Gas Used"
                      value={summary.transaction.gasUsed?.toString() || "-"}
                    />
                    <Row
                      label="Block Number"
                      value={summary.transaction.blockNumber?.toString() || "-"}
                    />
                    <Row
                      label="Status"
                      value={
                        summary.transaction.status === 1 ? "Success" : "Failed"
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
