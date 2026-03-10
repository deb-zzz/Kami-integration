// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title KamiNFTCore
 * @dev Core library providing essential data structures and storage management for NFT contracts.
 * This library contains the fundamental data structures and storage slot management that other
 * libraries depend on.
 */
library KamiNFTCore {
    using SafeERC20 for IERC20;

    // Storage slots for proxy compatibility
    bytes32 private constant ROYALTY_CONFIG_SLOT = keccak256("kami.royalty.config");
    bytes32 private constant PLATFORM_CONFIG_SLOT = keccak256("kami.platform.config");
    bytes32 private constant TRANSFER_TRACKER_SLOT = keccak256("kami.transfer.tracker");
    bytes32 private constant RENTALS_SLOT = keccak256("kami.rentals");

    // Role constants
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant PLATFORM_ROLE = keccak256("PLATFORM_ROLE");
    bytes32 public constant RENTER_ROLE = keccak256("RENTER_ROLE");

    /**
     * @dev Struct to represent a royalty recipient
     * @param receiver The address that will receive the royalty payment
     * @param feeNumerator The royalty percentage in basis points (e.g., 1000 = 10%, 500 = 5%)
     */
    struct RoyaltyData {
        address receiver;
        uint96 feeNumerator;
    }

    /**
     * @dev Rental information structure for tracking token rentals
     * @param renter The address currently renting the token
     * @param startTime The timestamp when the rental started
     * @param endTime The timestamp when the rental will end
     * @param rentalPrice The total price paid for the rental
     * @param active Whether the rental is currently active
     */
    struct Rental {
        address renter;
        uint256 startTime;
        uint256 endTime;
        uint256 rentalPrice;
        bool active;
    }

    /**
     * @dev Platform configuration structure
     * @param address_ The platform address that receives commission
     * @param commissionPercentage The platform commission percentage in basis points
     */
    struct PlatformConfig {
        address address_;
        uint96 commissionPercentage;
    }

    /**
     * @dev Royalty configuration structure
     * @param royaltyPercentage Global royalty percentage in basis points
     * @param mintRoyalties Array of royalty receivers for minting
     * @param transferRoyalties Array of royalty receivers for transfers
     * @param tokenMintRoyalties Token-specific mint royalties
     * @param tokenTransferRoyalties Token-specific transfer royalties
     */
    struct RoyaltyConfig {
        uint96 royaltyPercentage;
        RoyaltyData[] mintRoyalties;
        RoyaltyData[] transferRoyalties;
        mapping(uint256 => RoyaltyData[]) tokenMintRoyalties;
        mapping(uint256 => RoyaltyData[]) tokenTransferRoyalties;
    }

    /**
     * @dev Transfer tracking structure for royalty enforcement
     * @param pendingTransfers Mapping of transfer hashes to pending status
     * @param transferPrices Mapping of transfer hashes to prices
     * @param paidTransfers Mapping of transfer hashes to paid status
     * @param actualSalePrices Mapping of transfer hashes to actual sale prices
     */
    struct TransferTracker {
        mapping(bytes32 => bool) pendingTransfers;
        mapping(bytes32 => uint256) transferPrices;
        mapping(bytes32 => bool) paidTransfers;
        mapping(bytes32 => uint256) actualSalePrices;
    }

    // Storage slot getters
    function _getRoyaltyConfigSlot() private pure returns (bytes32) {
        return ROYALTY_CONFIG_SLOT;
    }

    function _getPlatformConfigSlot() private pure returns (bytes32) {
        return PLATFORM_CONFIG_SLOT;
    }

    function _getTransferTrackerSlot() private pure returns (bytes32) {
        return TRANSFER_TRACKER_SLOT;
    }

    function _getRentalsSlot() private pure returns (bytes32) {
        return RENTALS_SLOT;
    }

    // Storage slot access functions
    function _getRoyaltyConfig() internal pure returns (RoyaltyConfig storage r) {
        bytes32 slot = _getRoyaltyConfigSlot();
        assembly {
            r.slot := slot
        }
    }

    function _getPlatformConfig() internal pure returns (PlatformConfig storage p) {
        bytes32 slot = _getPlatformConfigSlot();
        assembly {
            p.slot := slot
        }
    }

    function _getTransferTracker() internal pure returns (TransferTracker storage t) {
        bytes32 slot = _getTransferTrackerSlot();
        assembly {
            t.slot := slot
        }
    }

    function _getRentals() internal pure returns (mapping(uint256 => Rental) storage r) {
        bytes32 slot = _getRentalsSlot();
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Get platform address
     * @return The platform address
     */
    function platformAddress() internal view returns (address) {
        PlatformConfig storage config = _getPlatformConfig();
        return config.address_;
    }

    /**
     * @dev Get platform commission percentage
     * @return The platform commission percentage in basis points
     */
    function platformCommission() internal view returns (uint96) {
        PlatformConfig storage config = _getPlatformConfig();
        return config.commissionPercentage;
    }

    /**
     * @dev Get royalty percentage
     * @return The global royalty percentage in basis points
     */
    function royaltyPercentage() internal view returns (uint96) {
        RoyaltyConfig storage config = _getRoyaltyConfig();
        return config.royaltyPercentage;
    }

    /**
     * @dev Check if a token is currently rented
     * @param tokenId The token ID to check
     * @return True if the token is rented, false otherwise
     */
    function isRented(uint256 tokenId) internal view returns (bool) {
        mapping(uint256 => Rental) storage rentals = _getRentals();
        return rentals[tokenId].active;
    }
}
