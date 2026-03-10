import { ethers, Log, TransactionReceipt } from 'ethers';
import { ListingPaginationQueryParams, TransactionDetails, TransferRequest, TransferResponse, WalletBalance } from '../types';
import { PrismaClient, Prisma, Web3TransactionType } from '@prisma/client';
import { Blockchain } from '../routes/blockchain';
import { isoToUnixMilliseconds } from '../utils/common';
import { EthereumAccountService } from '../lib/EthereumAccountService';
import axios from 'axios';

export class WalletService {
	private chainId: string;
	private provider: ethers.JsonRpcProvider;
	private usdcContract: ethers.Contract;
	private static prisma = new PrismaClient();

	// USDC Contract ABI (minimal for balance and transfer)
	private static readonly USDC_ABI = [
		'function balanceOf(address owner) view returns (uint256)',
		'function transfer(address to, uint256 amount) returns (bool)',
		'function decimals() view returns (uint8)',
		'function symbol() view returns (string)',
	] as const;

	// USDC Contract Address (Mainnet)
	private static readonly USDC_CONTRACT_ADDRESS = process.env.USDC_CONTRACT_ADDRESS ?? '';

	/**
	 * Get blockchain information by chain ID from the database
	 * @param {string} chainId - The blockchain chain ID (e.g., "0x14a34" for Base Sepolia)
	 * @returns {Promise<Blockchain | null>} Blockchain object with payment tokens, or null if not found
	 * @example
	 * const blockchain = await WalletService.getBlockchain("0x14a34");
	 * if (blockchain) {
	 *   console.log(blockchain.name); // "Base Sepolia"
	 *   console.log(blockchain.paymentTokens); // Array of payment tokens
	 * }
	 */
	public static async getBlockchain(chainId: string): Promise<Blockchain | null> {
		return WalletService.prisma.blockchain.findUnique({
			where: {
				chainId: chainId,
			},
			include: {
				paymentTokens: true,
			},
		});
	}

	/**
	 * Get all blockchain configurations from the database
	 * @returns {Promise<Blockchain[] | null>} Array of blockchain objects with payment tokens, or null if none found
	 * @example
	 * const blockchains = await WalletService.getBlockchainList();
	 * blockchains?.forEach(chain => {
	 *   console.log(`${chain.name} (${chain.chainId})`);
	 * });
	 */
	public static async getBlockchainList(): Promise<Blockchain[] | null> {
		return WalletService.prisma.blockchain.findMany({
			include: { paymentTokens: true },
		});
	}

	/**
	 * Get private key for a wallet address on a specific chain from the database
	 * @param {string} chainId - The blockchain chain ID
	 * @param {string} walletAddress - The wallet address to get the private key for
	 * @returns {Promise<string | undefined>} The private key string, or undefined if not found
	 * @example
	 * const privateKey = await WalletService.getPrivateKey("0x14a34", "0x...");
	 * if (privateKey) {
	 *   // Use private key for signing transactions
	 * }
	 */
	public static async getPrivateKey(chainId: string, walletAddress: string) {
		const privateKey = await this.getPrivateKeyForWalletAddress(walletAddress);
		if (!privateKey) throw new Error(`Private key not found for wallet address ${walletAddress}`);
		return privateKey;
	}

	constructor(chainId: string, rpcUrl: string, usdcContractAddress?: string) {
		this.chainId = chainId;
		this.provider = new ethers.JsonRpcProvider(rpcUrl);
		const contractAddress = usdcContractAddress || WalletService.USDC_CONTRACT_ADDRESS;
		this.usdcContract = new ethers.Contract(contractAddress, WalletService.USDC_ABI, this.provider);
	}

