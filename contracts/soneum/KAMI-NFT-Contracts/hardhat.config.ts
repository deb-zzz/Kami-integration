import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import '@openzeppelin/hardhat-upgrades';
import 'dotenv/config';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0000000000000000000000000000000000000000000000000000000000000000';

const config: HardhatUserConfig = {
	solidity: {
		version: '0.8.24',
		settings: {
			optimizer: {
				enabled: true,
				runs: 1, // Maximum size optimization
			},
			viaIR: true,
			evmVersion: 'paris',
			metadata: {
				bytecodeHash: 'none', // Don't include metadata to save space
			},
		},
		remappings: [
			'@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/',
			'@openzeppelin/contracts-upgradeable/=node_modules/@openzeppelin/contracts-upgradeable/',
		],
	},
	networks: {
		hardhat: {
			chainId: 1337,
			allowUnlimitedContractSize: true,
		},
		localhost: {
			url: 'http://127.0.0.1:8545',
			allowUnlimitedContractSize: true,
		},
		sepolia: {
			url: process.env.SEPOLIA_RPC_URL || '',
			accounts: [PRIVATE_KEY],
			gasPrice: 'auto',
		},
		goerli: {
			url: process.env.GOERLI_RPC_URL || '',
			accounts: [PRIVATE_KEY],
			gasPrice: 'auto',
		},
		mainnet: {
			url: process.env.MAINNET_RPC_URL || '',
			accounts: [PRIVATE_KEY],
			gasPrice: 'auto',
		},
		polygon: {
			url: process.env.POLYGON_RPC_URL || '',
			accounts: [PRIVATE_KEY],
			gasPrice: 'auto',
		},
		mumbai: {
			url: process.env.MUMBAI_RPC_URL || '',
			accounts: [PRIVATE_KEY],
			gasPrice: 'auto',
		},
		soneum: {
			url: process.env.SONEUM_RPC_URL || 'https://rpc.soneium.org',
			chainId: 1868,
			accounts: [PRIVATE_KEY],
			gasPrice: 'auto',
			allowUnlimitedContractSize: true,
		},
		minato: {
			url: process.env.MINATO_RPC_URL || 'https://rpc.minato.soneium.org',
			chainId: 1946,
			accounts: [PRIVATE_KEY],
			gasPrice: 'auto',
			allowUnlimitedContractSize: true,
		},
		base: {
			url: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
			chainId: 8453,
			accounts: [PRIVATE_KEY],
			gasPrice: 'auto',
		},
		baseSepolia: {
			url: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
			chainId: 84532,
			accounts: [PRIVATE_KEY],
			gasPrice: 'auto',
		},
	},
	paths: {
		sources: './contracts',
		tests: './test',
		cache: './cache',
		artifacts: './artifacts',
	},
	gasReporter: {
		enabled: process.env.REPORT_GAS === 'true',
		currency: 'USD',
		coinmarketcap: process.env.COINMARKETCAP_API_KEY,
		token: 'ETH',
		gasPriceApi: 'https://api.etherscan.io/api?module=proxy&action=eth_gasPrice',
		excludeContracts: ['MockERC20'],
		src: './contracts',
	},
	etherscan: {
		apiKey: {
			mainnet: process.env.ETHERSCAN_API_KEY || '',
			sepolia: process.env.ETHERSCAN_API_KEY || '',
			goerli: process.env.ETHERSCAN_API_KEY || '',
			polygon: process.env.POLYGONSCAN_API_KEY || '',
			polygonMumbai: process.env.POLYGONSCAN_API_KEY || '',
		},
	},
	sourcify: {
		enabled: true,
	},
	typechain: {
		outDir: 'typechain-types',
		target: 'ethers-v6',
	},
};

export default config;
