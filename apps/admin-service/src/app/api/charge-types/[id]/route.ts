import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Charge Type Management API - Individual Charge Type Operations
 *
 * This API provides endpoints for managing individual charge types by their ID.
 * It handles retrieving and deleting specific charge types.
 */

/**
 * GET /api/charge-types/[id]
 *
 * Get configured specific charge by ID.
 * @param request - The incoming HTTP request.
 * @param params - Route parameters object.
 * @param params.id - The unique identifier of the charge type to retrieve.
 *
 * @example
 * // Response structure
 * {
 *   "id": "<charge_type_uuid>",
 *   "name": "Name of the charge type",
 *   "createdAt": 1758514800,
 *   "updatedAt": 1758514800,
 *   "deletedAt": null,
 * }
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const id = (await params).id; // always defined when this route matches
    try {
        const chargeType = await prisma.chargeType.findUnique({
            where: { id },
        });

        if (!chargeType) {
            return NextResponse.json({ error: 'Charge type not found.' }, { status: 404 });
        }

        return NextResponse.json(chargeType);
    } catch {
        return NextResponse.json({ error: 'Failed to fetch charge type' }, { status: 500 });
    }
}

/**
 * DELETE /api/charge-types/[id]
 *
 * Deletes a charge.
 * @param request - The incoming HTTP request.
 * @param params - Route parameters object.
 * @param params.id - The unique identifier of the charge type to delete.
 * @returns JSON response containing:
 *   - Success: Confirmation message.
 *   - Error 500: When database operation fails.
 *
 * @example
 * // Response structure
 * { "message": "Charge type deleted successfully." }
 * */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const id = (await params).id; // always defined when this route matches
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    try {
        // Validate charge type to delete is associated with any charges.
        const charges = await prisma.charge.findMany({
            where: {
                typeId: id,
                deletedAt: null,
            },
        });
        if (charges.length > 0 && !force) {
            return NextResponse.json(
                { error: 'Charge type has associated charges and cannot be deleted.' },
                { status: 400 }
            );
        }

        // Perform hard delete if explicitly requested
        if (force) {
            await prisma.chargeType.delete({
                where: { id },
            });
            return NextResponse.json({ message: 'Charge type permanently deleted.' });
        }

        // Otherwise perform a soft delete
        const now = Math.floor(Date.now() / 1000);
        await prisma.chargeType.update({
            where: { id },
            data: {
                deletedAt: now,
                updatedAt: now,
            },
        });
        return NextResponse.json({ message: 'Charge type deleted successfully.' });

    } catch (e) {
        console.error('Error deleting charge type:', e);
        return NextResponse.json({ error: 'Failed to delete charge type' }, { status: 500 });
    }
}
