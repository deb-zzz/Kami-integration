import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/user/:id/block
 *
 * Blocks an administrator account by setting its status to "blocked".
 * Only works for non-deleted admins that are not already blocked.
 *
 * @returns {Promise<NextResponse>} JSON response indicating success or failure.
 *
 * ###### Response Codes:
 * - `200` — Admin successfully blocked or already blocked.
 * - `400` — Cannot block a deleted admin user.
 * - `404` — Admin not found.
 * - `500` — Unexpected server error.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    // Extract the admin ID from the pathname
    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean);

    // Expecting /api/user/[id]/block
    const id = segments[2]; // 0=api,1=user,2=[id],3=block => id at index 2
    if (!id) {
        return NextResponse.json({ error: "Missing admin ID in path" }, { status: 400 });
    }
    try {
        const admin = await prisma.administrator.findUnique({ where: { id } });
        if (!admin) return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
        else if (admin.deletedAt) {
            return NextResponse.json({ error: 'Unable to block deleted admin user.'}, { status: 400 });
        }

        if (admin.status === "blocked") return NextResponse.json({ message: "Admin user already blocked." });

        await prisma.administrator.update({
            where: { id },
            data: {
                status: "blocked",
                updatedAt: Math.floor(Date.now() / 1000),
            },
        });

        return NextResponse.json({ message: "Admin user successfully blocked." });

    } catch (err) {
        return NextResponse.json({ error: 'Failed to block admin: ' + (err as Error).message }, { status: 500 });
    }
}