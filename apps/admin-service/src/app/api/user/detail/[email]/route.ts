import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * User Detail Retrieval API
 *
 * This API provides detailed information about a specific administrator user
 * in the KAMI platform. It retrieves comprehensive user profile data including
 * account status, timestamps, and role information.
 *
 * Features:
 * - Individual user profile retrieval
 * - Comprehensive user information including status and timestamps
 * - Input validation for email addresses
 * - Error handling for missing users and database operations
 *
 * @note This endpoint requires a valid email address to retrieve user details
 * @security Should be protected to prevent unauthorized access to user information
 */

/**
 * Response structure for user detail operations
 */
type UserResponse = {
	email: string; // User's email address (unique identifier)
	name?: string; // Optional display name for the user
	role: string; // Role ID assigned to the user
	createdAt: number; // Unix timestamp when the user was created
	updatedAt: number; // Unix timestamp when the user was last updated
	lockedAt: number | null; // Unix timestamp when the user account was locked (null if not locked)
	lastLoginAt: number | null; // Unix timestamp of the user's last login (null if never logged in)
	status: string; // Current status of the user account (active, blocked, deleted)
};

/**
 * GET /api/user/detail
 *
 * Retrieves detailed information about a specific administrator user
 * by their email address. This endpoint provides comprehensive user
 * profile data including account status, timestamps, and role information.
 *
 * @param {NextRequest} request - The incoming HTTP request
 * @returns {Promise<NextResponse<UserResponse | { error: string }>>} JSON response containing:
 *   - Success: Complete user profile information
 *   - Error 400: When email is missing from request
 *   - Error 500: When database operation fails or user not found
 *
 * @example
 * // Request body:
 * GET /api/user/detail/admin@kami.com
 *
 * // Success response:
 * {
 *   "email": "admin@kami.com",
 *   "name": "System Administrator",
 *   "role": "admin",
 *   "createdAt": 1703123456,
 *   "updatedAt": 1703123456,
 *   "lockedAt": null,
 *   "lastLoginAt": 1703123456,
 *   "status": "active"
 * }
 *
 * // Error response:
 * {
 *   "error": "Email is required"
 * }
 *
 * @note This endpoint expects the email in the request body (not as a query parameter)
 * @throws {Error} When user is not found in the database
 */
export async function GET(
	request: never,
	{ params }: { params: { email: string } }
): Promise<NextResponse<UserResponse | { error: string }>> {
	try {
		const { email } = params;
		// Validate that email is provided
		if (!email) {
			return NextResponse.json({ error: 'Email is required' }, { status: 400 });
		}
		// Retrieve user from database - throws error if user not found
		const user = await prisma.administrator.findUniqueOrThrow({
			where: {
				email: email, // Find user by email address
			},
		});

		// Transform database record to API response format
		return NextResponse.json({
			email: user.email,
			name: user.name ?? undefined, // Handle optional name field
			role: user.roleId, // Map roleId to role for consistency
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			lockedAt: user.lockedAt, // Account locking timestamp
			lastLoginAt: user.lastLoginAt, // Last login timestamp
			status: user.status, // Current account status
		});
	} catch (e) {
		// Handle database errors and user not found scenarios
		return NextResponse.json({ error: 'Failed to fetch users: ' + (e as Error).message }, { status: 500 });
	}
}
