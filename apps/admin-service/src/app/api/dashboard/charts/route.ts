import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aggregateByTimeUnitWithLegend, getDateRange } from "@/app/api/dashboard/utils";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const range = (searchParams.get('range') || 'today') as 'today' | 'week' | 'month' | 'year' | 'custom';
        const tz = searchParams.get('tz') || 'UTC';
        const customFrom = searchParams.get('dateFrom') || undefined;
        const customTo = searchParams.get('dateTo') || undefined;

        const { fromUnix, toUnix, tzOffset } = getDateRange(range, tz, customFrom, customTo);

        // Fetch transactions and users in parallel
        const [txnRaw, userRaw] = await Promise.all([
            prisma.transaction.findMany({
                where: { timestamp: { gte: fromUnix, lte: toUnix } },
                select: { timestamp: true, status: true, type: true }
            }),
            prisma.user.findMany({
                where: { createdAt: { gte: Math.floor(fromUnix / 1000), lte: Math.floor(toUnix / 1000) } },
                select: { createdAt: true }
            })
        ]);

        // Prepare txnChartByStatus
        const txnChartByStatus = aggregateByTimeUnitWithLegend(
            txnRaw.map(tx => ({
                timestamp: Number(tx.timestamp),
                legend: tx.status === 1 ? "success" : tx.status === 0 ? "failed" : "other"
            })),
            range,
            tzOffset
        );

        // Prepare txnChartByType
        const txnChartByType = aggregateByTimeUnitWithLegend(
            txnRaw.map(tx => ({
                timestamp: Number(tx.timestamp),
                legend: tx.type || "unknown"
            })),
            range,
            tzOffset
        );

        // Prepare newUserChart
        const newUserChart = aggregateByTimeUnitWithLegend(
            userRaw.map(u => ({
                timestamp: u.createdAt * 1000, // seconds -> ms
                legend: "New Users"
            })),
            range,
            tzOffset
        );

        return NextResponse.json({
            range,
            tz,
            chartData: {
                txnChartByStatus,
                txnChartByType,
                newUserChart
            }
        });

    } catch (err) {
        console.error("Failed to fetch dashboard chart:", err);
        return NextResponse.json(
            { error: "Failed to fetch dashboard chart: " + (err as Error).message },
            { status: 500 }
        );
    }
}
