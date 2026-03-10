// app.ts
import express, { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { EncryptJWT, jwtDecrypt, base64url, compactDecrypt } from 'jose';

// Load environment variables
dotenv.config();

// Create Express Server
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

const dev_origins = process.env.CORS_ORIGIN_DEV ? process.env.CORS_ORIGIN_DEV.split(',') : [];
const prod_origins = process.env.CORS_ORIGIN_PROD ? process.env.CORS_ORIGIN_PROD.split(',') : [];
const origins = prod_origins;
origins.push(...dev_origins);
origins.push('http://localhost:3000', 'http://localhost:3001');

// Trust proxy
app.set('trust proxy', false);

// Middleware
app.use(helmet()); // Adds various HTTP headers for security
app.use(
	cors({
		origin: process.env.CORS_ORIGIN ? origins : '*',
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'Signature', 'Origin', 'X-Requested-With'],
		optionsSuccessStatus: 200,
		credentials: true, // Enable setting cookies from server to client
	}),
);

// Rate limiting
const limiter = rateLimit({
	windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
	max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Services configuration
const services = {
	'/auth-service': process.env.AUTH_SERVICE_URL as string,
	'/admin-service': process.env.ADMIN_SERVICE_URL as string,
	'/profile-service': process.env.PROFILE_SERVICE_URL as string,
	'/project-service': process.env.PROJECT_SERVICE_URL as string,
	'/tag-service': process.env.TAG_SERVICE_URL as string,
	'/post-service': process.env.POST_SERVICE_URL as string,
	'/feed-service': process.env.FEED_SERVICE_URL as string,
	'/social-service': process.env.SOCIAL_SERVICE_URL as string,
	'/collections-service': process.env.COLLECTION_SERVICE_URL as string,
	'/web3-service': process.env.WEB3_SERVICE_URL as string,
	'/media-service': process.env.S3MEDIA_SERVICE_URL as string,
	'/notifications-service': process.env.NOTIFICATIONS_SERVICE_URL as string,
	'/collaboration-service': process.env.COLLABORATION_SERVICE_URL as string,
	'/onboarding-service': process.env.ONBOARDING_SERVICE_URL as string,
	'/signin-service': process.env.SIGNIN_SERVICE_URL as string,
	'/ipfs-service': process.env.IPFS_SERVICE_URL as string,
	'/mailing-list-service': process.env.MAILING_LIST_SERVICE_URL as string,
	'/wallet-service': process.env.WALLET_SERVICE_URL as string,
	'/cart-service': process.env.CART_SERVICE_URL as string,
	'/referral-service': process.env.REFERRAL_SERVICE_URL as string,
	'/comm-service': process.env.COMM_SERVICE_URL as string,
	'/web3-funding-service': process.env.WEB3_FUNDING_SERVICE_URL as string,
	'/content-management-service': process.env.CONTENT_MANAGEMENT_SERVICE_URL as string,
};

// Proxy middleware configuration
const routerFunction = (req: Request): string => {
	// Use originalUrl to get the full path before any rewrites
	const path = (req as any).originalUrl || req.url || req.path || '';
	// Remove query string if present
	const pathWithoutQuery = path.split('?')[0];

	// Iterate through services to find matching prefix
	for (const [servicePath, serviceUrl] of Object.entries(services)) {
		if (pathWithoutQuery.startsWith(servicePath)) {
			console.log(`Router matched: ${pathWithoutQuery} -> ${serviceUrl}`);
			return serviceUrl;
		}
	}
	// Fallback to default target if no match
	console.log(`Router no match for: ${pathWithoutQuery}, using default target`);
	return 'http://localhost:3000';
};

const proxyOptions = {
	target: 'http://localhost:3000',
	router: routerFunction,
	pathRewrite: Object.fromEntries(Object.keys(services).map((key) => [`^${key}`, ''])),
	logger: console,
	changeOrigin: true,
	timeout: 30000,
	proxyTimeout: 30000,
	onError: (err: Error, req: Request, res: Response) => {
		console.error('Proxy Error:', err);
		console.error('Request URL:', req.url);
		console.error('Request Method:', req.method);
		console.error('Original URL:', (req as any).originalUrl);
		console.error('Request Path:', req.path);
		console.error('Request Headers:', req.headers);
		console.error('Request Body:', (req as any).sigBody);
		// Log what target was selected
		const target = routerFunction(req);
		console.error('Router selected target:', target);
		res.status(502).send(`Proxy Error: ${err.message}`);
	},
	onProxyReqError: (err: Error, req: Request, res: Response) => {
		console.error('Proxy Request Error:', err);
		res.status(502).send('Proxy Request Error');
	},
	onProxyResError: (err: Error, req: Request, res: Response) => {
		console.error('Proxy Response Error:', err);
		res.status(502).send('Proxy Response Error');
	},
};

function authMiddleware(req: Request, res: Response, next: NextFunction) {
	if (req.headers['issue']) {
		const payload = {
			sysid: 'kamiplatformv1',
		};
		const secret = base64url.decode(process.env.JWT_SECRET as string);
		new EncryptJWT(payload)
			.setProtectedHeader({ alg: 'dir', enc: 'A128CBC-HS256' })
			.setIssuedAt()
			.setIssuer('urn:KAMI-APIGW:issuer')
			.encrypt(Buffer.from(secret))
			.then((jwt) => {
				res.json(jwt);
			});
		return;
	}

	if (!req.headers.authorization) {
		console.log('No authorization header');
		res.status(401).send('Authorization Required');
		return;
	}
	if (req.method !== 'GET' && (req as any).sigBody && JSON.stringify((req as any).sigBody).length > 2 && !req.headers.signature) {
		console.log('No signature header');
		res.status(401).send('Signature Required');
		return;
	}

	// More explicit POST request handling
	if (req.method === 'POST') {
		if (shouldCheckSignature() && !req.headers.signature) {
			console.log('No signature header for POST request');
			res.status(401).send('Signature Required for POST requests');
			return;
		}
	}

	verifyAuth(req, (validAuth) => {
		const validSig = verifySignature(req);
		console.log(`ValidAuth: ${validAuth}, ValidSig: ${validSig}`);
		if (validAuth && validSig) {
			next();
		} else {
			res.status(401).send('Unauthorized');
		}
	});
}

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error(err.stack);
	res.status(500).send('Something broke!');
});

