import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ChargeLocation, Prisma } from '@prisma/client';
import { isoToUnixSeconds } from "@/util/DateTimeConvertor";
import { validateCreateChargeInput, validateUpdateChargeInput } from "@/app/api/charges/validation";

/**
 * Charges Management API
 *
 * This API provides comprehensive fee and charge management for the KAMI platform.
 * It handles various types of charges, including fixed amounts and percentage-based
 * fees for different platform operations.
 * */

/**
 * GET /api/charges
 *
 * Retrieves configured charges from the system in paged response for listing purpose.
 * @param request - The incoming HTTP request.
 * @param request.url - Query parameter object contains pagination, filters and sorting data.
 * @returns {Promise<NextResponse>} JSON response containing:
 *   - Success: Array of all charge configurations.
 *   - Error: Error message with failure details.
 *
 * @example
 * // Response structure:
 * {
 *   "data": [
 *     {
 *       "id": "<charge_uuid>"
 *       "typeId": "<charge_type_uuid>",
 *       "description": "Optional explanation of the charge",
 *       "location": "Checkout", // PascalCase enum
 *       "fixedAmount": 10.50,
 *       "percentage": 2.5,
 *       "createdAt": 1703123456,
 *       "updatedAt": 1703123456,
 *       "deletedAt": null,
 *       "chargeType": {
 *         "id": "<charge_type_uuid>",
 *         "name": "Name of the charge type"
 *       }
 *     }
 *   ],
 *   "meta": {
 *     "pagination": {
 *       "page": 1,
 *       "perPage": 20,
 *       "total": 6,
 *       "totalPages": 3
 *     },
 *     "filters": {
 *       // If apply field query param
 *     }
 *     "sort": {
 *       "by": "createdAt",
 *       "order": "desc"
 *     }
 *   }
 * }
 * */
