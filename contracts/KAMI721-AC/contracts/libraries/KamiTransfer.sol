// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./KamiNFTCore.sol";
import "./KamiRoyalty.sol";
import "./KamiPlatform.sol";

/**
 * @title KamiTransfer
 * @dev Library for transfer validation and sales functionality including
 * royalty enforcement, transfer validation, and sales processing.
 */
library KamiTransfer {
    using SafeERC20 for IERC20;
    using KamiNFTCore for *;
    using KamiRoyalty for *;
    using KamiPlatform for *;

    /**
     * @dev Validate transfer with royalty enforcement
     * @param tokenId The token ID being transferred
     * @param from The sender address
     * @param to The recipient address
     * @param isApprovedForAll Function to check if operator is approved for all
     * @param getApproved Function to get approved address for token
     */
    function validateTransfer(
        uint256 tokenId,
        address from,
        address to,
        function(address, address) view returns (bool) isApprovedForAll,
        function(uint256) view returns (address) getApproved
    ) internal view {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(from != to, "Transfer to same address");

        // Check if token is rented
        if (KamiNFTCore.isRented(tokenId)) {
            mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
            require(rentals[tokenId].renter == from, "Cannot transfer rented token");
        }

        // Check approval
        bool isApproved = isApprovedForAll(from, msg.sender) || getApproved(tokenId) == msg.sender;
        require(isApproved, "Transfer not approved");
    }

    /**
     * @dev Update rental status on transfer
     * @param tokenId The token ID being transferred
     */
    function updateRentalOnTransfer(
        uint256 tokenId,
        function(address) view 
    ) internal {
        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        
        // If token was rented, end the rental
        if (rentals[tokenId].active) {
            rentals[tokenId].active = false;
        }
    }

    /**
     * @dev Update rental status on transfer (simple version)
     * @param tokenId The token ID being transferred
     */
    function updateRentalOnTransferSimple(
        uint256 tokenId
    ) internal {
        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        
        // If token was rented, end the rental
        if (rentals[tokenId].active) {
            rentals[tokenId].active = false;
        }
    }

    /**
     * @dev Validate burn operation
     * @param tokenId The token ID being burned
     * @param tokenOwner The current owner of the token
     */
    function validateBurn(
        uint256 tokenId,
        address tokenOwner
    ) internal view {
        require(tokenOwner != address(0), "Token owner cannot be zero");
        
        // Check if token is rented
        if (KamiNFTCore.isRented(tokenId)) {
            mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
            require(rentals[tokenId].renter == tokenOwner, "Cannot burn rented token");
        }
    }

    /**
     * @dev Initiate transfer with royalty requirement
     * @param tokenId The token ID being transferred
     * @param to The recipient address
     * @param salePrice The sale price
     * @param owner The current owner of the token
     */
    function initiateTransferWithRoyalty(
        uint256 tokenId,
        address to,
        uint256 salePrice,
        address owner
    ) internal {
        require(owner != address(0), "Owner cannot be zero");
        require(to != address(0), "Recipient cannot be zero");
        require(salePrice > 0, "Sale price must be greater than 0");

        // Generate transfer hash
        bytes32 transferHash = keccak256(abi.encodePacked(tokenId, to, salePrice, block.timestamp));
        
        KamiNFTCore.TransferTracker storage tracker = KamiNFTCore._getTransferTracker();
        tracker.pendingTransfers[transferHash] = true;
        tracker.transferPrices[transferHash] = salePrice;
    }

    /**
     * @dev Calculate transfer payment
     * @param salePrice The sale price
     * @return The calculated payment amount
     */
    function calculateTransferPayment(
        uint256 salePrice
    ) internal view returns (uint256) {
        // Get royalty percentage
        uint96 royaltyPercentage = KamiRoyalty.royaltyPercentage();
        
        // Calculate royalty amount
        uint256 royaltyAmount = (salePrice * royaltyPercentage) / 10000;
        
        // Calculate platform commission
        uint96 platformCommission = KamiPlatform.platformCommission();
        uint256 platformCommissionAmount = (salePrice * platformCommission) / 10000;
        
        // Return total payment required
        return royaltyAmount + platformCommissionAmount;
    }

    /**
     * @dev Pay transfer royalty
     * @param paymentToken The payment token
     * @param tokenId The token ID being transferred
     * @param salePrice The sale price
     * @param owner The current owner of the token
     * @param seller The seller address
     */
    function payTransferRoyalty(
        IERC20 paymentToken,
        uint256 tokenId,
        uint256 salePrice,
        address owner,
        address seller
    ) internal {
        require(owner != address(0), "Owner cannot be zero");
        require(seller != address(0), "Seller cannot be zero");
        require(salePrice > 0, "Sale price must be greater than 0");

        // Distribute transfer royalties
        KamiRoyalty.distributeTransferRoyalties(tokenId, salePrice, paymentToken);
        
        // Distribute platform commission
        uint96 platformCommission = KamiPlatform.platformCommission();
        if (platformCommission > 0) {
            uint256 commissionAmount = (salePrice * platformCommission) / 10000;
            if (commissionAmount > 0) {
                paymentToken.safeTransfer(KamiPlatform.platformAddress(), commissionAmount);
            }
        }
    }

    /**
     * @dev Check if transfer royalty is required
     * @param tokenId The token ID being transferred
     * @param salePrice The sale price
     * @return True if transfer royalty is required, false otherwise
     */
    function isTransferRoyaltyRequired(
        uint256 tokenId,
        uint256 salePrice
    ) internal view returns (bool) {
        // Check if there are transfer royalties configured
        KamiNFTCore.RoyaltyData[] memory receivers = KamiRoyalty.getTransferRoyaltyReceivers(tokenId);
        return receivers.length > 0 && salePrice > 0;
    }

    /**
     * @dev Sell token with royalties and commission
     * @param paymentToken The payment token
     * @param tokenId The token ID being sold
     * @param to The buyer address
     * @param salePrice The sale price
     * @param seller The seller address
     */
    function sellToken(
        IERC20 paymentToken,
        uint256 tokenId,
        address to,
        uint256 salePrice,
        address seller
    ) internal {
        require(to != address(0), "Buyer cannot be zero");
        require(seller != address(0), "Seller cannot be zero");
        require(salePrice > 0, "Sale price must be greater than 0");

        // Transfer payment from buyer to seller
        paymentToken.safeTransferFrom(to, seller, salePrice);
        
        // Distribute royalties and commission
        payTransferRoyalty(paymentToken, tokenId, salePrice, seller, seller);
    }
}
