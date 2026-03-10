import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/user/[id]
 *
 * Fetches a admin user by its ID, including the role assigned.
 *
 * Behavior:
 * - If the admin exists, returns the admin's details along with the role.
 * - If the admin does not exist, returns 404.
 * - On any server error, returns 500 with an error message.
 *
 * ###### Response JSON structure:
 * ```ts
 * {
 *   id: string,
 *   email: string,
 *   name: string,
 *   roleId: string,
 *   roleName: boolean,
 *   status: string,
 *   createdAt: number,
 *   updatedAt: number,
 *   lastLoginAt: number | null,
 *   lockedAt: number | null,
 *   deletedAt: number | null,
 *   failedLoginAttempts: number
 * }
 * ```
 *
 * @param request - The incoming HTTP request.
 * @param params - Route parameters containing the admin ID.
 * @returns JSON response with admin details or error message.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const id = (await params).id; // always defined when this route matches
    try {
        const admin = await prisma.administrator.findUnique({
            where: { id },
            include: {
                role: { select: { name: true } },
            },
        });
        if (!admin) return NextResponse.json({ error: 'Admin user not found.' }, { status: 404 });

        return NextResponse.json({
            id: admin.id,
            email: admin.email,
            name: admin.name ?? undefined,
            roleId: admin.roleId,
            roleName: admin.role.name,
            status: admin.status,
            createdAt: admin.createdAt,
            updatedAt: admin.updatedAt,
            lastLoginAt: admin.lastLoginAt,
            deletedAt: admin.deletedAt,
            lockedAt: admin.lockedAt,
            failedLoginAttempts: admin.failedLoginAttempts,
        });
    } catch (err) {
        console.error('Error fetching admin by ID:', err);
        return NextResponse.json({ error: 'Failed to fetch admin by ID: ' + (err as Error).message }, { status: 500 });
    }
}

/**
 * DELETE /api/users/[id]
 *
 * Deletes an admin by its ID. Supports both soft deletion and force deletion.
 *
 * Query Parameters:
 * - `force` (optional: boolean)
 *    - `false` (default): Performs a soft delete by setting `deletedAt` and `updatedAt`.
 *    - `true`: Performs a permanent delete.
 *
 * Responses:
 * - `200` — Admin soft-deleted or permanently deleted.
 * - `404` — Admin not found.
 * - `500` — Unexpected server error.
 *
 * @param request - The incoming HTTP request.
 * @param params - Route parameters containing the admin ID.
 * @returns JSON response with either a success message or error details.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const id = (await params).id; // always defined when this route matches
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    try {
        const admin = await prisma.administrator.findUnique({
            where: { id },
            include: {
                role: { select: { id: true, name: true } },
            },
        });
        if (!admin) return NextResponse.json({ error: 'Admin user to delete not found.' }, { status: 404 });

        // Perform hard delete if explicitly requested
        if (force) {
            await prisma.administrator.delete({
                where: { id },
            });
            return NextResponse.json({ message: 'Admin user permanently deleted.' });
        }

        // Otherwise perform a soft delete
        const now = Math.floor(Date.now() / 1000);
        await prisma.administrator.update({
            where: { id },
            data: {
                status: 'deleted',
                deletedAt: now,
                updatedAt: now,
            },
        });
        return NextResponse.json({ message: 'Admin user deleted successfully.' });

    } catch (err) {
        console.error(`Error deleting admin by ID:`, err);
        return NextResponse.json({ error: 'Failed to delete admin user: ' + (err as Error).message }, { status: 500 });
    }
}
