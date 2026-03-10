import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { classifyBalanceError, safeFetch, walletSchema } from "../../utils";
import { WalletBalance, WalletBalanceResponse } from "@/types/wallet";

/**
 * Platform Wallet Management API
 *
 * This API provides endpoints for retrieving, updating, and deactivating
 * individual platform wallet records identified by their blockchain chain ID
 * and wallet address.
 *
 * Endpoints:
 * - GET    /admin-service/platform-wallets/{chainId}/{address}   → Get wallet details
 * - PUT    /admin-service/platform-wallets/{chainId}/{address}   → Update wallet record
 * - DELETE /admin-service/platform-wallets/{chainId}/{address}   → Deactivate (soft delete) wallet
 *
 * These operations are used by administrators to manage wallets that act as
 * platform or sponsor wallets within the system. Deactivation marks a wallet
 * as inactive rather than permanently removing it.
 *
 * Each wallet record includes:
 * - Basic metadata (name, type, chain ID)
 * - Status flags (isActive)
 * - Audit fields (createdBy, updatedBy, timestamps)
 */

/**
 * GET /api/platform-wallets/{chainId}/{walletAddress}
 * Retrieve a specific wallet by chain ID and address
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chainId: string; walletAddress: string }> }
) {
  try {
    const { chainId, walletAddress } = await params;

    if (!chainId || !walletAddress)
      return NextResponse.json(
        { error: "chainId and walletAddress are required" },
        { status: 400 }
      );

    const wallet = await prisma.platformWallet.findUnique({
      where: {
        walletAddress_chainId: { walletAddress, chainId },
      },
    });

    if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

    const outboundUrl = `${process.env.WALLET_SERVICE_URL as string}/balances/${chainId}?address=${walletAddress}`
    let balanceData: WalletBalance | null = null;
    let balanceError: string | null = null;
    let balanceErrorMessage: string | null = null;

    try {
      const response = await safeFetch<WalletBalanceResponse>(outboundUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      balanceData = response.data;

    } catch (e) {
      const msg = (e as Error)?.message ?? "Unknown error";
      balanceError = classifyBalanceError(msg);
      balanceErrorMessage = msg;
    }

    return NextResponse.json({
      ...wallet,
      ethBalance: balanceData?.ethBalance ?? null,
      usdcBalance: balanceData?.usdcBalance ?? null,
      ethBalanceFormatted: balanceData?.ethBalanceFormatted ?? null,
      usdcBalanceFormatted: balanceData?.usdcBalanceFormatted ?? null,
      balanceError,
      balanceErrorMessage,
    });

  } catch (e) {
    return NextResponse.json({ error: "Failed to get wallet: " + (e as Error).message }, { status: 500 });
  }
}

/**
 * PUT /api/platform-wallets/{chainId}/{walletAddress}
 * Update wallet details (partial update allowed)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ chainId: string; walletAddress: string }> }
) {
  try {
    const { chainId, walletAddress } = await params;
    if (!chainId || !walletAddress)
      return NextResponse.json(
        { error: "chainId and walletAddress are required" },
        { status: 400 }
      );

    const body = await req.json();

    // Partial validation for update — allow missing fields
    const partialSchema = walletSchema.partial();
    const data = partialSchema.parse(body);

    // Check if wallet exists
    const existingWallet = await prisma.platformWallet.findUnique({
      where: {
        walletAddress_chainId: { walletAddress, chainId },
      },
    });

    if (!existingWallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 400 });
    }

    // Perform update
    const updatedWallet = await prisma.platformWallet.update({
      where: {
        walletAddress_chainId: { walletAddress, chainId },
      },
      data: {
        ...data,
        updatedAt: Math.floor(Date.now() / 1000),
      },
    });

    return NextResponse.json(updatedWallet);
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to update wallet record: " + (e as Error).message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/platform-wallets/{chainId}/{walletAddress}
 * Soft deletes (deactivates) a wallet instead of permanent deletion
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chainId: string; walletAddress: string }> }
) {
  try {
    const { chainId, walletAddress } = await params;
    if (!chainId || !walletAddress)
      return NextResponse.json(
        { error: "chainId and walletAddress are required" },
        { status: 400 }
      );

    // Check if wallet exists
    const existingWallet = await prisma.platformWallet.findUnique({
      where: {
        walletAddress_chainId: { walletAddress, chainId },
      },
    });

    if (!existingWallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 400 });
    }

    const wallet = await prisma.platformWallet.update({
      where: {
        walletAddress_chainId: { walletAddress, chainId },
      },
      data: {
        isActive: false,
        updatedAt: Math.floor(Date.now() / 1000),
      },
    });

    return NextResponse.json({ message: "Wallet deactivated", wallet });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to deactivate wallet: " + (e as Error).message },
      { status: 500 }
    );
  }
}
