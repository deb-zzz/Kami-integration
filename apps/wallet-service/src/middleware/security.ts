import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Rate limiting configuration
export const createRateLimit = (windowMs: number, max: number, message: string) => {
	return rateLimit({
		windowMs,
		max,
		message: {
			success: false,
			error: 'RATE_LIMIT_EXCEEDED',
			message,
		},
		standardHeaders: true,
		legacyHeaders: false,
		handler: ((req: Request, res: Response) => {
			console.warn('Rate limit exceeded:', {
				ip: req.ip,
				userAgent: req.get('User-Agent'),
				path: req.path,
				timestamp: new Date().toISOString(),
			});
			res.status(429).json({
				success: false,
				error: 'RATE_LIMIT_EXCEEDED',
				message,
			});
		}) as any,
	});
};

// General API rate limiting
export const generalRateLimit = createRateLimit(
	15 * 60 * 1000, // 15 minutes
	100 * 15, // 100 requests per minute
	'Too many requests. Please try again later.'
);

// Health check rate limiting (less restrictive)
export const healthCheckRateLimit = createRateLimit(
	60 * 1000, // 1 minute
	30, // 30 requests per minute
	'Too many health check requests. Please try again later.'
);

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
	// Set security headers
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('X-Frame-Options', 'DENY');
	res.setHeader('X-XSS-Protection', '1; mode=block');
	res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
	res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

	// Remove X-Powered-By header
	res.removeHeader('X-Powered-By');

	next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
	const startTime = Date.now();
	const originalSend = res.send;

	res.send = function (data) {
		const duration = Date.now() - startTime;
		console.log('API Request:', {
			method: req.method,
			path: req.path,
			ip: req.ip,
			userAgent: req.get('User-Agent'),
			statusCode: res.statusCode,
			duration: `${duration}ms`,
			timestamp: new Date().toISOString(),
		});

		return originalSend.call(this, data);
	};

	next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
	// Sanitize string inputs
	const sanitizeString = (str: string): string => {
		return str
			.replace(/[<>]/g, '') // Remove potential HTML tags
			.trim()
			.substring(0, 1000); // Limit length
	};

	// Recursively sanitize object
	const sanitizeObject = (obj: any): any => {
		if (typeof obj === 'string') {
			return sanitizeString(obj);
		}
		if (Array.isArray(obj)) {
			return obj.map(sanitizeObject);
		}
		if (obj && typeof obj === 'object') {
			const sanitized: any = {};
			for (const key in obj) {
				if (obj.hasOwnProperty(key)) {
					sanitized[key] = sanitizeObject(obj[key]);
				}
			}
			return sanitized;
		}
		return obj;
	};

	// Sanitize request body
	if (req.body) {
		req.body = sanitizeObject(req.body);
	}

	// Sanitize query parameters
	if (req.query) {
		req.query = sanitizeObject(req.query);
	}

	next();
};

// Error handling middleware
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error('Unhandled error:', {
		error: err.message,
		stack: err.stack,
		path: req.path,
		method: req.method,
		ip: req.ip,
		timestamp: new Date().toISOString(),
	});

	// Don't leak error details in production
	const isDevelopment = process.env.NODE_ENV === 'development';

	res.status(500).json({
		success: false,
		error: 'INTERNAL_SERVER_ERROR',
		message: isDevelopment ? err.message : 'An internal server error occurred',
		...(isDevelopment && { stack: err.stack }),
	});
};
