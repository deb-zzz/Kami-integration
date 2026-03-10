// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./KamiNFTCore.sol";

/**
 * @title KamiPlatform
 * @dev Library for platform management functionality including commission handling
 * and platform configuration management.
 */
library KamiPlatform {
    using KamiNFTCore for *;

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

        // Verify caller has owner role
        require(
            IAccessControl(accessControl).hasRole(KamiNFTCore.OWNER_ROLE, msg.sender),
            "Caller must have owner role"
        );

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
}
