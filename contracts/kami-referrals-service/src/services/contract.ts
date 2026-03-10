import { publicClient, walletClient, contractAddress, getAccount, chain } from "../config/network";
import { type Address } from "viem";
import { getContract } from "viem";

// Contract ABI
const contractABI = [
  {
    inputs: [
      {
        internalType: "string",
        name: "initialUri",
        type: "string",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "approved",
        type: "bool",
      },
    ],
    name: "ApprovalForAll",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "TokenSupply",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "string",
        name: "value",
        type: "string",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "URI",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address[]",
        name: "accounts",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "ids",
        type: "uint256[]",
      },
    ],
    name: "balanceOfBatch",
    outputs: [
      {
        internalType: "uint256[]",
        name: "",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "getTotalSupply",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
    ],
    name: "isApprovedForAll",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
      {
        internalType: "bool",
        name: "approved",
        type: "bool",
      },
    ],
    name: "setApprovalForAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "newUri",
        type: "string",
      },
    ],
    name: "setTokenURI",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes4",
        name: "interfaceId",
        type: "bytes4",
      },
    ],
    name: "supportsInterface",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "uri",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function getContractInstance(address?: Address) {
  const addr = address || contractAddress;
  if (!addr) {
    throw new Error("Contract address not set. Deploy contract first or set CONTRACT_ADDRESS in .env");
  }
  const client = await walletClient;
  return getContract({
    address: addr,
    abi: contractABI,
    client: {
      public: publicClient,
      wallet: client,
    },
  });
}

export async function getUri(tokenId: bigint, contractAddr?: Address): Promise<string> {
  try {
    const contract = await getContractInstance(contractAddr);
    return await contract.read.uri([tokenId]);
  } catch (error: any) {
    throw new Error(`Failed to get URI: ${error.message}`);
  }
}

