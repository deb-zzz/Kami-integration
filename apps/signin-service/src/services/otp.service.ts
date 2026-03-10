import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { prisma } from '../config/prisma';

export class OtpService {
	prisma = prisma;

	async generateOtp(email: string): Promise<void> {
		// check the email is is whitelisted
		const isWhitelisted = await this.isEmailWhitelisted(email);
		if (!isWhitelisted) {
			throw new Error('Email is not whitelisted');
		}

		const otp = this.generateRandomOtp();
		const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);
		const expirySeconds = expiryMinutes * 60;

		try {
			// Check if Redis is connected and ready
			if (redis.status !== 'ready' && redis.status !== 'connect') {
				logger.error('Redis is not connected. Cannot generate OTP.', { redisStatus: redis.status });
				throw new Error('Redis connection not available. Please ensure Redis is running.');
			}

			// Store OTP in Redis with TTL
			// Key pattern: otp:{email}
			// Value: OTP code
			// TTL: expiry time in seconds
			// Using SET with EX option replaces any existing OTP for this email atomically
			const key = `otp:${email}`;
			await redis.set(key, otp, 'EX', expirySeconds);

			logger.info('OTP generated and stored in Redis', { 
				email, 
				key,
				otp, // Log OTP for development/testing purposes
				expiryMinutes,
			});

			// Send email with OTP (non-blocking - don't fail OTP generation if email fails)
			// The OTP is already stored in Redis, so we can attempt email delivery asynchronously
			const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://comm-service:3000/api/email/OTP';
			
			fetch(emailServiceUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email,
					otp,
					otpExpiryMinutes: expiryMinutes,
				}),
			})
				.then((response) => {
					if (!response.ok) {
						logger.warn('Email service returned non-OK status', {
							status: response.status,
							email,
						});
					} else {
						logger.debug('OTP email sent successfully', { email });
					}
				})
				.catch((emailError) => {
					// Log email error but don't fail OTP generation
					// The OTP is already stored in Redis and can be validated
					logger.warn('Failed to send OTP email (OTP still generated and stored)', {
						error: emailError instanceof Error ? emailError.message : String(emailError),
						email,
						emailServiceUrl,
						note: 'OTP is stored in Redis and can still be validated',
					});
				});
		} catch (error) {
			logger.error('Error generating OTP:', {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				email,
			});
			// Re-throw specific errors, wrap others
			if (error instanceof Error && error.message.includes('not whitelisted')) {
				throw error;
			}
			if (error instanceof Error && error.message.includes('Redis')) {
				throw error;
			}
			throw new Error(`Failed to generate OTP: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async validateOtp(email: string, otp: string): Promise<boolean> {
		try {
			// Check if Redis is connected and ready
			if (redis.status !== 'ready' && redis.status !== 'connect') {
				logger.error('Redis is not connected. Cannot validate OTP.', { redisStatus: redis.status });
				throw new Error('Redis connection not available. Please ensure Redis is running.');
			}

			const key = `otp:${email}`;

			// Atomic operation: Get and delete the OTP in one operation
			// This prevents race conditions where multiple requests could validate the same OTP
			// Using Lua script for atomicity (works with all Redis versions)
			const luaScript = `
				local key = KEYS[1]
				local expectedOtp = ARGV[1]
				local storedOtp = redis.call('GET', key)
				if storedOtp == expectedOtp then
					redis.call('DEL', key)
					return 1
				else
					return 0
				end
			`;

			const result = await redis.eval(luaScript, 1, key, otp);

			if (result === 1) {
				logger.debug('OTP validated successfully', { email });
				return true;
			} else {
				logger.debug('OTP validation failed: Invalid or expired OTP', { email });
				return false;
			}
		} catch (error) {
			logger.error('Error validating OTP:', {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				email,
			});
			throw error;
		}
	}

	async isEmailWhitelisted(email: string): Promise<boolean> {
		try {
			// Use $queryRaw to avoid Prisma's automatic parameter setting that causes issues with connection poolers
			// This is a workaround for the "unsupported startup parameter: search_path" error
			const result = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
				SELECT COUNT(*) as count FROM whitelist
			`;
			const totalCount = Number(result[0]?.count || 0);
			
			if (totalCount === 0) {
				return true;
			}

			const whitelist = await this.prisma.whitelist.findUnique({
				where: {
					email: email,
				},
			});
			return whitelist !== null;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('Error checking if email is whitelisted:', {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				email,
			});
			
			// Check if it's the search_path error specifically
			if (errorMessage.includes('search_path') || errorMessage.includes('startup parameter')) {
				logger.warn('PostgreSQL connection pooler detected - using fallback whitelist check', { email });
				// Try a simpler query that doesn't trigger parameter issues
				try {
					const whitelist = await this.prisma.whitelist.findUnique({
						where: { email: email },
					});
					return whitelist !== null;
				} catch (fallbackError) {
					logger.error('Fallback whitelist check also failed', { error: fallbackError });
				}
			}
			
			// If database connection fails, allow the request to proceed in development
			// This prevents OTP generation from failing due to database issues
			if (process.env.NODE_ENV === 'production') {
				// In production, fail closed - don't allow if we can't verify
				throw new Error('Database connection error: Unable to verify email whitelist status');
			}
			// In development, fail open - allow requests if database is unavailable
			logger.warn('Database unavailable for whitelist check, allowing request in development mode', { email });
			return true;
		}
	}

	private generateRandomOtp(): string {
		return Math.floor(100000 + Math.random() * 900000).toString();
	}
}
