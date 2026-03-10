// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "../src/KamiSponsoredNFT.sol";
import "../src/KamiPaymaster.sol";

/**
 * @title ConfigureScript
 * @dev Configuration script for KAMI sponsored NFT system
 */
contract ConfigureScript is Script {
    function run() external {
        // Set these addresses after deployment
        address nftAddress = vm.envAddress("NFT_CONTRACT_ADDRESS");
        address payable paymasterAddress = payable(vm.envAddress("PAYMASTER_ADDRESS"));
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Configuring contracts with account:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        KamiSponsoredNFT nft = KamiSponsoredNFT(nftAddress);
        KamiPaymaster paymaster = KamiPaymaster(paymasterAddress);
        
        // Set up royalty receivers for token ID 0 (example)
        KamiSponsoredNFT.RoyaltyData[] memory mintRoyalties = new KamiSponsoredNFT.RoyaltyData[](2);
        mintRoyalties[0] = KamiSponsoredNFT.RoyaltyData({
            receiver: deployer,
            feeNumerator: 5000 // 50%
        });
        mintRoyalties[1] = KamiSponsoredNFT.RoyaltyData({
            receiver: address(0x1234567890123456789012345678901234567890), // Example address
            feeNumerator: 5000 // 50%
        });
        
        nft.setMintRoyalties(0, mintRoyalties);
        
        // Set up transfer royalties for token ID 0
        KamiSponsoredNFT.RoyaltyData[] memory transferRoyalties = new KamiSponsoredNFT.RoyaltyData[](1);
        transferRoyalties[0] = KamiSponsoredNFT.RoyaltyData({
            receiver: deployer,
            feeNumerator: 10000 // 100%
        });
        
        nft.setTransferRoyalties(0, transferRoyalties);
        
        // Set royalty percentage
        nft.setRoyaltyPercentage(1000); // 10%
        
        // Configure additional allowed functions
        paymaster.allowFunction(nftAddress, bytes4(keccak256("setMintRoyalties(uint256,(address,uint96)[])")), true);
        paymaster.allowFunction(nftAddress, bytes4(keccak256("setTransferRoyalties(uint256,(address,uint96)[])")), true);
        paymaster.allowFunction(nftAddress, bytes4(keccak256("setRoyaltyPercentage(uint96)")), true);
        
        vm.stopBroadcast();
        
        console.log("Configuration completed successfully!");
    }
    
    function updateSpendingLimits() external {
        address payable paymasterAddress = payable(vm.envAddress("PAYMASTER_ADDRESS"));
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        KamiPaymaster paymaster = KamiPaymaster(paymasterAddress);
        
        // Update spending limits
        paymaster.setSpendingLimits(
            2000000 * 1e6, // 2M USDC global limit
            2000 * 1e6,    // 2K USDC user limit
            200             // 200 operations per user
        );
        
        // Update gas limits
        paymaster.setGasLimits(200 gwei, 1000000); // 200 gwei max price, 1M gas limit
        
        vm.stopBroadcast();
        
        console.log("Spending limits updated successfully!");
    }
    
    function addAllowedContract(address contractAddress) external {
        address payable paymasterAddress = payable(vm.envAddress("PAYMASTER_ADDRESS"));
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        KamiPaymaster paymaster = KamiPaymaster(paymasterAddress);
        paymaster.allowContract(contractAddress, true);
        
        vm.stopBroadcast();
        
        console.log("Contract allowed:", contractAddress);
    }
    
    function removeAllowedContract(address contractAddress) external {
        address payable paymasterAddress = payable(vm.envAddress("PAYMASTER_ADDRESS"));
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        KamiPaymaster paymaster = KamiPaymaster(paymasterAddress);
        paymaster.allowContract(contractAddress, false);
        
        vm.stopBroadcast();
        
        console.log("Contract disallowed:", contractAddress);
    }
}
