import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * GET /api/permissions
 *
 * Fetches all modules with their associated permissions, sorted by module and permission order.
 *
 * ###### Response JSON structure:
 * ```ts
 * [
 *   {
 *     id: string,        // Module ID
 *     name: string,      // Module name
 *     sortOrder: number, // Module sort order
 *     permissions: [
 *       {
 *         id: string,       // Permission ID
 *         name: string,     // Permission name
 *         description: string | null, // Optional description
 *         sortOrder: number // Permission sort order
 *       },
 *       // More permissions ...
 *     ]
 *   },
 *   // More modules ...
 * ]
 *```
 * Behavior:
 * - Returns all modules and their permissions.
 * - Permissions are grouped by module and sorted by `sortOrder`.
 * - On any database error, returns 500 with an error message.
 *
 * @returns JSON array of modules with nested permissions.
 */
export async function GET() {
	try {
		// Fetch all permissions with their associated module and role relationships
		const modules = await prisma.module.findMany({
			orderBy: { sortOrder: "asc" },
			include: {
				permissions: {
					orderBy: { sortOrder: "asc" },
					select: {
						id: true,
						name: true,
						description: true,
						sortOrder: true,
					},
				},
			},
		});
		const response = modules.map(m => ({
			id: m.id,
			name: m.name,
			sortOrder: m.sortOrder,
			permissions: m.permissions,
		}));

		// Return the permissions with full relationship data
		return NextResponse.json(response);

	} catch (err) {
		// Handle database errors gracefully
		console.error(`Error fetching permissions:`, err);
		return NextResponse.json({ error: 'Failed to fetch permissions: ' + (err as Error).message }, { status: 500 });
	}
}
