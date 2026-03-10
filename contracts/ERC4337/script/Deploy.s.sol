// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/KamiSmartAccountFactory.sol";
import "../src/KamiSmartAccount.sol";
import "../src/KamiSponsoredNFT.sol";
import "../src/KamiPaymaster.sol";

/**
 * @title DeployScript
 * @dev Deployment script for KAMI sponsored NFT system on Base blockchain
 */
contract DeployScript is Script {
    // Base network addresses
    address constant BASE_ENTRY_POINT = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    address constant BASE_SEPOLIA_ENTRY_POINT = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    
    // USDC on Base (example payment token)
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy Smart Account Factory
        KamiSmartAccountFactory factory = new KamiSmartAccountFactory(BASE_ENTRY_POINT);
        console.log("Smart Account Factory deployed at:", address(factory));
        
        // Deploy Paymaster
        KamiPaymaster paymaster = new KamiPaymaster(
            BASE_ENTRY_POINT,
            USDC_BASE,
            deployer, // treasury
            100 gwei, // max gas price
            500000,   // max gas limit
            1000000 * 1e6, // global spending limit (1M USDC)
            1000 * 1e6,    // user spending limit (1K USDC)
            100,           // user operation limit
            7 days         // limit reset period
        );
        console.log("Paymaster deployed at:", address(paymaster));
        
        // Deploy Sponsored NFT Contract
        KamiSponsoredNFT nft = new KamiSponsoredNFT(
            USDC_BASE,
            "KAMI Sponsored NFT",
            "KSNFT",
            "https://api.kami.com/metadata/",
            100 * 1e6, // 100 USDC mint price
            deployer,  // platform address
            500,       // 5% platform commission
            address(factory),
            address(paymaster)
        );
        console.log("Sponsored NFT Contract deployed at:", address(nft));
        
        // Configure Paymaster
        paymaster.allowContract(address(nft), true);
        paymaster.allowFunction(address(nft), bytes4(keccak256("mint()")), true);
        paymaster.allowFunction(address(nft), bytes4(keccak256("mintTo(address)")), true);
        paymaster.allowFunction(address(nft), bytes4(keccak256("sellToken(address,uint256,uint256)")), true);
        paymaster.allowFunction(address(nft), bytes4(keccak256("rentToken(uint256,uint256,uint256)")), true);
        paymaster.allowFunction(address(nft), bytes4(keccak256("endRental(uint256)")), true);
        paymaster.allowFunction(address(nft), bytes4(keccak256("extendRental(uint256,uint256,uint256)")), true);
        
        // Deposit ETH to Paymaster for gas sponsorship
        paymaster.deposit{value: 1 ether}();
        
        vm.stopBroadcast();
        
        console.log("Deployment completed successfully!");
        console.log("Factory:", address(factory));
        console.log("Paymaster:", address(paymaster));
        console.log("NFT Contract:", address(nft));
    }
    
    function deployToBaseSepolia() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying to Base Sepolia with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy Smart Account Factory
        KamiSmartAccountFactory factory = new KamiSmartAccountFactory(BASE_SEPOLIA_ENTRY_POINT);
        console.log("Smart Account Factory deployed at:", address(factory));
        
        // Deploy Paymaster
        KamiPaymaster paymaster = new KamiPaymaster(
            BASE_SEPOLIA_ENTRY_POINT,
            USDC_BASE_SEPOLIA,
            deployer, // treasury
            100 gwei, // max gas price
            500000,   // max gas limit
            100000 * 1e6, // global spending limit (100K USDC)
            1000 * 1e6,   // user spending limit (1K USDC)
            50,           // user operation limit
            1 days        // limit reset period
        );
        console.log("Paymaster deployed at:", address(paymaster));
        
        // Deploy Sponsored NFT Contract
        KamiSponsoredNFT nft = new KamiSponsoredNFT(
            USDC_BASE_SEPOLIA,
            "KAMI Sponsored NFT Test",
            "KSNFTT",
            "https://api.kami.com/test/metadata/",
            10 * 1e6,  // 10 USDC mint price
            deployer,  // platform address
            500,       // 5% platform commission
            address(factory),
            address(paymaster)
        );
        console.log("Sponsored NFT Contract deployed at:", address(nft));
        
        // Configure Paymaster
        paymaster.allowContract(address(nft), true);
        paymaster.allowFunction(address(nft), bytes4(keccak256("mint()")), true);
        paymaster.allowFunction(address(nft), bytes4(keccak256("mintTo(address)")), true);
        paymaster.allowFunction(address(nft), bytes4(keccak256("sellToken(address,uint256,uint256)")), true);
        paymaster.allowFunction(address(nft), bytes4(keccak256("rentToken(uint256,uint256,uint256)")), true);
        paymaster.allowFunction(address(nft), bytes4(keccak256("endRental(uint256)")), true);
        paymaster.allowFunction(address(nft), bytes4(keccak256("extendRental(uint256,uint256,uint256)")), true);
        
        // Deposit ETH to Paymaster for gas sponsorship
        paymaster.deposit{value: 0.1 ether}();
        
        vm.stopBroadcast();
        
        console.log("Base Sepolia deployment completed successfully!");
        console.log("Factory:", address(factory));
        console.log("Paymaster:", address(paymaster));
        console.log("NFT Contract:", address(nft));
    }
}
