require('@nomicfoundation/hardhat-toolbox');
require('@nomicfoundation/hardhat-chai-matchers');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	// Add remappings for @account-abstraction imports
	remappings: ['@account-abstraction/contracts/=node_modules/@account-abstraction/contracts/'],
	solidity: {
		version: '0.8.20',
		settings: {
			optimizer: {
				enabled: true,
				runs: 200,
			},
		},
	},
	networks: {
		hardhat: {
			chainId: 31337,
		},
		localhost: {
			url: 'http://127.0.0.1:8545',
		},
	},
	paths: {
		sources: './contracts',
		tests: './test',
		cache: './cache',
		artifacts: './artifacts',
	},
};
