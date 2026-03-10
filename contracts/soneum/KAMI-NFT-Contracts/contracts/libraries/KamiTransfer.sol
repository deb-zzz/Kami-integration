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
     */
    function validateTransfer(
        uint256 tokenId,
        address from,
        address to,
        function(address, address) view returns (bool) isApprovedForAll
    ) internal view {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(from != to, "Transfer to same address");

        // Check if token is rented
        if (KamiNFTCore.isRented(tokenId)) {
            mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
            require(rentals[tokenId].renter == from, "Cannot transfer rented token");
        }

        // Check approval only if the sender is not the one initiating the transfer (i.e., an operator is transferring)
        if (from != msg.sender) {
            bool isApproved = isApprovedForAll(from, msg.sender);
            require(isApproved, "Transfer not approved");
        }

        // Check if transfer royalties are required and have been paid
        KamiNFTCore.TransferTracker storage tracker = KamiNFTCore._getTransferTracker();
        bytes32 transferKey = keccak256(abi.encodePacked(tokenId, from, to));
        uint256 transferPrice = tracker.transferPrices[transferKey];
        bool isPaid = tracker.paidTransfers[transferKey];
        
        // Check if there are transfer royalties configured
        KamiNFTCore.RoyaltyData[] memory receivers = KamiRoyalty.getTransferRoyaltyReceivers(tokenId);
        
        // If royalties are configured AND there's a price > 0 for this transfer, enforce payment
        if (receivers.length > 0 && transferPrice > 0) {
            require(isPaid, "Transfer royalties not paid");
        }
    }

    /**
     * @dev Validate transfer with optional signature auth (for gasless/meta-tx).
     * When authorized != address(0), treats authorized as the operator instead of msg.sender.
     */
    function validateTransferWithAuth(
        uint256 tokenId,
        address from,
        address to,
        function(address, address) view returns (bool) isApprovedForAll,
        address authorized
    ) internal view {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(from != to, "Transfer to same address");

        if (KamiNFTCore.isRented(tokenId)) {
            mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
            require(rentals[tokenId].renter == from, "Cannot transfer rented token");
        }

        if (authorized != address(0)) {
            require(authorized == from, "Transfer not authorized");
        } else if (from != msg.sender) {
            require(isApprovedForAll(from, msg.sender), "Transfer not approved");
        }

        KamiNFTCore.TransferTracker storage tracker = KamiNFTCore._getTransferTracker();
        bytes32 transferKey = keccak256(abi.encodePacked(tokenId, from, to));
        uint256 transferPrice = tracker.transferPrices[transferKey];
        bool isPaid = tracker.paidTransfers[transferKey];
        KamiNFTCore.RoyaltyData[] memory receivers = KamiRoyalty.getTransferRoyaltyReceivers(tokenId);
        if (receivers.length > 0 && transferPrice > 0) {
            require(isPaid, "Transfer royalties not paid");
        }
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
     * @param seller The seller address (original owner)
     * @param buyer The buyer address (who pays)
     */
    function payTransferRoyalty(
        IERC20 paymentToken,
        uint256 tokenId,
        uint256 salePrice,
        address seller,
        address buyer
    ) internal {
        require(seller != address(0), "Seller cannot be zero");
        require(buyer != address(0), "Buyer cannot be zero");
        require(salePrice > 0, "Sale price must be greater than 0");

        // Check if transfer was initiated
        // The hash was created with (tokenId, buyer, salePrice, timestamp) in initiateTransferWithRoyalty
        KamiNFTCore.TransferTracker storage tracker = KamiNFTCore._getTransferTracker();
        bool transferFound = false;
        
        // This is a simplified check - in a real implementation, you'd want to store
        // the transfer hash in a mapping keyed by tokenId and salePrice
        for (uint256 i = 0; i < 1000; i++) { // Check recent timestamps
            bytes32 transferHash = keccak256(abi.encodePacked(tokenId, buyer, salePrice, block.timestamp - i));
            if (tracker.pendingTransfers[transferHash]) {
                tracker.pendingTransfers[transferHash] = false;
                transferFound = true;
                break;
            }
        }
        
        require(transferFound, "Transfer not initiated or royalty already paid");

        // Calculate platform commission
        uint96 platformCommission = KamiPlatform.platformCommission();
        uint256 commissionAmount = 0;
        if (platformCommission > 0) {
            commissionAmount = (salePrice * platformCommission) / 10000;
        }

        // Transfer platform commission from buyer to platform
        if (commissionAmount > 0) {
            paymentToken.safeTransferFrom(buyer, KamiPlatform.platformAddress(), commissionAmount);
        }

        // Calculate the remaining amount after platform commission
        uint256 remainingAmount = salePrice - commissionAmount;

        // Calculate royalty amount
        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        uint256 royaltyAmount = (remainingAmount * config.royaltyPercentage) / 10000;

        // Distribute transfer royalties from buyer to royalty receivers
        KamiRoyalty.distributeTransferRoyalties(tokenId, royaltyAmount, paymentToken, buyer);

        // Transfer the rest to the seller
        uint256 sellerAmount = remainingAmount - royaltyAmount;
        if (sellerAmount > 0) {
            paymentToken.safeTransferFrom(buyer, seller, sellerAmount);
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

        // Get the buyer - in most cases this will be msg.sender (who calls sellToken)
        // But we use 'to' parameter which is the buyer
        address buyer = to;

        // Calculate platform commission
        uint96 platformCommission = KamiPlatform.platformCommission();
        uint256 commissionAmount = 0;
        if (platformCommission > 0) {
            commissionAmount = (salePrice * platformCommission) / 10000;
        }

        // Collect payment from buyer
        paymentToken.safeTransferFrom(buyer, address(this), salePrice);

        // Calculate the remaining amount after platform commission
        uint256 remainingAmount = salePrice - commissionAmount;

        // Transfer platform commission
        if (commissionAmount > 0) {
            paymentToken.safeTransfer(KamiPlatform.platformAddress(), commissionAmount);
        }

        // Calculate royalty amount (royalties are paid by seller from their proceeds)
        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        uint256 royaltyAmount = (remainingAmount * config.royaltyPercentage) / 10000;

        // Distribute transfer royalties from contract to royalty receivers (seller pays)
        // We use address(this) as payer since we already collected payment
        if (royaltyAmount > 0) {
            KamiNFTCore.RoyaltyData[] memory receivers = KamiRoyalty.getTransferRoyaltyReceivers(tokenId);
            if (receivers.length > 0) {
                for (uint256 i = 0; i < receivers.length; i++) {
                    uint256 amount = (royaltyAmount * receivers[i].feeNumerator) / 10000;
                    if (amount > 0) {
                        paymentToken.safeTransfer(receivers[i].receiver, amount);
                    }
                }
            }
        }

        // Transfer the rest to the seller
        uint256 sellerAmount = remainingAmount - royaltyAmount;
        if (sellerAmount > 0) {
            paymentToken.safeTransfer(seller, sellerAmount);
        }

        // Mark the transfer as paid so the actual token transfer can proceed
        KamiNFTCore.TransferTracker storage tracker = KamiNFTCore._getTransferTracker();
        bytes32 transferKey = keccak256(abi.encodePacked(tokenId, seller, to));
        tracker.paidTransfers[transferKey] = true;
        tracker.transferPrices[transferKey] = salePrice;
    }
}
