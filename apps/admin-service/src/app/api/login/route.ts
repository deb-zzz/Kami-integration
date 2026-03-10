import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { JWTService } from '@/lib/jwtService';
import { encodePassword } from '@/util/password-utils';
import { formatZodError } from '@/util/zod-error-utils';

/**
 * Authentication API
 *
 * This API provides secure user authentication for the KAMI platform.
 * It handles login requests, password validation, and JWT token generation.
 *
 * Features:
 * - Secure password validation
 * - Automatic admin user creation for first-time setup
 * - JWT token generation for authenticated sessions
 * - Support for both encoded and plain text passwords
 *
 * @security Implements secure password hashing and JWT token generation
 */

// Authentication error messages
const authError = { error: 'Invalid credentials' };
const authError2 = { error: 'Invalid credentials 2' };

/**
 * Zod schema for validating login requests.
 *
 * Validate:
 * - `email` — Must be a valid email format. Converted to lowercase automatically.
 * - `password` — Required and cannot be empty.
 * - `encoded` — Indicates whether the password is already encoded. Default to true.
 * - `reset` — Indicates if this login request is for a password reset. Defaults to false.
 */
const loginSchema = z.object({
	email: z.email('Invalid email format.').transform((val) => val.toLowerCase()),
	password: z.string('Required.').trim().min(1, 'Required.'),
	encoded: z.boolean().default(true),
	reset: z.boolean().default(false),
});

/**
 * POST /api/login
 *
 * Authenticates a user and generates a JWT token for session management.
 * This endpoint handles both existing users and automatic admin creation
 * for first-time platform setup.
 *
 * @param {NextRequest} request - The incoming HTTP request
 * @returns A `NextResponse` containing the JWT token for authenticated
 * session or an error message.
 *
 * ###### Request Body Example:
 * ```JSON
 * {
 *   "email": "admin@kami.com",
 *   "password": "securePassword123",
 *   "encoded": false
 * }
 * ```
 * ###### Response Codes:
 * - `200` — Login success with JWT token response.
 * - `400` — Validation failed.
 * - `401` — Authentication failed.
 * - `500` — Unexpected server error.
 *
 * ###### Response Success Example:
 * ```JSON
 * { "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * ```
 * @security Implements secure password validation and JWT token generation
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		const body = await request.json();
		const data = loginSchema.parse(body);
		const { email, encoded, reset } = data;
		let { password } = data;

		// Find existing user by email.
		let user = await prisma.administrator.findUnique({ where: { email } });

		if (!user) {
			//Check first-time setup: if admin user table empty - create initial admin.
			const users = await prisma.administrator.findMany();

			if (users.length === 0) {
				// First-time setup: create default admin user
				user = await prisma.administrator.create({
					data: {
						email: 'paul@kamiunlimited.com', // Default admin email
						passwordHash: await encodePassword('Simple-01'), // Default password
						name: 'Admin', // Default admin name
						roleId: 'admin', // Default admin role
						status: 'active', // Set as active
						createdAt: Math.floor(Date.now() / 1000), // Current timestamp
					},
				});
			} else {
				return NextResponse.json(authError, { status: 401 });
			}
		}

		// Don't allow locked/deleted/blocked user.
		if (user.status === 'locked') return NextResponse.json({ error: 'Account is locked.' }, { status: 401 });
		else if (user?.deletedAt || user?.status !== 'active') {
			return NextResponse.json({ error: 'Account is inactive or blocked.' }, { status: 401 });
		}

		const now = Math.floor(Date.now() / 1000);
		// Handle password encoding if needed.
		password = !encoded ? await encodePassword(password) : password;

		// Reset password while login.
		if (reset && !encoded) {
			// Reset the password
			await prisma.administrator.update({
				where: { email },
				data: {
					passwordHash: password,
					updatedAt: now,
				},
			});
		}

		// Validate user credentials.
		if (!user.passwordHash || user.passwordHash !== password) {
			// Increment failed login attempts and lock the account upon reach 3 times.
			const failedAttempts = (user.failedLoginAttempts || 0) + 1;
			const locked = failedAttempts >= 3;

			await prisma.administrator.update({
				where: { email },
				data: {
					failedLoginAttempts: failedAttempts,
					...(locked ? { status: 'locked', lockedAt: now } : {}),
					updatedAt: now,
				},
			});

			return NextResponse.json(authError2, { status: 401 });
		}

		// Successful login → reset failed attempts + update timestamps.
		const admin = await prisma.administrator.update({
			where: { email },
			data: {
				failedLoginAttempts: 0,
				lastLoginAt: now,
				updatedAt: now,
			},
			include: {
				role: {
					include: {
						permissionRoles: {
							select: { permissionId: true },
						},
					},
				},
			},
		});
		const permissions = admin.role.permissionRoles.map((p) => p.permissionId);

		// Generate JWT token for authenticated session.
		const token = await JWTService.generateToken(user.email, user.name ?? '', user.roleId);

		// Return the authentication token.
		return NextResponse.json({
			token,
			permissions,
		});
	} catch (err) {
		if (err instanceof z.ZodError) {
			return NextResponse.json({ error: 'Validation failed', fieldErrors: formatZodError(err) }, { status: 400 });
		}
		return NextResponse.json({ error: 'Failed to login: ' + (err as Error).message }, { status: 500 });
	}
}
