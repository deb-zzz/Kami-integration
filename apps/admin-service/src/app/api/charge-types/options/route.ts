import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
    try {
        const chargeTypeOptions = await prisma.chargeType.findMany({
            where: {
                deletedAt: null
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: {
                name: "asc",
            },
        });
        return NextResponse.json(chargeTypeOptions)

    } catch {
        return NextResponse.json({ error: "Failed to fetch charge type options" }, { status: 500 });
    }
}