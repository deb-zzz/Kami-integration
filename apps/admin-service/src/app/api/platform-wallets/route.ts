import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { classifyBalanceError, safeFetch, walletSchema } from "./utils";
import { Prisma, WalletType, platformWallet } from "@prisma/client";
import { isoToUnixSeconds } from "@/util/DateTimeConvertor";
import { ChainAndWalletInfo, MultiWalletsBalanceResponse } from "@/types/wallet";

/**
 * Platform Wallet Management API
 *
 * This API provides endpoints for creating and retrieving platform wallet records used
 * as paymasters or sponsor wallets within the system. These wallets receive payments
 * and handle gas sponsorships across different blockchain networks.
 *
 * Endpoints:
 * - POST /api/platform-wallets → Create a new platform wallet record
 * - GET  /api/platform-wallets → List all wallets
 *
 * Each wallet record includes metadata such as wallet type (Platform or Sponsor),
 * chain ID, status, and audit information.
 */

/**
 * POST /api/platform-wallets
 * Create a new platform wallet record
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = walletSchema.parse(body);

    const wallet = await prisma.platformWallet.create({
      data: {
        ...data,
        createdAt: Math.floor(Date.now() / 1000),
      },
    });
    return NextResponse.json({ wallet });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to create wallet record: " + (e as Error).message },
      { status: 500 }
    );
  }
}


type WalletWithBalance = platformWallet & {
  ethBalance: string | null;
  usdcBalance: string | null;
  ethBalanceFormatted: string | null;
  usdcBalanceFormatted: string | null;
  balanceError?: string | null;
  balanceErrorMessage?: string | null;
}

/**
 * GET /api/platform-wallets
 * List all wallets
 *
 * Optional filters:
 * - chainId
 * - isActive (true / false)
 * - walletType ("Platform" / "Sponsor")
 *
 * Examples:
 *   /api/platform-wallets?chainId=8453
 *   /api/platform-wallets?isActive=true
 *   /api/platform-wallets?walletType=Sponsor
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('perPage') || '10', 10);
    const skip = (page - 1) * perPage;

    // Sorting (format: sort=field,order)
    const sortParam = searchParams.get('sort') || 'createdAt,desc';
    const [sortBy, orderRaw] = sortParam.split(',');
    const order = (orderRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

    // Filtering by columns
    const name = searchParams.get("name") || undefined;
    const chainId = searchParams.get("chainId") || undefined;
    const walletTypeParam = searchParams.get("walletType");
    const createdAtFrom = searchParams.get('createdAtFrom') || undefined;
    const createdAtTo = searchParams.get('createdAtTo') || undefined;
    const updatedAtFrom = searchParams.get('updatedAtFrom') || undefined;
    const updatedAtTo = searchParams.get('updatedAtTo') || undefined;
    const isActive = searchParams
        .get('isActive') === 'true' ? true : searchParams.get('isActive') === 'false' ? false : undefined;

    const where: Prisma.platformWalletWhereInput = {};
    if (name)    where.name = { contains: name, mode: 'insensitive' };
    if (chainId) where.chainId = chainId;

    let walletType: WalletType | undefined = undefined;
    if (walletTypeParam) {
      if (!(walletTypeParam in WalletType)) {
        return NextResponse.json(
            { error: `Invalid location. Allowed values: ${Object.values(WalletType).join(", ")}`},
            { status: 400 }
        );
      }
      walletType = walletTypeParam as WalletType;
    }
    if (walletType) where.walletType = walletType;
    if (isActive !== undefined) where.isActive = isActive;

    if (createdAtFrom || createdAtTo) {
      where.createdAt = {};
      if (createdAtFrom) where.createdAt.gte = isoToUnixSeconds(createdAtFrom);
      if (createdAtTo) where.createdAt.lte = isoToUnixSeconds(createdAtTo);
    }
    if (updatedAtFrom || updatedAtTo) {
      where.updatedAt = {};
      if (updatedAtFrom) where.updatedAt.gte = isoToUnixSeconds(updatedAtFrom);
      if (updatedAtTo) where.updatedAt.lte = isoToUnixSeconds(updatedAtTo);
    }

    if (walletTypeParam && !Object.values(WalletType).includes(walletTypeParam as WalletType)) {
      return NextResponse.json(
        { error: `Invalid walletType. Must be one of: ${Object.values(WalletType).join(", ")}` },
        { status: 400 }
      );
    }

    const wallets = await prisma.platformWallet.findMany({
      skip,
      take: perPage,
      where,
      orderBy: {
        [sortBy]: order,
      },
    });

    // Extract required fields to fetch balances outbound API call
    const walletRequestList = wallets.map((w) => ({
      chainId: w.chainId,
      walletAddress: w.walletAddress,
    }));

    const outboundUrl = `${process.env.WALLET_SERVICE_URL as string}/balances`
    const response = await safeFetch<MultiWalletsBalanceResponse>(outboundUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(walletRequestList),
    });

    const balanceData: ChainAndWalletInfo[] = response.data;
    const walletsWithBalance = mapWalletsWithBalances(wallets, balanceData);

    // Optional: total count for frontend pagination
    const total = await prisma.platformWallet.count({ where });

    return NextResponse.json({
      data: walletsWithBalance,
      meta: {
        pagination: {
          page, perPage, total,
          totalPages: Math.ceil(total / perPage),
        },
        filters: {
          name, chainId, walletType,
          createdAtFrom, createdAtTo,
          updatedAtFrom, updatedAtTo,
          isActive,
        },
        sort: {
          by: sortBy,
          order,
        },
      },
    });

  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch platform wallets: " + (e as Error).message }, { status: 500 });
  }
}

/**
 * Safely maps platform wallets with their corresponding balances
 */
function mapWalletsWithBalances(
    wallets: platformWallet[],
    balanceData: ChainAndWalletInfo[]
): WalletWithBalance[] {

  return wallets.map((wallet) => {
    const matched = balanceData.find((b) =>
            b.chainId?.toLowerCase() === wallet.chainId?.toLowerCase() &&
            b.walletAddress?.toLowerCase() === wallet.walletAddress?.toLowerCase()
    );

    // Type guard for objects that may include a `message` field
    const hasMessage = (obj: unknown): obj is { message: string } =>
        typeof obj === 'object' &&
        obj !== null &&
        'message' in obj &&
        typeof (obj as Record<string, unknown>).message === 'string';

    if (!matched || !matched.balances) {
      const message = hasMessage(matched) ? matched.message : "Unknown error";
      const balanceError = classifyBalanceError(message);

      return {
        ...wallet,
        ethBalance: null,
        usdcBalance: null,
        ethBalanceFormatted: null,
        usdcBalanceFormatted: null,
        balanceError,
        balanceErrorMessage: message,
      };
    }

    const { ethBalance, usdcBalance, ethBalanceFormatted, usdcBalanceFormatted } = matched.balances;

    return {
      ...wallet,
      ethBalance,
      usdcBalance,
      ethBalanceFormatted,
      usdcBalanceFormatted,
      balanceError: null,
      balanceErrorMessage: null,
    };
  });
}