import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-ethers'; // Use ethers v5 plugin

// Basic Hardhat config for running tests against Hardhat Network
const config: HardhatUserConfig = {
	solidity: '0.8.20',
	networks: {
		hardhat: {
			// Configuration for the default Hardhat Network
			// Increase gas limit to allow larger contracts
			gas: 30000000,
			blockGasLimit: 30000000,
			// Allow larger contract deployments
			allowUnlimitedContractSize: true,
		},
		// You can add other networks (e.g., testnets, mainnet) here
	},
	paths: {
		// Add paths configuration
		sources: './src/contracts', // Point to the correct contracts directory
	},
};

export default config;
