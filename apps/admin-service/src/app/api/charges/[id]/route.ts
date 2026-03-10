import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Charge Management API - Individual Charge Operations
 *
 * This API provides endpoints for managing individual charges by their ID.
 * It handles retrieving and deleting specific charge.
 */

/**
 * GET /api/charges/[id]
 *
 * Get configured specific charge by ID.
 * @param request - The incoming HTTP request.
 * @param params - Route parameters object.
 * @param params.id - The unique identifier of the charge to retrieve.
 *
 * @example
 * // Response structure
 * {
 *   "id": "<charge_uuid>",
 *   "typeId": "<charge_type_uuid>",
 *   "description": "Optional explanation of the charge",
 *   "location": "Checkout", // PascalCase enum
 *   "currency": null,
 *   "fixedAmount": "5",
 *   "percentage": "0",
 *   "createdAt": 1758514800,
 *   "updatedAt": 1758514800,
 *   "deletedAt": null,
 *   "chargeType": {
 *     "id": "<charge_type_uuid>",
 *     "name": "Name of the charge type"
 *   }
 * }
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const id = (await params).id; // always defined when this route matches
    try {
        const charge = await prisma.charge.findUnique({
            where: { id },
            include: {
                chargeType: { select: { id: true, name: true } },
            },
        });

        if (!charge) {
            return NextResponse.json({ error: 'Charge not found.' }, { status: 404 });
        }

        return NextResponse.json(charge);
    } catch {
        return NextResponse.json({ error: 'Failed to fetch charge' }, { status: 500 });
    }
}

/**
 * DELETE /api/charges/[id]
 *
 * Deletes a charge.
 * @param request - The incoming HTTP request.
 * @param params - Route parameters object.
 * @param params.id - The unique identifier of the charge to delete.
 * @returns JSON response containing:
 *   - Success: Confirmation message.
 *   - Error 500: When database operation fails.
 *
 * @example
 * // Response structure
 * { "message": "Charge deleted successfully." }
 * */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const id = (await params).id; // always defined when this route matches
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    try {
        // Perform hard delete if explicitly requested
        if (force) {
            await prisma.charge.delete({
                where: { id },
            });
            return NextResponse.json({ message: 'Charge permanently deleted.' });
        }

        // Otherwise perform a soft delete
        const now = Math.floor(Date.now() / 1000);
        await prisma.charge.update({
            where: { id },
            data: {
                deletedAt: now,
                updatedAt: now,
            },
        });
        return NextResponse.json({ message: 'Charge deleted successfully.' });

    } catch {
        return NextResponse.json({ error: 'Failed to delete charge' }, { status: 500 });
    }
}
