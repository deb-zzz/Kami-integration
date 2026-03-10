import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
// Redis URL for tests - defaults to localhost, can be overridden via REDIS_URL env var
// For tests, you can use a test Redis instance or mock Redis
if (!process.env.REDIS_URL) {
	process.env.REDIS_URL = 'redis://localhost:6379';
}
