import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Handles GET requests for retrieving available role options.
 *
 * @returns A `NextResponse` containing the list of roles or an error message.
 *
 * @remarks
 * Fetches all roles that are not soft-deleted (`deletedAt: null`),
 * selecting only their `id` and `name`, ordered alphabetically.
 */
export async function GET(): Promise<NextResponse> {
    try {
        const roleOptions = await prisma.role.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                name: true,
            },
            orderBy: { name: "asc" },
        });
        return NextResponse.json(roleOptions);

    } catch {
        return NextResponse.json({ error: "Failed to fetch role options" }, { status: 500 });
    }
}