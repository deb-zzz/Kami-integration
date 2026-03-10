import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializePrisma } from "@/util/serialize";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url)
        const tz = searchParams.get('tz') || 'UTC';

        const [totalUserCount, todayNewUserCountRaw, totalTxnCount, txnCountLast24h, totalPublishedProductCount, recentTxnRaw] = await Promise.all([
            prisma.user.count(),
            prisma.$queryRaw<{ count: number }[]>`
                SELECT COUNT(*) AS count
                FROM "user"
                WHERE DATE(timezone(${tz}, to_timestamp("createdAt"))) = DATE(timezone(${tz}, now()))
            `,
            prisma.transaction.count(),
            prisma.$queryRaw<{ count: number }[]>`
                SELECT COUNT(*) AS count
                FROM "transaction"
                WHERE "timestamp" >= EXTRACT(EPOCH FROM timezone(${tz}, now()) - INTERVAL '24 hours') * 1000
            `,
            prisma.product.count(),
            prisma.transaction.findMany({
                orderBy: { timestamp: 'desc' },
                take: 5,
                include: {
                    blockchain: { select: { name: true } }
                }
            }),
        ]);

        const todayNewUserCount = Number(todayNewUserCountRaw[0]?.count) ?? 0;
        const last24hTxnCount = Number(txnCountLast24h[0]?.count) ?? 0;

        const recentTxn = recentTxnRaw.map(txn => {
            const { blockchain, ...rest } = txn;
            return {
                ...rest,
                chainName: blockchain?.name || null
            };
        });

        const response = serializePrisma({
            tz,
            stats: {
                totalUserCount,
                todayNewUserCount,
                totalTxnCount,
                last24hTxnCount,
                totalPublishedProductCount,
            },
            recentTxn,
        })
        return NextResponse.json(response)

    } catch (err) {
        console.error(`Failed to fetch dashboard metric:`, err);
        return NextResponse.json({ error: "Failed to fetch dashboard metric: " + (err as Error).message }, { status: 500 });
    }
}