import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from "@prisma/client";
import { isoToUnixSeconds } from "@/util/DateTimeConvertor";
import { validateCreateAdminInput, validateUpdateAdminInput } from "@/app/api/user/validation";
import { encodePassword } from "@/util/password-utils";

/**
 * User Management API
 *
 * This API provides comprehensive user management functionality for administrators
 * in the KAMI platform. It handles CRUD operations for user accounts with
 * proper password hashing and role-based access control.
 *
 * Features:
 * - User creation with password encoding
 * - User retrieval and updates
 * - Role assignment and management
 * - Account status tracking (active, locked, deleted)
 * - Soft delete support (commented out)
 */

/**
 * GET /api/user
 *
 * Retrieves all administrator users from the system with their basic
 * profile information and account status in paged structure response.
 *
 * @param request - The incoming HTTP request.
 * @param request.url - Query parameter object contains pagination, filters and sorting data.
 * @returns {Promise<NextResponse<UserResponse[] | { error: string }>>} JSON response containing:
 *   - Success: Array of admin user objects with pagination metadata
 *   - Error: Error message with 500 status code
 *
 * ###### Response Body Example:
 * ```JSON
 * {
 *   "data": [
 *     {
 *       "id": "98645433-9f17-42e4-9985-c566f8e8c45f",
 *       "email": "test@example.com",
 *       "name": "Test Admin User",
 *       "role": "Default",
 *       "status": "deleted",
 *       "createdAt": 1762941697,
 *       "updatedAt": 1763007629,
 *       "lastLoginAt": null,
 *       "lockedAt": null,
 *       "deletedAt": null
 *     }
 *   ],
 *   "meta": {
 *     "pagination": {
 *       "page": 1,
 *       "perPage": 10,
 *       "total": 1,
 *       "totalPages": 1
 *     },
 *     "filters": {},
 *     "sort": {
 *       "by": "createdAt",
 *       "order": "desc"
 *     }
 *   }
 * }
 * ```
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
		const email = searchParams.get("email") || undefined;
		const name = searchParams.get("name") || undefined;
		const roleId = searchParams.get("roleId") || undefined;
		const status = searchParams.get("status") || undefined;
		const createdAtFrom = searchParams.get('createdAtFrom') || undefined;
		const createdAtTo = searchParams.get('createdAtTo') || undefined;
		const updatedAtFrom = searchParams.get('updatedAtFrom') || undefined;
		const updatedAtTo = searchParams.get('updatedAtTo') || undefined;
		const lastLoginAtFrom = searchParams.get('lastLoginAtFrom') || undefined;
		const lastLoginAtTo = searchParams.get('lastLoginAtTo') || undefined;
		const lockedAtFrom = searchParams.get('lockedAtFrom') || undefined;
		const lockedAtTo = searchParams.get('lockedAtTo') || undefined;
		const deletedAtFrom = searchParams.get('deletedAtFrom') || undefined;
		const deletedAtTo = searchParams.get('deletedAtTo') || undefined;

		const where: Prisma.administratorWhereInput = {};

		if (email) 	where.email  = { contains: email, mode: 'insensitive' };
		if (name) 	where.name 	 = { contains: name, mode: 'insensitive' };
		if (roleId)	where.roleId = roleId;
		if (status)	where.status = status;

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
		if (lastLoginAtFrom || lastLoginAtTo) {
			where.lastLoginAt = {};
			if (lastLoginAtFrom) where.lastLoginAt.gte = isoToUnixSeconds(lastLoginAtFrom);
			if (lastLoginAtTo) where.lastLoginAt.lte = isoToUnixSeconds(lastLoginAtTo);
		}
		if (lockedAtFrom || lockedAtTo) {
			where.lockedAt = {};
			if (lockedAtFrom) where.lockedAt.gte = isoToUnixSeconds(lockedAtFrom);
			if (lockedAtTo) where.lockedAt.lte = isoToUnixSeconds(lockedAtTo);
		}
		if (deletedAtFrom || deletedAtTo) {
			where.deletedAt = {};
			if (deletedAtFrom) where.deletedAt.gte = isoToUnixSeconds(deletedAtFrom);
			if (deletedAtTo) where.deletedAt.lte = isoToUnixSeconds(deletedAtTo);
		}

		const [admins, total] = await Promise.all([
			// Fetch all administrator users according to pagination metadata.
			prisma.administrator.findMany({
				skip,
				take: perPage,
				where,
				orderBy: {
					[sortBy]: order,
				},
				include: {
					role: { select: { id: true, name: true } },
				},
			}),
			// Optional: total count for frontend pagination.
			prisma.administrator.count({ where })
		]);

		return NextResponse.json({
			data: admins.map((admin) => ({
				id: admin.id,
				email: admin.email,
				name: admin.name ?? undefined,
				roleId: admin.roleId,
				role: admin.role.name,
				status: admin.status,
				createdAt: admin.createdAt,
				updatedAt: admin.updatedAt,
				lastLoginAt: admin.lastLoginAt,
				lockedAt: admin.lockedAt,
				deletedAt: admin.deletedAt,
			})),
			meta: {
				pagination: {
					page, perPage, total,
					totalPages: Math.ceil(total / perPage),
				},
				filters: {
					email, name, roleId, status,
					createdAtFrom, createdAtTo,
					updatedAtFrom, updatedAtTo,
					lastLoginAtFrom, lastLoginAtTo,
					lockedAtFrom, lockedAtTo,
					deletedAtFrom, deletedAtTo,
				},
				sort: {
					by: sortBy,
					order,
				},
			},
		});
		
	} catch (err) {
		// Handle database errors and returns appropriate error message
		console.error('Error fetching admin user list:', err);
		return NextResponse.json({ error: 'Failed to fetch admins: ' + (err as Error).message }, { status: 500 });
	}
}

/**
 * POST /api/user
 *
 * Creates a new administrator user account with proper password handling
 * and role assignment. Supports both pre-encoded and plain text passwords.
 * If the email matches a previously soft-deleted account, it can optionally
 * reactivate that account if `reactivate: true` is provided.
 *
 * @param {NextRequest} request - The incoming HTTP request
 * @returns A `NextResponse` containing the created administrator record or an error message.
 *
 * ###### Request Body Example (create new user):
 * ```JSON
 * {
 *   "email": "newadmin@example.com",
 *   "password": "securePassword123",
 *   "name": "New Administrator",
 *   "encoded": false
 * }
 * ```
 * ###### Request Body Example (reactivate deleted user):
 * ```json
 * {
 *   "email": "deletedadmin@example.com",
 *   "password": "securePassword123",
 *   "encoded": false,
 *   "reactivate": true
 * }
 * ```
 * ###### Response Codes:
 * - `200` — Admin user successfully created/reactivated.
 * - `400` — Validation failed.
 * - `409` — Found same previously deleted email.
 * - `500` — Unexpected server error.
 *
 * @security Passwords are automatically hashed if not pre-encoded
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const body = await request.json();
		const result = await validateCreateAdminInput(body);
		if (!result.ok) {
			return NextResponse.json({ error: 'Validation failed', fieldErrors: result.fieldErrors }, { status: 400 });
		}

		const data = result.data!;
		// Handle password encoding - use as-is if pre-encoded, hash if plain text
		const hashedPwd = data.encoded ? data.password : await encodePassword(data.password);

		// Find a default role to assign if no role specified.
		let defaultRole;
		if (!data.roleId) {
			defaultRole = await prisma.role.findUnique({
				where: { name: 'Default' }
			});
			if (!defaultRole) return NextResponse.json({ error: 'Missing default role.' }, { status: 400 });
		}
		const roleId = data.roleId ?? defaultRole!.id;

		const now = Math.floor(Date.now() / 1000);

		// Check if a soft-deleted account exists
		const deleted = await prisma.administrator.findFirst({
			where: {
				email: data.email,
				deletedAt: { not: null },
			}
		});
		if (deleted) {
			if (!body.reactivate) {
				return NextResponse.json({
					error: "SOFT_DELETED",
					message: "Admin with this email was previously deleted. Confirm reactivation?",
				}, { status: 409 });
			}

			const admin = await prisma.administrator.update({
				where: { id: deleted.id },
				data: {
					passwordHash: hashedPwd,
					name: data.name ?? deleted.name,
					roleId,
					status: 'active',
					deletedAt: null,
					lockedAt: null,
					updatedAt: now,
				},
				include: {
					role: { select: { name: true } },
				},
			});
			return NextResponse.json({
				id: admin.id,
				email: admin.email,
				name: admin.name ?? undefined,
				role: admin.role.name,
				status: admin.status,
				createdAt: admin.createdAt,
				updatedAt: admin.updatedAt,
				reactivated: true,
			});
		}

		// Create new administrator user with current timestamp
		const admin = await prisma.administrator.create({
			data: {
				email: data.email,
				passwordHash: hashedPwd, // Store encoded password hash
				name: data.name,
				roleId,
				status: 'active', // Set initial status as active
				createdAt: now, // Current Unix timestamp
				updatedAt: now,
			},
			include: {
				role: { select: { name: true } },
			},
		});

		return NextResponse.json({
			id: admin.id,
			email: admin.email,
			name: admin.name ?? undefined,
			role: admin.role.name,
			status: admin.status,
			createdAt: admin.createdAt,
			updatedAt: admin.updatedAt,
		});
	} catch (err) {
		console.error('Error creating admin user:', err);
		return NextResponse.json({ error: 'Failed to create admin user: ' + (err as Error).message }, { status: 500 });
	}
}

/**
 * PUT /api/user
 *
 * Updates an existing administrator user.
 *
 * Validates input, ensures the target admin exists, and updates allowed fields:
 * - `name`
 * - `roleId`
 *
 * @param {NextRequest} request - Incoming HTTP request (JSON body expected)
 * @returns A `NextResponse` containing the updated administrator record or error message
 *
 * ###### Request Body Example:
 * ```json
 * {
 *   "id": "admin-id-123",
 *   "name": "Updated Name",
 *   "roleId": "role-id-456"
 * }
 * ```
 * ###### Response Codes:
 * - `200` — Admin user successfully updated.
 * - `400` — Validation failed.
 * - `404` — Admin user not found.
 * - `403` — Not allowed due to already deleted.
 * - `500` — Unexpected server error.
 *
 * @note This endpoint does not allow password changes for security reasons
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
	try {
		const body = await request.json();
		const result = await validateUpdateAdminInput(body);
		if (!result.ok) {
			const fieldErrors = result.fieldErrors ?? {};

			// Generic error handling.
			if (fieldErrors.generic === "NOT_FOUND") {
				return NextResponse.json({ error: "Admin user to update not found." }, { status: 404 });
			}
			if (fieldErrors.generic === "DELETED") {
				return NextResponse.json({ error: "Deleted admin user cannot be updated." }, { status: 403 });
			}

			// Field specific errors.
			return NextResponse.json({ error: "Validation failed", fieldErrors }, { status: 400 });
		}

		const data = result.data!;

		// Update the admin user
		const admin = await prisma.administrator.update({
			where: { id: data.id },
			data: {
				name: data.name,
				roleId: data.roleId,
				updatedAt: Math.floor(Date.now() / 1000),
			},
			include: {
				role: { select: { name: true } },
			},
		});

		return NextResponse.json({
			id: admin.id,
			email: admin.email,
			name: admin.name ?? undefined,
			role: admin.role.name,
			status: admin.status,
			createdAt: admin.createdAt,
			updatedAt: admin.updatedAt,
		});

	} catch (err) {
		console.error('Error updating admin user:', err);
		return NextResponse.json({ error: 'Failed to update admin user: ' + (err as Error).message }, { status: 500 });
	}
}