export async function GET(request: NextRequest): Promise<NextResponse> {
	try {
		const { searchParams } = new URL(request.url)

		// Pagination
		const page = parseInt(searchParams.get('page') || '1', 10);
		const perPage = parseInt(searchParams.get('perPage') || '10', 10);
		const skip = (page - 1) * perPage;

		// Sorting (format: sort=field,order)
		const sortParam = searchParams.get('sort') || 'createdAt,desc';
		const [sortBy, orderRaw] = sortParam.split(',');
		const order = (orderRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

		// Filtering by columns
		const typeId = searchParams.get('typeId') || undefined;
		const description = searchParams.get('description') || undefined;
		const currency = searchParams.get("currency") || undefined;
		const locationParam = searchParams.get("location");
		const createdAtFrom = searchParams.get('createdAtFrom') || undefined;
		const createdAtTo = searchParams.get('createdAtTo') || undefined;
		const updatedAtFrom = searchParams.get('updatedAtFrom') || undefined;
		const updatedAtTo = searchParams.get('updatedAtTo') || undefined;
		const deletedAtFrom = searchParams.get('deletedAtFrom') || undefined;
		const deletedAtTo = searchParams.get('deletedAtTo') || undefined;

		const viewState = searchParams.get('viewState') || undefined;

		// Build dynamic where filter
		const where: Prisma.chargeWhereInput = {};

		switch (viewState) {
			case 'active':
				where.deletedAt = null;
				break;
			case 'deleted':
				where.NOT = { deletedAt: null };
				break;
			case 'all':
			default:
				// no filter → include all records
				break;
		}
		if (typeId) 	 where.typeId 	   = { contains: typeId, mode: 'insensitive' };
		if (description) where.description = { contains: description, mode: 'insensitive' };
		if (currency)	 where.currency    = { contains: currency, mode: 'insensitive' };

		let location: ChargeLocation | undefined = undefined;
		if (locationParam) {
			if (!(locationParam in ChargeLocation)) {
				return NextResponse.json(
					{ error: `Invalid location. Allowed values: ${Object.values(ChargeLocation).join(", ")}`},
					{ status: 400 }
				);
			}
			location = locationParam as ChargeLocation;
		}
		if (location) where.location = location;

		if (createdAtFrom || createdAtTo) {
			where.createdAt = {};
			if (createdAtFrom) where.createdAt.gte = isoToUnixSeconds(createdAtFrom);
			if (createdAtTo) where.createdAt.lte = isoToUnixSeconds(createdAtTo);
		}
		if (updatedAtFrom || updatedAtTo) {
			where.updatedAt = {};
			if (updatedAtFrom) where.updatedAt.gte = isoToUnixSeconds(updatedAtFrom);
			if (updatedAtTo) where.updatedAt.lte = isoToUnixSeconds(updatedAtTo);
		}
		if (deletedAtFrom || deletedAtTo) {
			where.deletedAt = {};
			if (deletedAtFrom) where.deletedAt.gte = isoToUnixSeconds(deletedAtFrom);
			if (deletedAtTo) where.deletedAt.lte = isoToUnixSeconds(deletedAtTo);
		}

		// Fetch charges with pagination, sorting, filtering
		const charges = await prisma.charge.findMany({
			skip,
			take: perPage,
			where,
			orderBy: {
				[sortBy]: order,
			},
			include: {
				chargeType: { select: { id: true, name: true } },
			},
		});

		// Optional: total count for frontend pagination
		const total = await prisma.charge.count({ where });

		return NextResponse.json({
			data: charges.map((charge) => {
				return {
					...charge,
					fixedAmount: charge.fixedAmount.toNumber(), // Convert Decimal to number
					percentage: charge.percentage.toNumber(), // Convert Decimal to number
					createdAt: charge.createdAt,
					updatedAt: charge.updatedAt
				}
			}),
			meta: {
				pagination: {
					page, perPage, total,
					totalPages: Math.ceil(total / perPage),
				},
				filters: {
					typeId, description, location, currency,
					createdAtFrom, createdAtTo,
					updatedAtFrom, updatedAtTo,
					deletedAtFrom, deletedAtTo,
					viewState
				},
				sort: {
					by: sortBy,
					order,
				},
			},
		});

	} catch (error) {
		// Handle database errors gracefully
		return NextResponse.json({ error: 'Failed to fetch charges: ' + (error as Error).message });
	}
}

/**
 * POST /api/charges
 *
 * Creates a new charge in the system.
 *
 * @param {NextRequest} request - The incoming HTTP request.
 * @returns {Promise<NextResponse>} JSON response containing:
 *   - Success: Created charge info.
 *   - Error: Error message with failure details.
 *
 * @example
 * // Request body:
 * {
 *   "typeId": "<charge_type_uuid>",
 *   "description": "Optional explanation of the charge",
 *   "location": "Checkout", // PascalCase enum
 *   "currency": "" // Required for fixed amount charge (e.g. USDC)
 *   "fixedAmount": 0,
 *   "percentage": 1.27
 * }
 * */
export async function POST(request: NextRequest): Promise<NextResponse> {
	const body = await request.json();

	try {
		const result = await validateCreateChargeInput(body);
		if (!result.ok) {
			return NextResponse.json({ error: 'Validation failed', fieldErrors: result.fieldErrors }, { status: 400 });
		}

		const data = result.data!;
		const now = Math.floor(Date.now() / 1000);

		const charge = await prisma.charge.create({
			data: {
				typeId: data.typeId,
				location: data.location,
				description: data.description ?? null,
				currency: data.currency ?? null,
				fixedAmount: data.fixedAmount,
				percentage: data.percentage,
				createdAt: now,
				updatedAt: now,
			},
			include: {
				chargeType: true,
			},
		});
		return NextResponse.json({
			...charge,
			fixedAmount: charge.fixedAmount.toNumber(), // Convert Decimal to number
			percentage: charge.percentage.toNumber(), // Convert Decimal to number
		});

	} catch (e) {
		return NextResponse.json({ error: 'Failed to create charge type: ' + (e as Error).message }, { status: 500 });
	}
}

/**
 * PUT /api/charges
 *
 * Updates existing charge in the system.
 *
 * @param {NextRequest} request - The incoming HTTP request.
 * @returns {Promise<NextResponse>} JSON response containing:
 *  - Success: Updated charge info.
 *  - Error: Error message with failure details.
 *
 * @example
 * // Request body:
 * {
 *   "id": "<charge_uuid_to_update>",
 *   "typeId": "<charge_type_uuid>",
 *   "description": "Optional explanation of the charge",
 *   "location": "Checkout", // PascalCase enum
 *   "currency": "" // Required for fixed amount charge (e.g. USDC)
 *   "fixedAmount": 0,
 *   "percentage": 1.27
 * }
 * */
export async function PUT(request: NextRequest): Promise<NextResponse> {
	const body = await request.json();

	try {
		const result = await validateUpdateChargeInput(body);
		if (!result.ok) {
			return NextResponse.json({ error: 'Validation failed', fieldErrors: result.fieldErrors }, { status: 400 });
		}

		const data = result.data!;

		const charge = await prisma.charge.update({
			where: { id: data.id },
			data: {
				typeId: data.typeId,
				location: data.location,
				description: data.description,
				currency: data.currency,
				fixedAmount: data.fixedAmount,
				percentage: data.percentage,
				updatedAt: Math.floor(Date.now() / 1000),
			},
			include: {
				chargeType: true,
			},
		});
		return NextResponse.json({
			...charge,
			fixedAmount: charge.fixedAmount.toNumber(), // Convert Decimal to number
			percentage: charge.percentage.toNumber(), // Convert Decimal to number
		});

	} catch (e) {
		return NextResponse.json({ error: 'Failed to update charge: ' + (e as Error).message }, { status: 500 });
	}
}
