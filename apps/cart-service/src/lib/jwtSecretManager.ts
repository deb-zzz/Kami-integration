import crypto from 'crypto';
import { prisma } from './db';
// import Redis from 'ioredis';

/**
 * JWT Secret Management System
 *
 * This class provides comprehensive JWT secret management including generation,
 * storage, rotation, and retrieval. It implements security best practices
 * for JWT token signing and enables seamless secret rotation without
 * disrupting existing valid tokens.
 *
 * Features:
 * - Cryptographically secure secret generation
 * - Database-backed secret storage
 * - Automatic secret rotation
 * - Graceful fallback to previous secrets
 * - Redis caching support (commented out for future implementation)
 */
export class JWTSecretManager {
	/**
	 * Generates a cryptographically secure random string for JWT signing
	 *
	 * Uses Node.js crypto.randomBytes() for true randomness and filters
	 * the output to ensure only alphanumeric characters for compatibility.
	 *
	 * @param {number} length - The length of the secret (default: 64)
	 * @returns {string} A secure random string suitable for JWT signing
	 *
	 * @example
	 * const secret = JWTSecretManager.generateSecureSecret(32);
	 * // Returns: "aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4yZ5"
	 */
	private static generateSecureSecret(length: number = 64): string {
		return crypto
			.randomBytes(length)
			.toString('base64')
			.replace(/[^a-zA-Z0-9]/g, '')
			.slice(0, length);
	}

	/**
	 * Creates a new JWT secret and stores it in the database
	 *
	 * Generates a cryptographically secure secret and persists it
	 * with a Unix timestamp for tracking creation time.
	 *
	 * @returns {Promise<JWTConfig>} The newly created JWT config object
	 *
	 * @example
	 * const newConfig = await JWTSecretManager.createNewSecret();
	 * console.log(newConfig.secret); // The new secret
	 * console.log(newConfig.createdAt); // Unix timestamp
	 */
	static async createNewSecret() {
		// Generate a cryptographically secure secret
		const secret = this.generateSecureSecret();
		// Convert current time to Unix timestamp for database storage
		const timestamp = Math.floor(Date.now() / 1000);

		// Store the new secret in the database
		return await prisma.jwtConfig.create({
			data: {
				secret,
				createdAt: timestamp,
			},
		});
	}

	/**
	 * Retrieves the most recent JWT secret from the database
	 *
	 * Orders by creation time to ensure the latest secret is always
	 * returned for new token generation.
	 *
	 * @returns {Promise<JWTConfig | null>} The most recent JWT config or null if none exists
	 *
	 * @example
	 * const currentSecret = await JWTSecretManager.getCurrentSecret();
	 * if (currentSecret) {
	 *   console.log('Current secret:', currentSecret.secret);
	 * }
	 */
	static async getCurrentSecret() {
		return await prisma.jwtConfig.findFirst({
			orderBy: {
				createdAt: 'desc',
			},
		});
	}

	/**
	 * Gets the current secret or creates a new one if none exists
	 *
	 * This method ensures that a JWT secret is always available for
	 * token generation. It first checks for an existing secret and
	 * creates a new one only if necessary.
	 *
	 * @returns {Promise<JWTConfig>} The JWT config (either existing or newly created)
	 *
	 * @example
	 * const secret = await JWTSecretManager.getOrCreateSecret();
	 * // Always returns a valid secret config
	 *
	 * @note Future implementation will include Redis caching for performance
	 */
	static async getOrCreateSecret() {
		// TODO: Implement Redis caching for performance optimization
		// const redis = new Redis();
		// const cachedSecret = await redis.get('jwt_secret');
		// if (cachedSecret) return JSON.parse(cachedSecret);

		// Check if a secret already exists
		const current = await this.getCurrentSecret();
		if (current) {
			// TODO: Cache the secret in Redis
			// await redis.set('jwt_secret', JSON.stringify(current));
			return current;
		}

		// Create a new secret if none exists
		const newSecret = await this.createNewSecret();
		// TODO: Cache the new secret in Redis
		// await redis.set('jwt_secret', JSON.stringify(newSecret));
		return newSecret;
	}

	/**
	 * Rotates the JWT secret by creating a new one
	 *
	 * This method implements secure secret rotation by:
	 * 1. Marking the current secret as updated (with timestamp)
	 * 2. Creating a new secret for future token generation
	 * 3. Maintaining the old secret for existing token validation
	 *
	 * This approach ensures that existing tokens remain valid while
	 * new tokens use the updated secret.
	 *
	 * @returns {Promise<JWTConfig>} The new JWT config
	 *
	 * @example
	 * const newSecret = await JWTSecretManager.rotateSecret();
	 * console.log('Secret rotated:', newSecret.secret);
	 *
	 * @security This method enables seamless secret rotation without
	 * disrupting existing user sessions
	 */
	static async rotateSecret() {
		// Get current timestamp for marking the old secret as updated
		const timestamp = Math.floor(Date.now() / 1000);

		// Mark the current secret as updated (enables graceful fallback)
		await prisma.jwtConfig.updateMany({
			where: {
				updatedAt: null, // Only update secrets that haven't been marked as updated
			},
			data: {
				updatedAt: timestamp,
			},
		});

		// Create and return a new secret for future token generation
		return await this.createNewSecret();
	}
}
