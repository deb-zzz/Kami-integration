import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
	redis: Redis | undefined;
};

/**
 * Redis client singleton
 * Reuses existing connection in non-production environments
 */
export const redis: Redis =
	globalForRedis.redis ??
	new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
		retryStrategy: (times) => {
			const delay = Math.min(times * 50, 2000);
			return delay;
		},
		maxRetriesPerRequest: 3,
		lazyConnect: true,
	});

// Handle connection errors gracefully
redis.on('error', (error) => {
	console.error('Redis connection error:', error);
	// Don't crash the app if Redis is unavailable
});

redis.on('connect', () => {
	console.log('Redis connected successfully');
});

redis.on('close', () => {
	console.warn('Redis connection closed');
});

// In non-production environments, store the Redis instance in global object for reuse
if (process.env.NODE_ENV !== 'production') {
	globalForRedis.redis = redis;
}

// Ensure connection is established (but don't block if it fails)
if (!redis.status || redis.status === 'end') {
	redis.connect().catch((error) => {
		console.error('Failed to connect to Redis:', error);
		console.warn('Checkout async features may not work without Redis. Sync mode will still function.');
	});
}
