// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
// import "./KamiNFTLibrary.sol";
import "@paulstinchcombe/kaminftlibrary/contracts/KamiNFTLibrary.sol";


/**
 * @title KAMI721C
 * @dev ERC721 contract with ERC20 payments, programmable royalties, platform commission, and rental functionality.
 * - Uses KamiNFTLibrary for advanced features and proxy compatibility.
 * - Supports multiple royalty receivers and role-based access control.
 *
 * Roles:
 * - OWNER_ROLE: Can pause/unpause, set mint price, set platform commission, set royalties, set base URI.
 * - PLATFORM_ROLE: Receives platform commission payments.
 * - RENTER_ROLE: Assigned to users renting tokens.
 *
 * Storage:
 * - Only _transferTracker is stored here; all other config is managed by KamiNFTLibrary via storage slots.
 */
contract KAMI721C is AccessControl, ERC721Enumerable, ERC2981, Pausable {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;
    using KamiNFTLibrary for *;

    /// @dev Transfer tracker for royalty enforcement (library-managed)
    KamiNFTLibrary.TransferTracker private _transferTracker;

    /// @notice Role for contract owners (can manage contract settings)
    bytes32 public constant OWNER_ROLE = KamiNFTLibrary.OWNER_ROLE;
    /// @notice Role for renters (assigned to users renting tokens)
    bytes32 public constant RENTER_ROLE = KamiNFTLibrary.RENTER_ROLE;
    /// @notice Role for platform (receives commission payments)
    bytes32 public constant PLATFORM_ROLE = KamiNFTLibrary.PLATFORM_ROLE;

    /// @dev Counter for token IDs
    Counters.Counter private _tokenIdCounter;
    /// @notice Mint price in payment token (ERC20)
    uint256 public mintPrice;
    /// @dev Base URI for token metadata
    string private _baseTokenURI;

    /// @notice ERC20 token used for payments (e.g., USDC)
    IERC20 public immutable paymentToken;

    /**
     * @notice Contract constructor
     * @param paymentToken_ ERC20 token address for payments
     * @param name_ ERC721 token name
     * @param symbol_ ERC721 token symbol
     * @param baseTokenURI_ Base URI for token metadata
     * @param initialMintPrice_ Initial mint price (in payment token)
     * @param platformAddress_ Address to receive platform commission
     * @param platformCommissionPercentage_ Platform commission (basis points, max 2000 = 20%)
     */
    constructor(
        address paymentToken_,
        string memory name_,
        string memory symbol_,
        string memory baseTokenURI_,
        uint256 initialMintPrice_,
        address platformAddress_,
        uint96 platformCommissionPercentage_
    ) ERC721(name_, symbol_) Pausable() {
        require(paymentToken_ != address(0), "Invalid payment token address");
        require(platformAddress_ != address(0), "Invalid platform address");
        require(platformCommissionPercentage_ <= 2000, "Platform commission too high"); // Max 20%

        paymentToken = IERC20(paymentToken_);
        _baseTokenURI = baseTokenURI_;
        mintPrice = initialMintPrice_;
        KamiNFTLibrary.initializePlatform(platformAddress_, platformCommissionPercentage_);
        KamiNFTLibrary.initializeRoyaltyConfig();

        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OWNER_ROLE, msg.sender);
        _grantRole(PLATFORM_ROLE, platformAddress_);
    }

    /**
     * @notice Checks supported interfaces (ERC721, ERC2981, AccessControl)
     * @param interfaceId Interface identifier
     * @return True if supported
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721Enumerable, ERC2981, AccessControl)
        returns (bool)
    {
        return ERC721Enumerable.supportsInterface(interfaceId) ||
            ERC2981.supportsInterface(interfaceId) ||
            AccessControl.supportsInterface(interfaceId);
    }

    /**
     * @notice Set platform commission percentage and address
     * @param newPlatformCommissionPercentage New commission (basis points, max 2000)
     * @param newPlatformAddress New platform address
     * @dev Only OWNER_ROLE can call. Updates role assignments as needed.
     */
    function setPlatformCommission(uint96 newPlatformCommissionPercentage, address newPlatformAddress) external {
        address oldPlatformAddress = KamiNFTLibrary.platformAddress();
        KamiNFTLibrary.updatePlatformCommission(newPlatformCommissionPercentage, newPlatformAddress, address(this));

        // Handle role management
        if (oldPlatformAddress != newPlatformAddress) {
            // Revoke role from old platform address
            if (hasRole(PLATFORM_ROLE, oldPlatformAddress)) {
                _revokeRole(PLATFORM_ROLE, oldPlatformAddress);
            }
            // Grant role to new platform address
            _grantRole(PLATFORM_ROLE, newPlatformAddress);
        }
    }

    /**
     * @notice Set royalty percentage (basis points, max 3000 = 30%)
     * @param newRoyaltyPercentage New royalty percentage
     * @dev Only OWNER_ROLE can call.
     */
    function setRoyaltyPercentage(uint96 newRoyaltyPercentage) external {
        KamiNFTLibrary.setRoyaltyPercentage(newRoyaltyPercentage, address(this));
    }

    /**
     * @notice Set mint royalty receivers (must sum to 10000 basis points)
     * @param royalties Array of royalty receivers and shares
     * @dev Only OWNER_ROLE can call.
     */
    function setMintRoyalties(KamiNFTLibrary.RoyaltyData[] calldata royalties) external {
        KamiNFTLibrary.setMintRoyalties(royalties, address(this));
    }

    /**
     * @notice Set transfer royalty receivers (must sum to 10000 basis points)
     * @param royalties Array of royalty receivers and shares
     * @dev Only OWNER_ROLE can call.
     */
    function setTransferRoyalties(KamiNFTLibrary.RoyaltyData[] calldata royalties) external {
        KamiNFTLibrary.setTransferRoyalties(royalties, address(this));
    }

    /**
     * @notice Set token-specific mint royalty receivers (must sum to 10000 basis points)
     * @param tokenId Token ID
     * @param royalties Array of royalty receivers and shares
     * @dev Only OWNER_ROLE can call.
     */
    function setTokenMintRoyalties(uint256 tokenId, KamiNFTLibrary.RoyaltyData[] calldata royalties) external {
        KamiNFTLibrary.setTokenMintRoyalties(tokenId, royalties, address(this), _exists);
    }

    /**
     * @notice Set token-specific transfer royalty receivers (must sum to 10000 basis points)
     * @param tokenId Token ID
     * @param royalties Array of royalty receivers and shares
     * @dev Only OWNER_ROLE can call.
     */
    function setTokenTransferRoyalties(uint256 tokenId, KamiNFTLibrary.RoyaltyData[] calldata royalties) external {
        KamiNFTLibrary.setTokenTransferRoyalties(tokenId, royalties, address(this), _exists);
    }

    /**
     * @notice ERC2981 royalty info for a token and sale price
     * @param tokenId Token ID
     * @param salePrice Sale price (in payment token)
     * @return receiver First royalty receiver (if any)
     * @return royaltyAmount Amount owed to receiver
     */
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        public
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        uint256 totalRoyaltyAmount = (salePrice * KamiNFTLibrary.royaltyPercentage()) / 10000;
        KamiNFTLibrary.RoyaltyData[] memory royalties = KamiNFTLibrary.getTransferRoyaltyReceivers(tokenId);
        if (royalties.length > 0) {
            KamiNFTLibrary.RoyaltyData memory info = royalties[0];
            uint256 receiverShare = (totalRoyaltyAmount * info.feeNumerator) / 10000;
            return (info.receiver, receiverShare);
        }
        return (address(0), 0);
    }

    /**
     * @notice Get mint royalty receivers for a token
     * @param tokenId Token ID
     * @return Array of royalty receivers and shares
     */
    function getMintRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTLibrary.RoyaltyData[] memory) {
        return KamiNFTLibrary.getMintRoyaltyReceivers(tokenId);
    }

    /**
     * @notice Get transfer royalty receivers for a token
     * @param tokenId Token ID
     * @return Array of royalty receivers and shares
     */
    function getTransferRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTLibrary.RoyaltyData[] memory) {
        return KamiNFTLibrary.getTransferRoyaltyReceivers(tokenId);
    }

    /**
     * @notice Mint a new token (requires payment)
     * @dev Transfers payment, mints token, and distributes mint royalties
     */
    function mint() external {
        paymentToken.safeTransferFrom(msg.sender, address(this), mintPrice);
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(msg.sender, tokenId);
        KamiNFTLibrary.distributeMintRoyalties(tokenId, mintPrice, paymentToken);
    }

    /**
     * @notice Sell a token to another user (with royalty and commission distribution)
     * @param to Buyer address
     * @param tokenId Token ID
     * @param salePrice Sale price (in payment token)
     * @dev Only token owner can call. Distributes royalties and commission, then transfers token.
     */
    function sellToken(address to, uint256 tokenId, uint256 salePrice) external {
        address seller = ownerOf(tokenId);
        KamiNFTLibrary.sellToken(paymentToken, tokenId, to, salePrice, seller);
        safeTransferFrom(seller, to, tokenId);
    }

    /**
     * @notice Rent a token for a specified duration
     * @param tokenId Token ID
     * @param duration Rental duration (seconds)
     * @param rentalPrice Rental price (in payment token)
     * @dev Transfers payment, distributes commission, and creates rental record. Grants RENTER_ROLE.
     */
    function rentToken(uint256 tokenId, uint256 duration, uint256 rentalPrice) external whenNotPaused {
        address tokenOwner = ownerOf(tokenId);
        KamiNFTLibrary.rentToken(paymentToken, tokenId, duration, rentalPrice, tokenOwner, address(this), false);
        // Grant RENTER_ROLE to the renter
        _grantRole(RENTER_ROLE, msg.sender);
    }

    /**
     * @notice End a rental for a token
     * @param tokenId Token ID
     * @dev Marks rental as inactive and revokes RENTER_ROLE if no other rentals
     */
    function endRental(uint256 tokenId) external whenNotPaused {
        address tokenOwner = ownerOf(tokenId);
        KamiNFTLibrary.endRental(tokenId, tokenOwner, address(this), hasActiveRentals, false);
        // Revoke RENTER_ROLE if no other active rentals
        KamiNFTLibrary.Rental memory rental = KamiNFTLibrary.getRentalInfo(KamiNFTLibrary._getRentals(), tokenId, _exists);
        address renter = rental.renter;
        if (!hasActiveRentals(renter)) {
            _revokeRole(RENTER_ROLE, renter);
        }
    }

    /**
     * @notice Extend a rental for a token
     * @param tokenId Token ID
     * @param additionalDuration Additional duration (seconds)
     * @param additionalPayment Additional payment (in payment token)
     * @dev Transfers payment and extends rental period.
     */
    function extendRental(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment) external whenNotPaused {
        address tokenOwner = ownerOf(tokenId);
        KamiNFTLibrary.extendRental(paymentToken, tokenId, additionalDuration, additionalPayment, tokenOwner, false);
    }

    /**
     * @notice Check if a token is currently rented
     * @param tokenId Token ID
     * @return True if rented
     */
    function isRented(uint256 tokenId) external view whenNotPaused returns (bool) {
        return KamiNFTLibrary.isRented(tokenId);
    }

    /**
     * @notice Get rental info for a token
     * @param tokenId Token ID
     * @return renter Renter address
     * @return startTime Rental start time
     * @return endTime Rental end time
     * @return rentalPrice Rental price
     * @return active Whether rental is active
     */
    function getRentalInfo(uint256 tokenId) external view whenNotPaused returns (
        address renter,
        uint256 startTime,
        uint256 endTime,
        uint256 rentalPrice,
        bool active
    ) {
        KamiNFTLibrary.Rental memory rental = KamiNFTLibrary.getRentalInfo(KamiNFTLibrary._getRentals(), tokenId, _exists);
        return (rental.renter, rental.startTime, rental.endTime, rental.rentalPrice, rental.active);
    }

    /**
     * @notice Check if a user has any active rentals
     * @param user User address
     * @return True if user has active rentals
     */
    function hasActiveRentals(address user) public view whenNotPaused returns (bool) {
        return KamiNFTLibrary.hasActiveRentals(KamiNFTLibrary._getRentals(), user, totalSupply, tokenByIndex);
    }

    /**
     * @dev Internal hook for transfer validation and rental expiration
     * @inheritdoc ERC721Enumerable
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);

        // Skip validation for minting (from == address(0))
        if (from == address(0)) {
            return;
        }

        // Check if rental has expired and mark it as inactive
        KamiNFTLibrary.Rental memory rental = KamiNFTLibrary.getRentalInfo(KamiNFTLibrary._getRentals(), tokenId, _exists);
        if (rental.active && block.timestamp >= rental.endTime) {
            // The library handles rental expiration internally
            address renter = rental.renter;
            if (!hasActiveRentals(renter)) {
                _revokeRole(RENTER_ROLE, renter);
            }
        }

        KamiNFTLibrary.validateTransfer(
            tokenId,
            from,
            to,
            from == address(0) ? address(0) : ownerOf(tokenId),
            isApprovedForAll,
            getApproved
        );
        KamiNFTLibrary.updateRentalOnTransfer(tokenId, from, to, address(this), hasActiveRentals);
    }

    /**
     * @notice Set the base URI for token metadata
     * @param baseURI New base URI
     * @dev Only OWNER_ROLE can call.
     */
    function setBaseURI(string memory baseURI) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        _baseTokenURI = baseURI;
    }

    /**
     * @dev Returns the base URI for token metadata
     * @return Base URI string
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @notice Burn a token (must not be rented)
     * @param tokenId Token ID
     * @dev Only token owner can call. Cannot burn rented tokens.
     */
    function burn(uint256 tokenId) external {
        KamiNFTLibrary.validateBurn(tokenId, ownerOf(tokenId));
        _burn(tokenId);
    }

    /**
     * @notice Pause contract (disables minting, renting, etc.)
     * @dev Only OWNER_ROLE can call.
     */
    function pause() external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        _pause();
    }
    /**
     * @notice Unpause contract
     * @dev Only OWNER_ROLE can call.
     */
    function unpause() external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        _unpause();
    }

    /**
     * @notice Initiate a transfer with royalty (for off-chain flows)
     * @param to Buyer address
     * @param tokenId Token ID
     * @param salePrice Sale price
     */
    function initiateTransferWithRoyalty(address to, uint256 tokenId, uint256 salePrice) external {
        KamiNFTLibrary.initiateTransferWithRoyalty(tokenId, to, salePrice, ownerOf(tokenId));
    }
    /**
     * @notice Pay transfer royalty (for off-chain flows)
     * @param to Buyer address
     * @param tokenId Token ID
     * @param salePrice Sale price
     */
    function payTransferRoyalty(address to, uint256 tokenId, uint256 salePrice) external {
        KamiNFTLibrary.payTransferRoyalty(paymentToken, tokenId, to, salePrice, ownerOf(tokenId), ownerOf(tokenId));
    }
    /**
     * @notice Check if transfer royalty is required for a transfer
     * @param from Seller address
     * @param to Buyer address
     * @param tokenId Token ID
     * @param salePrice Sale price
     * @return True if royalty is required
     */
    function isTransferRoyaltyRequired(address from, address to, uint256 tokenId, uint256 salePrice) external view returns (bool) {
        return KamiNFTLibrary.isTransferRoyaltyRequired(tokenId, from, to, salePrice);
    }

    /**
     * @notice Get platform commission percentage (basis points)
     * @return Commission percentage
     */
    function platformCommissionPercentage() public view returns (uint96) {
        return KamiNFTLibrary.platformCommission();
    }
    /**
     * @notice Get platform address
     * @return Platform address
     */
    function platformAddress() public view returns (address) {
        return KamiNFTLibrary.platformAddress();
    }
    /**
     * @notice Get royalty percentage (basis points)
     * @return Royalty percentage
     */
    function royaltyPercentage() public view returns (uint96) {
        return KamiNFTLibrary.royaltyPercentage();
    }
    /**
     * @notice Set mint price
     * @param newMintPrice New mint price (in payment token)
     * @dev Only OWNER_ROLE can call.
     */
    function setMintPrice(uint256 newMintPrice) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        mintPrice = newMintPrice;
    }
}