// Parse body
app.use(
	express.urlencoded({
		extended: false,
		verify: function (req, res, buf, encoding) {
			(req as any).sigBody = buf.toString(encoding as BufferEncoding);
		},
	}),
);

// Proxy middleware
app.use('/', authMiddleware, createProxyMiddleware(proxyOptions));

// Starting our Proxy server
app.listen(PORT, () => {
	console.log(`Starting Proxy at ${HOST}:${PORT}`);
});

function verifyAuth(req: Request, callback: (isValid: boolean) => void): void {
	const token: string | undefined = req.headers.authorization?.split(' ')[1];
	if (!token) {
		callback(false);
		return;
	}

	const secret = Buffer.from(process.env.JWT_SECRET as string, 'base64');

	jwtDecrypt(token, secret, {
		keyManagementAlgorithms: ['dir'],
		issuer: 'urn:KAMI-APIGW:issuer',
	})
		.then(({ payload }) => {
			callback(payload.sysid === 'kamiplatformv1');
		})
		.catch((err) => {
			console.log(`Invalid key: ${err.message}`);
			callback(false);
		});
}

function verifySignature(req: Request): boolean {
	// More explicit POST handling
	if (req.method === 'GET') return true;
	if (req.path.includes('/onboarding-service')) return true;

	const sig = req.headers.signature as string;
	if (!sig) return false;

	const body = (req as any).sigBody;
	if (!body || Object.keys(body).length === 0) return true;

	const message = JSON.stringify(body).replace(/\n|\s/g, '');
	if (message.length <= 2) return true;
	const token = process.env.JWT_SECRET as string;
	const crypto = require('crypto');
	const secret = token.slice(-10);
	const hmac = crypto.createHmac('sha256', secret);
	hmac.update(message);
	const signature = hmac.digest('hex');
	return shouldCheckSignature() ? signature === sig : true;
}

function shouldCheckSignature(): boolean {
	console.log('shouldCheckSignature:', process.env.CHECK_SIGNATURE === 'true');
	return process.env.CHECK_SIGNATURE === 'true';
}

async function verifyLogin(address: string): Promise<boolean> {
	try {
		const res = await fetch(`http://profile-service/api/${address}`);
		const data = await res.json();
		return data.status === 'success';
	} catch (err) {
		console.log(`Error verifying login: ${(err as Error).message}`);
		return false;
	}
}

// Add this logging to verify service URLs
console.log(
	'Service URLs:',
	Object.entries(services).map(([path, url]) => ({
		path,
		resolvedUrl: url,
	})),
);
