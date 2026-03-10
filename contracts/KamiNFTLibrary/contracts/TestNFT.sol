// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./KamiNFTLibrary.sol";

contract TestNFT is ERC721Enumerable, AccessControl {
    using KamiNFTLibrary for *;
    using SafeERC20 for IERC20;

    // Payment token
    IERC20 public paymentToken;
    address public contractOwner;

    constructor(address _paymentToken) ERC721("TestNFT", "TNFT") {
        paymentToken = IERC20(_paymentToken);
        contractOwner = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KamiNFTLibrary.OWNER_ROLE, msg.sender);
    }

    // Platform management functions
    function initializePlatform(address platformAddress_, uint96 platformCommissionPercentage_) external {
        KamiNFTLibrary.initializePlatform(platformAddress_, platformCommissionPercentage_);
    }

    function updatePlatformCommission(uint96 newPlatformCommissionPercentage, address newPlatformAddress) external {
        KamiNFTLibrary.updatePlatformCommission(newPlatformCommissionPercentage, newPlatformAddress, address(this));
    }

    // Royalty management functions
    function initializeRoyaltyConfig() external {
        KamiNFTLibrary.initializeRoyaltyConfig();
    }

    function setRoyaltyPercentage(uint96 newRoyaltyPercentage) external {
        KamiNFTLibrary.setRoyaltyPercentage(newRoyaltyPercentage, address(this));
    }

    function setMintRoyalties(KamiNFTLibrary.RoyaltyData[] calldata royalties) external {
        KamiNFTLibrary.setMintRoyalties(royalties, address(this));
    }

    function setTransferRoyalties(KamiNFTLibrary.RoyaltyData[] calldata royalties) external {
        KamiNFTLibrary.setTransferRoyalties(royalties, address(this));
    }

    // Payment distribution functions
    function distributeMintRoyalties(uint256 tokenId, uint256 mintPrice) external {
        // Transfer tokens from caller to this contract first
        paymentToken.safeTransferFrom(msg.sender, address(this), mintPrice);
        KamiNFTLibrary.distributeMintRoyalties(tokenId, mintPrice, paymentToken);
    }

    function distributeTransferRoyalties(uint256 tokenId, uint256 salePrice) external returns (uint256) {
        // Transfer tokens from caller to this contract first
        paymentToken.safeTransferFrom(msg.sender, address(this), salePrice);
        return KamiNFTLibrary.distributeTransferRoyalties(tokenId, salePrice, paymentToken);
    }

    // Token sale function
    function sellToken(uint256 tokenId, address to, uint256 salePrice) external {
        KamiNFTLibrary.sellToken(paymentToken, tokenId, to, salePrice, msg.sender);
    }

    // Rental functions
    function rentToken(uint256 tokenId, uint256 duration, uint256 rentalPrice) external {
        KamiNFTLibrary.rentToken(paymentToken, tokenId, duration, rentalPrice, ownerOf(tokenId), address(this), false);
    }

    function endRental(uint256 tokenId) external {
        KamiNFTLibrary.endRentalSimple(tokenId, ownerOf(tokenId), false);
    }

    function extendRental(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment) external {
        KamiNFTLibrary.extendRental(paymentToken, tokenId, additionalDuration, additionalPayment, ownerOf(tokenId), false);
    }

    function isRented(uint256 tokenId) external view returns (bool) {
        return KamiNFTLibrary.isRented(tokenId);
    }

    // Utility functions
    function calculateTransferPayment(uint256 salePrice) external view returns (uint256) {
        return KamiNFTLibrary.calculateTransferPayment(salePrice);
    }

    function hasActiveRentals(address user) public view returns (bool) {
        return KamiNFTLibrary.hasActiveRentals(KamiNFTLibrary._getRentals(), user, totalSupply, tokenByIndex);
    }

    // Configuration getters for testing
    function platformConfig() external view returns (address platformAddress, uint96 commissionPercentage) {
        platformAddress = KamiNFTLibrary.platformAddress();
        commissionPercentage = KamiNFTLibrary.platformCommission();
    }

    function royaltyConfig() external view returns (uint96 royaltyPercentage, KamiNFTLibrary.RoyaltyData[] memory mintRoyaltyReceivers, KamiNFTLibrary.RoyaltyData[] memory transferRoyaltyReceivers) {
        royaltyPercentage = KamiNFTLibrary.royaltyPercentage();
        mintRoyaltyReceivers = KamiNFTLibrary.getMintRoyaltyReceivers(0); // Get global mint royalties
        transferRoyaltyReceivers = KamiNFTLibrary.getTransferRoyaltyReceivers(0); // Get global transfer royalties
    }

    function owner() external view returns (address) {
        // Return the address that has DEFAULT_ADMIN_ROLE
        // In this case, it's the deployer (msg.sender in constructor)
        return contractOwner;
    }

    // Mint function for testing
    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }

    // Burn function for testing
    function burn(uint256 tokenId) external {
        KamiNFTLibrary.validateBurn(tokenId, ownerOf(tokenId));
        _burn(tokenId);
    }

    // Override _update (OpenZeppelin v5 transfer hook)
    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address previousOwner = super._update(to, tokenId, auth);
        KamiNFTLibrary.validateTransfer(tokenId, previousOwner, to, ownerOf(tokenId), isApprovedForAll, getApproved);
        KamiNFTLibrary.updateRentalOnTransferSimple(tokenId, previousOwner, to);
        return previousOwner;
    }

    // Override supportsInterface for multiple inheritance
    function supportsInterface(bytes4 interfaceId) public view override(ERC721Enumerable, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
} 