	/**
	 * Get wallet balances for ETH and USDC tokens
	 * @param {string} address - Ethereum wallet address (must be valid 0x format)
	 * @returns {Promise<WalletBalance>} Object containing ETH and USDC balances in both raw and formatted formats
	 * @throws {Error} Throws error if address is invalid or balance fetch fails
	 * @example
	 * const balances = await walletService.getWalletBalances("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
	 * console.log(balances.ethBalanceFormatted); // "5.445442084146222187"
	 * console.log(balances.usdcBalanceFormatted); // "140.649632"
	 *
	 * @returns {Promise<WalletBalance>} WalletBalance object with:
	 * - address: string - The wallet address
	 * - ethBalance: string - ETH balance in Wei (raw format)
	 * - usdcBalance: string - USDC balance in smallest unit (raw format)
	 * - ethBalanceFormatted: string - ETH balance formatted as Ether
	 * - usdcBalanceFormatted: string - USDC balance formatted with decimals
	 */
	async getWalletBalances(address: string): Promise<WalletBalance> {
		try {
			// Validate address
			if (!ethers.isAddress(address)) {
				throw new Error('Invalid wallet address');
			}

			// Get ETH balance
			const ethBalanceWei = await this.provider.getBalance(address);
			const ethBalanceEther = ethers.formatEther(ethBalanceWei);

			// Get USDC balance
			const usdcBalanceRaw = await this.usdcContract.balanceOf(address);
			const usdcDecimals = await this.usdcContract.decimals();
			const usdcBalance = ethers.formatUnits(usdcBalanceRaw, usdcDecimals);

			return {
				address,
				ethBalance: ethBalanceWei.toString(),
				usdcBalance: usdcBalanceRaw.toString(),
				ethBalanceFormatted: ethBalanceEther,
				usdcBalanceFormatted: usdcBalance,
			};
		} catch (error) {
			throw new Error(`Failed to get wallet balances: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Transfer USDC tokens from one wallet to another
	 * @param {TransferRequest} transferRequest - Transfer request object containing:
	 *   - fromAddress: string - Sender wallet address (must be valid 0x format)
	 *   - toAddress: string - Recipient wallet address (must be valid 0x format)
	 *   - amount: string - Amount to transfer as a decimal string (e.g., "100.0")
	 *   - privateKey: string - Private key of the sender wallet for signing the transaction
	 * @returns {Promise<TransferResponse>} Response object with:
	 *   - success: boolean - Whether the transfer was successful
	 *   - transactionHash?: string - Transaction hash if successful
	 *   - error?: string - Error message if transfer failed
	 * @throws {Error} Throws error for invalid addresses, insufficient balance, or transaction failures
	 * @example
	 * const result = await walletService.transferUSDC({
	 *   fromAddress: "0x...",
	 *   toAddress: "0x...",
	 *   amount: "100.0",
	 *   privateKey: "0x..."
	 * });
	 * if (result.success) {
	 *   console.log("Transaction hash:", result.transactionHash);
	 * }
	 */
	async transferUSDC(transferRequest: TransferRequest): Promise<TransferResponse> {
		try {
			// Validate addresses
			if (!ethers.isAddress(transferRequest.fromAddress)) {
				throw new Error('Invalid from address');
			}
			if (!ethers.isAddress(transferRequest.toAddress)) {
				throw new Error('Invalid to address');
			}

			// Validate amount
			const amount = parseFloat(transferRequest.amount);
			if (isNaN(amount) || amount <= 0) {
				throw new Error('Invalid amount');
			}

			// Validate private key
			if (!transferRequest.privateKey) {
				throw new Error('Private key is required');
			}

			// Create wallet from private key
			const wallet = new ethers.Wallet(transferRequest.privateKey, this.provider);

			// Connect the contract to the wallet for signing
			const usdcContractWithSigner = this.usdcContract.connect(wallet);

			// Get USDC decimals
			const decimals = await this.usdcContract.decimals();

			// Convert amount to proper units
			const amountInUnits = ethers.parseUnits(transferRequest.amount, decimals);

			// Check if wallet has enough USDC balance
			const balance = await this.usdcContract.balanceOf(transferRequest.fromAddress);
			if (balance < amountInUnits) {
				throw new Error('Insufficient USDC balance');
			}

			// Estimate gas for the transaction
			const gasEstimate = await (usdcContractWithSigner as any).transfer.estimateGas(transferRequest.toAddress, amountInUnits);

			// Execute the transfer
			const tx = await (usdcContractWithSigner as any).transfer(transferRequest.toAddress, amountInUnits, {
				gasLimit: (gasEstimate * 120n) / 100n, // Add 20% buffer
			});

			// Wait for transaction confirmation
			const receipt = await tx.wait();

			return {
				success: true,
				transactionHash: receipt?.hash,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Sponsored transfer payment token via the web3-service
	 * @param {TransferRequest} transferRequest - Transfer request object containing:
	 *   - fromAddress: string - Sender wallet address (must be valid 0x format)
	 *   - toAddress: string - Recipient wallet address (must be valid 0x format)
	 *   - amount: string - Amount to transfer as a decimal string (e.g., "100.0")
	 *   - privateKey: string - Private key of the sender wallet for signing the transaction
	 * @returns {Promise<TransferResponse>} Response object with:
	 */
	async sponsoredTransferPaymentToken(transferRequest: TransferRequest): Promise<TransferResponse> {
		// Validate input addresses
		if (!ethers.isAddress(transferRequest.fromAddress)) {
			return {
				success: false,
				error: 'Invalid from address',
			};
		}
		if (!ethers.isAddress(transferRequest.toAddress)) {
			return {
				success: false,
				error: 'Invalid to address',
			};
		}

		// Validate input amount
		const amount = parseFloat(transferRequest.amount);
		if (isNaN(amount) || amount <= 0) {
			return {
				success: false,
				error: 'Invalid amount',
			};
		}

		// Prepare payload (web3 service expects tokenSymbol, not paymentToken)
		const payload = {
			fromWalletAddress: transferRequest.fromAddress,
			toWalletAddress: transferRequest.toAddress,
			amount: transferRequest.amount,
			tokenSymbol: transferRequest.paymentToken ?? 'USDC',
			chainId: this.chainId,
		};

		const web3ServiceUrl = process.env.WEB3_SERVICE_URL;
		if (!web3ServiceUrl) {
			return {
				success: false,
				error: 'WEB3_SERVICE_URL is not set',
			};
		}

		try {
			const response = await axios.post(`${web3ServiceUrl}/api/transfer`, payload, {
				timeout: 90000, // 90s - web3 service maxDuration; transfers can include on-chain confirmation
				headers: { 'Content-Type': 'application/json' },
				validateStatus: (status) => status >= 200 && status < 300,
			});
			return {
				success: true,
				transactionHash: response.data.transactionHash,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Get detailed transaction information from the blockchain
	 * @param {string} txHash - Transaction hash (must be valid 0x format, 64 hex characters)
	 * @returns {Promise<TransactionDetails>} Detailed transaction information including:
	 *   - hash: string - Transaction hash
	 *   - from: string - Sender address
	 *   - to: string - Recipient address (empty string for contract creation)
	 *   - value: string - Transaction value in Wei (raw format)
	 *   - valueFormatted: string - Transaction value formatted as Ether
	 *   - gasLimit: string - Gas limit for the transaction
	 *   - gasPrice: string - Gas price in Wei
	 *   - gasUsed?: string - Actual gas used (from receipt)
	 *   - blockNumber?: number - Block number where transaction was included
	 *   - blockHash?: string - Hash of the block
	 *   - transactionIndex?: number - Transaction index in the block
	 *   - status?: number - Transaction status (1 = success, 0 = failure)
	 *   - nonce: number - Transaction nonce
	 *   - data: string - Transaction data (hex string)
	 * @throws {Error} Throws error if transaction not found or fetch fails
	 * @example
	 * const txDetails = await walletService.getTransactionDetails("0x...");
	 * console.log(`From: ${txDetails.from}, To: ${txDetails.to}`);
	 * console.log(`Value: ${txDetails.valueFormatted} ETH`);
	 * console.log(`Status: ${txDetails.status === 1 ? 'Success' : 'Failed'}`);
	 */
	async getTransactionDetails(txHash: string): Promise<TransactionDetails> {
		try {
			// Get transaction details
			const tx = await this.provider.getTransaction(txHash);
			if (!tx) {
				throw new Error('Transaction not found');
			}

			// Get transaction receipt for additional details
			const receipt = await this.provider.getTransactionReceipt(txHash);

			// Format values
			const valueFormatted = ethers.formatEther(tx.value);

			return {
				hash: tx.hash,
				from: tx.from,
				to: tx.to || '',
				value: tx.value.toString(),
				valueFormatted: valueFormatted,
				gasLimit: tx.gasLimit.toString(),
				gasPrice: tx.gasPrice?.toString() || '0',
				gasUsed: receipt?.gasUsed?.toString(),
				blockNumber: receipt?.blockNumber || undefined,
				blockHash: receipt?.blockHash,
				transactionIndex: receipt?.index,
				status: receipt?.status || undefined,
				nonce: tx.nonce,
				data: tx.data,
			};
		} catch (error) {
			throw new Error(`Failed to get transaction details: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Get USDC token contract information
	 * @returns {Promise<{symbol: string, decimals: string, contractAddress: string, name: string}>} USDC contract info:
	 *   - symbol: string - Token symbol (e.g., "USDC")
	 *   - decimals: string - Number of decimals (e.g., "6")
	 *   - contractAddress: string - USDC contract address on the chain
	 *   - name: string - Token name (falls back to symbol if name() method not available)
	 * @throws {Error} Throws error if contract info cannot be retrieved
	 * @example
	 * const usdcInfo = await walletService.getUSDCInfo();
	 * console.log(`USDC: ${usdcInfo.name} (${usdcInfo.symbol})`);
	 * console.log(`Decimals: ${usdcInfo.decimals}`);
	 * console.log(`Contract: ${usdcInfo.contractAddress}`);
	 */
	async getUSDCInfo() {
		try {
			const [symbol, decimals] = await Promise.all([this.usdcContract.symbol(), this.usdcContract.decimals()]);

			// Try to get name, but don't fail if it doesn't exist
			let name = '';
			try {
				name = await this.usdcContract.name();
			} catch (nameError) {
				// USDC contract might not have name() method, use symbol as fallback
				name = symbol;
			}

			return {
				symbol,
				decimals: decimals.toString(),
				contractAddress: await this.usdcContract.getAddress(),
				name,
			};
		} catch (error) {
			throw new Error(`Failed to get USDC info: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Save transaction details to the database
	 * @param {TransactionDetails} transactionDetails - Complete transaction details object
	 * @param {string} toAddress - Recipient address for the transaction
	 * @returns {Promise<void>} Resolves when transaction is saved
	 * @throws {Error} Throws error if database save fails
	 * @example
	 * const txDetails = await walletService.getTransactionDetails(txHash);
	 * await walletService.saveTransactionDetails(txDetails, "0x...");
	 */
	async saveTransactionDetails(transactionDetails: TransactionDetails, toAddress: string) {
		try {
			// Save transaction details to database
			await WalletService.prisma.transaction.create({
				data: {
					blockchain: {
						connect: {
							chainId: this.chainId,
						},
					},
					type: Web3TransactionType.Transfer,
					...transactionDetails,
					to: toAddress,
					timestamp: BigInt(Date.now()),
				},
			});
		} catch (error) {
			throw new Error(`Failed to save transaction details: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Get all wallet transactions from the database with pagination, filtering, and sorting
	 * @param {ListingPaginationQueryParams} [params] - Optional query parameters:
	 *   - page?: number - Page number (default: 1)
	 *   - perPage?: number - Items per page (default: 10)
	 *   - sortBy?: string - Field to sort by (default: 'timestamp')
	 *   - order?: 'asc' | 'desc' - Sort order (default: 'desc')
	 *   - filters?: object - Filter object with optional fields:
	 *     - hash?: string - Transaction hash filter
	 *     - chainId?: string - Chain ID filter
	 *     - addressFrom?: string - Sender address filter
	 *     - addressTo?: string - Recipient address filter
	 *     - blockHash?: string - Block hash filter
	 *     - checkoutId?: string - Checkout ID filter
	 *     - blockNumber?: string - Block number filter
	 *     - transactionIndex?: string - Transaction index filter
	 *     - nonce?: string - Nonce filter
	 *     - type?: Web3TransactionType - Transaction type filter
	 *     - status?: string - Transaction status filter
	 *     - timestampFrom?: string - Start timestamp (ISO format)
	 *     - timestampTo?: string - End timestamp (ISO format)
	 * @returns {Promise<{transactions: any[], total: number}>} Object containing:
	 *   - transactions: Array of transaction objects with blockchain name
	 *   - total: Total number of transactions matching filters
	 * @throws {Error} Throws error if database query fails
	 * @example
	 * const result = await WalletService.getAllWalletTransactions({
	 *   page: 1,
	 *   perPage: 20,
	 *   sortBy: 'timestamp',
	 *   order: 'desc',
	 *   filters: { chainId: '0x14a34', type: 'Transfer' }
	 * });
	 * console.log(`Found ${result.total} transactions`);
	 */
	public static async getAllWalletTransactions(params?: ListingPaginationQueryParams) {
		const { page = 1, perPage = 10, sortBy = 'timestamp', order = 'desc', filters = {} } = params || {};
		const skip = (page - 1) * perPage;

		const where: any = {};
		if (filters.hash) where.hash = { contains: filters.hash, mode: 'insensitive' };
		if (filters.addressFrom) where.from = { contains: filters.addressFrom, mode: 'insensitive' };
		if (filters.addressTo) where.to = { contains: filters.addressTo, mode: 'insensitive' };
		if (filters.checkoutId) where.checkoutId = { contains: filters.checkoutId, mode: 'insensitive' };
		if (filters.blockHash) where.blockHash = { contains: filters.blockHash, mode: 'insensitive' };
		if (filters.chainId) where.chainId = filters.chainId;
		if (filters.type) where.type = filters.type;
		if (filters.blockNumber) where.blockNumber = parseInt(filters.blockNumber);
		if (filters.transactionIndex) where.transactionIndex = parseInt(filters.transactionIndex);
		if (filters.nonce) where.nonce = parseInt(filters.nonce);
		if (filters.status) where.status = parseInt(filters.status);

		if (filters.timestampFrom || filters.timestampTo) {
			where.timestamp = {};
			if (filters.timestampFrom) where.timestamp.gte = isoToUnixMilliseconds(filters.timestampFrom);
			if (filters.timestampTo) where.timestamp.lte = isoToUnixMilliseconds(filters.timestampTo);
		}

		try {
			const [transactions, total] = await Promise.all([
				WalletService.prisma.transaction.findMany({
					where,
					orderBy: { [sortBy]: order },
					skip,
					take: perPage,
					include: {
						blockchain: { select: { name: true } },
					},
				}),
				WalletService.prisma.transaction.count({ where }),
			]);

			// Flatten txn info and excludes encrypted data property.
			type TxnWithBlockchain = Prisma.transactionGetPayload<{ include: { blockchain: { select: { name: true } } } }>;
			const flattenTransactions = transactions.map((txn: TxnWithBlockchain) => {
				const { blockchain, data, ...rest } = txn;
				return {
					...rest,
					chainName: blockchain?.name || null,
				};
			});

			return { transactions: flattenTransactions, total };
		} catch (error) {
			throw new Error(`Failed to get wallet transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Get all platform wallet configurations from the database
	 * @returns {Promise<any[]>} Array of platform wallet objects containing chain configuration
	 * @throws {Error} Throws error if database query fails
	 * @example
	 * const platforms = await WalletService.getAllPlatformWallets();
	 * platforms.forEach(platform => {
	 *   console.log(`Chain ${platform.chainId}: ${platform.platformAddress}`);
	 * });
	 */
	public static async getAllPlatformWallets() {
		try {
			return await WalletService.prisma.platform.findMany();
		} catch (error) {
			throw new Error(`Failed to get platform wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Get all transactions for a wallet address from the database with optional filtering
	 * @param {string} walletAddress - Wallet address to get transactions for (must be valid 0x format)
	 * @param {string} chainId - Blockchain chain ID
	 * @param {boolean} [isFiltered=false] - If true, only returns transactions with checkoutId or Transfer type
	 * @param {boolean} [isTransfer=false] - If true, returns only Transfer type transactions and limits to 5 unique recipients
	 * @returns {Promise<any[]>} Array of transaction objects with token data:
	 *   - Each transaction includes parsed token transfer data (ERC20/ERC721/ERC1155)
	 *   - BigInt values are converted to strings for JSON serialization
	 *   - If isTransfer=true, returns up to 5 unique transfer recipients
	 * @throws {Error} Throws error if address is invalid or database query fails
	 * @example
	 * // Get all transactions
	 * const allTxs = await walletService.getWalletTransactions("0x...", "0x14a34");
	 *
	 * // Get filtered transactions (checkout or transfers only)
	 * const filteredTxs = await walletService.getWalletTransactions("0x...", "0x14a34", true);
	 *
	 * // Get recent transfer recipients (max 5)
	 * const recipients = await walletService.getWalletTransactions("0x...", "0x14a34", false, true);
	 */
	async getWalletTransactions(walletAddress: string, chainId: string, isFiltered = false, isTransfer = false) {
		try {
			// Validate address
			if (!ethers.isAddress(walletAddress)) {
				throw new Error('Invalid wallet address');
			}

			// Query transactions from database
			let where: any = {
				chainId: { equals: chainId, mode: 'insensitive' },
				...(isTransfer ? { type: Web3TransactionType.Transfer } : {}),
				OR: [
					{ from: { equals: walletAddress.toLowerCase(), mode: 'insensitive' } },
					{ to: { equals: walletAddress.toLowerCase(), mode: 'insensitive' } },
				],
			};

			if (isFiltered) {
				where.AND = [
					{
						OR: [{ checkoutId: { not: null } }, { type: Web3TransactionType.Transfer }],
					},
				];
			}

			const transactions = await WalletService.prisma.transaction.findMany({
				where,
				orderBy: {
					timestamp: 'desc',
				},
			});

			type TransactionWithTokenData = Prisma.transactionGetPayload<{}> & { tokenData: TokenData[] };
			const transactionsWithTokenData = await Promise.all(
				transactions.map(async (tx): Promise<TransactionWithTokenData> => ({
					...tx,
					tokenData: await this.parseReceipt(tx.hash),
				})),
			);

			// Convert BigInt values to strings for JSON serialization
			let results = transactionsWithTokenData.map((tx: TransactionWithTokenData) => {
				// Ensure tokenData doesn't contain any BigInt values
				const sanitizedTokenData = tx.tokenData.map((token: TokenData) => ({
					...token,
					tokenDecimals: Number(token.tokenDecimals),
				}));

				return {
					hash: tx.hash,
					chainId: tx.chainId,
					checkoutId: tx.checkoutId,
					type: tx.type.toString(),
					from: tx.from,
					to: tx.to,
					value: tx.value.toString(),
					valueFormatted: tx.valueFormatted,
					gasLimit: tx.gasLimit.toString(),
					gasPrice: tx.gasPrice?.toString() || '0',
					gasUsed: tx.gasUsed?.toString(),
					blockNumber: tx.blockNumber ? Number(tx.blockNumber) : undefined,
					blockHash: tx.blockHash,
					transactionIndex: tx.transactionIndex ? Number(tx.transactionIndex) : undefined,
					status: tx.status ? Number(tx.status) : undefined,
					nonce: tx.nonce,
					data: tx.data,
					timestamp: tx.timestamp.toString(),
					tokenData: sanitizedTokenData,
				};
			});

			// Extract distinct toAddress (limit 5) for Transfer Recipient
			if (isTransfer) {
				const seen = new Set<string>();
				const filtered: any[] = [];

				for (const tx of results) {
					// Only consider ERC20 token transfers sent BY this wallet
					const erc20 = tx.tokenData?.find(
						(t: any) => t.tokenType === 'ERC20' && t.fromAddress?.toLowerCase() === walletAddress.toLowerCase(),
					);
					if (!erc20) continue;

					const toAddr = erc20.toAddress?.toLowerCase();
					if (!toAddr) continue;

					if (!seen.has(toAddr)) {
						seen.add(toAddr);
						filtered.push(tx);
					}

					if (filtered.length >= 5) break;
				}

				results = filtered;
			}

			return results;
		} catch (error) {
			throw new Error(`Failed to get wallet transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Get wallet transaction details from database by transaction hash
	 * @param {string} txHash - Transaction hash to look up
	 * @returns {Promise<object>} Transaction details object with:
	 *   - hash: string - Transaction hash
	 *   - from: string - Sender address
	 *   - to: string - Recipient address
	 *   - value: string - Transaction value
	 *   - valueFormatted: string - Formatted transaction value
	 *   - gasLimit: string - Gas limit
	 *   - gasPrice: string - Gas price
	 *   - gasUsed?: string - Gas used (if available)
	 *   - blockNumber?: number - Block number
	 *   - blockHash?: string - Block hash
	 *   - transactionIndex?: number - Transaction index
	 *   - status?: number - Transaction status
	 *   - nonce: number - Transaction nonce
	 *   - data: string - Transaction data
	 * @throws {Error} Throws error if transaction not found in database
	 * @example
	 * const tx = await walletService.getWalletTransaction("0x...");
	 * console.log(`Transaction from ${tx.from} to ${tx.to}`);
	 */
	async getWalletTransaction(txHash: string) {
		try {
			// Get transaction details
			const tx = await WalletService.prisma.transaction.findFirst({
				where: { hash: txHash },
			});

			if (!tx) {
				throw new Error('Transaction not found');
			}

			return {
				hash: tx.hash,
				from: tx.from,
				to: tx.to,
				value: tx.value,
				valueFormatted: tx.valueFormatted,
				gasLimit: tx.gasLimit,
				gasPrice: tx.gasPrice,
				gasUsed: tx?.gasUsed?.toString(),
				blockNumber: tx?.blockNumber || undefined,
				blockHash: tx?.blockHash || undefined,
				transactionIndex: tx?.transactionIndex || undefined,
				status: tx?.status || undefined,
				nonce: tx.nonce,
				data: tx.data,
			};
		} catch (error) {
			throw new Error(`Failed to get transaction details: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Get checkout order(s) linked to a transaction hash
	 * @param {string} txHash - Transaction hash to look up checkout orders for
	 * @returns {Promise<object | null>} Checkout object with related orders, order items, and products, or null if not found
	 *   The checkout object includes:
	 *   - checkoutCharges: Array of checkout charges
	 *   - orders: Array of orders with:
	 *     - orderItems: Array of order items with product information
	 *     - seller: Seller information
	 *   - product: Product information including collection
	 * @throws {Error} Throws error if database query fails
	 * @example
	 * const checkout = await walletService.getCheckoutOrders("0x...");
	 * if (checkout) {
	 *   console.log(`Checkout ID: ${checkout.id}`);
	 *   console.log(`Total Amount: ${checkout.totalAmount}`);
	 *   console.log(`Orders: ${checkout.orders.length}`);
	 * }
	 */
	async getCheckoutOrders(txHash: string) {
		try {
			const tx = await WalletService.prisma.transaction.findFirst({
				where: { hash: txHash },
			});

			if (!tx?.checkoutId) {
				return null;
			}

			const checkout = await WalletService.prisma.checkout.findFirst({
				where: { id: tx.checkoutId },
				include: {
					checkoutCharges: true,
					orders: {
						include: {
							orderItems: {
								include: {
									product: {
										include: {
											collection: true,
										},
									},
								},
							},
							seller: true,
						},
					},
				},
			});

			return checkout;
		} catch (error) {
			throw new Error(`Failed to get order details: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Get checkout total amount by checkout ID
	 * @param {string} checkoutId - Checkout ID to look up
	 * @returns {Promise<string | null>} Total amount as a string, or null if checkout not found
	 * @throws {Error} Throws error if database query fails
	 * @example
	 * const amount = await walletService.getCheckoutAmount("checkout-123");
	 * if (amount) {
	 *   console.log(`Total amount: ${amount}`);
	 * }
	 */
	async getCheckoutAmount(checkoutId: string) {
		try {
			const checkout = await WalletService.prisma.checkout.findFirst({
				where: { id: checkoutId },
			});

			return checkout?.totalAmount;
		} catch (error) {
			throw new Error(`Failed to get checkout amount: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Identify the token standard (ERC-20, ERC-721, or ERC-1155) from a transaction log
	 * @param {Log} log - Ethereum transaction log to analyze
	 * @returns {string | null} Token type string:
	 *   - "ERC-20" for ERC20 token transfers
	 *   - "ERC-721" for ERC721 token transfers
	 *   - "ERC-1155 (Single)" for single ERC1155 transfers
	 *   - "ERC-1155 (Batch)" for batch ERC1155 transfers
	 *   - null if token type cannot be identified
	 * @example
	 * const tokenType = walletService.identifyTokenType(log);
	 * if (tokenType === "ERC-20") {
	 *   // Handle ERC20 transfer
	 * }
	 */
	identifyTokenType(log: Log): string | null {
		// Event signatures (keccak256 hash) for the token standards.
		const ERC20_TRANSFER_EVENT_SIGNATURE = ethers.id('Transfer(address,address,uint256)');
		const ERC721_TRANSFER_EVENT_SIGNATURE = ethers.id('Transfer(address,address,uint256)'); // Same signature, different topics count
		const ERC1155_SINGLE_TRANSFER_EVENT_SIGNATURE = ethers.id('TransferSingle(address,address,address,uint256,uint256)');
		const ERC1155_BATCH_TRANSFER_EVENT_SIGNATURE = ethers.id('TransferBatch(address,address,address,uint256[],uint256[])');

		const { topics } = log;
		const signature = topics[0];

		switch (signature) {
			case ERC20_TRANSFER_EVENT_SIGNATURE:
				// Differentiate ERC-20 from ERC-721 by checking the number of topics.
				// ERC-20 Transfer has 3 topics: signature, from, to. The value is in the data.
				if (topics.length === 3) {
					return 'ERC-20';
				}
				// ERC-721 Transfer has 4 topics: signature, from, to, tokenId.
				if (topics.length === 4) {
					return 'ERC-721';
				}
				break;
			case ERC1155_SINGLE_TRANSFER_EVENT_SIGNATURE:
				return 'ERC-1155 (Single)';
			case ERC1155_BATCH_TRANSFER_EVENT_SIGNATURE:
				return 'ERC-1155 (Batch)';
		}

		return null;
	}

	/**
	 * Parse transaction receipt to extract token transfer data (ERC20/ERC721/ERC1155)
	 * @param {string} txHash - Transaction hash to parse
	 * @returns {Promise<TokenData[]>} Array of token transfer data objects, each containing:
	 *   - contractAddress: string - Token contract address
	 *   - tokenType: 'ERC20' | 'ERC721' | 'ERC1155' - Token standard type
	 *   - tokenSymbol: string - Token symbol (e.g., "USDC")
	 *   - tokenDecimals: number - Token decimals
	 *   - tokenName: string - Token name
	 *   - fromAddress: string - Sender address
	 *   - toAddress: string - Recipient address
	 *   - tokenId?: string - Token ID (for ERC721/ERC1155)
	 *   - tokenAmount: string - Token amount in raw format
	 *   - tokenAmountFormatted: string - Token amount formatted with decimals
	 *   - batch: boolean - Whether this is a batch transfer (ERC1155)
	 * @returns {Promise<TokenData[]>} Empty array if receipt not found or no token transfers
	 * @throws {Error} Throws error if receipt parsing fails
	 * @example
	 * const tokenData = await walletService.parseReceipt("0x...");
	 * tokenData.forEach(token => {
	 *   console.log(`${token.tokenType} ${token.tokenSymbol}: ${token.tokenAmountFormatted}`);
	 *   console.log(`From: ${token.fromAddress}, To: ${token.toAddress}`);
	 * });
	 */
	async parseReceipt(txHash: string): Promise<TokenData[]> {
		try {
			const receipt: TransactionReceipt | null = await this.provider.getTransactionReceipt(txHash);

			if (!receipt) {
				console.log(`Transaction receipt for hash ${txHash} not found.`);
				return [];
			}

			console.log(`Analyzing receipt for transaction: ${receipt.hash}`);
			console.log('---');

			const txData: TokenData[] = [];
			// We'll parse the logs and return an array of TokenData objects (txData)
			if (receipt.logs && receipt.logs.length > 0) {
				for (let index = 0; index < receipt.logs.length; index++) {
					const log: Log = receipt.logs[index];
					const tokenType = this.identifyTokenType(log);
					if (tokenType) {
						let tokenSymbol = '';
						let tokenDecimals = 0;
						let tokenName = '';
						let fromAddress = '';
						let toAddress = '';
						let tokenId: string | undefined = undefined;
						let tokenAmount = '';
						let tokenAmountFormatted = '';
						let batch = false;

						try {
							const tokenContract = new ethers.Contract(log.address, WalletService.USDC_ABI, this.provider);
							tokenSymbol = await tokenContract.symbol();
							tokenDecimals = Number(await tokenContract.decimals());
							tokenName = (await tokenContract.name?.().catch(() => '')) || '';
						} catch (e) {
							// fallback if not available
							tokenSymbol = '';
							tokenDecimals = 0;
							tokenName = '';
						}

						if (tokenType === 'ERC-20' && log.topics.length === 3) {
							fromAddress = '0x' + log.topics[1].slice(26);
							toAddress = '0x' + log.topics[2].slice(26);
							tokenAmount = log.data;
							try {
								tokenAmountFormatted = ethers.formatUnits(tokenAmount, tokenDecimals);
							} catch {
								tokenAmountFormatted = tokenAmount;
							}
						} else if (tokenType === 'ERC-721' && log.topics.length === 4) {
							fromAddress = '0x' + log.topics[1].slice(26);
							toAddress = '0x' + log.topics[2].slice(26);
							tokenId = BigInt(log.topics[3]).toString();
							tokenAmount = '1';
							tokenAmountFormatted = '1';
						} else if (tokenType.startsWith('ERC-1155')) {
							batch = tokenType.includes('Batch');
							const ERC1155_ABI = [
								'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
								'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
							];
							const iface = new ethers.Interface(ERC1155_ABI);
							try {
								const parsedLog = iface.parseLog({
									topics: log.topics,
									data: log.data,
								});
								if (!parsedLog) continue;
								fromAddress = parsedLog.args.from;
								toAddress = parsedLog.args.to;
								if (parsedLog.name === 'TransferSingle') {
									tokenId = parsedLog.args.id.toString();
									tokenAmount = parsedLog.args.value.toString();
									tokenAmountFormatted = tokenAmount;
								} else if (parsedLog.name === 'TransferBatch') {
									// For batch, we will return one TokenData per id/value pair
									const ids = Array.from(parsedLog.args.ids());
									const values = Array.from(parsedLog.args.values());
									for (let i = 0; i < ids.length; i++) {
										txData.push({
											contractAddress: log.address,
											tokenType: 'ERC1155',
											tokenSymbol,
											tokenDecimals,
											tokenName,
											fromAddress,
											toAddress,
											tokenId: (ids[i] as any).toString(),
											tokenAmount: (values[i] as any).toString(),
											tokenAmountFormatted: (values[i] as any).toString(),
											batch: true,
										});
									}
									continue;
								}
							} catch (err) {
								// fallback
								tokenId = undefined;
								tokenAmount = '';
								tokenAmountFormatted = '';
							}
						}

						txData.push({
							contractAddress: log.address,
							tokenType: tokenType === 'ERC-20' ? 'ERC20' : tokenType === 'ERC-721' ? 'ERC721' : 'ERC1155',
							tokenSymbol,
							tokenDecimals,
							tokenName,
							fromAddress,
							toAddress,
							tokenId,
							tokenAmount,
							tokenAmountFormatted,
							batch,
						});
					}
				}
			}
			return txData;
		} catch (error) {
			throw new Error(`Failed to parse receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Get private key for an identifier
	 * @param identifier - Identifier for the account
	 * @returns Private key with 0x prefix
	 */
	private static getPrivateKeyForIdentifier(identifier: string): `0x${string}` {
		const salt = process.env.ETHEREUM_SALT || '0000000000000000000000000000000000000000000000000000000000000000';
		const account = new EthereumAccountService().generateAccount(identifier, salt);
		return account.privateKey as `0x${string}`;
	}

	/**
	 * Get private key for a wallet address
	 * @param walletAddress - Wallet address to get private key for
	 * @returns Private key with 0x prefix
	 * @throws Error if account not found or email not found
	 */
	private static async getPrivateKeyForWalletAddress(walletAddress: string): Promise<`0x${string}`> {
		const account = await WalletService.prisma.account.findFirst({
			where: {
				walletAddress: {
					equals: walletAddress,
					mode: 'insensitive',
				},
			},
		});
		if (!account) throw new Error(`Account not found for wallet address ${walletAddress}`);
		if (!account.email) throw new Error(`Email not found for account ${walletAddress}`);
		return this.getPrivateKeyForIdentifier(account.email);
	}
}

export type TokenData = {
	contractAddress: string;
	tokenType: 'ERC20' | 'ERC721' | 'ERC1155';
	tokenSymbol: string;
	tokenDecimals: number;
	tokenName: string;
	fromAddress: string;
	toAddress: string;
	tokenId?: string;
	tokenAmount: string;
	tokenAmountFormatted: string;
	batch: boolean;
};
