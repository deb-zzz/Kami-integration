import request from 'supertest';
import express, { Express } from 'express';
import contractRoutes from '../../src/routes/sigils';
import * as deploymentService from '../../src/services/deployment';
import * as contractService from '../../src/services/contract';

// Mock the network config to avoid requiring PRIVATE_KEY
jest.mock('../../src/config/network', () => ({
	publicClient: {},
	walletClient: {},
	contractAddress: undefined,
}));

// Mock the services
jest.mock('../../src/services/deployment');
jest.mock('../../src/services/contract');

describe('Contract API Routes', () => {
	let app: Express;

	beforeEach(() => {
		app = express();
		app.use(express.json());
		app.use('/contract', contractRoutes);
		jest.clearAllMocks();
	});

	describe('POST /contract/deploy', () => {
		it('should deploy a contract successfully', async () => {
			const mockAddress = '0x1234567890123456789012345678901234567890';
			(deploymentService.deployContract as jest.Mock).mockResolvedValue(mockAddress);

			const response = await request(app).post('/contract/deploy').send({ initialUri: 'https://example.com/metadata/' }).expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.address).toBe(mockAddress);
			expect(deploymentService.deployContract).toHaveBeenCalledWith('https://example.com/metadata/');
		});

		it('should return 400 if initialUri is missing', async () => {
			const response = await request(app).post('/contract/deploy').send({}).expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toContain('initialUri');
		});

		it('should return 500 on deployment failure', async () => {
			(deploymentService.deployContract as jest.Mock).mockRejectedValue(new Error('Deployment failed'));

			const response = await request(app).post('/contract/deploy').send({ initialUri: 'https://example.com/metadata/' }).expect(500);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toBe('Deployment failed');
		});
	});

	describe('GET /contract/uri/:tokenId', () => {
		it('should get URI for valid token ID', async () => {
			const mockUri = 'https://example.com/token/1';
			(contractService.getUri as jest.Mock).mockResolvedValue(mockUri);

			const response = await request(app).get('/contract/uri/1').expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.uri).toBe(mockUri);
			expect(contractService.getUri).toHaveBeenCalledWith(1n, undefined);
		});

		it('should return 400 for invalid token ID', async () => {
			const response = await request(app).get('/contract/uri/0').expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toContain('between 1 and 6');
		});

		it('should return 400 for token ID > 6', async () => {
			const response = await request(app).get('/contract/uri/7').expect(400);

			expect(response.body.success).toBe(false);
		});

		it('should handle contract address query parameter', async () => {
			const mockUri = 'https://example.com/token/2';
			const contractAddress = '0x1234567890123456789012345678901234567890';
			(contractService.getUri as jest.Mock).mockResolvedValue(mockUri);

			await request(app).get(`/contract/uri/2?contractAddress=${contractAddress}`).expect(200);

			expect(contractService.getUri).toHaveBeenCalledWith(2n, contractAddress);
		});
	});

	describe('POST /contract/set-token-uri', () => {
		it('should set token URI successfully', async () => {
			const mockTxHash = '0xabcdef1234567890';
			(contractService.setTokenURI as jest.Mock).mockResolvedValue(mockTxHash);

			const response = await request(app)
				.post('/contract/set-token-uri')
				.send({ tokenId: 1, newUri: 'https://example.com/new-uri' })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.txHash).toBe(mockTxHash);
			expect(contractService.setTokenURI).toHaveBeenCalledWith(1n, 'https://example.com/new-uri', undefined);
		});

		it('should return 400 for invalid token ID', async () => {
			const response = await request(app)
				.post('/contract/set-token-uri')
				.send({ tokenId: 0, newUri: 'https://example.com/new-uri' })
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it('should return 400 if newUri is missing', async () => {
			const response = await request(app).post('/contract/set-token-uri').send({ tokenId: 1 }).expect(400);

			expect(response.body.success).toBe(false);
		});
	});

	describe('POST /contract/mint', () => {
		it('should mint tokens successfully', async () => {
			const mockTxHash = '0xabcdef1234567890';
			const recipient = '0x1234567890123456789012345678901234567890';
			(contractService.mint as jest.Mock).mockResolvedValue(mockTxHash);

			const response = await request(app).post('/contract/mint').send({ tokenId: 1, amount: 10, recipient }).expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.txHash).toBe(mockTxHash);
			expect(contractService.mint).toHaveBeenCalledWith(1n, 10n, recipient, undefined);
		});

		it('should return 400 for invalid token ID', async () => {
			const recipient = '0x1234567890123456789012345678901234567890';
			const response = await request(app).post('/contract/mint').send({ tokenId: 7, amount: 10, recipient }).expect(400);

			expect(response.body.success).toBe(false);
		});

		it('should return 400 for invalid amount', async () => {
			const recipient = '0x1234567890123456789012345678901234567890';
			const response = await request(app).post('/contract/mint').send({ tokenId: 1, amount: 0, recipient }).expect(400);

			expect(response.body.success).toBe(false);
		});

		it('should return 400 for invalid recipient address', async () => {
			const response = await request(app)
				.post('/contract/mint')
				.send({ tokenId: 1, amount: 10, recipient: 'invalid-address' })
				.expect(400);

			expect(response.body.success).toBe(false);
		});
	});

	describe('GET /contract/total-supply/:tokenId', () => {
		it('should get total supply for valid token ID', async () => {
			const mockSupply = 100n;
			(contractService.getTotalSupply as jest.Mock).mockResolvedValue(mockSupply);

			const response = await request(app).get('/contract/total-supply/1').expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.totalSupply).toBe('100');
			expect(contractService.getTotalSupply).toHaveBeenCalledWith(1n, undefined);
		});

		it('should return 400 for invalid token ID', async () => {
			const response = await request(app).get('/contract/total-supply/0').expect(400);

			expect(response.body.success).toBe(false);
		});
	});

	describe('GET /contract/balance/:owner/:tokenId', () => {
		it('should get balance for valid owner and token ID', async () => {
			const owner = '0x1234567890123456789012345678901234567890';
			const mockBalance = 50n;
			(contractService.getBalance as jest.Mock).mockResolvedValue(mockBalance);

			const response = await request(app).get(`/contract/balance/${owner}/1`).expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.balance).toBe('50');
			expect(contractService.getBalance).toHaveBeenCalledWith(owner, 1n, undefined);
		});

		it('should return 400 for invalid owner address', async () => {
			const response = await request(app).get('/contract/balance/invalid-address/1').expect(400);

			expect(response.body.success).toBe(false);
		});

		it('should return 400 for invalid token ID', async () => {
			const owner = '0x1234567890123456789012345678901234567890';
			const response = await request(app).get(`/contract/balance/${owner}/7`).expect(400);

			expect(response.body.success).toBe(false);
		});
	});
});
