// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {KamiNFTCore} from "./KamiNFTCore.sol";
import {KamiPlatform} from "./KamiPlatform.sol";

/**
 * @title KamiRoyalty
 * @dev Library for royalty management functionality including royalty configuration,
 * distribution, and validation.
 */
library KamiRoyalty {
    using SafeERC20 for IERC20;
    using KamiNFTCore for *;

    // ============ CUSTOM ERRORS ============
    
    error RoyaltyPercentageTooHigh();
    error RoyaltiesMustSumTo10000();
    error TokenDoesNotExist();


    /**
     * @dev Initialize royalty configuration
     */
    function initializeRoyaltyConfig() internal {
        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        config.royaltyPercentage = 1000; // Default to 10%
    }

    /**
     * @dev Set global royalty percentage
     * @param newRoyaltyPercentage New royalty percentage in basis points
     */
    function setRoyaltyPercentage(
        uint96 newRoyaltyPercentage
    ) internal {
        if (newRoyaltyPercentage > 10000) revert RoyaltyPercentageTooHigh();
        // Role check moved to main contract

        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        config.royaltyPercentage = newRoyaltyPercentage;
    }

    /**
     * @dev Set global mint royalties (must sum to 10000 basis points)
     * @param royalties Array of royalty receivers and percentages
     */
    function setMintRoyalties(
        KamiNFTCore.RoyaltyData[] calldata royalties
    ) internal {
        // Role check moved to main contract

        // Validate that royalties sum to 10000 basis points
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < royalties.length; i++) {
            totalPercentage += royalties[i].feeNumerator;
        }
        if (totalPercentage != 10000) revert RoyaltiesMustSumTo10000();

        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        
        // Clear existing mint royalties
        delete config.mintRoyalties;
        
        // Set new mint royalties
        for (uint256 i = 0; i < royalties.length; i++) {
            config.mintRoyalties.push(royalties[i]);
        }
    }

    /**
     * @dev Set global transfer royalties (must sum to 10000 basis points)
     * @param royalties Array of royalty receivers and percentages
     */
    function setTransferRoyalties(
        KamiNFTCore.RoyaltyData[] calldata royalties
    ) internal {
        // Role check moved to main contract

        // Validate that royalties sum to 10000 basis points
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < royalties.length; i++) {
            totalPercentage += royalties[i].feeNumerator;
        }
        if (totalPercentage != 10000) revert RoyaltiesMustSumTo10000();

        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        
        // Clear existing transfer royalties
        delete config.transferRoyalties;
        
        // Set new transfer royalties
        for (uint256 i = 0; i < royalties.length; i++) {
            config.transferRoyalties.push(royalties[i]);
        }
    }

    /**
     * @dev Set token-specific mint royalties
     * @param tokenId The token ID to set royalties for
     * @param royalties Array of royalty receivers and percentages
     * @param exists Function to check if token exists
     */
    function setTokenMintRoyalties(
        uint256 tokenId,
        KamiNFTCore.RoyaltyData[] calldata royalties,
        function(uint256) external view returns (bool) exists
    ) internal {
        if (!exists(tokenId)) revert TokenDoesNotExist();
        // Role check moved to main contract

        // Validate that royalties sum to 10000 basis points
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < royalties.length; i++) {
            totalPercentage += royalties[i].feeNumerator;
        }
        if (totalPercentage != 10000) revert RoyaltiesMustSumTo10000();

        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        
        // Clear existing token mint royalties
        delete config.tokenMintRoyalties[tokenId];
        
        // Set new token mint royalties
        for (uint256 i = 0; i < royalties.length; i++) {
            config.tokenMintRoyalties[tokenId].push(royalties[i]);
        }
    }

    /**
     * @dev Set token-specific transfer royalties
     * @param tokenId The token ID to set royalties for
     * @param royalties Array of royalty receivers and percentages
     * @param exists Function to check if token exists
     */
    function setTokenTransferRoyalties(
        uint256 tokenId,
        KamiNFTCore.RoyaltyData[] calldata royalties,
        function(uint256) external view returns (bool) exists
    ) internal {
        if (!exists(tokenId)) revert TokenDoesNotExist();
        // Role check moved to main contract

        // Validate that royalties sum to 10000 basis points
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < royalties.length; i++) {
            totalPercentage += royalties[i].feeNumerator;
        }
        if (totalPercentage != 10000) revert RoyaltiesMustSumTo10000();

        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        
        // Clear existing token transfer royalties
        delete config.tokenTransferRoyalties[tokenId];
        
        // Set new token transfer royalties
        for (uint256 i = 0; i < royalties.length; i++) {
            config.tokenTransferRoyalties[tokenId].push(royalties[i]);
        }
    }

    /**
     * @dev Get royalty percentage
     * @return The global royalty percentage in basis points
     */
    function royaltyPercentage() internal view returns (uint96) {
        return KamiNFTCore.royaltyPercentage();
    }

    /**
     * @dev Get mint royalty receivers for a token
     * @param tokenId The token ID to get royalty receivers for
     * @return Array of royalty receivers
     */
    function getMintRoyaltyReceivers(uint256 tokenId) internal view returns (KamiNFTCore.RoyaltyData[] memory) {
        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        
        // Check if token has specific mint royalties
        if (config.tokenMintRoyalties[tokenId].length > 0) {
            return config.tokenMintRoyalties[tokenId];
        }
        
        // Return global mint royalties
        return config.mintRoyalties;
    }

    /**
     * @dev Get transfer royalty receivers for a token
     * @param tokenId The token ID to get royalty receivers for
     * @return Array of royalty receivers
     */
    function getTransferRoyaltyReceivers(uint256 tokenId) internal view returns (KamiNFTCore.RoyaltyData[] memory) {
        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        
        // Check if token has specific transfer royalties
        if (config.tokenTransferRoyalties[tokenId].length > 0) {
            return config.tokenTransferRoyalties[tokenId];
        }
        
        // Return global transfer royalties
        return config.transferRoyalties;
    }

    /**
     * @dev Distribute mint royalties
     * @param tokenId The token ID being minted
     * @param remainingAmount The remaining amount after platform commission
     * @param paymentToken The payment token
     */
    function distributeMintRoyalties(
        uint256 tokenId,
        uint256 remainingAmount,
        IERC20 paymentToken
    ) internal {
        KamiNFTCore.RoyaltyData[] memory receivers = getMintRoyaltyReceivers(tokenId);
        
        for (uint256 i = 0; i < receivers.length; i++) {
            uint256 amount = (remainingAmount * receivers[i].feeNumerator) / 10000;
            if (amount > 0) {
                paymentToken.safeTransfer(receivers[i].receiver, amount);
            }
        }
    }

    /**
     * @dev Distribute transfer royalties
     * @param tokenId The token ID being transferred
     * @param royaltyAmount The royalty amount to distribute
     * @param paymentToken The payment token
     * @param payer The address from which payment is made
     */
    function distributeTransferRoyalties(
        uint256 tokenId,
        uint256 royaltyAmount,
        IERC20 paymentToken,
        address payer
    ) internal {
        KamiNFTCore.RoyaltyData[] memory receivers = getTransferRoyaltyReceivers(tokenId);

        if (receivers.length == 0) {
            return; // No receivers to distribute to
        }

        // Use the passed royalty amount for distribution
        uint256 distributionAmount = royaltyAmount;

        // Distribute among receivers
        for (uint256 i = 0; i < receivers.length; i++) {
            uint256 amount = (distributionAmount * receivers[i].feeNumerator) / 10000;
            if (amount > 0) {
                paymentToken.safeTransferFrom(payer, receivers[i].receiver, amount);
            }
        }
    }
}