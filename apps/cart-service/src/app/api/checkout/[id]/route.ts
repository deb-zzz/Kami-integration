import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializePrisma } from "@/utils/common";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const id = (await params).id;
    if (!id) return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });

    try {
        const checkout = await prisma.checkout.findUnique({
            where: { id },
            include: {
                user: { select: { walletAddress: true, userName: true } },
                checkoutCharges: true,
                orders: {
                    include: {
                        orderItems: {
                            include: { product: {
                                    include: {
                                        collection: true,
                                    }
                                }}
                        },
                        seller: { select: { walletAddress: true, userName: true } },
                    },
                },
            }
        });
        if (!checkout) return NextResponse.json({ error: 'Checkout not found' }, { status: 404 });
        return NextResponse.json(serializePrisma(checkout));

    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch order by ID: ' + (e as Error).message }, { status: 500 });
    }
}
