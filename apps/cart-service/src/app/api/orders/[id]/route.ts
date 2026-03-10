import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializePrisma } from "@/utils/common";

/**
 * GET /api/orders/[id]
 *
 * Get specific order by ID
 * */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const id = (await params).id;
    if (!id) return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });

    try {
        const order = await prisma.order.findUnique({
            where: { id },
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
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        return NextResponse.json(serializePrisma(order));

    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch order by ID: ' + (e as Error).message }, { status: 500 });
    }
}
