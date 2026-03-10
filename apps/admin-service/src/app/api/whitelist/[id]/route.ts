import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { WhitelistResponse } from '../types';

/**
 * Whitelist Management API - Individual Entry Operations
 *
 * This API provides endpoints for managing individual whitelist entries
 * by their ID. It handles retrieving and deleting specific whitelist
 * records with proper error handling.
 *
 * Features:
 * - Individual whitelist entry retrieval
 * - Permanent deletion of whitelist entries
 * - Dynamic route parameter handling
 * - Comprehensive error handling
 *
 * @note This API uses Next.js dynamic routing with [id] parameter
 * @security DELETE operations are permanent and irreversible
 */

/**
 * GET /api/whitelist/[id]
 *
 * Retrieves a specific whitelist entry by its ID. This endpoint
 * provides detailed information about a single whitelist record
 * including email, phone number, wallet address, and creation timestamp.
 *
 * @param {Object} params - Route parameters object
 * @param {Object} params.params - Next.js dynamic route parameters
 * @param {string} params.params.id - The unique identifier of the whitelist entry to retrieve
 * @returns {Promise<NextResponse<WhitelistResponse | { error: string }>>} JSON response containing:
 *   - Success: Whitelist entry object with all details
 *   - Error 500: When database operation fails or entry not found
 *
 * @example
 * // Request: GET /api/whitelist/123
 * // Response structure:
 * {
 *   "id": 123,
 *   "walletAddress": "0x1234...",
 *   "email": "user@example.com",
 *   "phoneNumber": "+1234567890",
 *   "createdAt": 1703123456
 * }
 *
 * @throws {Error} When whitelist entry is not found (findUniqueOrThrow)
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<WhitelistResponse | { error: string }>> {
	try {
		// Retrieve whitelist entry by ID - throws error if not found
		const whitelist = await prisma.whitelist.findUniqueOrThrow({
			where: { id: Number((await params).id) }, // Convert string ID to number for database query
		});

		// Return the whitelist entry with all its details
		return NextResponse.json(whitelist);
	} catch (error) {
		// Handle database errors and entry not found scenarios
		return NextResponse.json({ error: 'Failed to get whitelist: ' + (error as Error).message }, { status: 500 });
	}
}

/**
 * DELETE /api/whitelist/[id]
 *
 * Permanently deletes a whitelist entry by its ID. This operation
 * removes the entry from the whitelist and is irreversible. Use with
 * caution as it will immediately revoke access for the associated
 * user, email, or wallet address.
 *
 * @param {Object} params - Route parameters object
 * @param {Object} params.params - Next.js dynamic route parameters
 * @param {string} params.params.id - The unique identifier of the whitelist entry to delete
 * @returns {Promise<NextResponse<WhitelistResponse | { error: string }>>} JSON response containing:
 *   - Success: The deleted whitelist entry object (for confirmation)
 *   - Error 500: When database operation fails or entry not found
 *
 * @example
 * // Request: DELETE /api/whitelist/123
 * // Response structure (returns deleted entry):
 * {
 *   "id": 123,
 *   "walletAddress": "0x1234...",
 *   "email": "user@example.com",
 *   "phoneNumber": "+1234567890",
 *   "createdAt": 1703123456
 * }
 *
 * @warning This operation is permanent and cannot be undone
 * @security Should be protected to prevent unauthorized whitelist removal
 * @note The deleted entry is returned for confirmation purposes
 */
export async function DELETE(
	request: never,
	{ params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<WhitelistResponse | { error: string }>> {
	try {
		// Permanently delete the whitelist entry by ID
		const whitelist = await prisma.whitelist.delete({
			where: { id: Number((await params).id) }, // Convert string ID to number for database query
		});

		// Return the deleted entry for confirmation
		return NextResponse.json(whitelist);
	} catch (error) {
		// Handle database errors and entry not found scenarios
		return NextResponse.json({ error: 'Failed to delete whitelist: ' + (error as Error).message }, { status: 500 });
	}
}
