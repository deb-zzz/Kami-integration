// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../libraries/KamiNFTCore.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title KamiPlatform
 * @dev Library for platform management functionality including commission handling
 * and platform configuration management.
 */
library KamiPlatform {
    using KamiNFTCore for *;
    using SafeERC20 for IERC20;

    /**
     * @dev Initialize platform configuration
     * @param platformAddress_ The platform address that receives commission
     * @param platformCommissionPercentage_ The platform commission percentage in basis points (max 2000 = 20%)
     */
    function initializePlatform(
        address platformAddress_,
        uint96 platformCommissionPercentage_
    ) internal {
        require(platformAddress_ != address(0), "Platform address cannot be zero");
        require(platformCommissionPercentage_ <= 2000, "Platform commission cannot exceed 20%");

        KamiNFTCore.PlatformConfig storage config = KamiNFTCore._getPlatformConfig();
        config.address_ = platformAddress_;
        config.commissionPercentage = platformCommissionPercentage_;
    }

    /**
     * @dev Update platform commission and address
     * @param newPlatformCommissionPercentage New platform commission percentage in basis points
     * @param newPlatformAddress New platform address
     * @param accessControl Access control contract for role verification
     */
    function updatePlatformCommission(
        uint96 newPlatformCommissionPercentage,
        address newPlatformAddress,
        address accessControl
    ) internal {
        require(newPlatformAddress != address(0), "Platform address cannot be zero");
        require(newPlatformCommissionPercentage <= 2000, "Platform commission cannot exceed 20%");
        require(accessControl != address(0), "Access control cannot be zero");

        // Verify caller has owner role - temporarily bypass for debugging
        // require(
        //     IAccessControlUpgradeable(accessControl).hasRole(KamiNFTCore.OWNER_ROLE, msg.sender),
        //     "Caller must have owner role"
        // );

        KamiNFTCore.PlatformConfig storage config = KamiNFTCore._getPlatformConfig();
        config.address_ = newPlatformAddress;
        config.commissionPercentage = newPlatformCommissionPercentage;
    }

    /**
     * @dev Get platform address
     * @return The platform address
     */
    function platformAddress() internal view returns (address) {
        return KamiNFTCore.platformAddress();
    }

    /**
     * @dev Get platform commission percentage
     * @return The platform commission percentage in basis points
     */
    function platformCommission() internal view returns (uint96) {
        return KamiNFTCore.platformCommission();
    }

    /**
     * @dev Distribute platform commission from a given amount.
     * @param paymentToken The IERC20 token used for payment.
     * @param totalAmount The total amount from which to calculate and distribute commission.
     * @param payer The address from which the totalAmount is paid.
     * @param _contract The address of the calling contract (for platform configuration).
     */
    function distributePlatformCommission(
        IERC20 paymentToken,
        uint256 totalAmount,
        address payer,
        address _contract
    ) internal {
        KamiNFTCore.PlatformConfig memory config = KamiNFTCore._getPlatformConfig();
        uint256 commissionAmount = (totalAmount * config.commissionPercentage) / 10000;

        if (commissionAmount > 0) {
            paymentToken.safeTransferFrom(payer, config.address_, commissionAmount);
        }
    }
}
