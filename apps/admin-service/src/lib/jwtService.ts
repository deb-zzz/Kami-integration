import * as jose from 'jose';
import { JWTSecretManager } from './jwtSecretManager';
import { prisma } from './db';

/**
 * JWT Service for Token Management
 *
 * This service provides comprehensive JWT token operations including generation,
 * verification, and extraction. It integrates with the JWTSecretManager for
 * secure secret handling and supports graceful secret rotation.
 *
 * Features:
 * - Secure token generation with configurable expiration
 * - Robust token verification with fallback to previous secrets
 * - Authorization header parsing
 * - Automatic secret rotation support
 */

interface JWTPayload {
	email: string;
	role: string;
	name?: string;
	// Add any other claims you want to include
	iat?: number;
	exp?: number;
}

export class JWTService {
	/**
	 * Generates a JWT token for a given wallet address
	 * @param walletAddress The wallet address to create a token for
	 * @param expiresIn Time until token expires in seconds. Default: 24 hours
	 * @returns The generated JWT token
	 */
	static async generateToken(email: string, name: string, role: string, expiresIn: number = 1 * 60 * 60): Promise<string> {
		const jwtConfig = await JWTSecretManager.getOrCreateSecret();
		const secret = new TextEncoder().encode(jwtConfig.secret);
		const alg = 'HS256';

		const jwt = await new jose.SignJWT({ email, name, role })
			.setProtectedHeader({ alg })
			.setIssuedAt()
			.setExpirationTime(`${expiresIn}s`)
			.sign(secret);

		return jwt;
	}

	/**
	 * Verifies a JWT token and returns the decoded payload
	 * @param token The JWT token to verify
	 * @returns The decoded token payload or null if invalid
	 */
	static async verifyToken(token: string): Promise<JWTPayload | null> {
		try {
			// Get the most recent secret
			const jwtConfig = await JWTSecretManager.getCurrentSecret();
			if (!jwtConfig) {
				throw new Error('No JWT secret configured');
			}

			const secret = new TextEncoder().encode(jwtConfig.secret);
			const { payload } = await jose.jwtVerify(token, secret);

			return payload as unknown as JWTPayload;
		} catch (e) {
			console.error((e as Error).cause);
			// If verification fails with the current secret, try checking if it's a token
			// from a recently rotated secret
			try {
				const oldConfigs = await prisma.jwtConfig.findMany({
					where: {
						updatedAt: { not: null },
					},
					orderBy: {
						updatedAt: 'desc',
					},
					take: 1,
				});

				if (oldConfigs.length > 0) {
					const oldSecret = new TextEncoder().encode(oldConfigs[0].secret);
					const { payload } = await jose.jwtVerify(token, oldSecret);
					return payload as unknown as JWTPayload;
				}
			} catch {
				// If all verification attempts fail, return null
				return null;
			}
		}
		return null;
	}

	/**
	 * Extracts the token from the Authorization header
	 * @param authHeader The Authorization header value
	 * @returns The token or null if not found/invalid
	 */
	static extractTokenFromHeader(authHeader?: string): string | null {
		if (!authHeader?.startsWith('Bearer ')) {
			return null;
		}
		return authHeader.split(' ')[1];
	}
}
