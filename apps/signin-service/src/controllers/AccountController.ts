import { EthereumAccountService } from '../services/EthereumAccountService';
import { validateIdentifier } from '../utils/validators';
import { createAccount } from '../utils/account.utils';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

type Account = {
	chainId: string;
	address: string;
	publicKey?: string;
	mnemonic?: string;
	privateKey?: string;
	identifier: string;
};

/**
 * Controller handling Ethereum account-related requests
 */
export class AccountController {
	private ethereumAccountService: EthereumAccountService;

	constructor() {
		this.ethereumAccountService = new EthereumAccountService();
	}

	/**
	 * Generates an Ethereum account based on user credentials
	 * @param identifier - User's email or phone number
	 * @returns Generated Ethereum wallet
	 */
	public generateAccount = async (identifier: string, withKey?: boolean): Promise<Account> => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		const phoneRegex = /^\+?[1-9]\d{1,14}$/;
		const isEmail = emailRegex.test(identifier);
		const isPhone = phoneRegex.test(identifier);

		try {
			// Validate the identifier
			if (!validateIdentifier(identifier)) {
				throw 'Invalid identifier format';
			}

			// Generate a unique salt for this user (in production, this should be stored securely)
			const salt = process.env.ETHEREUM_SALT || 'default-salt';

			// Generate the account
			const wallet = this.ethereumAccountService.generateAccount(identifier, salt);

			// Get a blockchain
			const blockchain = await prisma.blockchain.findUnique({ where: { chainId: process.env.CHAIN_ID || '0x2105' } });
			const chainId = blockchain?.chainId || '0x2105';

			await createAccount({
				walletAddress: wallet.address,
				email: isEmail ? identifier : undefined,
				phone: isPhone ? identifier : undefined,
			});

			return {
				chainId: chainId,
				address: wallet.address,
				identifier,
				publicKey: withKey ? wallet.signingKey.publicKey : undefined,
				mnemonic: withKey ? wallet.mnemonic?.phrase : undefined,
				privateKey: withKey ? wallet.privateKey : undefined,
			};
		} catch (error) {
			logger.error('Error generating Ethereum account:', {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				identifier,
			});
			throw error instanceof Error ? error : new Error('Failed to generate Ethereum account');
		}
	};
}
