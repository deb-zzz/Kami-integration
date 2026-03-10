import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import balancesRouter from './routes/balances';
import transferRouter from './routes/transfer';
import transactionsRouter from './routes/transactions';
import blockchainRouter from './routes/blockchain';
import schedulerRouter from './routes/scheduler';
import { generalRateLimit, securityHeaders, requestLogger, sanitizeInput, errorHandler } from './middleware/security';

// Load environment variables
dotenv.config();

const app: express.Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				scriptSrc: ["'self'"],
				imgSrc: ["'self'", 'data:', 'https:'],
			},
		},
	})
); // Security headers
app.use(securityHeaders); // Additional security headers
app.use(requestLogger); // Request logging
app.use(sanitizeInput); // Input sanitization

app.use(
	cors({
		origin: '*',
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
		credentials: false,
	})
); // Configured CORS

app.use(express.json({ limit: '1mb' })); // Parse JSON bodies with size limit
app.use(express.urlencoded({ extended: true, limit: '1mb' })); // Parse URL-encoded bodies

// Rate limiting
app.use(generalRateLimit as unknown as express.RequestHandler); // General rate limiting

// Health check endpoint
app.get('/health', (req, res) => {
	res.json({
		success: true,
		message: 'KAMI Wallet Service is running',
		timestamp: new Date().toISOString(),
		version: '1.0.0',
	});
});

// API Routes with specific rate limiting
app.use('/api/balances', balancesRouter);
app.use('/api/transfer', transferRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/blockchain', blockchainRouter);
app.use('/api/scheduler', schedulerRouter);

// Root endpoint
app.get('/', (req, res) => {
	res.json({
		success: true,
		message: 'KAMI Platform Wallet Service API',
		version: '1.0.0',
		endpoints: {
			health: '/health',
			balances: '/api/balances/:chainId?address=0x...',
			usdcInfo: '/api/balances/:chainId/usdc-info',
			blockchain: '/api/blockchain/:chainId',
			transfers: '/api/transfer/:chainId/usdc',
			gasEstimation: '/api/transfer/:chainId/estimate-gas',
			transaction: '/api/transactions/:chainId/transaction/:txHash',
			transactions: '/api/transactions/:chainId?walletAddress=0x...',
		},
	});
});

// 404 handler
app.use('*', (req, res) => {
	res.status(404).json({
		success: false,
		error: 'NOT_FOUND',
		message: `Route ${req.originalUrl} not found`,
	});
});

// Global error handler
app.use(errorHandler);

// Validate required environment variables
const requiredEnvVars = ['RPC_URL'];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
	console.error('Missing required environment variables:', missingEnvVars);
	console.error('Please check your .env file and ensure all required variables are set.');
	process.exit(1);
}

// Start server
app.listen(PORT, () => {
	console.log(`🚀 KAMI Wallet Service running on port ${PORT}`);
	console.log(`📊 Health check: http://localhost:${PORT}/health`);
	console.log(`💰 Balances API: http://localhost:${PORT}/api/balances`);
	console.log(`💸 Transfers API: http://localhost:${PORT}/api/transfer`);
	console.log(`💸 Transactions API: http://localhost:${PORT}/api/transactions`);
	console.log(`💸 Blockchain API: http://localhost:${PORT}/api/blockchain`);
	console.log(`💸 USDC Info API: http://localhost:${PORT}/api/balances/:chainId/usdc-info`);
	console.log(`💸 Transaction API: http://localhost:${PORT}/api/transactions/:chainId/transaction/:txHash`);
	console.log(`💸 Scheduler API: http://localhost:${PORT}/api/scheduler/balance-alert`);
	console.log(`🌐 RPC URL: ${process.env.RPC_URL}`);
});

export default app;
