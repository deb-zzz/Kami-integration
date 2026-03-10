import { prisma } from '@/lib/db';
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from 'next/server';
import { isoToUnixSeconds } from "@/util/DateTimeConvertor";
import { validateCreateRoleInput, validateUpdateRoleInput } from "@/app/api/roles/validation";

/**
 * Role Management API
 *
 * This API provides endpoints for managing user roles and their associated permissions
 * in the KAMI platform. It follows the Role-Based Access Control (RBAC) pattern.
 */

/**
 * GET /api/roles
 *
 * Retrieves all roles from the database with their associated permissions
 * in paged structure response.
 *
 * @param request - The incoming HTTP request.
 * @param request.url - Query parameter object contains pagination, filters and sorting data.
 * @returns {Promise<NextResponse>} JSON response containing:
 *   - Success: Array of role objects with pagination metadata
 *   - Error: Error message with status code `500`
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
		const id = searchParams.get("id") || undefined;
		const name = searchParams.get("name") || undefined;
		const description = searchParams.get("description") || undefined;
		const isSystemGenerated = searchParams
			.get('isSystemGenerated') === 'true' ? true : searchParams.get('isSystemGenerated') === 'false' ? false : undefined;
		const createdAtFrom = searchParams.get('createdAtFrom') || undefined;
		const createdAtTo = searchParams.get('createdAtTo') || undefined;
		const updatedAtFrom = searchParams.get('updatedAtFrom') || undefined;
		const updatedAtTo = searchParams.get('updatedAtTo') || undefined;
		const deletedAtFrom = searchParams.get('deletedAtFrom') || undefined;
		const deletedAtTo = searchParams.get('deletedAtTo') || undefined;

		const where: Prisma.roleWhereInput = {};

		if (id) 		 where.id  		   = { contains: id, mode: 'insensitive' };
		if (name) 		 where.name 	   = { contains: name, mode: 'insensitive' };
		if (description) where.description = { contains: description, mode: 'insensitive' };
		if (isSystemGenerated !== undefined) where.isSystemGenerated = isSystemGenerated;

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

		const [roles, total] = await Promise.all([
			// Fetch all roles according to pagination metadata.
			prisma.role.findMany({
				skip,
				take: perPage,
				where,
				orderBy: {
					[sortBy]: order,
				},
			}),
			// Optional: total count for frontend pagination.
			prisma.role.count({ where })
		])

		return NextResponse.json({
			data: roles,
			meta: {
				pagination: {
					page, perPage, total,
					totalPages: Math.ceil(total / perPage),
				},
				filters: {
					id, name, description, isSystemGenerated,
					createdAtFrom, createdAtTo,
					updatedAtFrom, updatedAtTo,
					deletedAtFrom, deletedAtTo,
				},
				sort: {
					by: sortBy,
					order,
				},
			},
		});
	} catch {
		// Handle database errors and returns appropriate error message
		return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
	}
}

/**
 * POST /api/roles
 *
 * Creates a new role with specified permissions. This endpoint can
 * optionally reactivate that account if `reactivate: true` is provided.
 *
 * @param {NextRequest} request - The incoming HTTP request
 * @returns {Promise<NextResponse>} JSON response containing:
 *   - Success: The created role object with all fields
 *   - Error: Error message with appropriate status code
 *
 * ###### Request Body Example (create new role):
 * ```JSON
 * {
 *   "name": "Test",
 *   "description": "Optional role description",
 *   "permissions": ["dashboard:view", "admin_management:create"]
 * }
 * ```
 * ###### Request Body Example (reactivate deleted role):
 * ```json
 * {
 *   "name": "Test",
 *   "description": "Optional role description",
 *   "permissions": ["dashboard:view", "admin_management:create"],
 *   "reactivate": true
 * }
 * ```
 * ###### Response Codes:
 * - `200` — Role successfully created/reactivated.
 * - `400` — Validation failed.
 * - `409` — Found same previously deleted role name.
 * - `500` — Unexpected server error.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const body = await request.json();
		const result = await validateCreateRoleInput(body);
		if (!result.ok) {
			return NextResponse.json({ error: 'Validation failed', fieldErrors: result.fieldErrors }, { status: 400 });
		}

		const data = result.data!;
		const now = Math.floor(Date.now() / 1000);

		const deleted = await prisma.role.findFirst({
			where: {
				name: data.name,
				deletedAt: { not: null },
			},
		});
		if (deleted) {
			if (!body.reactivate) {
				return NextResponse.json({
					error: "SOFT_DELETED",
					message: "Role with same name was previously deleted. Confirm reactivation?",
				}, { status: 409 });
			}

			const role = await prisma.role.update({
				where: { id: deleted.id },
				data: {
					description: data.description,
					deletedAt: null,
					updatedAt: now,
				},
			});
			return NextResponse.json(role);
		}

		const role = await prisma.role.create({
			data: {
				name: data.name,
				description: data.description,
				isSystemGenerated: data.isSystemGenerated,
				createdAt: now,
				updatedAt: now,
			},
		});

		if (data.permissionIds && data.permissionIds.length > 0) {
			await prisma.permissionRole.createMany({
				data: data.permissionIds.map(p => ({
					permissionId: p,
					roleId: role.id
				})),
			});
		}

		return NextResponse.json(role);

	} catch (err) {
		console.error('Error creating role:', err);
		return NextResponse.json({ error: 'Failed to create role: ' + (err as Error).message }, { status: 500 });
	}
}

/**
 * PUT /api/roles
 *
 * Updates an existing role with specified permissions. This endpoint implements
 * a many-to-many relationship between roles and permissions through the
 * permissionRole junction table.
 *
 * @param {NextRequest} request - The incoming HTTP request
 * @returns {Promise<NextResponse>} JSON response containing:
 *   - Success: The updated role object with all fields
 *   - Error: Error message with appropriate status code
 *
 * ###### Request Body Example (create new role):
 * ```JSON
 * {
 *   "id": "UUID"
 *   "name": "Test",
 *   "description": "Optional role description",
 *   "permissions": ["dashboard:view", "admin_management:create"]
 * }
 * ```
 * ###### Response Codes:
 * - `200` — Role successfully updated.
 * - `400` — Field validation failed.
 * - `404` — Role to update not found.
 * - `403` — Not allowed due to system-generated role or already deleted.
 * - `500` — Unexpected server error.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
	try {
		const body = await request.json();
		const result = await validateUpdateRoleInput(body);
		if (!result.ok) {
			const fieldErrors = result.fieldErrors ?? {};

			// Generic error handling.
			if (fieldErrors.generic === "NOT_FOUND") {
				return NextResponse.json({ error: "Role to update not found." }, { status: 404 });
			}
			if (fieldErrors.generic === "SYSTEM_LOCK") {
				return NextResponse.json({ error: "System-generated roles cannot be modified." }, { status: 403 });
			}
			if (fieldErrors.generic === "DELETED") {
				return NextResponse.json({ error: "Deleted role cannot be updated." }, { status: 403 });
			}

			// Field specific errors.
			return NextResponse.json({ error: "Validation failed", fieldErrors }, { status: 400 });
		}

		const data = result.data!;

		// #1 Delete all existing permission associations for the role.
		await prisma.permissionRole.deleteMany({
			where: { roleId: data.id },
		});

		// #2 Update the role.
		const role = await prisma.role.update({
			where: { id: data.id },
			data: {
				name: data.name,
				description: data.description,
				updatedAt: Math.floor(Date.now() / 1000),
			}
		});

		// #3 Create new permission associations to the role.
		if (data.permissionIds && data.permissionIds.length > 0) {
			await prisma.permissionRole.createMany({
				data: data.permissionIds.map(p => ({
					permissionId: p,
					roleId: role.id
				})),
			});
		}

		return NextResponse.json(role);

	} catch (err) {
		console.error('Error updating role:', err);
		return NextResponse.json({ error: 'Failed to update role: ' + (err as Error).message }, { status: 500 });
	}
}
