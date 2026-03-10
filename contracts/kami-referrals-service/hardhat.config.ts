import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-toolbox";

// Base Sepolia chain ID: 84532 (0x14a34 in hex)
const baseSepoliaChainId = 84532;

// Helper to get private key synchronously for Hardhat network configuration
// For build/compile time, we don't need the private key - only for deployment
// So we'll use the PRIVATE_KEY env var if available, or empty array
function getPrivateKeyForNetwork(): string[] {
  // During build/compile, we can use the deprecated PRIVATE_KEY env var as fallback
  // or just use empty array (contracts compile fine without accounts)
  if (process.env.PRIVATE_KEY) {
    return [process.env.PRIVATE_KEY];
  }
  
  // For build time (Docker builds, CI), empty array is fine
  // The actual deployment will use the database-stored encrypted keys
  return [];
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    baseSepolia: {
      url: process.env.RPC_URL || "https://sepolia.base.org",
      accounts: getPrivateKeyForNetwork(),
    },
    hardhat: {
      chainId: 1337,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test/solidity",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    require: ["./test/setup.ts"],
  },
};

export default config;

