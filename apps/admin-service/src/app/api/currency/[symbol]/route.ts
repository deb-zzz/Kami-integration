import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Currency Management API - Individual Currency Operations
 *
 * This API provides endpoints for managing individual currencies by their symbol.
 * It handles retrieving and deleting specific currencies.
 */

/**
 * GET /api/currency/[symbol]
 *
 * Get configured specific currency by symbol.
 * @param request - The incoming HTTP request.
 * @param params - Route parameters object.
 * @param params.symbol - The unique identifier (symbol) of the currency to retrieve.
 *
 * @example
 * // Response structure
 * {
 *   "symbol": "USD",
 *   "name": "US Dollar",
 *   "type": "Fiat",
 *   "isActive": true,
 *   "createdAt": 1758514800,
 *   "updatedAt": 1758514800,
 *   "updatedBy": "admin@example.com",
 *   "deletedAt": null,
 * }
 */
export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
    const symbol = (await params).symbol; // always defined when this route matches
    try {
        const currency = await prisma.currency.findUnique({
            where: { symbol: symbol.toUpperCase() },
        });

        if (!currency) {
            return NextResponse.json({ error: 'Currency not found.' }, { status: 404 });
        }

        return NextResponse.json(currency);
    } catch {
        return NextResponse.json({ error: 'Failed to fetch currency' }, { status: 500 });
    }
}

/**
 * DELETE /api/currency/[symbol]
 *
 * Deletes a currency.
 * @param request - The incoming HTTP request.
 * @param params - Route parameters object.
 * @param params.symbol - The unique identifier (symbol) of the currency to delete.
 * @returns JSON response containing:
 *   - Success: Confirmation message.
 *   - Error 400: When user ID (email) is missing
 *   - Error 500: When database operation fails.
 *
 * @example
 * // Response structure
 * { "message": "Currency deleted successfully." }
 * */
export async function DELETE(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
    const symbol = (await params).symbol; // always defined when this route matches
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    try {
        const upperSymbol = symbol.toUpperCase();

        // Check if currency exists
        const currency = await prisma.currency.findUnique({
            where: { symbol: upperSymbol },
        });

        if (!currency) {
            return NextResponse.json({ error: 'Currency not found.' }, { status: 404 });
        }

        // Perform hard delete if explicitly requested
        if (force) {
            await prisma.currency.delete({
                where: { symbol: upperSymbol },
            });
            return NextResponse.json({ message: 'Currency permanently deleted.' });
        }

        // Otherwise perform a soft delete
        const now = Math.floor(Date.now() / 1000);
        await prisma.currency.update({
            where: { symbol: upperSymbol },
            data: {
                isActive: false,
                deletedAt: now,
                updatedAt: now,
                updatedBy: 'system',
            },
        });
        return NextResponse.json({ message: 'Currency deleted successfully.' });

    } catch (e) {
        console.error('Error deleting currency:', e);
        return NextResponse.json({ error: 'Failed to delete currency' }, { status: 500 });
    }
}
