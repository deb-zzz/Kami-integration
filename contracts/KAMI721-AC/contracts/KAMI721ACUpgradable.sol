// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./libraries/KamiNFTCore.sol";
import "./libraries/KamiPlatform.sol";
import "./libraries/KamiRoyalty.sol";
import "./libraries/KamiRental.sol";
import "./libraries/KamiTransfer.sol";

/**
 * @title KAMI721ACUpgradable
 * @dev Upgradeable claimable ERC721 contract with advanced royalty, platform commission, and rental features.
 * - One claim per address (no traditional minting)
 * - ERC20 payment integration
 * - Platform commission system
 * - Time-based rental system
 * - Royalty enforcement
 * - Role-based access control
 * - Batch claiming
 * - UUPS upgradeable pattern
 * 
 * Uses split libraries for size optimization and SONEUM deployment compatibility.
 * @author Paul Stinchcombe
 * @custom:security-contact security@kami.com
 */
contract KAMI721ACUpgradable is 
    Initializable,
    AccessControlUpgradeable,
    ERC721EnumerableUpgradeable,
    ERC2981Upgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using KamiNFTCore for *;
    using KamiPlatform for *;
    using KamiRoyalty for *;
    using KamiRental for *;
    using KamiTransfer for *;

    // ============ STORAGE VARIABLES ============

    /** @dev Transfer tracker for royalty enforcement - managed by library */
    KamiNFTCore.TransferTracker private _transferTracker;

    /** @dev Role definitions from library */
    bytes32 public constant OWNER_ROLE = KamiNFTCore.OWNER_ROLE;
    bytes32 public constant RENTER_ROLE = KamiNFTCore.RENTER_ROLE;
    bytes32 public constant PLATFORM_ROLE = KamiNFTCore.PLATFORM_ROLE;

    /** @dev Token ID counter for sequential token generation */
    CountersUpgradeable.Counter private _tokenIdCounter;
    
    /** @dev Price required to claim a token (in payment token units) */
    uint256 public mintPrice;
    
    /** @dev Base URI for token metadata */
    string private _baseTokenURI;
    
    /** @dev ERC20 token used for all payments */
    IERC20Upgradeable public paymentToken;

    /** @dev Mapping to track which addresses have already claimed a token */
    mapping(address => bool) public hasClaimed;

    // ============ EVENTS ============

    /**
     * @dev Emitted when a token is successfully claimed
     * @param claimer Address that claimed the token
     * @param tokenId ID of the claimed token
     * @param paymentAmount Amount paid for the claim
     */
    event TokenClaimed(address indexed claimer, uint256 indexed tokenId, uint256 paymentAmount);

    /**
     * @dev Emitted when tokens are batch claimed (owner pays for all)
     * @param owner Address that paid for all tokens
     * @param recipients Array of addresses that received tokens
     * @param totalPayment Total amount paid by owner
     */
    event BatchClaimedFor(address indexed owner, address[] recipients, uint256 totalPayment);

    /**
     * @dev Emitted when tokens are batch claimed (each recipient pays)
     * @param caller Address that initiated the batch claim
     * @param recipients Array of addresses that received tokens
     */
    event BatchClaimed(address indexed caller, address[] recipients);

    // ============ INITIALIZER ============

    /**
     * @notice Initializes the contract with configuration.
     * @param paymentToken_ ERC20 token address for payments
     * @param name_ NFT collection name
     * @param symbol_ NFT collection symbol
     * @param baseTokenURI_ Base URI for token metadata
     * @param initialMintPrice_ Initial claim price
     * @param platformAddress_ Platform commission recipient
     * @param platformCommissionPercentage_ Platform commission (basis points, max 2000 = 20%)
     */
    function initialize(
        address paymentToken_,
        string memory name_,
        string memory symbol_,
        string memory baseTokenURI_,
        uint256 initialMintPrice_,
        address platformAddress_,
        uint96 platformCommissionPercentage_
    ) public initializer {
        require(paymentToken_ != address(0), "Invalid payment token address");
        require(platformAddress_ != address(0), "Invalid platform address");
        require(platformCommissionPercentage_ <= 2000, "Platform commission too high");
        
        __ERC721_init(name_, symbol_);
        __ERC721Enumerable_init();
        __ERC2981_init();
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        paymentToken = IERC20Upgradeable(paymentToken_);
        _baseTokenURI = baseTokenURI_;
        mintPrice = initialMintPrice_;
        
        // Initialize libraries
        KamiPlatform.initializePlatform(platformAddress_, platformCommissionPercentage_);
        KamiRoyalty.initializeRoyaltyConfig();
        
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OWNER_ROLE, msg.sender);
        _grantRole(PLATFORM_ROLE, platformAddress_);
    }

    /**
     * @notice Checks interface support (ERC165).
     * @param interfaceId Interface identifier
     * @return True if supported
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721EnumerableUpgradeable, ERC2981Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ============ PLATFORM COMMISSION MANAGEMENT ============

    /**
     * @notice Update platform commission settings (OWNER_ROLE only).
     * @param newPlatformCommissionPercentage New commission (basis points, max 2000)
     * @param newPlatformAddress New platform address
     */
    function setPlatformCommission(uint96 newPlatformCommissionPercentage, address newPlatformAddress) external {
        address oldPlatformAddress = KamiPlatform.platformAddress();
        KamiPlatform.updatePlatformCommission(newPlatformCommissionPercentage, newPlatformAddress, address(this));
        if (oldPlatformAddress != newPlatformAddress) {
            if (hasRole(PLATFORM_ROLE, oldPlatformAddress)) {
                _revokeRole(PLATFORM_ROLE, oldPlatformAddress);
            }
            _grantRole(PLATFORM_ROLE, newPlatformAddress);
        }
    }

    // ============ ROYALTY MANAGEMENT ============

    /**
     * @notice Set global royalty percentage (OWNER_ROLE only).
     * @param newRoyaltyPercentage New royalty (basis points, max 10000)
     */
    function setRoyaltyPercentage(uint96 newRoyaltyPercentage) external {
        KamiRoyalty.setRoyaltyPercentage(newRoyaltyPercentage, address(this));
    }

    /**
     * @notice Set mint royalty receivers (OWNER_ROLE only).
     * @param royalties Array of RoyaltyData (receiver, feeNumerator)
     */
    function setMintRoyalties(KamiNFTCore.RoyaltyData[] calldata royalties) external {
        KamiRoyalty.setMintRoyalties(royalties, address(this));
    }

    /**
     * @notice Set transfer royalty receivers (OWNER_ROLE only).
     * @param royalties Array of RoyaltyData (receiver, feeNumerator)
     */
    function setTransferRoyalties(KamiNFTCore.RoyaltyData[] calldata royalties) external {
        KamiRoyalty.setTransferRoyalties(royalties, address(this));
    }

    /**
     * @notice Set token-specific mint royalties (OWNER_ROLE only).
     * @param tokenId Token ID
     * @param royalties Array of RoyaltyData
     */
    function setTokenMintRoyalties(uint256 tokenId, KamiNFTCore.RoyaltyData[] calldata royalties) external {
        KamiRoyalty.setTokenMintRoyalties(tokenId, royalties, address(this), _exists);
    }

    /**
     * @notice Set token-specific transfer royalties (OWNER_ROLE only).
     * @param tokenId Token ID
     * @param royalties Array of RoyaltyData
     */
    function setTokenTransferRoyalties(uint256 tokenId, KamiNFTCore.RoyaltyData[] calldata royalties) external {
        KamiRoyalty.setTokenTransferRoyalties(tokenId, royalties, address(this), _exists);
    }

    /**
     * @notice Royalty info for a token sale (ERC2981).
     * @param tokenId Token ID
     * @param salePrice Sale price
     * @return receiver Royalty receiver
     * @return royaltyAmount Royalty amount
     */
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        public
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        uint256 totalRoyaltyAmount = (salePrice * KamiRoyalty.royaltyPercentage()) / 10000;
        KamiNFTCore.RoyaltyData[] memory royalties = KamiRoyalty.getTransferRoyaltyReceivers(tokenId);
        if (royalties.length > 0) {
            KamiNFTCore.RoyaltyData memory info = royalties[0];
            uint256 receiverShare = (totalRoyaltyAmount * info.feeNumerator) / 10000;
            return (info.receiver, receiverShare);
        }
        return (address(0), 0);
    }

    /**
     * @notice Get mint royalty receivers for a token.
     * @param tokenId Token ID
     * @return Array of RoyaltyData
     */
    function getMintRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTCore.RoyaltyData[] memory) {
        return KamiRoyalty.getMintRoyaltyReceivers(tokenId);
    }

    /**
     * @notice Get transfer royalty receivers for a token.
     * @param tokenId Token ID
     * @return Array of RoyaltyData
     */
    function getTransferRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTCore.RoyaltyData[] memory) {
        return KamiRoyalty.getTransferRoyaltyReceivers(tokenId);
    }

    // ============ TOKEN SALES ============

    /**
     * @notice Sell a token with royalty distribution.
     * @param to Buyer address
     * @param tokenId Token ID
     * @param salePrice Sale price
     */
    function sellToken(address to, uint256 tokenId, uint256 salePrice) external {
        address seller = ownerOf(tokenId);
        KamiTransfer.sellToken(IERC20(address(paymentToken)), tokenId, to, salePrice, seller);
        safeTransferFrom(seller, to, tokenId);
    }

    // ============ RENTAL SYSTEM ============

    /**
     * @notice Rent a token for a duration.
     * @param tokenId Token ID
     * @param duration Rental duration (seconds)
     * @param rentalPrice Total rental price
     */
    function rentToken(uint256 tokenId, uint256 duration, uint256 rentalPrice) external whenNotPaused {
        address tokenOwner = ownerOf(tokenId);
        KamiRental.rentToken(IERC20(address(paymentToken)), tokenId, duration, rentalPrice, tokenOwner, address(this));
        _grantRole(RENTER_ROLE, msg.sender);
    }

    /**
     * @notice End a rental early.
     * @param tokenId Token ID
     */
    function endRental(uint256 tokenId) external whenNotPaused {
        address tokenOwner = ownerOf(tokenId);
        KamiRental.endRentalSimple(tokenId, tokenOwner, address(this));
        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiRental._getRentals();
        address renter = KamiRental.getRentalInfo(tokenId, _exists).renter;
        if (!KamiRental.hasActiveRentals(renter, totalSupply, tokenByIndex)) {
            _revokeRole(RENTER_ROLE, renter);
        }
    }

    /**
     * @notice Extend a rental period.
     * @param tokenId Token ID
     * @param additionalDuration Additional duration (seconds)
     * @param additionalPayment Additional payment
     */
    function extendRental(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment) external whenNotPaused {
        address tokenOwner = ownerOf(tokenId);
        KamiRental.extendRental(IERC20(address(paymentToken)), tokenId, additionalDuration, additionalPayment, tokenOwner);
    }

    /**
     * @notice Check if a token is currently rented.
     * @param tokenId Token ID
     * @return True if rented
     */
    function isRented(uint256 tokenId) external view whenNotPaused returns (bool) {
        return KamiRental.isRented(tokenId);
    }

    /**
     * @notice Get rental info for a token.
     * @param tokenId Token ID
     * @return renter Renter address
     * @return startTime Rental start
     * @return endTime Rental end
     * @return rentalPrice Rental price
     * @return active Rental active
     */
    function getRentalInfo(uint256 tokenId) external view whenNotPaused returns (
        address renter,
        uint256 startTime,
        uint256 endTime,
        uint256 rentalPrice,
        bool active
    ) {
        KamiNFTCore.Rental memory rental = KamiRental.getRentalInfo(tokenId, _exists);
        return (rental.renter, rental.startTime, rental.endTime, rental.rentalPrice, rental.active);
    }

    /**
     * @notice Check if a user has active rentals.
     * @param user User address
     * @return True if user has active rentals
     */
    function hasActiveRentals(address user) public view whenNotPaused returns (bool) {
        return KamiRental.hasActiveRentals(user, totalSupply, tokenByIndex);
    }

    // ============ TOKEN TRANSFER VALIDATION ============

    /**
     * @dev Hook before any token transfer. Handles rental expiry, role management, and transfer validation.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override(ERC721EnumerableUpgradeable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        
        // Check for expired rentals
        if (KamiRental.isRented(tokenId)) {
            KamiNFTCore.Rental memory rental = KamiRental.getRentalInfo(tokenId, _exists);
            if (block.timestamp >= rental.endTime) {
                address renter = rental.renter;
                if (!KamiRental.hasActiveRentals(renter, totalSupply, tokenByIndex)) {
                    _revokeRole(RENTER_ROLE, renter);
                }
            }
        }
        
        // Validate transfer
        KamiTransfer.validateTransfer(
            tokenId,
            from,
            to,
            isApprovedForAll,
            getApproved
        );
        
        // Update rental status on transfer
        KamiTransfer.updateRentalOnTransferSimple(tokenId);
    }

    // ============ METADATA MANAGEMENT ============

    /**
     * @notice Set base URI for token metadata (OWNER_ROLE only).
     * @param baseURI New base URI
     */
    function setBaseURI(string memory baseURI) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        _baseTokenURI = baseURI;
    }

    /**
     * @notice Get base URI for token metadata.
     * @return Base URI string
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    // ============ TOKEN BURNING ============

    /**
     * @notice Burn a token (token owner only).
     * @param tokenId Token ID
     */
    function burn(uint256 tokenId) external {
        KamiTransfer.validateBurn(tokenId, ownerOf(tokenId));
        _burn(tokenId);
    }

    // ============ PAUSE FUNCTIONALITY ============

    /**
     * @notice Pause all non-view functions (OWNER_ROLE only).
     */
    function pause() external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        _pause();
    }

    /**
     * @notice Unpause all functions (OWNER_ROLE only).
     */
    function unpause() external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        _unpause();
    }

    // ============ ROYALTY TRANSFER FUNCTIONS ============

    /**
     * @notice Initiate a transfer with royalty requirement.
     * @param to Recipient address
     * @param tokenId Token ID
     * @param salePrice Sale price
     */
    function initiateTransferWithRoyalty(address to, uint256 tokenId, uint256 salePrice) external {
        KamiTransfer.initiateTransferWithRoyalty(tokenId, to, salePrice, ownerOf(tokenId));
    }

    /**
     * @notice Pay transfer royalty and complete transfer.
     * @param to Recipient address
     * @param tokenId Token ID
     * @param salePrice Sale price
     */
    function payTransferRoyalty(address to, uint256 tokenId, uint256 salePrice) external {
        KamiTransfer.payTransferRoyalty(IERC20(address(paymentToken)), tokenId, salePrice, ownerOf(tokenId), msg.sender);
    }

    /**
     * @notice Check if transfer royalty is required.
     * @param from Sender address
     * @param to Recipient address
     * @param tokenId Token ID
     * @param salePrice Sale price
     * @return True if royalty required
     */
    function isTransferRoyaltyRequired(address from, address to, uint256 tokenId, uint256 salePrice) external view returns (bool) {
        return KamiTransfer.isTransferRoyaltyRequired(tokenId, salePrice);
    }

    // ============ GETTER FUNCTIONS ============

    /**
     * @notice Get platform commission percentage.
     * @return Commission (basis points)
     */
    function platformCommissionPercentage() public view returns (uint96) {
        return KamiPlatform.platformCommission();
    }

    /**
     * @notice Get platform address.
     * @return Platform address
     */
    function platformAddress() public view returns (address) {
        return KamiPlatform.platformAddress();
    }

    /**
     * @notice Get global royalty percentage.
     * @return Royalty (basis points)
     */
    function royaltyPercentage() public view returns (uint96) {
        return KamiRoyalty.royaltyPercentage();
    }

    /**
     * @notice Set mint price (OWNER_ROLE only).
     * @param newMintPrice New claim price
     */
    function setMintPrice(uint256 newMintPrice) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        mintPrice = newMintPrice;
    }

    // ============ CLAIMING FUNCTIONS ============

    /**
     * @notice Claim a single token (one per address).
     * Requirements:
     * - Caller must not have already claimed
     * - Caller must have approved sufficient payment tokens
     * - Caller must have sufficient payment token balance
     */
    function claim() external {
        require(!hasClaimed[msg.sender], "Already claimed");
        paymentToken.safeTransferFrom(msg.sender, address(this), mintPrice);
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(msg.sender, tokenId);
        KamiRoyalty.distributeMintRoyalties(tokenId, mintPrice, IERC20(address(paymentToken)));
        hasClaimed[msg.sender] = true;
        emit TokenClaimed(msg.sender, tokenId, mintPrice);
    }

    /**
     * @notice Batch claim tokens for recipients (owner pays for all).
     * @param recipients Array of recipient addresses
     * Requirements:
     * - Caller must have OWNER_ROLE
     * - All recipients must not have already claimed
     * - Owner must have approved sufficient payment tokens
     * - Recipients array must not be empty or exceed 100
     * - No zero addresses
     */
    function batchClaimFor(address[] calldata recipients) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        require(recipients.length > 0, "Empty recipients array");
        require(recipients.length <= 100, "Too many recipients");
        uint256 totalCost = mintPrice * recipients.length;
        paymentToken.safeTransferFrom(msg.sender, address(this), totalCost);
        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            require(recipient != address(0), "Invalid recipient address");
            require(!hasClaimed[recipient], "Recipient already claimed");
            uint256 tokenId = _tokenIdCounter.current();
            _tokenIdCounter.increment();
            _safeMint(recipient, tokenId);
            KamiRoyalty.distributeMintRoyalties(tokenId, mintPrice, IERC20(address(paymentToken)));
            hasClaimed[recipient] = true;
        }
        emit BatchClaimedFor(msg.sender, recipients, totalCost);
    }

    /**
     * @notice Batch claim tokens for recipients (each pays for themselves).
     * @param recipients Array of recipient addresses
     * Requirements:
     * - All recipients must not have already claimed
     * - All recipients must have approved sufficient payment tokens
     * - Recipients array must not be empty or exceed 100
     * - No zero addresses
     */
    function batchClaim(address[] calldata recipients) external {
        require(recipients.length > 0, "Empty recipients array");
        require(recipients.length <= 100, "Too many recipients");
        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            require(recipient != address(0), "Invalid recipient address");
            require(!hasClaimed[recipient], "Recipient already claimed");
            paymentToken.safeTransferFrom(recipient, address(this), mintPrice);
            uint256 tokenId = _tokenIdCounter.current();
            _tokenIdCounter.increment();
            _safeMint(recipient, tokenId);
            KamiRoyalty.distributeMintRoyalties(tokenId, mintPrice, IERC20(address(paymentToken)));
            hasClaimed[recipient] = true;
        }
        emit BatchClaimed(msg.sender, recipients);
    }

    // ============ UPGRADE AUTHORIZATION ============

    /**
     * @notice Authorize upgrade (OWNER_ROLE only).
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(OWNER_ROLE) {}
}