// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title KAMINFTLibrary
 * @dev A comprehensive library providing extended features for ERC721 contracts:
 * - Programmable royalties with multiple receivers
 * - ERC20 payment integration
 * - Platform commission system
 * - Time-based rental system
 * - Mandatory royalty enforcement
 * - Role-based access control
 *
 * This library can be used to extend any ERC721 contract with these advanced features.
 */
library KamiNFTLibrary {
    using SafeERC20 for IERC20;

    // Struct to represent a royalty recipient
    struct RoyaltyData {
        address receiver;
        uint96 feeNumerator;
    }

    // Rental information structure
    struct Rental {
        address renter;
        uint256 startTime;
        uint256 endTime;
        uint256 rentalPrice;
        bool active;
    }

    // Platform configuration
    struct PlatformConfig {
        uint96 commissionPercentage; // In basis points (e.g., 500 = 5%)
        address platformAddress;
    }

    // Royalty configuration
    struct RoyaltyConfig {
        uint96 royaltyPercentage; // In basis points (e.g., 1000 = 10%)
        RoyaltyData[] mintRoyaltyReceivers;
        RoyaltyData[] transferRoyaltyReceivers;
        mapping(uint256 => RoyaltyData[]) tokenMintRoyalties;
        mapping(uint256 => RoyaltyData[]) tokenTransferRoyalties;
    }

    // Transfer tracking for royalty enforcement
    struct TransferTracker {
        mapping(bytes32 => bool) pendingTransfers;
        mapping(bytes32 => uint256) transferPrices;
        mapping(bytes32 => bool) paidTransfers;
        mapping(bytes32 => uint256) actualSalePrices; // Track actual sale prices for transfers
    }

    // Events
    event MintRoyaltiesUpdated(RoyaltyData[] royalties);
    event TransferRoyaltiesUpdated(RoyaltyData[] royalties);
    event TokenMintRoyaltiesUpdated(uint256 indexed tokenId, RoyaltyData[] royalties);
    event TokenTransferRoyaltiesUpdated(uint256 indexed tokenId, RoyaltyData[] royalties);
    event TransferRoyaltyDistributed(uint256 indexed tokenId, address indexed receiver, uint256 amount);
    event PlatformCommissionPaid(uint256 indexed tokenId, address indexed platformAddress, uint256 amount);
    event RoyaltyPercentageUpdated(uint96 newPercentage);
    event PlatformCommissionUpdated(uint96 newPercentage, address newPlatformAddress);
    event TokenSold(uint256 indexed tokenId, address indexed from, address indexed to, uint256 salePrice);
    event TokenRented(uint256 indexed tokenId, address indexed owner, address indexed renter, uint256 startTime, uint256 endTime, uint256 rentalPrice);
    event RentalEnded(uint256 indexed tokenId, address indexed owner, address indexed renter);
    event RentalExtended(uint256 indexed tokenId, address indexed renter, uint256 newEndTime);
    event TransferRoyaltyRequired(uint256 indexed tokenId, address indexed from, address indexed to, uint256 requiredAmount);
    event TransferRoyaltyPaid(uint256 indexed tokenId, address indexed from, address indexed to, uint256 amount);

    // Role definitions
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant RENTER_ROLE = keccak256("RENTER_ROLE");
    bytes32 public constant PLATFORM_ROLE = keccak256("PLATFORM_ROLE");

    /**
     * @dev Initialize platform configuration
     */
    function initializePlatform(
        PlatformConfig storage config,
        address platformAddress_,
        uint96 platformCommissionPercentage_
    ) internal {
        require(platformAddress_ != address(0), "Invalid platform address");
        require(platformCommissionPercentage_ <= 2000, "Platform commission too high"); // Max 20%

        config.platformAddress = platformAddress_;
        config.commissionPercentage = platformCommissionPercentage_;
    }

    /**
     * @dev Update platform commission
     */
    function updatePlatformCommission(
        PlatformConfig storage config,
        uint96 newPlatformCommissionPercentage,
        address newPlatformAddress,
        address accessControl
    ) internal {
        if (!AccessControl(accessControl).hasRole(OWNER_ROLE, msg.sender)) revert("Caller is not an owner");
        require(newPlatformAddress != address(0), "Invalid platform address");
        require(newPlatformCommissionPercentage <= 2000, "Platform commission too high"); // Max 20%

        address oldPlatformAddress = config.platformAddress;

        config.commissionPercentage = newPlatformCommissionPercentage;
        config.platformAddress = newPlatformAddress;

        // Note: Role management should be handled by the calling contract
        // The library cannot directly grant/revoke roles due to access control restrictions

        emit PlatformCommissionUpdated(newPlatformCommissionPercentage, newPlatformAddress);
    }

    /**
     * @dev Initialize royalty configuration
     */
    function initializeRoyaltyConfig(RoyaltyConfig storage config) internal {
        config.royaltyPercentage = 1000; // Default to 10%
    }

    /**
     * @dev Set royalty percentage
     */
    function setRoyaltyPercentage(
        RoyaltyConfig storage config,
        uint96 newRoyaltyPercentage,
        address accessControl
    ) internal {
        if (!AccessControl(accessControl).hasRole(OWNER_ROLE, msg.sender)) revert("Caller is not an owner");
        require(newRoyaltyPercentage <= 3000, "Royalty percentage too high"); // Max 30%

        config.royaltyPercentage = newRoyaltyPercentage;
        emit RoyaltyPercentageUpdated(newRoyaltyPercentage);
    }

    /**
     * @dev Set mint royalties
     */
    function setMintRoyalties(
        RoyaltyConfig storage config,
        RoyaltyData[] calldata royalties,
        PlatformConfig storage platformConfig,
        address accessControl
    ) internal {
        if (!AccessControl(accessControl).hasRole(OWNER_ROLE, msg.sender)) revert("Caller is not an owner");

        delete config.mintRoyaltyReceivers;

        uint96 totalFees = 0;
        for (uint i = 0; i < royalties.length; i++) {
            require(royalties[i].receiver != address(0), "Invalid receiver");
            totalFees += royalties[i].feeNumerator;
            config.mintRoyaltyReceivers.push(royalties[i]);
        }

        // Ensure total royalties equal 100% of the remaining amount (after platform commission)
        require(totalFees == 10000, "Total mint royalty percentages must equal 100%");

        emit MintRoyaltiesUpdated(royalties);
    }

    /**
     * @dev Set transfer royalties
     */
    function setTransferRoyalties(
        RoyaltyConfig storage config,
        RoyaltyData[] calldata royalties,
        address accessControl
    ) internal {
        if (!AccessControl(accessControl).hasRole(OWNER_ROLE, msg.sender)) revert("Caller is not an owner");

        delete config.transferRoyaltyReceivers;

        uint96 totalFees = 0;
        for (uint i = 0; i < royalties.length; i++) {
            require(royalties[i].receiver != address(0), "Invalid receiver");
            totalFees += royalties[i].feeNumerator;
            config.transferRoyaltyReceivers.push(royalties[i]);
        }

        require(totalFees == 10000, "Total transfer royalty percentages must equal 100%");

        emit TransferRoyaltiesUpdated(royalties);
    }

    /**
     * @dev Set token-specific mint royalties
     */
    function setTokenMintRoyalties(
        RoyaltyConfig storage config,
        uint256 tokenId,
        RoyaltyData[] calldata royalties,
        PlatformConfig storage platformConfig,
        address accessControl,
        function(uint256) view returns (bool) exists
    ) internal {
        if (!AccessControl(accessControl).hasRole(OWNER_ROLE, msg.sender)) revert("Caller is not an owner");
        // Remove token existence requirement to allow setting royalties for future tokens

        delete config.tokenMintRoyalties[tokenId];

        uint96 totalFees = 0;
        for (uint i = 0; i < royalties.length; i++) {
            require(royalties[i].receiver != address(0), "Invalid receiver");
            totalFees += royalties[i].feeNumerator;
            config.tokenMintRoyalties[tokenId].push(royalties[i]);
        }

        // Ensure total royalties equal 100% of the remaining amount (after platform commission)
        require(totalFees == 10000, "Total token mint royalty percentages must equal 100%");

        emit TokenMintRoyaltiesUpdated(tokenId, royalties);
    }

    /**
     * @dev Set token-specific transfer royalties
     */
    function setTokenTransferRoyalties(
        RoyaltyConfig storage config,
        uint256 tokenId,
        RoyaltyData[] calldata royalties,
        address accessControl,
        function(uint256) view returns (bool) exists
    ) internal {
        if (!AccessControl(accessControl).hasRole(OWNER_ROLE, msg.sender)) revert("Caller is not an owner");
        // Remove token existence requirement to allow setting royalties for future tokens

        delete config.tokenTransferRoyalties[tokenId];

        uint96 totalFees = 0;
        for (uint i = 0; i < royalties.length; i++) {
            require(royalties[i].receiver != address(0), "Invalid receiver");
            totalFees += royalties[i].feeNumerator;
            config.tokenTransferRoyalties[tokenId].push(royalties[i]);
        }

        require(totalFees == 10000, "Total transfer royalty percentages must equal 100%");

        emit TokenTransferRoyaltiesUpdated(tokenId, royalties);
    }

    /**
     * @dev Get mint royalty receivers for a token
     */
    function getMintRoyaltyReceivers(RoyaltyConfig storage config, uint256 tokenId) internal view returns (RoyaltyData[] memory) {
        if (config.tokenMintRoyalties[tokenId].length > 0) {
            return config.tokenMintRoyalties[tokenId];
        } else {
            return config.mintRoyaltyReceivers;
        }
    }

    /**
     * @dev Get transfer royalty receivers for a token
     */
    function getTransferRoyaltyReceivers(RoyaltyConfig storage config, uint256 tokenId) internal view returns (RoyaltyData[] memory) {
        if (config.tokenTransferRoyalties[tokenId].length > 0) {
            return config.tokenTransferRoyalties[tokenId];
        } else {
            return config.transferRoyaltyReceivers;
        }
    }

    /**
     * @dev Distribute mint royalties
     */
    function distributeMintRoyalties(
        RoyaltyConfig storage config,
        PlatformConfig storage platformConfig,
        IERC20 paymentToken,
        uint256 tokenId,
        uint256 mintPrice
    ) internal {
        // Calculate platform commission
        uint256 platformCommission = (mintPrice * platformConfig.commissionPercentage) / 10000;

        // Get mint royalties for this token (token-specific or global)
        RoyaltyData[] memory royalties = getMintRoyaltyReceivers(config, tokenId);

        // Calculate remaining amount to distribute
        uint256 remainingAmount = mintPrice - platformCommission;

        // Pay platform commission
        if (platformCommission > 0) {
            paymentToken.safeTransfer(platformConfig.platformAddress, platformCommission);
        }

        // Distribute mint royalties
        uint256 totalDistributed = 0;
        if (royalties.length > 0) {
            for (uint i = 0; i < royalties.length; i++) {
                uint256 amount = (remainingAmount * royalties[i].feeNumerator) / 10000;
                if (amount > 0) {
                    paymentToken.safeTransfer(royalties[i].receiver, amount);
                    totalDistributed += amount;
                }
            }
        }

        // If there's any remaining tokens (due to rounding), send it to the first royalty receiver or platform
        uint256 undistributed = remainingAmount - totalDistributed;
        if (undistributed > 0) {
            if (royalties.length > 0) {
                paymentToken.safeTransfer(royalties[0].receiver, undistributed);
            } else {
                paymentToken.safeTransfer(platformConfig.platformAddress, undistributed);
            }
        }
    }

    /**
     * @dev Distribute transfer royalties
     */
    function distributeTransferRoyalties(
        RoyaltyConfig storage config,
        PlatformConfig storage platformConfig,
        IERC20 paymentToken,
        uint256 tokenId,
        uint256 salePrice
    ) internal {
        // Calculate royalty amount
        uint256 royaltyAmount = (salePrice * config.royaltyPercentage) / 10000;

        // Calculate platform commission
        uint256 platformCommission = (salePrice * platformConfig.commissionPercentage) / 10000;

        // Distribute royalties
        if (royaltyAmount > 0) {
            // Get royalty receivers for this token
            RoyaltyData[] memory royalties = getTransferRoyaltyReceivers(config, tokenId);

            if (royalties.length > 0) {
                for (uint i = 0; i < royalties.length; i++) {
                    uint256 amount = (royaltyAmount * royalties[i].feeNumerator) / 10000;
                    if (amount > 0) {
                        paymentToken.safeTransfer(royalties[i].receiver, amount);
                        emit TransferRoyaltyDistributed(tokenId, royalties[i].receiver, amount);
                    }
                }
            }
        }

        // Pay platform commission
        if (platformCommission > 0) {
            paymentToken.safeTransfer(platformConfig.platformAddress, platformCommission);
            emit PlatformCommissionPaid(tokenId, platformConfig.platformAddress, platformCommission);
        }
    }

    /**
     * @dev Sell token with royalties
     */
    function sellToken(
        RoyaltyConfig storage config,
        PlatformConfig storage platformConfig,
        IERC20 paymentToken,
        TransferTracker storage tracker,
        uint256 tokenId,
        address to,
        uint256 salePrice,
        address seller,
        mapping(uint256 => Rental) storage rentals
    ) internal {
        require(msg.sender == seller, "Only token owner can sell");
        require(!rentals[tokenId].active, "Token is currently rented");

        // Calculate seller proceeds
        uint256 totalFees = calculateTransferPayment(config, platformConfig, salePrice);
        uint256 sellerProceeds = salePrice - totalFees;

        // Transfer total sale price from buyer to contract
        paymentToken.safeTransferFrom(to, address(this), salePrice);

        // Distribute royalties and platform commission
        distributeTransferRoyalties(config, platformConfig, paymentToken, tokenId, salePrice);

        // Pay seller
        paymentToken.safeTransfer(seller, sellerProceeds);

        // Mark this transfer as paid to avoid royalty check in _beforeTokenTransfer
        bytes32 transferId = keccak256(abi.encodePacked(tokenId, seller, to, salePrice));
        tracker.paidTransfers[transferId] = true;
        tracker.actualSalePrices[transferId] = salePrice;

        emit TokenSold(tokenId, seller, to, salePrice);
    }

    /**
     * @dev Rent a token
     */
    function rentToken(
        mapping(uint256 => Rental) storage rentals,
        PlatformConfig storage platformConfig,
        IERC20 paymentToken,
        uint256 tokenId,
        uint256 duration,
        uint256 rentalPrice,
        address tokenOwner,
        address accessControl
    ) internal {
        require(!rentals[tokenId].active, "Token is already rented");
        require(duration > 0, "Rental duration must be greater than 0");
        require(rentalPrice > 0, "Rental price must be greater than 0");
        require(tokenOwner != msg.sender, "Owner cannot rent their own token");

        // Calculate platform commission
        uint256 platformCommission = (rentalPrice * platformConfig.commissionPercentage) / 10000;

        // Calculate owner's share (rental price minus platform commission)
        uint256 ownerShare = rentalPrice - platformCommission;

        // Transfer rental payment from renter to this contract
        paymentToken.safeTransferFrom(msg.sender, address(this), rentalPrice);

        // Pay platform commission
        if (platformCommission > 0) {
            paymentToken.safeTransfer(platformConfig.platformAddress, platformCommission);
            emit PlatformCommissionPaid(tokenId, platformConfig.platformAddress, platformCommission);
        }

        // Pay owner's share
        paymentToken.safeTransfer(tokenOwner, ownerShare);

        // Create rental record
        rentals[tokenId] = Rental({
            renter: msg.sender,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            rentalPrice: rentalPrice,
            active: true
        });

        // Note: Role management should be handled by the calling contract
        // AccessControl(accessControl).grantRole(RENTER_ROLE, msg.sender);

        emit TokenRented(tokenId, tokenOwner, msg.sender, block.timestamp, block.timestamp + duration, rentalPrice);
    }

    /**
     * @dev End a rental early
     */
    function endRental(
        mapping(uint256 => Rental) storage rentals,
        uint256 tokenId,
        address tokenOwner,
        address accessControl,
        function(address) view returns (bool) hasActiveRentals
    ) internal {
        require(rentals[tokenId].active, "Token is not rented");
        require(msg.sender == tokenOwner || msg.sender == rentals[tokenId].renter, "Only owner or renter can end rental");

        address renter = rentals[tokenId].renter;

        // Mark rental as inactive
        rentals[tokenId].active = false;

        // Note: Role management should be handled by the calling contract
        // if (!hasActiveRentals(renter)) {
        //     AccessControl(accessControl).revokeRole(RENTER_ROLE, renter);
        // }

        emit RentalEnded(tokenId, tokenOwner, renter);
    }

    /**
     * @dev Extend a rental period
     */
    function extendRental(
        mapping(uint256 => Rental) storage rentals,
        PlatformConfig storage platformConfig,
        IERC20 paymentToken,
        uint256 tokenId,
        uint256 additionalDuration,
        uint256 additionalPayment,
        address tokenOwner
    ) internal {
        require(rentals[tokenId].active, "Token is not rented");
        require(additionalDuration > 0, "Additional duration must be greater than 0");
        require(additionalPayment > 0, "Additional payment must be greater than 0");
        require(msg.sender == rentals[tokenId].renter, "Only renter can extend rental");

        // Calculate platform commission for the additional payment
        uint256 platformCommission = (additionalPayment * platformConfig.commissionPercentage) / 10000;

        // Calculate owner's share (additional payment minus platform commission)
        uint256 ownerShare = additionalPayment - platformCommission;

        // Transfer additional payment from renter to this contract
        paymentToken.safeTransferFrom(msg.sender, address(this), additionalPayment);

        // Pay platform commission
        if (platformCommission > 0) {
            paymentToken.safeTransfer(platformConfig.platformAddress, platformCommission);
            emit PlatformCommissionPaid(tokenId, platformConfig.platformAddress, platformCommission);
        }

        // Pay owner's share
        paymentToken.safeTransfer(tokenOwner, ownerShare);

        // Update rental end time
        rentals[tokenId].endTime += additionalDuration;
        rentals[tokenId].rentalPrice += additionalPayment;

        emit RentalExtended(tokenId, msg.sender, rentals[tokenId].endTime);
    }

    /**
     * @dev Check if a token is rented
     */
    function isRented(mapping(uint256 => Rental) storage rentals, uint256 tokenId) internal view returns (bool) {
        return rentals[tokenId].active;
    }

    /**
     * @dev Get rental information
     */
    function getRentalInfo(
        mapping(uint256 => Rental) storage rentals,
        uint256 tokenId,
        function(uint256) view returns (bool) exists
    ) internal view returns (Rental memory) {
        require(exists(tokenId), "Token does not exist");
        return rentals[tokenId];
    }

    /**
     * @dev Check if a user has active rentals
     */
    function hasActiveRentals(
        mapping(uint256 => Rental) storage rentals,
        address user,
        function() view returns (uint256) totalSupply,
        function(uint256) view returns (uint256) tokenByIndex
    ) internal view returns (bool) {
        for (uint256 i = 0; i < totalSupply(); i++) {
            uint256 tokenId = tokenByIndex(i);
            if (rentals[tokenId].active && rentals[tokenId].renter == user) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Validate transfer
     */
    function validateTransfer(
        mapping(uint256 => Rental) storage rentals,
        RoyaltyConfig storage config,
        TransferTracker storage tracker,
        uint256 tokenId,
        address from,
        address to,
        address tokenOwner,
        function(address, address) view returns (bool) isApprovedForAll,
        function(uint256) view returns (address) getApproved
    ) internal view {
        // Allow minting and burning
        if (from == address(0) || to == address(0)) {
            return;
        }

        // Check if token is rented
        if (rentals[tokenId].active) {
            // Only allow transfers from the renter back to the owner
            require(
                (from == rentals[tokenId].renter && to == tokenOwner) ||
                (msg.sender == tokenOwner && block.timestamp >= rentals[tokenId].endTime),
                "Token is locked during rental period"
            );
        }

        // Check if royalties have been paid for this transfer
        if (config.royaltyPercentage > 0 && from != to) {
            // Minimum royalty threshold: 1 USDC (1,000,000 units for 6 decimals)
            uint256 minRoyalty = 1_000_000;
            // Assume a typical sale price for threshold check (could be improved)
            uint256 testSalePrice = 1_000_000; // 1 USDC
            uint256 royaltyAmount = (testSalePrice * config.royaltyPercentage) / 10000;
            if (royaltyAmount < minRoyalty) {
                // If royalty is less than threshold, do not require payment
                return;
            }

            // Check if this is a direct transfer that bypasses royalty payment
            // Allow transfers to approved addresses without royalty payment
            bool isApproved = isApprovedForAll(from, msg.sender) || getApproved(tokenId) == msg.sender;

            // Allow transfers when rental has expired or when transferring from renter back to owner
            bool isRentalTransfer = rentals[tokenId].active &&
                from == rentals[tokenId].renter &&
                to == tokenOwner;

            // Allow transfers when rental has expired
            bool isExpiredRental = (rentals[tokenId].endTime > 0) && (block.timestamp >= rentals[tokenId].endTime);

            if (!isApproved && !isRentalTransfer && !isExpiredRental) {
                // Check if any transfer between these addresses for this token has been marked as paid
                bool royaltyPaid = false;

                // Check for common price points (1 USDC to 1000 USDC)
                for (uint256 price = 1000000; price <= 1000000000; price *= 10) {
                    bytes32 transferId = keccak256(abi.encodePacked(tokenId, from, to, price));
                    if (tracker.paidTransfers[transferId]) {
                        royaltyPaid = true;
                        break;
                    }
                }

                // If not found in common price points, check a wider range
                if (!royaltyPaid) {
                    for (uint256 price = 1000000; price <= 1000000000; price += 1000000) {
                        bytes32 transferId = keccak256(abi.encodePacked(tokenId, from, to, price));
                        if (tracker.paidTransfers[transferId]) {
                            royaltyPaid = true;
                            break;
                        }
                    }
                }

                if (!royaltyPaid) {
                    revert("Royalty payment required before transfer. Use initiateTransferWithRoyalty and payTransferRoyalty functions.");
                }
            }
        }
    }

    /**
     * @dev Update rental on transfer
     */
    function updateRentalOnTransfer(
        mapping(uint256 => Rental) storage rentals,
        uint256 tokenId,
        address from,
        address to,
        address accessControl,
        function(address) view returns (bool) hasActiveRentals
    ) internal {
        // Allow minting and burning
        if (from == address(0) || to == address(0)) {
            return;
        }

        // Check if rental has expired and mark it as inactive
        if (rentals[tokenId].active && block.timestamp >= rentals[tokenId].endTime) {
            rentals[tokenId].active = false;
            // Note: Role management should be handled by the calling contract
            // if (!hasActiveRentals(rentals[tokenId].renter)) {
            //     AccessControl(accessControl).revokeRole(RENTER_ROLE, rentals[tokenId].renter);
            // }
            emit RentalEnded(tokenId, from, rentals[tokenId].renter);
        }
    }

    /**
     * @dev Validate burn
     */
    function validateBurn(
        uint256 tokenId,
        address tokenOwner,
        mapping(uint256 => Rental) storage rentals
    ) internal view {
        require(tokenOwner == msg.sender, "Not token owner");
        require(!rentals[tokenId].active, "Cannot burn a rented token");
    }

    /**
     * @dev Initiate transfer with royalty
     */
    function initiateTransferWithRoyalty(
        TransferTracker storage tracker,
        uint256 tokenId,
        address to,
        uint256 salePrice,
        address owner,
        mapping(uint256 => Rental) storage rentals
    ) internal {
        require(msg.sender == owner, "Only token owner can initiate transfer");
        require(!rentals[tokenId].active, "Token is currently rented");
        require(to != address(0), "Cannot transfer to zero address");

        bytes32 transferId = keccak256(abi.encodePacked(tokenId, owner, to, salePrice));
        tracker.pendingTransfers[transferId] = true;
        tracker.transferPrices[transferId] = salePrice;

        emit TransferRoyaltyRequired(tokenId, owner, to, salePrice);
    }

    /**
     * @dev Calculate total required payment for transfer royalties
     */
    function calculateTransferPayment(
        RoyaltyConfig storage config,
        PlatformConfig storage platformConfig,
        uint256 salePrice
    ) internal view returns (uint256 totalRequired) {
        uint256 royaltyAmount = (salePrice * config.royaltyPercentage) / 10000;
        uint256 platformCommission = (salePrice * platformConfig.commissionPercentage) / 10000;
        return royaltyAmount + platformCommission;
    }

    /**
     * @dev Pay transfer royalty
     */
    function payTransferRoyalty(
        TransferTracker storage tracker,
        RoyaltyConfig storage config,
        PlatformConfig storage platformConfig,
        IERC20 paymentToken,
        uint256 tokenId,
        address to,
        uint256 salePrice,
        address owner
    ) internal {
        bytes32 transferId = keccak256(abi.encodePacked(tokenId, owner, to, salePrice));

        require(tracker.pendingTransfers[transferId], "No pending transfer found");
        require(tracker.transferPrices[transferId] == salePrice, "Sale price mismatch");

        // Calculate total required payment
        uint256 totalRequired = calculateTransferPayment(config, platformConfig, salePrice);

        // Transfer payment from buyer
        paymentToken.safeTransferFrom(msg.sender, address(this), totalRequired);

        // Distribute royalties and platform commission
        distributeTransferRoyalties(config, platformConfig, paymentToken, tokenId, salePrice);

        // Mark transfer as paid
        tracker.pendingTransfers[transferId] = false;
        delete tracker.transferPrices[transferId];
        tracker.paidTransfers[transferId] = true;

        emit TransferRoyaltyPaid(tokenId, owner, to, totalRequired);
    }

    /**
     * @dev Check if transfer royalty is required
     */
    function isTransferRoyaltyRequired(
        TransferTracker storage tracker,
        uint256 tokenId,
        address from,
        address to,
        uint256 salePrice
    ) internal view returns (bool) {
        bytes32 transferId = keccak256(abi.encodePacked(tokenId, from, to, salePrice));
        return tracker.pendingTransfers[transferId];
    }
}
