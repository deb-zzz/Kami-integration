/**
 * KAMI Platform Gasless NFT Operations
 *
 * Public API for gasless deployment, minting, selling, and payment token operations.
 * All operations use sponsored transactions where the platform pays gas fees.
 *
 * @see README.md in this folder for architecture and usage.
 */

// Config
export {
	getHexChainId,
	getChainIdWithDefault,
	getBlockchainViemObject,
	getBlockchainInfo,
	getPlatformInfo,
	validatePaymentTokens,
	getDefaultPaymentToken,
	validateChainId,
} from './config';

// Deploy
export {
	deployGaslessCollection,
	deployKami721CContract,
	deployKami721ACContract,
	deployKami1155Contract,
	deployKamiNFTContract,
} from './deploy';

// Mint
export { mintGaslessNFT, batchMintGaslessNFTs, mintKami721CToken, mintKami721ACToken, mintKami1155Token, mintKamiNFTToken } from './mint';

// Sell
export { sellKamiToken } from './sell';

// Operations (price, royalty, role)
export { setKamiNFTRoyalty, setKamiNFTPrice, setMintPrice, setMaxQuantity, grantOwnerRoleToSimpleAccount } from './operations';

// Tokens (payment token helpers)
export { toTokenUnits, getPaymentTokenDecimals, transferPaymentToken, getPaymentTokenBalances } from './tokens';

// Contract reads
export { kamiBalanceOf, kamiTotalSupply, kamiMaxQuantity, kamiTotalMinted } from './contract-reads';

// EntryPoint deposit (when using EntryPoint path for deploy/operations)
export {
	fundEntryPointDeposit,
	getEntryPointDepositBalance,
	ensureEntryPointDeposit,
	ENTRY_POINT_DEPOSIT_ABI,
	ENTRY_POINT_GAS_LIMIT_DEPLOY,
	ENTRY_POINT_GAS_LIMIT_MINT,
	ENTRY_POINT_GAS_LIMIT_OPERATION,
	USER_OP_CALL_GAS_LIMIT_OPERATION,
} from './entrypoint-deposit';
export type { EnsureEntryPointDepositParams, EnsureEntryPointDepositResult } from './entrypoint-deposit';

// Transaction
export { createTransaction } from './transaction';

// Wallet
export { getOwnerPrivateKey, validateWalletAccess } from './wallet';

// Inventory
export { validateAndCorrectContractQuantityState } from './inventory';

// Types
export type {
	BaseDeployParams,
	DeployKami721CParams,
	DeployKami721ACParams,
	DeployKami1155Params,
	DeployContractParams,
	BaseMintParams,
	MintKami721CParams,
	MintKami721ACParams,
	MintKami1155Params,
	MintTokenParams,
	DeployResponse,
	MintResponse,
	ContractQuantityValidationResult,
} from './types';
