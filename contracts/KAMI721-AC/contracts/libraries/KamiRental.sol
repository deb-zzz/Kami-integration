// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./KamiNFTCore.sol";

/**
 * @title KamiRental
 * @dev Library for rental system functionality including token rental management,
 * rental validation, and rental status tracking.
 */
library KamiRental {
    using SafeERC20 for IERC20;
    using KamiNFTCore for *;

    /**
     * @dev Rent a token
     * @param paymentToken The payment token
     * @param tokenId The token ID to rent
     * @param duration The rental duration in seconds
     * @param rentalPrice The total rental price
     * @param tokenOwner The current owner of the token
     * @param accessControl Access control contract for role verification
     */
    function rentToken(
        IERC20 paymentToken,
        uint256 tokenId,
        uint256 duration,
        uint256 rentalPrice,
        address tokenOwner,
        address accessControl
    ) internal {
        require(tokenOwner != address(0), "Token owner cannot be zero");
        require(duration > 0, "Rental duration must be greater than 0");
        require(rentalPrice > 0, "Rental price must be greater than 0");
        require(accessControl != address(0), "Access control cannot be zero");

        // Verify caller has renter role
        require(
            IAccessControl(accessControl).hasRole(KamiNFTCore.RENTER_ROLE, msg.sender),
            "Caller must have renter role"
        );

        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        
        // Check if token is already rented
        require(!rentals[tokenId].active, "Token is already rented");

        // Transfer rental payment
        paymentToken.safeTransferFrom(msg.sender, tokenOwner, rentalPrice);

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
     * @dev End a rental early
     * @param tokenId The token ID to end rental for
     * @param tokenOwner The current owner of the token
     * @param accessControl Access control contract for role verification
     */
    function endRental(
        uint256 tokenId,
        address tokenOwner,
        address accessControl,
        function(address) view 
    ) internal {
        require(tokenOwner != address(0), "Token owner cannot be zero");
        require(accessControl != address(0), "Access control cannot be zero");

        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        
        // Check if token is rented
        require(rentals[tokenId].active, "Token is not rented");

        // Verify caller is the renter or has owner role
        bool isRenter = rentals[tokenId].renter == msg.sender;
        bool isOwner = IAccessControl(accessControl).hasRole(KamiNFTCore.OWNER_ROLE, msg.sender);
        require(isRenter || isOwner, "Caller must be renter or owner");

        // End rental
        rentals[tokenId].active = false;
    }

    /**
     * @dev End a rental early (simple version)
     * @param tokenId The token ID to end rental for
     * @param tokenOwner The current owner of the token
     * @param accessControl Access control contract for role verification
     */
    function endRentalSimple(
        uint256 tokenId,
        address tokenOwner,
        address accessControl
    ) internal {
        require(tokenOwner != address(0), "Token owner cannot be zero");
        require(accessControl != address(0), "Access control cannot be zero");

        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        
        // Check if token is rented
        require(rentals[tokenId].active, "Token is not rented");

        // Verify caller is the renter or has owner role
        bool isRenter = rentals[tokenId].renter == msg.sender;
        bool isOwner = IAccessControl(accessControl).hasRole(KamiNFTCore.OWNER_ROLE, msg.sender);
        require(isRenter || isOwner, "Caller must be renter or owner");

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
        address tokenOwner
    ) internal {
        require(tokenOwner != address(0), "Token owner cannot be zero");
        require(additionalDuration > 0, "Additional duration must be greater than 0");
        require(additionalPayment > 0, "Additional payment must be greater than 0");

        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        
        // Check if token is rented
        require(rentals[tokenId].active, "Token is not rented");
        require(rentals[tokenId].renter == msg.sender, "Caller must be the renter");

        // Transfer additional payment
        paymentToken.safeTransferFrom(msg.sender, tokenOwner, additionalPayment);

        // Extend rental
        rentals[tokenId].endTime += additionalDuration;
        rentals[tokenId].rentalPrice += additionalPayment;
    }

    /**
     * @dev Get rental information for a token
     * @param tokenId The token ID to get rental info for
     * @param exists Function to check if token exists
     * @return The rental information
     */
    function getRentalInfo(
        uint256 tokenId,
        function(uint256) view returns (bool) exists
    ) internal view returns (KamiNFTCore.Rental memory) {
        require(exists(tokenId), "Token does not exist");

        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        return rentals[tokenId];
    }

    /**
     * @dev Check if user has active rentals
     * @param user The user to check
     * @param totalSupply Function to get total supply
     * @param tokenByIndex Function to get token by index
     * @return True if user has active rentals, false otherwise
     */
    function hasActiveRentals(
        address user,
        function() view returns (uint256) totalSupply,
        function(uint256) view returns (uint256) tokenByIndex
    ) internal view returns (bool) {
        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        
        uint256 supply = totalSupply();
        for (uint256 i = 0; i < supply; i++) {
            uint256 tokenId = tokenByIndex(i);
            if (rentals[tokenId].active && rentals[tokenId].renter == user) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Check if user has active rentals (ERC1155 version)
     * @param user The user to check
     * @param totalSupply Function to get total supply
     * @param tokenByIndex Function to get token by index
     * @return True if user has active rentals, false otherwise
     */
    function hasActiveRentalsERC1155(
        address user,
        function() view returns (uint256) totalSupply,
        function(uint256) view returns (uint256) tokenByIndex
    ) internal view returns (bool) {
        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiNFTCore._getRentals();
        
        uint256 supply = totalSupply();
        for (uint256 i = 0; i < supply; i++) {
            uint256 tokenId = tokenByIndex(i);
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
