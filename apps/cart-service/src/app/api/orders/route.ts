import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { serializePrisma } from "@/utils/common";

/**
 * GET /api/orders?buyerWalletAddress=<buyer_wallet_address>
 *
 * GET /api/orders?sellerWalletAddress=<seller_wallet_address>
 *
 * Get all orders under given wallet address either from buyer/seller perspectives.
 * */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const buyerWalletAddress = searchParams.get("buyerWalletAddress") ?? undefined;
    const sellerWalletAddress = searchParams.get("sellerWalletAddress") ?? undefined;
    if (!buyerWalletAddress && !sellerWalletAddress) {
        return NextResponse.json(
            { error: "Either buyerWalletAddress or sellerWalletAddress param is required" }, { status: 400 }
        );
    }

    try {
        const where: Prisma.orderWhereInput = {};
        if (buyerWalletAddress) {
            where.fromWalletAddress = buyerWalletAddress;
        } else if (sellerWalletAddress) {
            where.toWalletAddress = sellerWalletAddress;
        }

        const orders = await prisma.order.findMany({
            where,
            orderBy: {
                createdAt: "desc",
            },
            include: {
                orderItems: {
                    include: { product: {
                        include: {
                            collection: true,
                        }
                    }}
                },
                buyer: { select: { walletAddress: true, userName: true } },
                seller: { select: { walletAddress: true, userName: true } },
            },
        });

        return NextResponse.json(serializePrisma(orders));

    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch orders: ' + (e as Error).message }, { status: 500 });
    }
}
