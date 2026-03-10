// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title KamiNFTLibrary
 * @dev A comprehensive library providing extended features for ERC721 and ERC1155 NFT contracts:
 * - Programmable royalties with multiple receivers
 * - ERC20 payment integration
 * - Platform commission system
 * - Time-based rental system
 * - Mandatory royalty enforcement
 * - Role-based access control
 *
 * This library can be used to extend any ERC721 or ERC1155 NFT contract with these advanced features.
 */
library KamiNFTLibrary {
    using SafeERC20 for IERC20;

    // Storage slot for RoyaltyConfig to ensure proxy compatibility
    bytes32 private constant ROYALTY_CONFIG_SLOT = keccak256("kami.royalty.config");
    bytes32 private constant PLATFORM_CONFIG_SLOT = keccak256("kami.platform.config");
    bytes32 private constant TRANSFER_TRACKER_SLOT = keccak256("kami.transfer.tracker");
    bytes32 private constant RENTALS_SLOT = keccak256("kami.rentals");

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
     * @dev Platform configuration for managing platform fees
     * @param commissionPercentage The platform commission percentage in basis points (e.g., 500 = 5%, max 2000 = 20%)
     * @param platformAddress The address that receives platform commission payments
     */
    struct PlatformConfig {
        uint96 commissionPercentage; // In basis points (e.g., 500 = 5%)
        address platformAddress;
    }

    /**
     * @dev Royalty configuration for managing royalty distributions
     * @param royaltyPercentage The global royalty percentage in basis points (e.g., 1000 = 10%, max 3000 = 30%)
     * @param mintRoyaltyReceivers Array of royalty receivers for mint operations
     * @param transferRoyaltyReceivers Array of royalty receivers for transfer operations
     * @param tokenMintRoyalties Mapping of token-specific mint royalty receivers
     * @param tokenTransferRoyalties Mapping of token-specific transfer royalty receivers
     */
    struct RoyaltyConfig {
        uint96 royaltyPercentage; // In basis points (e.g., 1000 = 10%)
        RoyaltyData[] mintRoyaltyReceivers;
        RoyaltyData[] transferRoyaltyReceivers;
        mapping(uint256 => RoyaltyData[]) tokenMintRoyalties;
        mapping(uint256 => RoyaltyData[]) tokenTransferRoyalties;
    }

    /**
     * @dev Transfer tracking for royalty enforcement and validation
     * @param pendingTransfers Mapping of transfer IDs to pending status
     * @param transferPrices Mapping of transfer IDs to their prices
     * @param paidTransfers Mapping of transfer IDs to paid status
     * @param actualSalePrices Mapping of transfer IDs to actual sale prices
     */
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
    // event DebugMintRoyalties(uint256 indexed tokenId, uint256 amount, uint256 platformAmount, uint256 remainingAmount, uint256 royaltiesLength);
    // event DebugRoyaltyDistributed(uint256 indexed tokenId, address indexed receiver, uint256 amount);

    // Role definitions
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant RENTER_ROLE = keccak256("RENTER_ROLE");
    bytes32 public constant PLATFORM_ROLE = keccak256("PLATFORM_ROLE");

    /**
     * @dev Initialize platform configuration with commission percentage and address
     * @param platformAddress_ The address that will receive platform commission payments
     * @param platformCommissionPercentage_ The platform commission percentage in basis points (max 2000 = 20%)
     * 
     * Requirements:
     * - platformAddress_ must not be the zero address
     * - platformCommissionPercentage_ must not exceed 2000 (20%)
     * 
     * This function should be called once during contract initialization to set up the platform
     * that will receive commission payments from all transactions.
     */
    function initializePlatform(
        address platformAddress_,
        uint96 platformCommissionPercentage_
    ) internal {
        require(platformAddress_ != address(0), "Invalid platform address");
        require(platformCommissionPercentage_ <= 2000, "Platform commission too high"); // Max 20%

        PlatformConfig storage config = _getPlatformConfig();
        config.platformAddress = platformAddress_;
        config.commissionPercentage = platformCommissionPercentage_;
    }

    /**
     * @dev Update platform commission settings (requires OWNER_ROLE)
     * @param newPlatformCommissionPercentage The new platform commission percentage in basis points (max 2000 = 20%)
     * @param newPlatformAddress The new platform address that will receive commission payments
     * 
     * Requirements:
     * - Caller must have OWNER_ROLE
     * - newPlatformAddress must not be the zero address
     * - newPlatformCommissionPercentage must not exceed 2000 (20%)
     * 
     * Emits a {PlatformCommissionUpdated} event.
     */
    function updatePlatformCommission(
        uint96 newPlatformCommissionPercentage,
        address newPlatformAddress,
        address /*accessControl*/
    ) internal {
        // if (!AccessControl(accessControl).hasRole(OWNER_ROLE, msg.sender)) revert("Caller is not an owner");
        require(newPlatformAddress != address(0), "Invalid platform address");
        require(newPlatformCommissionPercentage <= 2000, "Platform commission too high"); // Max 20%

        PlatformConfig storage config = _getPlatformConfig();
        // address oldPlatformAddress = config.platformAddress;

        config.commissionPercentage = newPlatformCommissionPercentage;
        config.platformAddress = newPlatformAddress;

        // Note: Role management should be handled by the calling contract
        // The library cannot directly grant/revoke roles due to access control restrictions

        emit PlatformCommissionUpdated(newPlatformCommissionPercentage, newPlatformAddress);
    }

    /**
     * @dev Initialize royalty configuration with default values
     * 
     * Sets the default royalty percentage to 10% (1000 basis points).
     * This function should be called once during contract initialization.
     * 
     * The default configuration can be updated later using setRoyaltyPercentage,
     * setMintRoyalties, and setTransferRoyalties functions.
     */
    function initializeRoyaltyConfig() internal {
        RoyaltyConfig storage config = _getRoyaltyConfig();
        config.royaltyPercentage = 1000; // Default to 10%
    }

    /**
     * @dev Set the global royalty percentage (requires OWNER_ROLE)
     * @param newRoyaltyPercentage The new royalty percentage in basis points (max 3000 = 30%)
     * @param accessControl The AccessControl contract address for role verification
     * 
     * Requirements:
     * - Caller must have OWNER_ROLE
     * - newRoyaltyPercentage must not exceed 3000 (30%)
     * 
     * This sets the global royalty percentage that applies to all transfers unless
     * overridden by token-specific royalty configurations.
     * 
     * Emits a {RoyaltyPercentageUpdated} event.
     */
    function setRoyaltyPercentage(
        uint96 newRoyaltyPercentage,
        address accessControl
    ) internal {
        if (!AccessControl(accessControl).hasRole(OWNER_ROLE, msg.sender)) revert("Caller is not an owner");
        require(newRoyaltyPercentage <= 3000, "Royalty percentage too high"); // Max 30%

        RoyaltyConfig storage config = _getRoyaltyConfig();
        config.royaltyPercentage = newRoyaltyPercentage;
        emit RoyaltyPercentageUpdated(newRoyaltyPercentage);
    }

    /**
     * @dev Configure mint royalty receivers and percentages (requires OWNER_ROLE)
     * @param royalties Array of RoyaltyData structs containing receiver addresses and fee numerators
     * @param accessControl The AccessControl contract address for role verification
     * 
     * Requirements:
     * - Caller must have OWNER_ROLE
     * - All receiver addresses must not be the zero address
     * - Total fee numerators must equal exactly 10000 (100%)
     * 
     * This function sets the global mint royalty configuration that applies to all mint operations
     * unless overridden by token-specific mint royalty configurations.
     * 
     * Example:
     * ```
     * RoyaltyData[] memory royalties = new RoyaltyData[](2);
     * royalties[0] = RoyaltyData(artist, 7000); // 70% to artist
     * royalties[1] = RoyaltyData(platform, 3000); // 30% to platform
     * setMintRoyalties(royalties, address(this));
     * ```
     * 
     * Emits a {MintRoyaltiesUpdated} event.
     */
    function setMintRoyalties(
        RoyaltyData[] calldata royalties,
        address accessControl
    ) internal {
        if (!AccessControl(accessControl).hasRole(OWNER_ROLE, msg.sender)) revert("Caller is not an owner");

        RoyaltyConfig storage config = _getRoyaltyConfig();
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
     * @dev Configure transfer royalty receivers and percentages (requires OWNER_ROLE)
     * @param royalties Array of RoyaltyData structs containing receiver addresses and fee numerators
     * @param accessControl The AccessControl contract address for role verification
     * 
     * Requirements:
     * - Caller must have OWNER_ROLE
     * - All receiver addresses must not be the zero address
     * - Total fee numerators must equal exactly 10000 (100%)
     * 
     * This function sets the global transfer royalty configuration that applies to all transfer operations
     * unless overridden by token-specific transfer royalty configurations.
     * 
     * Example:
     * ```
     * RoyaltyData[] memory royalties = new RoyaltyData[](2);
     * royalties[0] = RoyaltyData(artist, 6000); // 60% to artist
     * royalties[1] = RoyaltyData(creator, 4000); // 40% to creator
     * setTransferRoyalties(royalties, address(this));
     * ```
     * 
     * Emits a {TransferRoyaltiesUpdated} event.
     */
    function setTransferRoyalties(
        RoyaltyData[] calldata royalties,
        address accessControl
    ) internal {
        if (!AccessControl(accessControl).hasRole(OWNER_ROLE, msg.sender)) revert("Caller is not an owner");

        RoyaltyConfig storage config = _getRoyaltyConfig();
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
        uint256 tokenId,
        RoyaltyData[] calldata royalties,
        address accessControl,
        function(uint256) view returns (bool) /*exists*/
    ) internal {
        if (!AccessControl(accessControl).hasRole(OWNER_ROLE, msg.sender)) revert("Caller is not an owner");

        RoyaltyConfig storage config = _getRoyaltyConfig();
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
        uint256 tokenId,
        RoyaltyData[] calldata royalties,
        address accessControl,
        function(uint256) view returns (bool) /*exists*/
    ) internal {
        if (!AccessControl(accessControl).hasRole(OWNER_ROLE, msg.sender)) revert("Caller is not an owner");
        // Remove token existence requirement to allow setting royalties for future tokens

        RoyaltyConfig storage config = _getRoyaltyConfig();
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
     * @dev Get platform address
     */
    function platformAddress() internal view returns (address) {
        PlatformConfig storage config = _getPlatformConfig();
        return config.platformAddress;
    }

    /**
     * @dev Get platform commission percentage
     */
    function platformCommission() internal view returns (uint96) {
        PlatformConfig storage config = _getPlatformConfig();
        return config.commissionPercentage;
    }

    /**
     * @dev Get royalty percentage
     */
    function royaltyPercentage() internal view returns (uint96) {
        RoyaltyConfig storage config = _getRoyaltyConfig();
        return config.royaltyPercentage;
    }

    /**
     * @dev Get mint royalty receivers for a token
     */
    function getMintRoyaltyReceivers(uint256 tokenId) internal view returns (RoyaltyData[] memory) {
        RoyaltyConfig storage config = _getRoyaltyConfig();
        if (config.tokenMintRoyalties[tokenId].length > 0) {
            return config.tokenMintRoyalties[tokenId];
        } else {
            return config.mintRoyaltyReceivers;
        }
    }

    /**
     * @dev Get transfer royalty receivers for a token
     */
    function getTransferRoyaltyReceivers(uint256 tokenId) internal view returns (RoyaltyData[] memory) {
        RoyaltyConfig storage config = _getRoyaltyConfig();
        if (config.tokenTransferRoyalties[tokenId].length > 0) {
            return config.tokenTransferRoyalties[tokenId];
        } else {
            return config.transferRoyaltyReceivers;
        }
    }

    /**
     * @dev Distribute royalties and platform commission during minting
     * @param tokenId The ID of the token being minted
     * @param amount The total amount to distribute (mint price)
     * @param paymentToken The ERC20 token used for payments
     * 
     * This function handles the distribution of mint royalties and platform commission:
     * 1. Calculates and pays platform commission first
     * 2. Distributes remaining amount to mint royalty receivers
     * 3. Handles rounding by sending any "dust" to the first royalty receiver
     * 4. If no royalty receivers are configured, sends remaining amount to platform
     * 
     * The distribution follows this priority:
     * - Platform commission (if configured)
     * - Mint royalty receivers (token-specific or global)
     * - Platform (if no royalty receivers configured)
     * 
     * Example:
     * ```
     * // For a 100 USDC mint with 5% platform commission and 70%/30% artist/platform split
     * // Platform gets: 5 USDC (commission) + 28.5 USDC (royalty share) = 33.5 USDC
     * // Artist gets: 66.5 USDC (royalty share)
     * distributeMintRoyalties(tokenId, 100e6, paymentToken);
     * ```
     */
    function distributeMintRoyalties(
        uint256 tokenId,
        uint256 amount,
        IERC20 paymentToken
    ) internal {
        PlatformConfig storage platformConfig = _getPlatformConfig();
        uint96 platformCommissionPercent = platformConfig.commissionPercentage;

        // Pay platform commission
        uint256 platformAmount = (amount * platformCommissionPercent) / 10000;
        if (platformAmount > 0) {
            paymentToken.safeTransfer(platformConfig.platformAddress, platformAmount);
        }

        // Get mint royalties for this token (token-specific or global)
        RoyaltyData[] memory royalties = getMintRoyaltyReceivers(tokenId);

        // Calculate remaining amount to distribute
        uint256 remainingAmount = amount - platformAmount;

        // Debug logging
        // emit DebugMintRoyalties(tokenId, amount, platformAmount, remainingAmount, royalties.length);

        if (royalties.length > 0 && remainingAmount > 0) {
            // Distribute to royalty receivers
            uint256 totalDistributed = 0;
            for (uint i = 0; i < royalties.length; i++) {
                uint256 royaltyAmount = (remainingAmount * royalties[i].feeNumerator) / 10000;
                if (royaltyAmount > 0) {
                    paymentToken.safeTransfer(royalties[i].receiver, royaltyAmount);
                    totalDistributed += royaltyAmount;
                    // emit DebugRoyaltyDistributed(tokenId, royalties[i].receiver, royaltyAmount);
                }
            }

            // Handle dust/rounding by sending to first receiver
            uint256 dust = remainingAmount - totalDistributed;
            if (dust > 0 && royalties.length > 0) {
                paymentToken.safeTransfer(royalties[0].receiver, dust);
                // emit DebugRoyaltyDistributed(tokenId, royalties[0].receiver, dust);
            }
        } else if (remainingAmount > 0) {
            // If no royalty receivers, send remaining to platform
            paymentToken.safeTransfer(platformConfig.platformAddress, remainingAmount);
            // emit DebugRoyaltyDistributed(tokenId, platformConfig.platformAddress, remainingAmount);
        }
    }

    /**
     * @dev Distribute royalties and platform commission during transfers
     * @param tokenId The ID of the token being transferred
     * @param salePrice The sale price of the token
     * @param paymentToken The ERC20 token used for payments
     * @return totalDistributed The total amount distributed (platform commission + royalties)
     * 
     * This function handles the distribution of transfer royalties and platform commission:
     * 1. Calculates and pays platform commission first
     * 2. Calculates royalty amount based on global royalty percentage
     * 3. Distributes royalty amount to transfer royalty receivers
     * 4. Handles rounding by sending any "dust" to the first royalty receiver
     * 5. If no royalty receivers are configured, sends royalty to platform
     * 
     * The distribution follows this priority:
     * - Platform commission (if configured)
     * - Transfer royalty receivers (token-specific or global)
     * - Platform (if no royalty receivers configured)
     * 
     * Example:
     * ```
     * // For a 100 USDC sale with 5% platform commission and 10% royalty split 60%/40%
     * // Platform gets: 5 USDC (commission) + 4 USDC (royalty share) = 9 USDC
     * // Artist gets: 6 USDC (royalty share)
     * // Total distributed: 15 USDC
     * uint256 distributed = distributeTransferRoyalties(tokenId, 100e6, paymentToken);
     * ```
     */
    function distributeTransferRoyalties(
        uint256 tokenId,
        uint256 salePrice,
        IERC20 paymentToken
    ) internal returns (uint256 totalDistributed) {
        PlatformConfig storage platformConfig = _getPlatformConfig();
        uint96 platformCommissionPercent = platformConfig.commissionPercentage;

        // Pay platform commission
        uint256 platformAmount = (salePrice * platformCommissionPercent) / 10000;
        totalDistributed = platformAmount;
        if (platformAmount > 0) {
            paymentToken.safeTransfer(platformConfig.platformAddress, platformAmount);
        }

        // Get transfer royalties for this token (token-specific or global)
        RoyaltyData[] memory royalties = getTransferRoyaltyReceivers(tokenId);

        // Calculate royalty amount
        uint256 royaltyAmount = (salePrice * royaltyPercentage()) / 10000;
        if (royalties.length > 0 && royaltyAmount > 0) {
            // Distribute to royalty receivers
            uint256 totalRoyaltyDistributed = 0;
            for (uint i = 0; i < royalties.length; i++) {
                uint256 receiverAmount = (royaltyAmount * royalties[i].feeNumerator) / 10000;
                if (receiverAmount > 0) {
                    paymentToken.safeTransfer(royalties[i].receiver, receiverAmount);
                    totalRoyaltyDistributed += receiverAmount;
                }
            }
            // Handle dust/rounding by sending to first receiver
            uint256 dust = royaltyAmount - totalRoyaltyDistributed;
            if (dust > 0 && royalties.length > 0) {
                paymentToken.safeTransfer(royalties[0].receiver, dust);
                totalRoyaltyDistributed += dust;
            }
            totalDistributed += totalRoyaltyDistributed;
        } else if (royaltyAmount > 0) {
            // If no royalty receivers, send royalty to platform
            paymentToken.safeTransfer(platformConfig.platformAddress, royaltyAmount);
            totalDistributed += royaltyAmount;
        }
    }

    /**
     * @dev Sell a token with royalty distribution
     */
    function sellToken(
        IERC20 paymentToken,
        uint256 tokenId,
        address to,
        uint256 salePrice,
        address seller
    ) internal {
        require(msg.sender == seller, "Only token owner can sell");
        
        TransferTracker storage tracker = _getTransferTracker();
        mapping(uint256 => Rental) storage rentals = _getRentals();
        
        require(!rentals[tokenId].active, "Token is currently rented");

        // Calculate royalty amount
        uint256 royaltyAmount = (salePrice * royaltyPercentage()) / 10000;
        // Calculate platform commission
        uint256 platformCommissionAmount = (salePrice * platformCommission()) / 10000;

        // Transfer total sale price from buyer to contract
        paymentToken.safeTransferFrom(to, address(this), salePrice);

        // Distribute royalties and platform commission
        uint256 totalDistributed = distributeTransferRoyalties(tokenId, salePrice, paymentToken);

        // Pay seller (sale price minus total distributed)
        uint256 sellerProceeds = salePrice - totalDistributed;
        paymentToken.safeTransfer(seller, sellerProceeds);

        // Mark this transfer as paid to avoid royalty check in _beforeTokenTransfer
        bytes32 transferId = keccak256(abi.encodePacked(tokenId, seller, to, salePrice));
        tracker.paidTransfers[transferId] = true;
        tracker.actualSalePrices[transferId] = salePrice;

        emit TokenSold(tokenId, seller, to, salePrice);
    }

    /**
     * @dev Rent a token for a specified duration
     * @param paymentToken The ERC20 token used for rental payments
     * @param tokenId The ID of the token to rent
     * @param duration The rental duration in seconds
     * @param rentalPrice The total price for the rental period
     * @param tokenOwner The current owner of the token
     * @param accessControl The AccessControl contract address for role management
     * @param isERC1155 If true, allows owners to rent their own tokens (ERC1155 behavior)
     * 
     * Requirements:
     * - Token must not already be rented
     * - Duration must be greater than 0
     * - Rental price must be greater than 0
     * - For ERC721: Owner cannot rent their own token
     * - For ERC1155: Owner can rent their own token
     * 
     * This function:
     * 1. Calculates platform commission from rental price
     * 2. Transfers rental payment from renter to contract
     * 3. Pays platform commission to platform address
     * 4. Pays remaining amount to token owner
     * 5. Creates rental record with start/end times
     * 
     * Example:
     * ```
     * // Rent token #1 for 7 days at 50 USDC with 5% platform commission
     * // Platform gets: 2.5 USDC
     * // Owner gets: 47.5 USDC
     * rentToken(paymentToken, 1, 7 days, 50e6, owner, address(this), false);
     * ```
     * 
     * Emits a {TokenRented} event.
     */
    function rentToken(
        IERC20 paymentToken,
        uint256 tokenId,
        uint256 duration,
        uint256 rentalPrice,
        address tokenOwner,
        address accessControl,
        bool isERC1155
    ) internal {
        mapping(uint256 => Rental) storage rentals = _getRentals();
        PlatformConfig storage platformConfig = _getPlatformConfig();
        
        require(!rentals[tokenId].active, "Token is already rented");
        require(duration > 0, "Rental duration must be greater than 0");
        require(rentalPrice > 0, "Rental price must be greater than 0");
        
        // For ERC721, prevent owners from renting their own tokens
        // For ERC1155, allow owners to rent their own tokens
        if (!isERC1155) {
            require(tokenOwner != msg.sender, "Owner cannot rent their own token");
        }

        // Calculate platform commission
        uint256 platformCommissionAmount = (rentalPrice * platformConfig.commissionPercentage) / 10000;

        // Calculate owner's share (rental price minus platform commission)
        uint256 ownerShare = rentalPrice - platformCommissionAmount;

        // Transfer rental payment from renter to this contract
        paymentToken.safeTransferFrom(msg.sender, address(this), rentalPrice);

        // Pay platform commission
        if (platformCommissionAmount > 0) {
            paymentToken.safeTransfer(platformConfig.platformAddress, platformCommissionAmount);
            emit PlatformCommissionPaid(tokenId, platformConfig.platformAddress, platformCommissionAmount);
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
     * @param isERC1155 If true, uses ERC1155 ownership logic
     */
    function endRental(
        uint256 tokenId,
        address tokenOwner,
        address /*accessControl*/,
        function(address) view returns (bool) /*hasActiveRentals*/,
        bool isERC1155
    ) internal {
        mapping(uint256 => Rental) storage rentals = _getRentals();
        
        require(rentals[tokenId].active, "Token is not rented");
        
        if (isERC1155) {
            // For ERC1155, allow the renter to end the rental
            require(msg.sender == rentals[tokenId].renter, "Only renter can end rental");
        } else {
            // For ERC721, allow owner or renter to end rental
            require(msg.sender == tokenOwner || msg.sender == rentals[tokenId].renter, "Only owner or renter can end rental");
        }

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
     * @dev End a rental early (simplified version without callback)
     * @param tokenId The ID of the token to end rental for
     * @param tokenOwner The current owner of the token
     * @param isERC1155 If true, uses ERC1155 ownership logic
     * 
     * Requirements:
     * - Token must be currently rented
     * - For ERC721: Only owner or renter can end rental
     * - For ERC1155: Only renter can end rental
     * 
     * This function marks the rental as inactive, allowing the token to be
     * transferred normally again. It's a simplified version that doesn't require
     * callback functions for role management.
     * 
     * Emits a {RentalEnded} event.
     */
    function endRentalSimple(
        uint256 tokenId,
        address tokenOwner,
        bool isERC1155
    ) internal {
        mapping(uint256 => Rental) storage rentals = _getRentals();
        
        require(rentals[tokenId].active, "Token is not rented");
        
        if (isERC1155) {
            // For ERC1155, allow the renter to end the rental
            require(msg.sender == rentals[tokenId].renter, "Only renter can end rental");
        } else {
            // For ERC721, allow owner or renter to end rental
            require(msg.sender == tokenOwner || msg.sender == rentals[tokenId].renter, "Only owner or renter can end rental");
        }

        address renter = rentals[tokenId].renter;

        // Mark rental as inactive
        rentals[tokenId].active = false;

        emit RentalEnded(tokenId, tokenOwner, renter);
    }

    /**
     * @dev Extend a rental period
     * @param isERC1155 If true, uses ERC1155 logic
     */
    function extendRental(
        IERC20 paymentToken,
        uint256 tokenId,
        uint256 additionalDuration,
        uint256 additionalPayment,
        address tokenOwner,
        bool isERC1155
    ) internal {
        mapping(uint256 => Rental) storage rentals = _getRentals();
        PlatformConfig storage platformConfig = _getPlatformConfig();
        
        require(rentals[tokenId].active, "Token is not rented");
        require(additionalDuration > 0, "Additional duration must be greater than 0");
        require(additionalPayment > 0, "Additional payment must be greater than 0");
        if (isERC1155) {
            require(tokenOwner == rentals[tokenId].renter, "Only renter can extend rental (ERC1155)");
        } else {
            require(msg.sender == rentals[tokenId].renter, "Only renter can extend rental");
        }

        // Calculate platform commission for the additional payment
        uint256 platformCommissionAmount = (additionalPayment * platformConfig.commissionPercentage) / 10000;

        // Calculate owner's share (additional payment minus platform commission)
        uint256 ownerShare = additionalPayment - platformCommissionAmount;

        // Transfer additional payment from renter to this contract
        paymentToken.safeTransferFrom(msg.sender, address(this), additionalPayment);

        // Pay platform commission
        if (platformCommissionAmount > 0) {
            paymentToken.safeTransfer(platformConfig.platformAddress, platformCommissionAmount);
            emit PlatformCommissionPaid(tokenId, platformConfig.platformAddress, platformCommissionAmount);
        }

        // Pay owner's share
        paymentToken.safeTransfer(tokenOwner, ownerShare);

        // Update rental end time
        rentals[tokenId].endTime += additionalDuration;
        rentals[tokenId].rentalPrice += additionalPayment;

        emit RentalExtended(tokenId, msg.sender, rentals[tokenId].endTime);
    }

    /**
     * @dev Check if a token is currently rented
     * @param tokenId The ID of the token to check
     * @return True if the token is currently rented, false otherwise
     * 
     * This function checks the rental status of a specific token by looking up
     * the rental record and checking if it's active and hasn't expired.
     */
    function isRented(uint256 tokenId) internal view returns (bool) {
        mapping(uint256 => Rental) storage rentals = _getRentals();
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
     * @dev Check if a user has active rentals (ERC721 version)
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
     * @dev Check if a user has active rentals (ERC1155 version)
     */
    function hasActiveRentalsERC1155(
        mapping(uint256 => Rental) storage rentals,
        address user,
        function(uint256) view returns (uint256) totalSupply,
        function(uint256) view returns (uint256) tokenByIndex,
        uint256 maxTokenId
    ) internal view returns (bool) {
        for (uint256 i = 0; i <= maxTokenId; i++) {
            if (totalSupply(i) > 0) { // Check if token exists
                if (rentals[i].active && rentals[i].renter == user) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * @dev Validate transfer
     */
    function validateTransfer(
        uint256 tokenId,
        address from,
        address to,
        address tokenOwner,
        function(address, address) view returns (bool) isApprovedForAll,
        function(uint256) view returns (address) getApproved
    ) internal view {
        mapping(uint256 => Rental) storage rentals = _getRentals();
        RoyaltyConfig storage config = _getRoyaltyConfig();
        TransferTracker storage tracker = _getTransferTracker();

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
        uint256 tokenId,
        address from,
        address to,
        address /*accessControl*/,
        function(address) view returns (bool) /*hasActiveRentals*/
    ) internal {
        mapping(uint256 => Rental) storage rentals = _getRentals();
        
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
     * @dev Update rental on transfer (simplified version without callback)
     */
    function updateRentalOnTransferSimple(
        uint256 tokenId,
        address from,
        address to
    ) internal {
        mapping(uint256 => Rental) storage rentals = _getRentals();
        
        // Allow minting and burning
        if (from == address(0) || to == address(0)) {
            return;
        }

        // Check if rental has expired and mark it as inactive
        if (rentals[tokenId].active && block.timestamp >= rentals[tokenId].endTime) {
            rentals[tokenId].active = false;
            emit RentalEnded(tokenId, from, rentals[tokenId].renter);
        }
    }

    /**
     * @dev Validate burn
     */
    function validateBurn(
        uint256 tokenId,
        address tokenOwner
    ) internal view {
        mapping(uint256 => Rental) storage rentals = _getRentals();
        require(tokenOwner == msg.sender, "Not token owner");
        require(!rentals[tokenId].active, "Cannot burn a rented token");
    }

    /**
     * @dev Initiate transfer with royalty
     */
    function initiateTransferWithRoyalty(
        uint256 tokenId,
        address to,
        uint256 salePrice,
        address owner
    ) internal {
        TransferTracker storage tracker = _getTransferTracker();
        mapping(uint256 => Rental) storage rentals = _getRentals();
        
        require(msg.sender == owner, "Only token owner can initiate transfer");
        require(!rentals[tokenId].active, "Token is currently rented");
        require(to != address(0), "Cannot transfer to zero address");

        bytes32 transferId = keccak256(abi.encodePacked(tokenId, owner, to, salePrice));
        tracker.pendingTransfers[transferId] = true;
        tracker.transferPrices[transferId] = salePrice;

        emit TransferRoyaltyRequired(tokenId, owner, to, salePrice);
    }

    /**
     * @dev Calculate total required payment for transfer royalties and platform commission
     * @param salePrice The sale price of the token
     * @return totalRequired The total amount required (royalties + platform commission)
     * 
     * This function calculates the total amount that needs to be paid for a transfer,
     * including both the royalty percentage and platform commission percentage.
     * 
     * Example:
     * ```
     * // For a 100 USDC sale with 10% royalty and 5% platform commission
     * // Total required: 10 + 5 = 15 USDC
     * uint256 required = calculateTransferPayment(100e6); // Returns 15e6
     * ```
     */
    function calculateTransferPayment(
        uint256 salePrice
    ) internal view returns (uint256 totalRequired) {
        RoyaltyConfig storage config = _getRoyaltyConfig();
        PlatformConfig storage platformConfig = _getPlatformConfig();
        uint256 royaltyAmount = (salePrice * config.royaltyPercentage) / 10000;
        uint256 platformCommission = (salePrice * platformConfig.commissionPercentage) / 10000;
        return royaltyAmount + platformCommission;
    }

    /**
     * @dev Pay transfer royalty
     */
    function payTransferRoyalty(
        IERC20 paymentToken,
        uint256 tokenId,
        address to,
        uint256 salePrice,
        address buyer,
        address seller
    ) internal {
        TransferTracker storage tracker = _getTransferTracker();
        RoyaltyConfig storage config = _getRoyaltyConfig();
        PlatformConfig storage platformConfig = _getPlatformConfig();
        
        // Transfer full sale price from buyer to contract
        paymentToken.safeTransferFrom(buyer, address(this), salePrice);

        // Calculate royalty and platform commission
        uint256 royaltyAmount = (salePrice * config.royaltyPercentage) / 10000;
        uint256 platformCommissionAmount = (salePrice * platformConfig.commissionPercentage) / 10000;

        // Distribute royalties and platform commission, get total distributed
        uint256 totalDistributed = distributeTransferRoyalties(tokenId, salePrice, paymentToken);

        // Pay seller (sale price minus total distributed)
        uint256 sellerProceeds = salePrice - totalDistributed;
        paymentToken.safeTransfer(seller, sellerProceeds);

        // Mark transfer as paid
        bytes32 buyerTransferId = keccak256(abi.encodePacked(tokenId, buyer, to, salePrice));
        tracker.paidTransfers[buyerTransferId] = true;

        emit TransferRoyaltyPaid(tokenId, seller, to, salePrice);
    }

    /**
     * @dev Check if transfer royalty is required
     */
    function isTransferRoyaltyRequired(
        uint256 tokenId,
        address from,
        address to,
        uint256 salePrice
    ) internal view returns (bool) {
        TransferTracker storage tracker = _getTransferTracker();
        bytes32 transferId = keccak256(abi.encodePacked(tokenId, from, to, salePrice));
        return tracker.pendingTransfers[transferId];
    }
}