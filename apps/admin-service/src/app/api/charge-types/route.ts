import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/db';
import { isoToUnixSeconds } from "@/util/DateTimeConvertor";
import { Prisma } from "@prisma/client";
import { validateCreateChargeTypeInput, validateUpdateChargeTypeInput } from "@/app/api/charge-types/validation";

/**
 * Charge Type Management API
 *
 * This API provides endpoints for managing charge types in the KAMI platform.
 */

/**
 * GET /api/charge-types
 *
 * Retrieves all charge types from the system in paged response for listing purpose.
 * @param request - The incoming HTTP request.
 * @param request.url - Query parameter object contains pagination, filters and sorting data.
 * @returns {Promise<NextResponse>} JSON response containing:
 *   - Success: Array of all charge types.
 *   - Error: Error message with failure details.
 *
 * @example
 * // Response structure:
 * {
 *   "data": [
 *     {
 *       "id": "<charge_type_uuid>"
 *       "name": "Name of the charge type",
 *       "createdAt": 1703123456,
 *       "updatedAt": 1703123456,
 *       "deletedAt": null,
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
        const name = searchParams.get('name') || undefined;
        const createdAtFrom = searchParams.get('createdAtFrom') || undefined;
        const createdAtTo = searchParams.get('createdAtTo') || undefined;
        const updatedAtFrom = searchParams.get('updatedAtFrom') || undefined;
        const updatedAtTo = searchParams.get('updatedAtTo') || undefined;
        const deletedAtFrom = searchParams.get('deletedAtFrom') || undefined;
        const deletedAtTo = searchParams.get('deletedAtTo') || undefined;

        const viewState = searchParams.get('viewState') || undefined;

        // Build dynamic where filter
        const where: Prisma.chargeTypeWhereInput = {};
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
        if (name) where.name = { contains: name, mode: 'insensitive' };
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
        const chargeTypes = await prisma.chargeType.findMany({
            skip,
            take: perPage,
            where,
            orderBy: {
                [sortBy]: order,
            }
        });

        // Optional: total count for frontend pagination
        const total = await prisma.chargeType.count({ where });

        return NextResponse.json({
            data: chargeTypes.map((chargeType) => {
                return {
                    ...chargeType,
                    createdAt: chargeType.createdAt,
                    updatedAt: chargeType.updatedAt
                }
            }),
            meta: {
                pagination: {
                    page, perPage, total,
                    totalPages: Math.ceil(total / perPage),
                },
                filters: {
                    name,
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

    } catch {
        return NextResponse.json({ error: 'Failed to fetch charge types' }, { status: 500 });
    }
}

/**
 * POST /api/charge-types
 *
 * Creates a new charge type in the system.
 *
 * @param {NextRequest} request - The incoming HTTP request.
 * @returns {Promise<NextResponse>} JSON response containing:
 *   - Success: Created charge type info.
 *   - Error: Error message with failure details.
 *
 * @example
 * // Request body:
 * {
 *   "name": "Name of the charge type"
 * }
 * */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const body = await request.json();
    try {
        const result = await validateCreateChargeTypeInput(body);
        if (!result.ok) {
            return NextResponse.json({ error: 'Validation failed', fieldErrors: result.fieldErrors }, { status: 400 });
        }

        const data = result.data!;
        const now = Math.floor(Date.now() / 1000);

        const chargeType = await prisma.chargeType.create({
            data: {
                name: data.name,
                createdAt: now,
                updatedAt: now,
            }
        });
        return NextResponse.json(chargeType);

    } catch (e) {
        return NextResponse.json({ error: 'Failed to create charge type: ' + (e as Error).message }, { status: 500 });
    }
}

/**
 * PUT /api/charge-types
 *
 * Updates existing charge type in the system.
 *
 * @param {NextRequest} request - The incoming HTTP request.
 * @returns {Promise<NextResponse>} JSON response containing:
 *   - Success: Updated charge type info.
 *   - Error: Error message with failure details.
 *
 * @example
 * // Request body:
 * {
 *   "id": "<charge_type_uuid_to_update>"
 *   "name": "Name of the charge type"
 * }
 * */
export async function PUT(request: NextRequest): Promise<NextResponse> {
    const body = await request.json();

    try {
        const result = await validateUpdateChargeTypeInput(body);
        if (!result.ok) {
            return NextResponse.json({ error: 'Validation failed', fieldErrors: result.fieldErrors }, { status: 400 });
        }

        const data = result.data!;

        const chargeType = await prisma.chargeType.update({
            where: { id: data.id },
            data: {
                name: data.name,
                updatedAt: Math.floor(Date.now() / 1000),
            }
        });
        return NextResponse.json(chargeType);

    } catch (e) {
        return NextResponse.json({ error: 'Failed to update charge type: ' + (e as Error).message }, { status: 500 });
    }
}
