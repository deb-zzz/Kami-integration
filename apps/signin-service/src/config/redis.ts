import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Determine Redis URL based on environment
// Docker network: redis://redis:6379
// Local development: redis://localhost:6379
// Or use REDIS_URL environment variable
const getRedisUrl = (): string => {
	if (process.env.REDIS_URL) {
		return process.env.REDIS_URL;
	}
	// Default to localhost for local dev, redis hostname for Docker
	const host = process.env.NODE_ENV === 'production' ? 'redis' : 'localhost';
	return `redis://${host}:6379`;
};

// Create Redis client
export const redis = new Redis(getRedisUrl(), {
	retryStrategy: (times) => {
		const delay = Math.min(times * 50, 2000);
		// In development, allow more retries; in production, fail faster
		if (process.env.NODE_ENV === 'production' && times > 10) {
			logger.error('Redis connection failed after 10 retries');
			return null; // Stop retrying
		}
		return delay;
	},
	maxRetriesPerRequest: 3,
	lazyConnect: true,
	enableReadyCheck: true,
	enableOfflineQueue: false, // Don't queue commands when offline
});

// Handle connection events
redis.on('connect', () => {
	logger.info('Redis client connecting...');
});

redis.on('ready', () => {
	logger.info('Redis client connected and ready');
});

redis.on('error', (err) => {
	logger.error('Redis client error:', err);
});

redis.on('close', () => {
	logger.warn('Redis client connection closed');
});

redis.on('reconnecting', () => {
	logger.info('Redis client reconnecting...');
});

// Initialize Redis connection
export const initializeRedis = async (): Promise<void> => {
		try {
		// Set a timeout for initial connection attempt (3 seconds)
		// This prevents hanging if Redis is not available
		const connectionPromise = redis.connect();
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Redis connection timeout after 3 seconds')), 3000)
		);

		await Promise.race([connectionPromise, timeoutPromise]);

		// Test connection with a ping
		const pong = await redis.ping();
		if (pong === 'PONG') {
			logger.info('Redis connection verified successfully');
		} else {
			throw new Error('Redis ping failed');
		}
	} catch (error) {
		// In development, log warning but don't fail
		// In production, Redis is required
		if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
			logger.warn(
				'Redis connection failed. The app will continue but OTP functionality will not work until Redis is available.',
				{ error: error instanceof Error ? error.message : String(error) }
			);
			logger.warn('To start Redis locally, run: redis-server or docker run -p 6379:6379 redis');
			// Don't throw - let the app start
			return;
		} else {
			// In production, Redis is required
			logger.error('Failed to connect to Redis:', error);
			throw error;
		}
	}
};

// Close Redis connection gracefully
export const closeRedis = async (): Promise<void> => {
	try {
		await redis.quit();
		logger.info('Redis connection closed gracefully');
	} catch (error) {
		logger.error('Error closing Redis connection:', error);
		// Force disconnect if quit fails
		redis.disconnect();
	}
};
