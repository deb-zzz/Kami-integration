import request from 'supertest';
import { app } from '../index';
import { redis } from '../config/redis';
import { prisma } from '../config/prisma';

// Mock fetch globally
global.fetch = jest.fn();

describe('OTP Endpoints', () => {
	const testEmail = 'test@example.com';
	const testOtp = '123456';

	beforeAll(async () => {
		// Mock fetch to return success for email service
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			status: 200,
		});

		// Ensure Redis is connected
		try {
			if (redis.status !== 'ready') {
				await redis.connect();
			}
		} catch (error) {
			// If already connected, ignore the error
			if (redis.status === 'ready') {
				// Already connected, continue
			} else {
				throw error;
			}
		}

		// Create a test blockchain record if it doesn't exist
		const testChainId = process.env.CHAIN_ID || '0x2105';
		try {
			await prisma.blockchain.upsert({
				where: { chainId: testChainId },
				update: {},
				create: {
					chainId: testChainId,
					name: 'Test Blockchain',
					rpcUrl: 'https://test-rpc.example.com',
					createdAt: Math.floor(Date.now() / 1000),
					updatedAt: Math.floor(Date.now() / 1000),
				},
			});
		} catch (error) {
			// Ignore if already exists or if using in-memory database
			console.log('Note: Could not create blockchain record (may be using in-memory DB):', error);
		}

		// Clean up any existing OTP keys before tests
		const keys = await redis.keys('otp:*');
		if (keys.length > 0) {
			await redis.del(...keys);
		}
	});

	afterAll(async () => {
		// Clean up Redis OTP keys after tests
		const keys = await redis.keys('otp:*');
		if (keys.length > 0) {
			await redis.del(...keys);
		}
		await prisma.$disconnect();
	});

	describe('POST /api/otp/generate', () => {
		it('should generate OTP for valid email', async () => {
			const response = await request(app).post('/api/otp/generate').send({ email: testEmail });

			expect(response.status).toBe(200);
			expect(response.body).toEqual({ success: true, message: 'OTP sent successfully' });
		});

		it('should reject invalid email', async () => {
			const response = await request(app).post('/api/otp/generate').send({ email: 'invalid-email' });

			expect(response.status).toBe(400);
			expect(response.body.errors).toBeDefined();
		});

		it('should reject missing email', async () => {
			const response = await request(app).post('/api/otp/generate').send({});

			expect(response.status).toBe(400);
			expect(response.body.errors).toBeDefined();
		});
	});

	describe('POST /api/otp/validate', () => {
		beforeEach(async () => {
			// Clean up any existing OTP for test email
			const key = `otp:${testEmail}`;
			await redis.del(key);

			// Insert a test OTP before each validation test
			// Set OTP with 10 minute expiry (600 seconds)
			await redis.set(key, testOtp, 'EX', 600);
		});

		it('should validate correct OTP', async () => {
			const response = await request(app).post('/api/otp/validate').send({ email: testEmail, otp: testOtp });

			expect(response.status).toBe(200);
			expect(response.body).toMatchObject({
				success: true,
				message: 'OTP validated successfully',
			});
			expect(response.body.walletAddress).toBeDefined();
		});

		it('should reject incorrect OTP', async () => {
			const response = await request(app).post('/api/otp/validate').send({ email: testEmail, otp: '000000' });

			expect(response.status).toBe(400);
			expect(response.body).toEqual({ success: false, error: 'Invalid or expired OTP' });
		});

		it('should reject invalid OTP format', async () => {
			const response = await request(app).post('/api/otp/validate').send({ email: testEmail, otp: '123' });

			expect(response.status).toBe(400);
			expect(response.body.errors).toBeDefined();
		});

		it('should reject missing OTP', async () => {
			const response = await request(app).post('/api/otp/validate').send({ email: testEmail });

			expect(response.status).toBe(400);
			expect(response.body.errors).toBeDefined();
		});
	});
});
