import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { WhitelistRequest } from './types';
import { isoToUnixSeconds } from "@/util/DateTimeConvertor";
import { Prisma } from "@prisma/client";

/**
 * Whitelist Management API
 *
 * This API provides comprehensive whitelist management functionality for
 * controlling access to the KAMI platform. It supports individual entries,
 * bulk imports, and complete whitelist management.
 *
 * Features:
 * - Individual whitelist entry creation
 * - Bulk import from external data sources
 * - Complete whitelist retrieval and management
 * - Flexible identification (email, phone, wallet address)
 * - Bulk deletion capabilities
 */

/**
 * GET /api/whitelist
 *
 * Request to fetch all whitelist entries in paged response for listing purpose.
 * @param request - The incoming HTTP request.
 * @param request.url - a query parameter object contains pagination, filters and sorting data.
 * @returns {Promise<NextResponse>} JSON response containing:
 *   - Success: Array of all whitelist entries with paginated metadata.
 *   - Error: Error message with failure details.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
	try {
		const { searchParams } = new URL(request.url);

		// Pagination
		const page = parseInt(searchParams.get('page') || '1', 10);
		const perPage = parseInt(searchParams.get('perPage') || '10', 10);
		const skip = (page - 1) * perPage;

		// Sorting (format: sort=field,order)
		const sortParam = searchParams.get('sort') || 'createdAt,desc';
		const [sortBy, orderRaw] = sortParam.split(',');
		const order = (orderRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

		// Filtering by columns
		const walletAddress = searchParams.get("walletAddress") || undefined;
		const email = searchParams.get("email") || undefined;
		const phoneNumber = searchParams.get("phoneNumber") || undefined;
		const createdAtFrom = searchParams.get('createdAtFrom') || undefined;
		const createdAtTo = searchParams.get('createdAtTo') || undefined;

		const where: Prisma.whitelistWhereInput = {};
		if (walletAddress) where.walletAddress = { contains: walletAddress, mode: 'insensitive' };
		if (email) 		   where.email 		   = { contains: email, mode: 'insensitive' };
		if (phoneNumber)   where.phoneNumber   = { contains: phoneNumber, mode: 'insensitive' };
		if (createdAtFrom || createdAtTo) {
			where.createdAt = {};
			if (createdAtFrom) where.createdAt.gte = isoToUnixSeconds(createdAtFrom);
			if (createdAtTo) where.createdAt.lte = isoToUnixSeconds(createdAtTo);
		}

		const whitelist = await prisma.whitelist.findMany({
			skip,
			take: perPage,
			where,
			orderBy: {
				[sortBy]: order,
			},
		});
		// total count for frontend pagination
		const total = await prisma.whitelist.count({ where });

		return NextResponse.json({
			data: whitelist,
			meta: {
				pagination: {
					page, perPage, total,
					totalPages: Math.ceil(total / perPage),
				},
				filters: {
					walletAddress, email, phoneNumber,
					createdAtFrom, createdAtTo,
				},
				sort: {
					by: sortBy,
					order,
				},
			},
		});

	} catch (error) {
		return NextResponse.json({ error: 'Failed to fetch whitelist: ' + (error as Error).message }, { status: 500 });
	}
}

/**
 * Handles POST requests to create a new whitelist entry.
 *
 * @param {NextRequest} request - The incoming request object containing the whitelist data.
 * @returns {Promise<NextResponse>}
 * A promise that resolves to a NextResponse containing the created whitelist entry or an error message.
 */
export async function POST(request: NextRequest) {
	const whitelistRequest: WhitelistRequest = await request.json();

	try {
		const whitelist = await prisma.whitelist.create({
			data: { ...whitelistRequest, createdAt: Math.floor(Date.now() / 1000) },
		});
		return NextResponse.json(whitelist);
	} catch (error) {
		return NextResponse.json({ error: 'Failed to create whitelist: ' + (error as Error).message }, { status: 500 });
	}
}

/**
 * Handles DELETE requests to remove all whitelist entries.
 *
 * @returns {Promise<NextResponse>}
 * A promise that resolves to a NextResponse containing the result of the delete operation or an error message.
 */
export async function DELETE() {
	try {
		const whitelist = await prisma.whitelist.deleteMany();
		return NextResponse.json(whitelist);
	} catch (error) {
		return NextResponse.json({ error: 'Failed to delete whitelist: ' + (error as Error).message }, { status: 500 });
	}
}

/**
 * Data structure for bulk whitelist import operations
 */
type ImportedData = {
	email?: string; // Optional email address for whitelist entry
	phone?: string; // Optional phone number for whitelist entry
};

/**
 * Response structure for bulk import operations
 */
type ImportResponse = {
	success: boolean; // Whether the import operation was successful
	error?: string; // Error message if the import failed
};

/**
 * Handles PATCH requests to import multiple whitelist entries.
 *
 * @param {NextRequest} request - The incoming request object containing an array of records to import.
 * @returns {Promise<NextResponse<ImportResponse>>}
 * A promise that resolves to a NextResponse indicating the success or failure of the import operation.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse<ImportResponse>> {
	try {
		// Parse the incoming bulk import data
		const records: ImportedData[] = await request.json();
		console.log(records);

		// Validate that we have records to import
		if (records.length == 0) throw new Error('No records to import');

		// Process each record individually to handle partial failures gracefully
		for (const { email, phone } of records) {
			try {
				// Create whitelist entry with current timestamp
				await prisma.whitelist.create({
					data: {
						email,
						phoneNumber: phone,
						createdAt: Math.floor(Date.now() / 1000), // Current Unix timestamp
					},
				});
			} catch (err) {
				// Log individual record failures but continue processing others
				console.log(`error importing record with email: ${email} and phone ${phone}... ignored!`);
				console.log((err as Error).message);
				continue; // Skip failed records and continue with the next one
			}
		}
	} catch (err) {
		return NextResponse.json({ success: false, error: (err as Error).message }, { status: 400 });
	}

	// Return success if we reach here (even with some individual failures)
	return NextResponse.json({ success: true });
}
