// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./KamiNFTCore.sol";
import "./KamiPlatform.sol";
import "./KamiRoyalty.sol";

/**
 * @title KamiRental
 * @dev Library for rental system functionality including token rental management,
 * rental validation, and rental status tracking.
 */
library KamiRental {
    using SafeERC20 for IERC20;
    using KamiNFTCore for *;
    using KamiRoyalty for *;

    /**
     * @dev Rent a token
     * @param paymentToken The payment token
     * @param tokenId The token ID to rent
     * @param duration The rental duration in seconds
     * @param rentalPrice The total rental price
     * @param tokenOwner The current owner of the token
     */
    function rentToken(
        IERC20 paymentToken,
        uint256 tokenId,
        uint256 duration,
        uint256 rentalPrice,
        address tokenOwner,
        address payer // New parameter
    ) internal {
        require(tokenOwner != address(0), "Token owner cannot be zero");
        require(duration > 0, "Rental duration must be greater than 0");
        require(rentalPrice > 0, "Rental price must be greater than 0");
        // Role check moved to main contract

        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        
        // Check if token is already rented
        require(!rentals[tokenId].active, "Token is already rented");

        // Collect payment from renter to contract
        paymentToken.safeTransferFrom(payer, address(this), rentalPrice);

        // Calculate platform commission
        uint96 platformCommission = KamiPlatform.platformCommission();
        uint256 commissionAmount = 0;
        if (platformCommission > 0) {
            commissionAmount = (rentalPrice * platformCommission) / 10000;
        }

        // Transfer platform commission to platform
        if (commissionAmount > 0) {
            paymentToken.safeTransfer(KamiPlatform.platformAddress(), commissionAmount);
        }

        // Calculate remaining amount after platform commission
        uint256 remainingAmount = rentalPrice - commissionAmount;

        // Calculate royalty amount (royalties are calculated on remaining amount after commission)
        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        uint256 royaltyAmount = (remainingAmount * config.royaltyPercentage) / 10000;

        // Distribute mint royalties to royalty receivers (rental uses mint royalties)
        if (royaltyAmount > 0) {
            KamiNFTCore.RoyaltyData[] memory receivers = KamiRoyalty.getMintRoyaltyReceivers(tokenId);
            if (receivers.length > 0) {
                for (uint256 i = 0; i < receivers.length; i++) {
                    uint256 amount = (royaltyAmount * receivers[i].feeNumerator) / 10000;
                    if (amount > 0) {
                        paymentToken.safeTransfer(receivers[i].receiver, amount);
                    }
                }
            }
        }

        // Transfer the rest to the token owner
        uint256 ownerAmount = remainingAmount - royaltyAmount;
        if (ownerAmount > 0) {
            paymentToken.safeTransfer(tokenOwner, ownerAmount);
        }

        // Create rental
        rentals[tokenId] = KamiNFTCore.Rental({
            renter: msg.sender,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            rentalPrice: rentalPrice,
            active: true
        });
    }

    /**
     * @dev Rent a token with explicit payer and renter (for gasless / meta-tx).
     * @param paymentToken The payment token
     * @param tokenId The token ID to rent
     * @param duration The rental duration in seconds
     * @param rentalPrice The total rental price
     * @param tokenOwner The current owner of the token
     * @param payer Address to pull payment from
     * @param renter Address to record as the renter
     */
    function rentTokenFor(
        IERC20 paymentToken,
        uint256 tokenId,
        uint256 duration,
        uint256 rentalPrice,
        address tokenOwner,
        address payer,
        address renter
    ) internal {
        require(tokenOwner != address(0), "Token owner cannot be zero");
        require(payer != address(0), "Payer cannot be zero");
        require(renter != address(0), "Renter cannot be zero");
        require(duration > 0, "Rental duration must be greater than 0");
        require(rentalPrice > 0, "Rental price must be greater than 0");

        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        require(!rentals[tokenId].active, "Token is already rented");

        paymentToken.safeTransferFrom(payer, address(this), rentalPrice);

        uint96 platformCommission = KamiPlatform.platformCommission();
        uint256 commissionAmount = 0;
        if (platformCommission > 0) {
            commissionAmount = (rentalPrice * platformCommission) / 10000;
        }
        if (commissionAmount > 0) {
            paymentToken.safeTransfer(KamiPlatform.platformAddress(), commissionAmount);
        }

        uint256 remainingAmount = rentalPrice - commissionAmount;
        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        uint256 royaltyAmount = (remainingAmount * config.royaltyPercentage) / 10000;

        if (royaltyAmount > 0) {
            KamiNFTCore.RoyaltyData[] memory receivers = KamiRoyalty.getMintRoyaltyReceivers(tokenId);
            if (receivers.length > 0) {
                for (uint256 i = 0; i < receivers.length; i++) {
                    uint256 amount = (royaltyAmount * receivers[i].feeNumerator) / 10000;
                    if (amount > 0) {
                        paymentToken.safeTransfer(receivers[i].receiver, amount);
                    }
                }
            }
        }

        uint256 ownerAmount = remainingAmount - royaltyAmount;
        if (ownerAmount > 0) {
            paymentToken.safeTransfer(tokenOwner, ownerAmount);
        }

        rentals[tokenId] = KamiNFTCore.Rental({
            renter: renter,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            rentalPrice: rentalPrice,
            active: true
        });
    }

    /**
     * @dev End a rental early
     * @param tokenId The token ID to end rental for
     */
    function endRentalSimple(
        uint256 tokenId
    ) internal {
        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        
        // Check if token is rented
        require(rentals[tokenId].active, "Token is not rented");

        // Role check moved to main contract

        // End rental
        rentals[tokenId].active = false;
    }

    /**
     * @dev Extend a rental period
     * @param paymentToken The payment token
     * @param tokenId The token ID to extend rental for
     * @param additionalDuration The additional duration in seconds
     * @param additionalPayment The additional payment required
     * @param tokenOwner The current owner of the token
     */
    function extendRental(
        IERC20 paymentToken,
        uint256 tokenId,
        uint256 additionalDuration,
        uint256 additionalPayment,
        address tokenOwner,
        address payer // New parameter
    ) internal {
        require(tokenOwner != address(0), "Token owner cannot be zero");
        require(additionalDuration > 0, "Additional duration must be greater than 0");
        require(additionalPayment > 0, "Additional payment must be greater than 0");
        
        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        
        // Check if token is rented
        require(rentals[tokenId].active, "Token is not rented");
        require(rentals[tokenId].renter == msg.sender, "Caller must be the renter"); // This check remains in library, as it's directly about the rental state

        // Collect additional payment from renter to contract
        paymentToken.safeTransferFrom(payer, address(this), additionalPayment);

        // Calculate platform commission
        uint96 platformCommission = KamiPlatform.platformCommission();
        uint256 commissionAmount = 0;
        if (platformCommission > 0) {
            commissionAmount = (additionalPayment * platformCommission) / 10000;
        }

        // Transfer platform commission to platform
        if (commissionAmount > 0) {
            paymentToken.safeTransfer(KamiPlatform.platformAddress(), commissionAmount);
        }

        // Calculate remaining amount after platform commission
        uint256 remainingAmount = additionalPayment - commissionAmount;

        // Calculate royalty amount (royalties are calculated on remaining amount after commission)
        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        uint256 royaltyAmount = (remainingAmount * config.royaltyPercentage) / 10000;

        // Distribute mint royalties to royalty receivers (rental uses mint royalties)
        if (royaltyAmount > 0) {
            KamiNFTCore.RoyaltyData[] memory receivers = KamiRoyalty.getMintRoyaltyReceivers(tokenId);
            if (receivers.length > 0) {
                for (uint256 i = 0; i < receivers.length; i++) {
                    uint256 amount = (royaltyAmount * receivers[i].feeNumerator) / 10000;
                    if (amount > 0) {
                        paymentToken.safeTransfer(receivers[i].receiver, amount);
                    }
                }
            }
        }

        // Transfer the rest to the token owner
        uint256 ownerAmount = remainingAmount - royaltyAmount;
        if (ownerAmount > 0) {
            paymentToken.safeTransfer(tokenOwner, ownerAmount);
        }

        // Extend rental
        rentals[tokenId].endTime += additionalDuration;
        rentals[tokenId].rentalPrice += additionalPayment;
    }

    /**
     * @dev Extend a rental period with explicit renter and payer (for gasless / meta-tx).
     * @param paymentToken The payment token
     * @param tokenId The token ID to extend rental for
     * @param additionalDuration Additional duration in seconds
     * @param additionalPayment Additional payment required
     * @param tokenOwner The current owner of the token
     * @param payer Address to pull payment from
     * @param renter Address that must match the current renter
     */
    function extendRentalAs(
        IERC20 paymentToken,
        uint256 tokenId,
        uint256 additionalDuration,
        uint256 additionalPayment,
        address tokenOwner,
        address payer,
        address renter
    ) internal {
        require(tokenOwner != address(0), "Token owner cannot be zero");
        require(payer != address(0), "Payer cannot be zero");
        require(renter != address(0), "Renter cannot be zero");
        require(additionalDuration > 0, "Additional duration must be greater than 0");
        require(additionalPayment > 0, "Additional payment must be greater than 0");

        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        require(rentals[tokenId].active, "Token is not rented");
        require(rentals[tokenId].renter == renter, "Caller must be the renter");

        paymentToken.safeTransferFrom(payer, address(this), additionalPayment);

        uint96 platformCommission = KamiPlatform.platformCommission();
        uint256 commissionAmount = 0;
        if (platformCommission > 0) {
            commissionAmount = (additionalPayment * platformCommission) / 10000;
        }
        if (commissionAmount > 0) {
            paymentToken.safeTransfer(KamiPlatform.platformAddress(), commissionAmount);
        }

        uint256 remainingAmount = additionalPayment - commissionAmount;
        KamiNFTCore.RoyaltyConfig storage config = KamiNFTCore._getRoyaltyConfig();
        uint256 royaltyAmount = (remainingAmount * config.royaltyPercentage) / 10000;

        if (royaltyAmount > 0) {
            KamiNFTCore.RoyaltyData[] memory receivers = KamiRoyalty.getMintRoyaltyReceivers(tokenId);
            if (receivers.length > 0) {
                for (uint256 i = 0; i < receivers.length; i++) {
                    uint256 amount = (royaltyAmount * receivers[i].feeNumerator) / 10000;
                    if (amount > 0) {
                        paymentToken.safeTransfer(receivers[i].receiver, amount);
                    }
                }
            }
        }

        uint256 ownerAmount = remainingAmount - royaltyAmount;
        if (ownerAmount > 0) {
            paymentToken.safeTransfer(tokenOwner, ownerAmount);
        }

        rentals[tokenId].endTime += additionalDuration;
        rentals[tokenId].rentalPrice += additionalPayment;
    }

    /**
     * @dev Get rental information for a token.
     * @param tokenId Token ID to get rental info for.
     * @return Rental information.
     */
    function getRentalInfo(
        uint256 tokenId
    ) internal view returns (KamiNFTCore.Rental memory) {
        require(KamiNFTCore.doesTokenExist(address(this), tokenId), "Token does not exist");

        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        return rentals[tokenId];
    }

    /**
     * @dev Check if user has active rentals (ERC1155 version)
     * @param user The user to check
     * @param currentTokenId The current value of _tokenIdCounter
     * @return True if user has active rentals, false otherwise
     */
    function hasActiveRentalsERC1155(
        address user,
        uint256 currentTokenId
    ) internal view returns (bool) {
        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        
        for (uint256 tokenId = 1; tokenId <= currentTokenId; tokenId++) {
            if (rentals[tokenId].active && rentals[tokenId].renter == user) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Check if a token is currently rented
     * @param tokenId The token ID to check
     * @return True if the token is rented, false otherwise
     */
    function isRented(uint256 tokenId) internal view returns (bool) {
        return KamiNFTCore.isRented(tokenId);
    }

    /**
     * @dev Get rentals mapping (for external access)
     * @return The rentals mapping
     */
    function _getRentals() internal pure returns (mapping(uint256 => KamiNFTCore.Rental) storage) {
        return KamiNFTCore._getRentals();
    }
}