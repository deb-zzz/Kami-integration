import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/db';
import { isoToUnixSeconds } from "@/util/DateTimeConvertor";
import { Prisma } from "@prisma/client";
import { validateCreateCurrencyInput, validateUpdateCurrencyInput } from "@/app/api/currency/validation";

/**
 * Currency Management API
 *
 * This API provides endpoints for managing currencies in the KAMI platform.
 * 
 * Authentication:
 * - Create, Update, and Delete operations require JWT authentication
 * - Include "Authorization: Bearer <token>" header in requests
 * - The administrator's email from the JWT is validated and stored for audit purposes
 * - Administrator must be active and not deleted
 */

/**
 * GET /api/currency
 *
 * Retrieves all currencies from the system in paged response for listing purpose.
 * @param request - The incoming HTTP request.
 * @param request.url - Query parameter object contains pagination, filters and sorting data.
 * @returns {Promise<NextResponse>} JSON response containing:
 *   - Success: Array of all currencies.
 *   - Error: Error message with failure details.
 *
 * @example
 * // Response structure:
 * {
 *   "data": [
 *     {
 *       "symbol": "USD",
 *       "name": "US Dollar",
 *       "type": "Fiat",
 *       "isActive": true,
 *       "createdAt": 1703123456,
 *       "updatedAt": 1703123456,
 *       "updatedBy": "admin@example.com",
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
        const symbol = searchParams.get('symbol') || undefined;
        const name = searchParams.get('name') || undefined;
        const type = searchParams.get('type') || undefined;
        const isActive = searchParams.get('isActive') === 'true' ? true : searchParams.get('isActive') === 'false' ? false : undefined;
        const createdAtFrom = searchParams.get('createdAtFrom') || undefined;
        const createdAtTo = searchParams.get('createdAtTo') || undefined;
        const updatedAtFrom = searchParams.get('updatedAtFrom') || undefined;
        const updatedAtTo = searchParams.get('updatedAtTo') || undefined;

        const includeDeleted = searchParams.get('includeDeleted') === 'true';

        // Build dynamic where filter
        const where: Prisma.currencyWhereInput = {};
        if (!includeDeleted) where.deletedAt = null;
        if (symbol) where.symbol = { contains: symbol, mode: 'insensitive' };
        if (name) where.name = { contains: name, mode: 'insensitive' };
        if (type) where.type = type as 'Fiat' | 'Crypto';
        if (isActive !== undefined) where.isActive = isActive;
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

        // Fetch currencies with pagination, sorting, filtering
        const currencies = await prisma.currency.findMany({
            skip,
            take: perPage,
            where,
            orderBy: {
                [sortBy]: order,
            }
        });

        // Optional: total count for frontend pagination
        const total = await prisma.currency.count({ where });

        return NextResponse.json({
            data: currencies.map((currency) => {
                return {
                    ...currency,
                    createdAt: currency.createdAt,
                    updatedAt: currency.updatedAt
                }
            }),
            meta: {
                pagination: {
                    page, perPage, total,
                    totalPages: Math.ceil(total / perPage),
                },
                filters: {
                    symbol,
                    name,
                    type,
                    isActive,
                    createdAtFrom, createdAtTo,
                    updatedAtFrom, updatedAtTo,
                },
                sort: {
                    by: sortBy,
                    order,
                },
            },
        });

    } catch {
        return NextResponse.json({ error: 'Failed to fetch currencies' }, { status: 500 });
    }
}

/**
 * POST /api/currency
 *
 * Creates a new currency in the system.
 *
 * @param {NextRequest} request - The incoming HTTP request.
 * @returns {Promise<NextResponse>} JSON response containing:
 *   - Success: Created currency info.
 *   - Error: Error message with failure details.
 *
 * @example
 * // Request body:
 * {
 *   "symbol": "USD",
 *   "name": "US Dollar",
 *   "type": "Fiat",
 *   "isActive": true
 * }
 * */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const body = await request.json();
    try {
        const result = await validateCreateCurrencyInput(body);
        if (!result.ok) {
            return NextResponse.json({ error: 'Validation failed', fieldErrors: result.fieldErrors }, { status: 400 });
        }

        const data = result.data!;
        const now = Math.floor(Date.now() / 1000);

        const currency = await prisma.currency.create({
            data: {
                symbol: data.symbol,
                name: data.name,
                type: data.type,
                isActive: data.isActive,
                createdAt: now,
                updatedAt: now,
            }
        });
        return NextResponse.json(currency);

    } catch (e) {
        return NextResponse.json({ error: 'Failed to create currency: ' + (e as Error).message }, { status: 500 });
    }
}

/**
 * PUT /api/currency
 *
 * Updates existing currency in the system.
 *
 * @param {NextRequest} request - The incoming HTTP request.
 * @returns {Promise<NextResponse>} JSON response containing:
 *   - Success: Updated currency info.
 *   - Error: Error message with failure details.
 *
 * @example
 * // Request body:
 * {
 *   "symbol": "USD",
 *   "name": "US Dollar",
 *   "type": "Fiat",
 *   "isActive": false
 *   "updatedBy": "system"
 * }
 * */
export async function PUT(request: NextRequest): Promise<NextResponse> {
    const body = await request.json();

    try {
        const updatedEmail: string | null = body.updatedBy || null;

        const result = await validateUpdateCurrencyInput(body);
        if (!result.ok) {
            return NextResponse.json({ error: 'Validation failed', fieldErrors: result.fieldErrors }, { status: 400 });
        }

        const data = result.data!;

        // Build update data object dynamically
        const updateData: Prisma.currencyUncheckedUpdateInput = {
            updatedAt: Math.floor(Date.now() / 1000),
            updatedBy: updatedEmail,
        };

        if (data.name !== undefined) updateData.name = data.name;
        if (data.type !== undefined) updateData.type = data.type;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;

        const currency = await prisma.currency.update({
            where: { symbol: data.symbol },
            data: updateData,
        });
        return NextResponse.json(currency);

    } catch (e) {
        return NextResponse.json({ error: 'Failed to update currency: ' + (e as Error).message }, { status: 500 });
    }
}
