// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@paulstinchcombe/kaminftlibrary/contracts/KamiNFTLibrary.sol";

/**
 * @title KAMI1155CUpgradeable
 * @dev An upgradeable ERC1155 implementation with programmable royalties, rental functionality, 
 * platform commissions, and transfer validation. Built using the modular KamiNFTLibrary for 
 * enhanced functionality and maintainability.
 * 
 * This contract provides all the features of KAMI1155C but with upgradeability support:
 * - ERC1155 multi-token standard compliance
 * - ERC2981 royalty standard support
 * - Time-based rental system with automatic role management
 * - Programmable royalties for both minting and transfers
 * - Platform commission automation
 * - Transfer validation with royalty enforcement
 * - Access control with role-based permissions
 * - Pausable functionality for emergency situations
 * - Support for any ERC20 payment token
 * - UUPS upgradeability pattern
 * 
 * @custom:security-contact security@kami.example.com
 * @custom:website https://kami.example.com
 * @custom:docs https://docs.kami.example.com
 */
contract KAMI1155CUpgradeable is
    Initializable,
    AccessControlUpgradeable,
    ERC1155Upgradeable,
    ERC1155SupplyUpgradeable,
    ERC2981Upgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;
    using KamiNFTLibrary for *;

    // ============ STORAGE VARIABLES ============

    /// @dev Storage gap for upgradeable contracts to prevent storage collision
    uint256[50] private __gap;

    /// @dev Role for upgrading the contract
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @dev Role definitions imported from KamiNFTLibrary
    bytes32 public constant OWNER_ROLE = KamiNFTLibrary.OWNER_ROLE;
    bytes32 public constant RENTER_ROLE = KamiNFTLibrary.RENTER_ROLE;
    bytes32 public constant PLATFORM_ROLE = KamiNFTLibrary.PLATFORM_ROLE;

    /// @dev Library storage for transfer tracking and royalty enforcement
    KamiNFTLibrary.TransferTracker private _transferTracker;

    /// @dev Contract state variables
    IERC20 public paymentToken;
    uint256 public mintPrice;
    string private _baseTokenURI;
    Counters.Counter private _tokenIdCounter;

    // ============ EVENTS ============

    /**
     * @dev Emitted when a new token is minted
     * @param to The address that received the tokens
     * @param tokenId The ID of the minted token
     * @param amount The amount of tokens minted
     * @param price The total price paid for minting
     */
    event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 amount, uint256 price);

    /**
     * @dev Emitted when tokens are sold
     * @param from The address selling the tokens
     * @param to The address buying the tokens
     * @param tokenId The ID of the sold token
     * @param amount The amount of tokens sold
     * @param price The sale price
     */
    event TokenSold(address indexed from, address indexed to, uint256 indexed tokenId, uint256 amount, uint256 price);

    /**
     * @dev Emitted when tokens are rented
     * @param owner The address that owns the tokens
     * @param renter The address renting the tokens
     * @param tokenId The ID of the rented token
     * @param startTime The rental start timestamp
     * @param endTime The rental end timestamp
     * @param price The rental price
     */
    event TokenRented(address indexed owner, address indexed renter, uint256 indexed tokenId, uint256 startTime, uint256 endTime, uint256 price);

    /**
     * @dev Emitted when a rental ends
     * @param owner The address that owns the tokens
     * @param renter The address that was renting the tokens
     * @param tokenId The ID of the token
     */
    event RentalEnded(address indexed owner, address indexed renter, uint256 indexed tokenId);

    /**
     * @dev Emitted when a rental is extended
     * @param renter The address renting the tokens
     * @param tokenId The ID of the token
     * @param newEndTime The new rental end timestamp
     * @param additionalPayment The additional payment made
     */
    event RentalExtended(address indexed renter, uint256 indexed tokenId, uint256 newEndTime, uint256 additionalPayment);

    // ============ CONSTRUCTOR ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ INITIALIZATION ============

    /**
     * @dev Initializes the contract with the specified parameters
     * @param paymentToken_ The ERC20 token address to be used for payments
     * @param name_ The name of the NFT collection
     * @param symbol_ The symbol of the NFT collection
     * @param baseURI_ The base URI for token metadata
     * @param mintPrice_ The initial mint price in payment token units
     * @param platformAddress_ The platform address to receive commissions
     * @param platformCommissionPercentage_ The platform commission percentage in basis points (max 20%)
     * 
     * Requirements:
     * - Can only be called once (initializer modifier)
     * - `paymentToken_` must not be the zero address
     * - `platformAddress_` must not be the zero address
     * - `platformCommissionPercentage_` must not exceed 2000 (20%)
     */
    function initialize(
        address paymentToken_,
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        uint256 mintPrice_,
        address platformAddress_,
        uint96 platformCommissionPercentage_
    ) public initializer {
        require(paymentToken_ != address(0), "Invalid payment token address");
        require(platformAddress_ != address(0), "Invalid platform address");
        require(platformCommissionPercentage_ <= 2000, "Platform commission too high"); // Max 20%

        // Initialize upgradeable contracts
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ERC1155_init(baseURI_);
        __ERC1155Supply_init();
        __ERC2981_init();
        __Pausable_init();

        // Set contract state
        paymentToken = IERC20(paymentToken_);
        mintPrice = mintPrice_;
        _baseTokenURI = baseURI_;

        // Initialize library configurations
        KamiNFTLibrary.initializePlatform(platformAddress_, platformCommissionPercentage_);
        KamiNFTLibrary.initializeRoyaltyConfig();

        // Grant initial roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OWNER_ROLE, msg.sender);
        _grantRole(PLATFORM_ROLE, platformAddress_);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    /**
     * @dev Required by the OZ UUPS module to authorize upgrades
     * @param newImplementation The address of the new implementation
     * 
     * Requirements:
     * - Caller must have UPGRADER_ROLE
     */
    function _authorizeUpgrade(address newImplementation) internal view override {
        require(hasRole(UPGRADER_ROLE, msg.sender), "Caller is not an upgrader");
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Returns the next token ID that will be assigned
     * @return The next token ID
     */
    function nextTokenId() public view returns (uint256) {
        return _tokenIdCounter.current();
    }

    /**
     * @dev Checks if the contract supports a specific interface
     * @param interfaceId The interface identifier to check
     * @return True if the interface is supported, false otherwise
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155Upgradeable, ERC2981Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return ERC1155Upgradeable.supportsInterface(interfaceId) ||
            ERC2981Upgradeable.supportsInterface(interfaceId) ||
            AccessControlUpgradeable.supportsInterface(interfaceId);
    }

    /**
     * @dev Returns the platform address that receives commissions
     * @return The platform address
     */
    function platformAddress() public view returns (address) {
        return KamiNFTLibrary.platformAddress();
    }

    /**
     * @dev Returns the platform commission percentage in basis points
     * @return The platform commission percentage
     */
    function platformCommission() public view returns (uint96) {
        return KamiNFTLibrary.platformCommission();
    }

    /**
     * @dev Returns the platform commission percentage (alias for platformCommission)
     * @return The platform commission percentage
     */
    function platformCommissionPercentage() public view returns (uint96) {
        return KamiNFTLibrary.platformCommission();
    }

    /**
     * @dev Returns the global royalty percentage in basis points
     * @return The royalty percentage
     */
    function royaltyPercentage() public view returns (uint96) {
        return KamiNFTLibrary.royaltyPercentage();
    }

    /**
     * @dev Returns royalty information for ERC2981 compliance
     * @param tokenId The token ID to get royalty info for
     * @param salePrice The sale price to calculate royalties from
     * @return receiver The address to receive royalties
     * @return royaltyAmount The royalty amount
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
     * @dev Returns the mint royalty receivers for a specific token
     * @param tokenId The token ID to get mint royalty receivers for
     * @return Array of royalty data containing receiver addresses and fee numerators
     */
    function getMintRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTLibrary.RoyaltyData[] memory) {
        return KamiNFTLibrary.getMintRoyaltyReceivers(tokenId);
    }

    /**
     * @dev Returns the transfer royalty receivers for a specific token
     * @param tokenId The token ID to get transfer royalty receivers for
     * @return Array of royalty data containing receiver addresses and fee numerators
     */
    function getTransferRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTLibrary.RoyaltyData[] memory) {
        return KamiNFTLibrary.getTransferRoyaltyReceivers(tokenId);
    }

    /**
     * @dev Returns the URI for a token ID
     * @param tokenId The token ID to get the URI for
     * @return The token URI
     */
    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        return string(abi.encodePacked(_baseTokenURI, _toString(tokenId)));
    }

    /**
     * @dev Checks if a token is currently rented
     * @param tokenId The token ID to check
     * @return True if the token is rented, false otherwise
     */
    function isRented(uint256 tokenId) external view whenNotPaused returns (bool) {
        return KamiNFTLibrary.isRented(tokenId);
    }

    /**
     * @dev Returns rental information for a specific token
     * @param tokenId The token ID to get rental info for
     * @return renter The address renting the token
     * @return startTime The rental start timestamp
     * @return endTime The rental end timestamp
     * @return rentalPrice The total rental price paid
     * @return active Whether the rental is currently active
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
     * @dev Checks if a user has any active rentals
     * @param user The address to check
     * @return True if the user has active rentals, false otherwise
     */
    function hasActiveRentals(address user) public view whenNotPaused returns (bool) {
        uint256 current = _tokenIdCounter.current();
        if (current == 0) {
            return false;
        }
        return KamiNFTLibrary.hasActiveRentalsERC1155(KamiNFTLibrary._getRentals(), user, totalSupply, _dummyTokenByIndex, _tokenIdCounter.current() - 1);
    }

    /**
     * @dev Helper function to check if a token exists
     * @param tokenId The token ID to check
     * @return True if the token exists, false otherwise
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return totalSupply(tokenId) > 0;
    }

    /**
     * @dev Public function to check if a token exists (for library compatibility)
     * @param tokenId The token ID to check
     * @return True if the token exists, false otherwise
     */
    function exists(uint256 tokenId) public view override returns (bool) {
        return totalSupply(tokenId) > 0;
    }

    /**
     * @dev Wrapper function for totalSupply to match library expectations
     * @return The total number of unique tokens minted
     */
    function _getTotalSupply() public view returns (uint256) {
        return _tokenIdCounter.current();
    }

    /**
     * @dev Dummy tokenByIndex function for ERC1155 (not used, but required for library compatibility)
     * @return Always reverts
     */
    function _dummyTokenByIndex(uint256) public pure returns (uint256) {
        revert("tokenByIndex not supported in ERC1155");
    }

    /**
     * @dev Dummy getApproved function for ERC1155 (not used, but required for library compatibility)
     * @return Always returns address(0)
     */
    function _dummyGetApproved(uint256) public pure returns (address) {
        return address(0);
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @dev Updates the platform commission percentage and address
     * @param newPlatformCommissionPercentage The new commission percentage in basis points
     * @param newPlatformAddress The new platform address
     * 
     * Requirements:
     * - Caller must have OWNER_ROLE
     */
    function setPlatformCommission(uint96 newPlatformCommissionPercentage, address newPlatformAddress) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        
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
     * @dev Sets the global royalty percentage
     * @param newRoyaltyPercentage The new royalty percentage in basis points
     * 
     * Requirements:
     * - Caller must have OWNER_ROLE
     */
    function setRoyaltyPercentage(uint96 newRoyaltyPercentage) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        KamiNFTLibrary.setRoyaltyPercentage(newRoyaltyPercentage, address(this));
    }

    /**
     * @dev Sets the mint price
     * @param newMintPrice The new mint price in payment token units
     * 
     * Requirements:
     * - Caller must have OWNER_ROLE
     */
    function setMintPrice(uint256 newMintPrice) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        mintPrice = newMintPrice;
    }

    /**
     * @dev Sets the base URI for token metadata
     * @param baseURI The new base URI
     * 
     * Requirements:
     * - Caller must have OWNER_ROLE
     */
    function setBaseURI(string memory baseURI) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        _baseTokenURI = baseURI;
    }

    /**
     * @dev Pauses the contract
     * 
     * Requirements:
     * - Caller must have OWNER_ROLE
     */
    function pause() external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        _pause();
    }
    
    /**
     * @dev Unpauses the contract
     * 
     * Requirements:
     * - Caller must have OWNER_ROLE
     */
    function unpause() external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        _unpause();
    }

    // ============ ROYALTY MANAGEMENT ============

    /**
     * @dev Sets global mint royalties
     * @param royalties Array of royalty data containing receiver addresses and fee numerators
     * 
     * Requirements:
     * - Caller must have OWNER_ROLE
     */
    function setMintRoyalties(KamiNFTLibrary.RoyaltyData[] calldata royalties) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        KamiNFTLibrary.setMintRoyalties(royalties, address(this));
    }

    /**
     * @dev Sets global transfer royalties
     * @param royalties Array of royalty data containing receiver addresses and fee numerators
     * 
     * Requirements:
     * - Caller must have OWNER_ROLE
     */
    function setTransferRoyalties(KamiNFTLibrary.RoyaltyData[] calldata royalties) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        KamiNFTLibrary.setTransferRoyalties(royalties, address(this));
    }

    /**
     * @dev Sets token-specific mint royalties
     * @param tokenId The token ID to set royalties for
     * @param royalties Array of royalty data containing receiver addresses and fee numerators
     * 
     * Requirements:
     * - Caller must have OWNER_ROLE
     * - Token must exist
     */
    function setTokenMintRoyalties(uint256 tokenId, KamiNFTLibrary.RoyaltyData[] calldata royalties) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        KamiNFTLibrary.setTokenMintRoyalties(tokenId, royalties, address(this), _exists);
    }

    /**
     * @dev Sets token-specific transfer royalties
     * @param tokenId The token ID to set royalties for
     * @param royalties Array of royalty data containing receiver addresses and fee numerators
     * 
     * Requirements:
     * - Caller must have OWNER_ROLE
     * - Token must exist
     */
    function setTokenTransferRoyalties(uint256 tokenId, KamiNFTLibrary.RoyaltyData[] calldata royalties) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        KamiNFTLibrary.setTokenTransferRoyalties(tokenId, royalties, address(this), _exists);
    }

    // ============ MINTING FUNCTIONS ============

    /**
     * @dev Mints a specified amount of tokens
     * @param amount The amount of tokens to mint
     * 
     * Requirements:
     * - Contract must not be paused
     * - Caller must have approved sufficient payment tokens
     * - Caller must have sufficient payment token balance
     */
    function mint(uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 totalPrice = mintPrice * amount;
        paymentToken.safeTransferFrom(msg.sender, address(this), totalPrice);
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _mint(msg.sender, tokenId, amount, "");
        
        // Distribute mint royalties
        KamiNFTLibrary.distributeMintRoyalties(tokenId, totalPrice, paymentToken);
        
        emit TokenMinted(msg.sender, tokenId, amount, totalPrice);
    }

    /**
     * @dev Mints multiple tokens in batch
     * @param amounts Array of amounts to mint for each token ID
     * 
     * Requirements:
     * - Contract must not be paused
     * - Caller must have approved sufficient payment tokens
     * - Caller must have sufficient payment token balance
     * - All amounts must be greater than 0
     */
    function mintBatch(uint256[] memory amounts) external whenNotPaused {
        require(amounts.length > 0, "Amounts array cannot be empty");
        
        uint256 totalPrice = 0;
        uint256[] memory tokenIds = new uint256[](amounts.length);
        
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "Amount must be greater than 0");
            totalPrice += mintPrice * amounts[i];
            tokenIds[i] = _tokenIdCounter.current();
            _tokenIdCounter.increment();
        }
        
        paymentToken.safeTransferFrom(msg.sender, address(this), totalPrice);
        _mintBatch(msg.sender, tokenIds, amounts, "");
        
        // Distribute royalties for each token
        for (uint256 i = 0; i < tokenIds.length; i++) {
            KamiNFTLibrary.distributeMintRoyalties(tokenIds[i], mintPrice * amounts[i], paymentToken);
            emit TokenMinted(msg.sender, tokenIds[i], amounts[i], mintPrice * amounts[i]);
        }
    }

    // ============ RENTAL FUNCTIONS ============

    /**
     * @dev Rents a token for a specified duration
     * @param tokenId The token ID to rent
     * @param duration The rental duration in seconds
     * @param rentalPrice The rental price in payment token units
     * 
     * Requirements:
     * - Contract must not be paused
     * - Caller must own the token
     * - Token must not already be rented
     * - Caller must have approved sufficient payment tokens
     */
    function rentToken(uint256 tokenId, uint256 duration, uint256 rentalPrice) external whenNotPaused {
        require(balanceOf(msg.sender, tokenId) > 0, "Must own tokens to rent");
        require(duration > 0, "Duration must be greater than 0");
        require(rentalPrice > 0, "Rental price must be greater than 0");
        
        // Call library with ERC1155 flag set to true
        KamiNFTLibrary.rentToken(paymentToken, tokenId, duration, rentalPrice, msg.sender, address(this), true);
        
        // Grant RENTER_ROLE to the renter
        _grantRole(RENTER_ROLE, msg.sender);
        
        // Get rental info for event emission
        KamiNFTLibrary.Rental memory rental = KamiNFTLibrary.getRentalInfo(KamiNFTLibrary._getRentals(), tokenId, _exists);
        emit TokenRented(msg.sender, msg.sender, tokenId, rental.startTime, rental.endTime, rentalPrice);
    }

    /**
     * @dev Ends a rental early
     * @param tokenId The token ID to end rental for
     * 
     * Requirements:
     * - Contract must not be paused
     * - Caller must own the token or be the renter
     */
    function endRental(uint256 tokenId) external whenNotPaused {
        // Get rental info from library to determine who can end the rental
        KamiNFTLibrary.Rental memory rental = KamiNFTLibrary.getRentalInfo(KamiNFTLibrary._getRentals(), tokenId, _exists);
        require(balanceOf(msg.sender, tokenId) > 0 || rental.renter == msg.sender, "Must own tokens or be renter to end rental");
        
        address tokenOwner = balanceOf(msg.sender, tokenId) > 0 ? msg.sender : rental.renter;
        KamiNFTLibrary.endRental(tokenId, tokenOwner, address(this), hasActiveRentals, true);
        
        // Check if renter still has active rentals
        if (!hasActiveRentals(rental.renter)) {
            _revokeRole(RENTER_ROLE, rental.renter);
        }
        
        emit RentalEnded(tokenOwner, rental.renter, tokenId);
    }

    /**
     * @dev Extends a rental period
     * @param tokenId The token ID to extend rental for
     * @param additionalDuration The additional duration in seconds
     * @param additionalPayment The additional payment in payment token units
     * 
     * Requirements:
     * - Contract must not be paused
     * - Caller must own the token
     * - Caller must have approved sufficient payment tokens
     */
    function extendRental(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment) external whenNotPaused {
        require(balanceOf(msg.sender, tokenId) > 0, "Must own tokens to extend rental");
        require(additionalDuration > 0, "Additional duration must be greater than 0");
        require(additionalPayment > 0, "Additional payment must be greater than 0");
        
        // Get current rental info to determine the renter
        KamiNFTLibrary.Rental memory rental = KamiNFTLibrary.getRentalInfo(KamiNFTLibrary._getRentals(), tokenId, _exists);
        require(rental.active, "Token is not currently rented");
        
        // Call library with ERC1155 flag set to true, passing the renter as tokenOwner
        KamiNFTLibrary.extendRental(paymentToken, tokenId, additionalDuration, additionalPayment, rental.renter, true);
        
        // Get updated rental info for event emission
        KamiNFTLibrary.Rental memory updatedRental = KamiNFTLibrary.getRentalInfo(KamiNFTLibrary._getRentals(), tokenId, _exists);
        emit RentalExtended(rental.renter, tokenId, updatedRental.endTime, additionalPayment);
    }

    // ============ SALES FUNCTIONS ============

    /**
     * @dev Sells tokens with automatic royalty distribution
     * @param to The address to sell to
     * @param tokenId The token ID to sell
     * @param amount The amount of tokens to sell
     * @param salePrice The sale price in payment token units
     * 
     * Requirements:
     * - Contract must not be paused
     * - Caller must own sufficient tokens
     * - Token must not be rented
     */
    function sellToken(address to, uint256 tokenId, uint256 amount, uint256 salePrice) external whenNotPaused {
        require(to != address(0), "Cannot sell to zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(salePrice > 0, "Sale price must be greater than 0");
        
        address seller = msg.sender;
        // Check that the seller owns the token
        require(balanceOf(seller, tokenId) >= amount, "Insufficient token balance");
        
        KamiNFTLibrary.sellToken(paymentToken, tokenId, to, salePrice, seller);
        safeTransferFrom(seller, to, tokenId, amount, "");
        
        emit TokenSold(seller, to, tokenId, amount, salePrice);
    }

    // ============ TRANSFER ROYALTY FUNCTIONS ============

    /**
     * @dev Initiates a transfer with royalty requirement
     * @param to The address to transfer to
     * @param tokenId The token ID to transfer
     * @param salePrice The sale price for royalty calculation
     * 
     * Requirements:
     * - Contract must not be paused
     * - Caller must own the token
     */
    function initiateTransferWithRoyalty(address to, uint256 tokenId, uint256 salePrice) external whenNotPaused {
        require(to != address(0), "Cannot transfer to zero address");
        require(balanceOf(msg.sender, tokenId) > 0, "Must own tokens to transfer");
        require(salePrice > 0, "Sale price must be greater than 0");
        
        KamiNFTLibrary.initiateTransferWithRoyalty(tokenId, to, salePrice, msg.sender);
    }
    
    /**
     * @dev Pays transfer royalty for a pending transfer
     * @param seller The address selling the tokens
     * @param to The address buying the tokens
     * @param tokenId The token ID being transferred
     * @param salePrice The sale price for royalty calculation
     * 
     * Requirements:
     * - Contract must not be paused
     * - Transfer must be initiated
     * - Caller must have approved sufficient payment tokens
     */
    function payTransferRoyalty(address seller, address to, uint256 tokenId, uint256 salePrice) external whenNotPaused {
        require(seller != address(0), "Seller cannot be zero address");
        require(to != address(0), "Buyer cannot be zero address");
        require(salePrice > 0, "Sale price must be greater than 0");
        
        KamiNFTLibrary.payTransferRoyalty(paymentToken, tokenId, to, salePrice, msg.sender, seller);
    }
    
    /**
     * @dev Checks if transfer royalty is required for a transfer
     * @param from The address transferring from
     * @param to The address transferring to
     * @param tokenId The token ID being transferred
     * @param salePrice The sale price for royalty calculation
     * @return True if royalty payment is required, false otherwise
     */
    function isTransferRoyaltyRequired(address from, address to, uint256 tokenId, uint256 salePrice) external view returns (bool) {
        return KamiNFTLibrary.isTransferRoyaltyRequired(tokenId, from, to, salePrice);
    }

    // ============ BURNING FUNCTIONS ============

    /**
     * @dev Burns a specified amount of tokens
     * @param tokenId The token ID to burn
     * @param amount The amount of tokens to burn
     * 
     * Requirements:
     * - Contract must not be paused
     * - Caller must own sufficient tokens
     * - Token must not be rented
     */
    function burn(uint256 tokenId, uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender, tokenId) >= amount, "Insufficient token balance");
        
        KamiNFTLibrary.validateBurn(tokenId, msg.sender);
        _burn(msg.sender, tokenId, amount);
    }

    /**
     * @dev Burns multiple tokens in batch
     * @param tokenIds Array of token IDs to burn
     * @param amounts Array of amounts to burn for each token ID
     * 
     * Requirements:
     * - Contract must not be paused
     * - Caller must own sufficient tokens for each token ID
     * - No token must be rented
     */
    function burnBatch(uint256[] memory tokenIds, uint256[] memory amounts) external whenNotPaused {
        require(tokenIds.length == amounts.length, "Arrays length mismatch");
        require(tokenIds.length > 0, "Arrays cannot be empty");
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(amounts[i] > 0, "Amount must be greater than 0");
            require(balanceOf(msg.sender, tokenIds[i]) >= amounts[i], "Insufficient token balance");
            KamiNFTLibrary.validateBurn(tokenIds[i], msg.sender);
        }
        _burnBatch(msg.sender, tokenIds, amounts);
    }

    // ============ INTERNAL FUNCTIONS ============

    /**
     * @dev Hook that is called before any token transfer
     * @param operator The address which initiated the transfer
     * @param from The address which is transferring tokens
     * @param to The address which is receiving tokens
     * @param ids Array of token IDs being transferred
     * @param amounts Array of amounts being transferred
     * @param data Additional data with no specified format
     */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155Upgradeable, ERC1155SupplyUpgradeable) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 tokenId = ids[i];
            
            // Check if rental has expired and mark it as inactive using library
            if (KamiNFTLibrary.isRented(tokenId)) {
                KamiNFTLibrary.Rental memory rental = KamiNFTLibrary.getRentalInfo(KamiNFTLibrary._getRentals(), tokenId, _exists);
                if (rental.active && block.timestamp >= rental.endTime) {
                    // The library should handle this automatically, but we can check here
                    if (hasActiveRentals(rental.renter)) {
                        _revokeRole(RENTER_ROLE, rental.renter);
                    }
                }
            }

            KamiNFTLibrary.validateTransfer(tokenId, from, to, from == address(0) ? address(0) : msg.sender, isApprovedForAll, _dummyGetApproved);
            KamiNFTLibrary.updateRentalOnTransfer(tokenId, from, to, address(this), hasActiveRentals);
        }
    }

    /**
     * @dev Converts a uint256 to its string representation
     * @param value The value to convert
     * @return The string representation of the value
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
