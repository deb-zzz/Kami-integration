// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./KamiNFTCore.sol";

/**
 * @title KamiRoyalty
 * @dev Library for royalty management functionality including royalty configuration,
 * distribution, and validation.
 */
library KamiRoyalty {
    using SafeERC20 for IERC20;
    using KamiNFTCore for *;

    /**
     * @dev Initialize royalty configuration
     */
    function initializeRoyaltyConfig() internal {
        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        config.royaltyPercentage = 0; // Default to 0%
    }

    /**
     * @dev Set global royalty percentage
     * @param newRoyaltyPercentage New royalty percentage in basis points
     * @param accessControl Access control contract for role verification
     */
    function setRoyaltyPercentage(
        uint96 newRoyaltyPercentage,
        address accessControl
    ) internal {
        require(newRoyaltyPercentage <= 10000, "Royalty percentage cannot exceed 100%");
        require(accessControl != address(0), "Access control cannot be zero");

        // Verify caller has owner role
        require(
            IAccessControl(accessControl).hasRole(KamiNFTCore.OWNER_ROLE, msg.sender),
            "Caller must have owner role"
        );

        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        config.royaltyPercentage = newRoyaltyPercentage;
    }

    /**
     * @dev Set global mint royalties (must sum to 10000 basis points)
     * @param royalties Array of royalty receivers and percentages
     * @param accessControl Access control contract for role verification
     */
    function setMintRoyalties(
        KamiNFTCore.RoyaltyData[] calldata royalties,
        address accessControl
    ) internal {
        require(accessControl != address(0), "Access control cannot be zero");

        // Verify caller has owner role
        require(
            IAccessControl(accessControl).hasRole(KamiNFTCore.OWNER_ROLE, msg.sender),
            "Caller must have owner role"
        );

        // Validate that royalties sum to 10000 basis points
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < royalties.length; i++) {
            totalPercentage += royalties[i].feeNumerator;
        }
        require(totalPercentage == 10000, "Royalties must sum to 10000 basis points");

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
     * @param accessControl Access control contract for role verification
     */
    function setTransferRoyalties(
        KamiNFTCore.RoyaltyData[] calldata royalties,
        address accessControl
    ) internal {
        require(accessControl != address(0), "Access control cannot be zero");

        // Verify caller has owner role
        require(
            IAccessControl(accessControl).hasRole(KamiNFTCore.OWNER_ROLE, msg.sender),
            "Caller must have owner role"
        );

        // Validate that royalties sum to 10000 basis points
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < royalties.length; i++) {
            totalPercentage += royalties[i].feeNumerator;
        }
        require(totalPercentage == 10000, "Royalties must sum to 10000 basis points");

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
     * @param accessControl Access control contract for role verification
     * @param exists Function to check if token exists
     */
    function setTokenMintRoyalties(
        uint256 tokenId,
        KamiNFTCore.RoyaltyData[] calldata royalties,
        address accessControl,
        function(uint256) view returns (bool) exists
    ) internal {
        require(exists(tokenId), "Token does not exist");
        require(accessControl != address(0), "Access control cannot be zero");

        // Verify caller has owner role
        require(
            IAccessControl(accessControl).hasRole(KamiNFTCore.OWNER_ROLE, msg.sender),
            "Caller must have owner role"
        );

        // Validate that royalties sum to 10000 basis points
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < royalties.length; i++) {
            totalPercentage += royalties[i].feeNumerator;
        }
        require(totalPercentage == 10000, "Royalties must sum to 10000 basis points");

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
     * @param accessControl Access control contract for role verification
     * @param exists Function to check if token exists
     */
    function setTokenTransferRoyalties(
        uint256 tokenId,
        KamiNFTCore.RoyaltyData[] calldata royalties,
        address accessControl,
        function(uint256) view returns (bool) exists
    ) internal {
        require(exists(tokenId), "Token does not exist");
        require(accessControl != address(0), "Access control cannot be zero");

        // Verify caller has owner role
        require(
            IAccessControl(accessControl).hasRole(KamiNFTCore.OWNER_ROLE, msg.sender),
            "Caller must have owner role"
        );

        // Validate that royalties sum to 10000 basis points
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < royalties.length; i++) {
            totalPercentage += royalties[i].feeNumerator;
        }
        require(totalPercentage == 10000, "Royalties must sum to 10000 basis points");

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
     * @param mintPrice The mint price
     * @param paymentToken The payment token
     */
    function distributeMintRoyalties(
        uint256 tokenId,
        uint256 mintPrice,
        IERC20 paymentToken
    ) internal {
        KamiNFTCore.RoyaltyData[] memory receivers = getMintRoyaltyReceivers(tokenId);
        
        for (uint256 i = 0; i < receivers.length; i++) {
            uint256 amount = (mintPrice * receivers[i].feeNumerator) / 10000;
            if (amount > 0) {
                paymentToken.safeTransfer(receivers[i].receiver, amount);
            }
        }
    }

    /**
     * @dev Distribute transfer royalties
     * @param tokenId The token ID being transferred
     * @param salePrice The sale price
     * @param paymentToken The payment token
     */
    function distributeTransferRoyalties(
        uint256 tokenId,
        uint256 salePrice,
        IERC20 paymentToken
    ) internal {
        KamiNFTCore.RoyaltyData[] memory receivers = getTransferRoyaltyReceivers(tokenId);
        
        for (uint256 i = 0; i < receivers.length; i++) {
            uint256 amount = (salePrice * receivers[i].feeNumerator) / 10000;
            if (amount > 0) {
                paymentToken.safeTransfer(receivers[i].receiver, amount);
            }
        }
    }
}
