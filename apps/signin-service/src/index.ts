import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { otpRoutes } from './routes/otp.routes';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';
import { initializeRedis, closeRedis } from './config/redis';
import { disconnectPrisma } from './config/prisma';

// Load environment variables
dotenv.config();

export const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize Redis connection
initializeRedis()
	.then(() => {
		logger.info('Redis initialization completed');
	})
	.catch((error) => {
		// Only exit in production if Redis is required
		if (process.env.NODE_ENV === 'production') {
			logger.error('Failed to initialize Redis in production. Exiting.', error);
			process.exit(1);
		} else {
			logger.warn('Redis initialization failed in development. App will continue but OTP features may not work.', error);
		}
	});

// Routes
app.use('/api/otp', otpRoutes);

// Error handling
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
	const server = app.listen(port, () => {
		logger.info(`Server is running on port ${port}`);
	});

	// Graceful shutdown handler for the HTTP server
	const gracefulShutdown = async (signal: string) => {
		logger.info(`${signal} received. Shutting down HTTP server...`);
		
		server.close(async () => {
			logger.info('HTTP server closed');
			
			// Close database connections
			await Promise.all([
				closeRedis(),
				disconnectPrisma(),
			]);
			
			logger.info('All connections closed. Exiting...');
			process.exit(0);
		});

		// Force close after 10 seconds
		setTimeout(() => {
			logger.error('Forcing shutdown after timeout');
			process.exit(1);
		}, 10000);
	};

	process.on('SIGINT', () => gracefulShutdown('SIGINT'));
	process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