export async function setTokenURI(
  tokenId: bigint,
  newUri: string,
  contractAddr?: Address
): Promise<string> {
  try {
    const contract = await getContractInstance(contractAddr);
    const account = await getAccount();
    const addr = contractAddr || contractAddress;
    if (!addr) {
      throw new Error("Contract address not set");
    }

    // Simulate the transaction first to verify it will succeed
    await publicClient.simulateContract({
      address: addr,
      abi: contractABI,
      functionName: "setTokenURI",
      args: [tokenId, newUri],
      account,
    });

    // If simulation succeeds, execute the write transaction
    const hash = await contract.write.setTokenURI([tokenId, newUri], {
      account,
      chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  } catch (error: any) {
    throw new Error(`Failed to set token URI: ${error.message}`);
  }
}

export async function mint(
  tokenId: bigint,
  amount: bigint,
  recipient: Address,
  contractAddr?: Address
): Promise<string> {
  try {
    console.log(`🔄 Starting mint: Token ID ${tokenId}, Amount ${amount}, Recipient ${recipient}`);
    const contract = await getContractInstance(contractAddr);
    const account = await getAccount();
    const addr = contractAddr || contractAddress;
    if (!addr) {
      throw new Error("Contract address not set");
    }

    // Verify the account is the contract owner before attempting to mint
    const contractOwner = await getContractOwner(contractAddr);
    const accountAddress = account.address;
    
    if (accountAddress.toLowerCase() !== contractOwner.toLowerCase()) {
      const chainInfo = chain ? `chain ${chain.id} (${chain.name})` : 'the configured chain';
      throw new Error(
        `Account ${accountAddress} is not the contract owner. ` +
        `Contract owner is ${contractOwner}. ` +
        `Please ensure the private key for ${chainInfo} corresponds to the contract owner address.`
      );
    }
    
    console.log(`✅ Account ${accountAddress} verified as contract owner`);

    // Simulate the transaction first to verify it will succeed
    console.log(`🔍 Simulating mint transaction...`);
    await publicClient.simulateContract({
      address: addr,
      abi: contractABI,
      functionName: "mint",
      args: [tokenId, amount, recipient],
      account,
    });
    console.log(`✅ Simulation successful, executing transaction...`);

    // If simulation succeeds, execute the write transaction
    const hash = await contract.write.mint([tokenId, amount, recipient], {
      account,
      chain,
    });
    console.log(`📤 Transaction submitted: ${hash}, waiting for confirmation...`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    // Log mint occurrence
    console.log(`✅ Mint occurred: Token ID ${tokenId}, Amount ${amount}, Recipient ${recipient}, Transaction Hash ${hash}, Block ${receipt.blockNumber}`);
    
    return hash;
  } catch (error: any) {
    console.error(`❌ Mint failed: ${error.message}`);
    throw new Error(`Failed to mint: ${error.message}`);
  }
}

export async function getTotalSupply(tokenId: bigint, contractAddr?: Address): Promise<bigint> {
  try {
    const contract = await getContractInstance(contractAddr);
    return await contract.read.getTotalSupply([tokenId]);
  } catch (error: any) {
    throw new Error(`Failed to get total supply: ${error.message}`);
  }
}

export async function getBalance(
  owner: Address,
  tokenId: bigint,
  contractAddr?: Address
): Promise<bigint> {
  try {
    const contract = await getContractInstance(contractAddr);
    return await contract.read.balanceOf([owner, tokenId]);
  } catch (error: any) {
    throw new Error(`Failed to get balance: ${error.message}`);
  }
}

export async function getContractOwner(contractAddr?: Address): Promise<Address> {
  try {
    const contract = await getContractInstance(contractAddr);
    return await contract.read.owner();
  } catch (error: any) {
    throw new Error(`Failed to get contract owner: ${error.message}`);
  }
}

export async function transferOwnership(
  newOwner: Address,
  contractAddr?: Address
): Promise<string> {
  try {
    console.log(`🔄 Starting ownership transfer to: ${newOwner}`);
    const contract = await getContractInstance(contractAddr);
    const account = await getAccount();
    const addr = contractAddr || contractAddress;
    if (!addr) {
      throw new Error("Contract address not set");
    }

    // Verify the account is the current contract owner
    const contractOwner = await getContractOwner(contractAddr);
    const accountAddress = account.address;
    
    if (accountAddress.toLowerCase() !== contractOwner.toLowerCase()) {
      const chainInfo = chain ? `chain ${chain.id} (${chain.name})` : 'the configured chain';
      throw new Error(
        `Account ${accountAddress} is not the contract owner. ` +
        `Contract owner is ${contractOwner}. ` +
        `Only the current owner can transfer ownership. ` +
        `Please ensure the private key for ${chainInfo} corresponds to the contract owner address.`
      );
    }
    
    console.log(`✅ Account ${accountAddress} verified as contract owner`);

    // Simulate the transaction first to verify it will succeed
    console.log(`🔍 Simulating transfer ownership transaction...`);
    await publicClient.simulateContract({
      address: addr,
      abi: contractABI,
      functionName: "transferOwnership",
      args: [newOwner],
      account,
    });
    console.log(`✅ Simulation successful, executing transaction...`);

    // If simulation succeeds, execute the write transaction
    const hash = await contract.write.transferOwnership([newOwner], {
      account,
      chain,
    });
    console.log(`📤 Transaction submitted: ${hash}, waiting for confirmation...`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    // Verify the ownership was transferred
    const newContractOwner = await getContractOwner(contractAddr);
    if (newContractOwner.toLowerCase() !== newOwner.toLowerCase()) {
      throw new Error(
        `Ownership transfer transaction completed but verification failed. ` +
        `Expected owner: ${newOwner}, Actual owner: ${newContractOwner}`
      );
    }
    
    // Log ownership transfer
    console.log(`✅ Ownership transferred: From ${accountAddress} to ${newOwner}, Transaction Hash ${hash}, Block ${receipt.blockNumber}`);
    
    return hash;
  } catch (error: any) {
    console.error(`❌ Transfer ownership failed: ${error.message}`);
    throw new Error(`Failed to transfer ownership: ${error.message}`);
  }
}

