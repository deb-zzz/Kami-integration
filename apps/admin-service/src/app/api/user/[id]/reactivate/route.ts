import {NextRequest, NextResponse} from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/admins/:id/reactivate
 *
 * Reactivates an administrator account by setting its status to "active".
 * This endpoint only works for users that are not deleted and not already active.
 *
 * @returns {Promise<NextResponse>} A JSON response indicating success or failure.
 *
 * ###### Response Codes:
 * - `200` — Admin successfully reactivated or already active.
 * - `400` — Cannot reactivate a deleted admin.
 * - `404` — Admin not found.
 * - `500` — Unexpected server error.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    // Extract the admin ID from the pathname
    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean);

    // Expecting /api/user/[id]/reactivate
    const id = segments[2]; // 0=api,1=user,2=[id],3=reactivate => id at index 2
    if (!id) {
        return NextResponse.json({ error: "Missing admin ID in path" }, { status: 400 });
    }

    try {
        const admin = await prisma.administrator.findUnique({ where: { id } });
        if (!admin) return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
        else if (admin.deletedAt) {
            return NextResponse.json({ error: 'Unable to reactivate status for deleted admin user.'}, { status: 400 });
        }

        if (admin.status === "active") return NextResponse.json({ message: "Status already active." });

        await prisma.administrator.update({
            where: { id },
            data: {
                status: "active",
                lockedAt: null,
                updatedAt: Math.floor(Date.now() / 1000),
            },
        });

        return NextResponse.json({ message: "Admin user successfully reactivated." });

    } catch (err) {
        return NextResponse.json({ error: 'Failed to reactivate admin status: ' + (err as Error).message }, { status: 500 });
    }
}