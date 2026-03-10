import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Role Management API - Individual Role Operations
 *
 * This API provides endpoints for managing individual roles by their ID.
 * It handles retrieving and deleting specific roles with their associated permissions.
 */

/**
 * GET /api/roles/[id]
 *
 * Fetches a role by its ID, including its associated permission IDs.
 *
 * Behavior:
 * - If the role exists, returns the role's details along with a flattened list of permission IDs.
 * - If the role does not exist, returns 404.
 * - On any server error, returns 500 with an error message.
 *
 * ###### Response JSON structure:
 * ```ts
 * {
 *   id: string,
 *   name: string,
 *   description: string | null,
 *   isSystemGenerated: boolean,
 *   createdAt: number,
 *   updatedAt: number,
 *   deletedAt: number | null,
 *   permissionIds: string[]
 * }
 * ```
 *
 * @param request - The incoming HTTP request.
 * @param params - Route parameters containing the role ID.
 * @returns JSON response with role details or error message.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const id = (await params).id; // always defined when this route matches

	try {
		const role = await prisma.role.findUnique({
			where: { id },
			include: {
				permissionRoles: {
					include: {
						permission: true,
					},
				},
			},
		});
		if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 });

		const { permissionRoles, ...rest } = role;
		const permissionIds = permissionRoles.map(p => p.permissionId)

		// Flatten response to necessary info
		return NextResponse.json({
			...rest,
			permissionIds,
		});
	} catch (err) {
		console.error(`Error fetch role by ID:`, err);
		return NextResponse.json({ error: 'Failed to fetch role by ID: ' + (err as Error).message }, { status: 500 });
	}
}

/**
 * DELETE /api/roles/[id]
 *
 * Deletes a role by its ID. Supports both soft deletion and force deletion.
 *
 * Query Parameters:
 * - `force` (optional: boolean)
 *    - `false` (default): Performs a soft delete by setting `deletedAt` and `updatedAt`.
 *    - `true`: Performs a permanent delete. Ensures the role is not assigned to any administrators before removal.
 *
 * Behavior:
 * - If the role does not exist → returns 404.
 * - If `force=false` and role is assigned to active administrators → returns 409.
 * - If `force=true` and the role is assigned to any administrators → returns 409.
 * - System-generated roles cannot be deleted.
 *
 * Responses:
 * - `200` — Role soft-deleted or permanently deleted.
 * - `404` — Role not found.
 * - `403` — Attempt to delete a system-generated role.
 * - `400` — Role is associated with administrator(s) and cannot be deleted.
 * - `500` — Unexpected server error.
 *
 * @param request - The incoming HTTP request.
 * @param params - Route parameters containing the role ID.
 * @returns JSON response with either a success message or error details.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const id = (await params).id; // always defined when this route matches
	const { searchParams } = new URL(request.url);
	const force = searchParams.get('force') === 'true';

	try {
		const role = await prisma.role.findUnique({
			where: { id },
		});
		if (!role) return NextResponse.json({ error: 'Role to delete not found.' }, { status: 404 });
		if (role.isSystemGenerated) return NextResponse.json({ error: 'System-generated roles cannot be deleted.' }, { status: 403 });

		if (force) {
			const count = await prisma.administrator.count({ where: { roleId: id } });
			if (count > 0) {
				return NextResponse.json({ error: 'Role is assigned to administrator(s) and cannot be deleted.' }, { status: 400 });
			}
			// Delete all permission associations for this role
			await prisma.permissionRole.deleteMany({
				where: { roleId: id },
			});
			// Delete the role itself
			await prisma.role.delete({
				where: { id },
			});
			return NextResponse.json({ message: 'Role permanently deleted.' });
		}

		// Otherwise perform a soft delete
		const count = await prisma.administrator.count({
			where: { roleId: id, deletedAt: null },
		});
		if (count > 0) {
			return NextResponse.json({ error: "Cannot delete role linked to active administrators." }, { status: 400 });
		}
		const now = Math.floor(Date.now() / 1000);
		await prisma.role.update({
			where: { id },
			data: {
				deletedAt: now,
				updatedAt: now,
			}
		})
		return NextResponse.json({ message: 'Role deleted successfully.' });

	} catch (err) {
		console.error(`Error delete role by ID:`, err);
		return NextResponse.json({ error: 'Failed to delete role by ID: ' + (err as Error).message }, { status: 500 });
	}
}
