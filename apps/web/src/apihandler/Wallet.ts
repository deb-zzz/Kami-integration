"use server";

import {
  BlockchainResponse,
  BlockchainsResponse,
  EstimateGasResponse,
  Profile,
  Recipient,
  TransferResponse,
  WalletBalanceResponse,
  WalletTransactionResponse,
} from "@/types";
import { axiosInstance } from "./AxiosInstance";
import { AxiosError } from "axios";
import { getProfile } from "./Profile";

export const getWalletBalance = async (address: string, chainId: string) => {
  const res = await axiosInstance.get(
    `/wallet-service/balances/${chainId}?address=${address}`,
    { headers: { Authorization: `Bearer ${String(process.env.AUTH)}` } }
  );

  return <WalletBalanceResponse>res.data;
};

export const getBlockchain = async (chainId: string) => {
  const res = await axiosInstance.get(`/wallet-service/blockchain/${chainId}`, {
    headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
  });

  return <BlockchainResponse>res.data;
};
export const getBlockchains = async () => {
  const res = await axiosInstance.get(`/wallet-service/blockchain`, {
    headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
  });

  return <BlockchainsResponse>res.data;
};

export const getTransactions = async (address: string, chainId: string) => {
  try {
    const res = await axiosInstance.get(
      `/wallet-service/transactions/${chainId}/?walletAddress=${address}&filtered=true`,
      { headers: { Authorization: `Bearer ${String(process.env.AUTH)}` } }
    );
    
    return <WalletTransactionResponse>res.data;
  } catch (e) {
    return <{ success: false; status: number }>{
      success: false,
      status: (e as AxiosError).status,
    };
  }
};
export const getRecentTransferRecipients = async (
  address: string,
  chainId: string
): Promise<string[]> => {
  try {
    const res = await axiosInstance.get(
      `/wallet-service/transactions/${chainId}/?walletAddress=${address}&filtered=true&type=Transfer`,
      { headers: { Authorization: `Bearer ${String(process.env.AUTH)}` } }
    );

    const data = res.data as WalletTransactionResponse;

    // Early return if no data
    if (!data.success || !data.data?.length) {
      return [];
    }

    // Extract unique recipient addresses using Set for O(1) deduplication
    const uniqueRecipients = Array.from(
      new Set(
        data.data
          .filter((tx) => tx.from === address)
          .map((tx) => tx.to)
      )
    ).slice(0, 5);
    
    return uniqueRecipients;
  } catch (e) {
    const axiosError = e as AxiosError;
    console.error("Failed to fetch recent transfer recipients:", axiosError.message);
    return [];
  }
};

export const getTransactionSummary = async (address: string, hash: string) => {
  try {
    const res = await axiosInstance.get(
      `/wallet-service/transactions/${address}/transaction/${hash}/summary`,
      {
        headers: { Authorization: `Bearer ${String(process.env.AUTH)}` },
      }
    );
    return <{ success: boolean; data: any }>res.data;
  } catch (e) {
    return <{ success: false; status: number }>{
      success: false,
      status: (e as AxiosError).status,
    };
  }
};

export const getEstimateGas = async (
  fromAddress: string,
  toAddress: string,
  chainId: string,
  amount: string
) => {
  try {
    const bodyReq = {
      fromAddress,
      toAddress,
      amount,
    };

    const res = await axiosInstance.post(
      `wallet-service/transfer/${chainId}/estimate-gas`,
      bodyReq,
      {
        headers: {
          Authorization: `Bearer ${String(process.env.AUTH)}`,
          "Content-Type": "application/json",
        },
      }
    );
    return <EstimateGasResponse>res.data;
  } catch (e) {
    const axiosError = e as AxiosError;
    // Return the error response from the API if available
    if (axiosError.response?.data) {
      return axiosError.response.data as EstimateGasResponse;
    }
    // Fallback error structure if no response data
    return {
      success: false,
      error: "NETWORK_ERROR",
      message: axiosError.message || "Failed to estimate gas",
    } as any;
  }
};

export const postCryptoTransfer = async (
  fromAddress: string,
  toAddress: string,
  chainId: string,
  currency: string,
  amount: string
) => {
  try {
    const bodyReq = {
      fromAddress,
      toAddress,
      amount,
    };

    const res = await axiosInstance.post(
      `wallet-service/transfer/${chainId}/${currency.toLowerCase()}`,
      bodyReq,
      {
        headers: {
          Authorization: `Bearer ${String(process.env.AUTH)}`,
          "Content-Type": "application/json",
        },
      }
    );
    return <TransferResponse>res.data;
  } catch (e) {
    const axiosError = e as AxiosError;
    if (axiosError.response?.data) {
      return axiosError.response.data as EstimateGasResponse;
    }
    return {
      success: false,
      code: axiosError.code,
      message: axiosError.message,
    } as any;
  }
};
