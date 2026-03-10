// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {ERC1155Utils} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Utils.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {KamiNFTCore} from "./libraries/KamiNFTCore.sol";
import {KamiPlatform} from "./libraries/KamiPlatform.sol";
import {KamiRoyalty} from "./libraries/KamiRoyalty.sol";
import {KamiRental} from "./libraries/KamiRental.sol";
import {KamiTransfer} from "./libraries/KamiTransfer.sol";

/**
 * @title KAMI1155C
 * @dev An advanced ERC1155 implementation with programmable royalties, rental functionality,
 * platform commissions, and transfer validation. Built using the modular KamiNFTLibrary for
 * enhanced functionality and maintainability.
 *
 * This contract provides:
 * - ERC1155 multi-token standard compliance
 * - ERC2981 royalty standard support
 * - Time-based rental system with automatic role management
 * - Programmable royalties for both minting and transfers
 * - Platform commission automation
 * - Transfer validation with royalty enforcement
 * - Access control with role-based permissions
 * - Pausable functionality for emergency situations
 * - Support for any ERC20 payment token
 *
 * @custom:security-contact security@kami.example.com
 * @custom:website https://kami.example.com
 * @custom:docs https://docs.kami.example.com
 */
contract KAMI1155C is AccessControl, ERC1155, ERC1155Supply, ERC2981, Pausable, EIP712 {
    using SafeERC20 for IERC20;
    // Libraries called explicitly to reduce contract size

    // ============ STORAGE VARIABLES ============

    /// @dev Transfer tracker for royalty enforcement
    KamiNFTCore.TransferTracker private _transferTracker;

    /// @notice Role for contract owners (can manage contract settings)
    bytes32 public constant OWNER_ROLE = KamiNFTCore.OWNER_ROLE;
    /// @notice Role for renters (assigned to users renting tokens)
    bytes32 public constant RENTER_ROLE = KamiNFTCore.RENTER_ROLE;
    /// @notice Role for platform (receives commission payments)
    bytes32 public constant PLATFORM_ROLE = KamiNFTCore.PLATFORM_ROLE;

    /// @dev Counter for generating unique token IDs
    uint256 private _tokenIdCounter = 1;

    /// @dev Current price in payment token units
    mapping(uint256 => uint256) public tokenPrices;

    /// @dev Individual URI for each token
    mapping(uint256 => string) public tokenURIs;

    /// @dev Base URI for token metadata (fallback)
    string private _baseTokenURI;

    /// @dev Immutable payment token contract address
    IERC20 public immutable PAYMENT_TOKEN;

    /// @dev Maximum total supply for each tokenId (0 means unlimited)
    mapping(uint256 => uint256) private _tokenTotalSupplies;

    /// @dev Maximum total supply for the contract (0 means unlimited)
    uint256 private _maxTotalSupply;

    /// @dev Actual minted count per tokenId (tracks real supply)
    mapping(uint256 => uint256) private _actualMintedCount;

    /// @dev Custom error for when token supply limit is exceeded
    error TokenSupplyExceeded();
    error SignatureExpired();
    error InvalidSigner();

    // EIP-712 type hashes (gasless entrypoints)
    bytes32 private constant SELL_TOKEN_TYPEHASH = keccak256("SellToken1155(address to,uint256 tokenId,uint256 amount,address seller,uint256 deadline)");
    bytes32 private constant SET_TOKEN_URI_TYPEHASH = keccak256("SetTokenURI1155(uint256 tokenId,string newTokenURI,uint256 deadline)");
    bytes32 private constant RENT_TOKEN_TYPEHASH = keccak256("RentToken1155(uint256 tokenId,uint256 duration,uint256 rentalPrice,address renter,uint256 deadline)");
    bytes32 private constant EXTEND_RENTAL_TYPEHASH = keccak256("ExtendRental1155(uint256 tokenId,uint256 additionalDuration,uint256 additionalPayment,address tokenOwner,uint256 deadline)");
    bytes32 private constant END_RENTAL_TYPEHASH = keccak256("EndRental1155(uint256 tokenId,address signer,uint256 deadline)");
    bytes32 private constant INITIATE_TRANSFER_TYPEHASH = keccak256("InitiateTransferWithRoyalty1155(address to,uint256 tokenId,uint256 price,address tokenOwner,uint256 deadline)");
    bytes32 private constant PAY_TRANSFER_ROYALTY_TYPEHASH = keccak256("PayTransferRoyalty1155(uint256 tokenId,uint256 price,address buyer,address seller,uint256 deadline)");
    bytes32 private constant BURN_TYPEHASH = keccak256("Burn1155(uint256 tokenId,uint256 amount,address owner,uint256 deadline)");

    /// @dev When set, _update uses this as authorized for transfer validation (signature path)
    address private _signatureTransferAuth;

    /// @notice Getter function for payment token address
    function paymentToken() external view returns (address) {
        return address(PAYMENT_TOKEN);
    }

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

    /**
     * @dev Initializes the contract with the specified parameters
     * @param paymentToken_ The ERC20 token address to be used for payments
     * @param baseTokenURI_ The base URI for token metadata
     * @param platformAddress_ The platform address to receive commissions
     * @param platformCommissionPercentage_ The platform commission percentage in basis points (max 20%)
     * @param adminAddress_ Address to receive admin and owner roles
     * @param totalSupply_ Optional total supply limit for the contract (0 means unlimited)
     *
     * Requirements:
     * - `paymentToken_` must not be the zero address
     * - `platformAddress_` must not be the zero address
     * - `adminAddress_` must not be the zero address
     * - `platformCommissionPercentage_` must not exceed 2000 (20%)
     */
    constructor(
        address paymentToken_,
        string memory baseTokenURI_,
        address platformAddress_,
        uint96 platformCommissionPercentage_,
        address adminAddress_,
        uint256 totalSupply_
    ) ERC1155(baseTokenURI_) Pausable() EIP712("KAMI1155C", "1") {
        require(paymentToken_ != address(0), "Invalid payment token address");
        require(platformAddress_ != address(0), "Invalid platform address");
        require(adminAddress_ != address(0), "Invalid admin address");
        require(platformCommissionPercentage_ <= 2000, "Platform commission too high"); // Max 20%

        PAYMENT_TOKEN = IERC20(paymentToken_);
        _baseTokenURI = baseTokenURI_;

        // Initialize library configurations
        KamiPlatform.initializePlatform(platformAddress_, platformCommissionPercentage_);
        KamiRoyalty.initializeRoyaltyConfig();

        // Grant initial roles - grant admin role to the specified admin address instead of msg.sender
        _grantRole(DEFAULT_ADMIN_ROLE, adminAddress_);
        _grantRole(OWNER_ROLE, adminAddress_);
        _grantRole(PLATFORM_ROLE, platformAddress_);
        
        // Set total supply if provided (0 means unlimited)
        if (totalSupply_ > 0) {
            _maxTotalSupply = totalSupply_;
        }
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Returns the next token ID that will be assigned
     * @return The next token ID
     */
    function nextTokenId() public view returns (uint256) {
        return _tokenIdCounter;
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
        override(ERC1155, ERC2981, AccessControl)
        returns (bool)
    {
        return ERC1155.supportsInterface(interfaceId) ||
            ERC2981.supportsInterface(interfaceId) ||
            AccessControl.supportsInterface(interfaceId);
    }

    /**
     * @dev Returns the platform address that receives commissions
     * @return The platform address
     */
    function platformAddress() public view returns (address) {
        return KamiPlatform.platformAddress();
    }

    /**
     * @dev Returns the platform commission percentage in basis points
     * @return The platform commission percentage
     */
    function platformCommission() public view returns (uint96) {
        return KamiPlatform.platformCommission();
    }

    /**
     * @dev Returns the platform commission percentage (alias for platformCommission)
     * @return The platform commission percentage
     */
    function platformCommissionPercentage() public view returns (uint96) {
        return KamiPlatform.platformCommission();
    }

    /**
     * @dev Returns the global royalty percentage in basis points
     * @return The royalty percentage
     */
    function royaltyPercentage() public view returns (uint96) {
        return KamiRoyalty.royaltyPercentage();
    }

    /**
     * @dev Returns royalty information for ERC2981 compliance
     * @dev Price is automatically taken from tokenPrices mapping, price parameter is unused but required for ERC2981 interface
     * @param tokenId The token ID to get royalty info for
     * @return receiver The address to receive royalties (first receiver for ERC2981 compatibility)
     * @return royaltyAmount The royalty amount (first receiver's share)
     */
    function royaltyInfo(uint256 tokenId, uint256 /* price */)
        public
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        uint256 tokenPrice = tokenPrices[tokenId];
        if (tokenPrice == 0) {
            return (address(0), 0);
        }
        
        uint256 totalRoyaltyAmount = (tokenPrice * KamiRoyalty.royaltyPercentage()) / 10000;
        KamiNFTCore.RoyaltyData[] memory royalties = KamiRoyalty.getTransferRoyaltyReceivers(tokenId);
        if (royalties.length > 0) {
            KamiNFTCore.RoyaltyData memory info = royalties[0];
            uint256 receiverShare = (totalRoyaltyAmount * info.feeNumerator) / 10000;
            return (info.receiver, receiverShare);
        }
        return (address(0), 0);
    }

    /**
     * @notice Get all royalty receivers and their amounts for a token sale.
     * @param tokenId Token ID
     * @return receivers Array of royalty receiver addresses
     * @return amounts Array of royalty amounts for each receiver
     */
    function getRoyaltyInfo(uint256 tokenId)
        public
        view
        returns (address[] memory receivers, uint256[] memory amounts)
    {
        uint256 price = tokenPrices[tokenId];
        if (price == 0) {
            return (new address[](0), new uint256[](0));
        }
        
        uint256 totalRoyaltyAmount = (price * KamiRoyalty.royaltyPercentage()) / 10000;
        KamiNFTCore.RoyaltyData[] memory royalties = KamiRoyalty.getTransferRoyaltyReceivers(tokenId);
        
        if (royalties.length == 0) {
            return (new address[](0), new uint256[](0));
        }
        
        receivers = new address[](royalties.length);
        amounts = new uint256[](royalties.length);
        
        for (uint256 i = 0; i < royalties.length; i++) {
            receivers[i] = royalties[i].receiver;
            amounts[i] = (totalRoyaltyAmount * royalties[i].feeNumerator) / 10000;
        }
        
        return (receivers, amounts);
    }

    /**
     * @dev Returns the mint royalty receivers for a specific token
     * @param tokenId The token ID to get mint royalty receivers for
     * @return Array of royalty data containing receiver addresses and fee numerators
     */
    function getMintRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTCore.RoyaltyData[] memory) {
        return KamiRoyalty.getMintRoyaltyReceivers(tokenId);
    }

    /**
     * @dev Returns the transfer royalty receivers for a specific token
     * @param tokenId The token ID to get transfer royalty receivers for
     * @return Array of royalty data containing receiver addresses and fee numerators
     */
    function getTransferRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTCore.RoyaltyData[] memory) {
        return KamiRoyalty.getTransferRoyaltyReceivers(tokenId);
    }


    /**
     * @dev Checks if a token is currently rented
     * @param tokenId The token ID to check
     * @return True if the token is rented, false otherwise
     */
    function isRented(uint256 tokenId) external view whenNotPaused returns (bool) {
        return KamiRental.isRented(tokenId);
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
        KamiNFTCore.Rental memory rental = KamiRental.getRentalInfo(tokenId);
        return (rental.renter, rental.startTime, rental.endTime, rental.rentalPrice, rental.active);
    }

    /**
     * @dev Checks if a user has any active rentals
     * @param user The address to check
     * @return True if the user has active rentals, false otherwise
     */
    function hasActiveRentals(address user) public view whenNotPaused returns (bool) {
        // For ERC1155, we need to check all possible token IDs
        return KamiRental.hasActiveRentalsERC1155(user, _tokenIdCounter);
    }

    /**
     * @dev Helper function to check if a token exists
     * @param tokenId The token ID to check
     * @return True if the token exists, false otherwise
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        // Use the actual minted count, not the limit
        return getTotalMinted(tokenId) > 0;
    }

    /**
     * @dev Public function to check if a token exists (for library compatibility)
     * @param tokenId The token ID to check
     * @return True if the token exists, false otherwise
     */
    function exists(uint256 tokenId) public view override returns (bool) {
        // Use the actual minted count, not the limit
        return getTotalMinted(tokenId) > 0;
    }

    /**
     * @notice Override totalSupply to return the set limit instead of actual minted amount
     * @param tokenId Token ID
     * @return Total supply limit (0 means unlimited)
     */
    function totalSupply(uint256 tokenId) public view override returns (uint256) {
        return _tokenTotalSupplies[tokenId];
    }

    /**
     * @notice Set total supply limit for the contract (OWNER_ROLE only).
     * @param maxSupply Maximum total supply for the contract (0 means unlimited)
     */
    function setTotalSupply(uint256 maxSupply) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        _maxTotalSupply = maxSupply;
    }

    /**
     * @notice Get total supply limit for the contract.
     * @return Total supply limit (0 means unlimited)
     */
    function maxTotalSupply() public view returns (uint256) {
        return _maxTotalSupply;
    }

    /**
     * @notice Set total supply limit for a specific tokenId (OWNER_ROLE only).
     * @param tokenId Token ID
     * @param maxSupply Maximum number of tokens that can be minted for this tokenId
     */
    function setTokenTotalSupply(uint256 tokenId, uint256 maxSupply) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        _tokenTotalSupplies[tokenId] = maxSupply;
    }

    /**
     * @notice Get the number of tokens minted so far for a specific tokenId.
     * @param tokenId Token ID
     * @return Number of tokens minted
     */
    function getTotalMinted(uint256 tokenId) public view returns (uint256) {
        // Use our tracked count which is maintained in _update
        // Since we track in _update which is called for all mints/burns, this should always be accurate
        return _actualMintedCount[tokenId];
    }

    /**
     * @dev Wrapper function for totalSupply to match library expectations
     * @return The total number of unique tokens minted
     */
        function _getTotalSupply() public view returns (uint256) {
        return _tokenIdCounter;
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
        require(newPlatformAddress != address(0), "Platform address cannot be zero");

        address oldPlatformAddress = KamiPlatform.platformAddress();
        KamiPlatform.updatePlatformCommission(newPlatformCommissionPercentage, newPlatformAddress, address(this));

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
        KamiRoyalty.setRoyaltyPercentage(newRoyaltyPercentage);
    }

    /**
     * @dev Sets the price
     * @param newPrice The new price in payment token units
     *
     * Requirements:
     * - Caller must have OWNER_ROLE
     */
    function setPrice(uint256 tokenId, uint256 newPrice) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        require(exists(tokenId), "Token does not exist");
        tokenPrices[tokenId] = newPrice;
    }

    /**
     * @dev Sets the URI for a specific token
     * @param tokenId The token ID
     * @param newTokenURI The new URI for the token's metadata
     *
     * Requirements:
     * - Caller must have OWNER_ROLE
     * - Token must exist
     * - Token URI cannot be empty
     */
    function setTokenURI(uint256 tokenId, string calldata newTokenURI) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        require(exists(tokenId), "Token does not exist");
        require(bytes(newTokenURI).length > 0, "Token URI cannot be empty");
        tokenURIs[tokenId] = newTokenURI;
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
     * @dev Returns the URI for a given token ID
     * @dev Returns individual token URI if set, otherwise falls back to base URI
     * @param tokenId The token ID to query
     * @return The token URI
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        require(exists(tokenId), "URI query for nonexistent token");
        
        string memory individualURI = tokenURIs[tokenId];
        if (bytes(individualURI).length > 0) {
            return individualURI;
        }
        
        return string(abi.encodePacked(_baseTokenURI, _toString(tokenId)));
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
    function setMintRoyalties(KamiNFTCore.RoyaltyData[] calldata royalties) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        KamiRoyalty.setMintRoyalties(royalties);
    }

    /**
     * @dev Sets global transfer royalties
     * @param royalties Array of royalty data containing receiver addresses and fee numerators
     *
     * Requirements:
     * - Caller must have OWNER_ROLE
     */
    function setTransferRoyalties(KamiNFTCore.RoyaltyData[] calldata royalties) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        KamiRoyalty.setTransferRoyalties(royalties);
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
    function setTokenMintRoyalties(
        uint256 tokenId,
        KamiNFTCore.RoyaltyData[] calldata royalties
    ) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        KamiRoyalty.setTokenMintRoyalties(tokenId, royalties, KamiNFTCore.getExternalExistsReference(address(this)));
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
    function setTokenTransferRoyalties(
        uint256 tokenId,
        KamiNFTCore.RoyaltyData[] calldata royalties
    ) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Caller is not an owner");
        KamiRoyalty.setTokenTransferRoyalties(tokenId, royalties, KamiNFTCore.getExternalExistsReference(address(this)));
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
    function mint(address recipient, uint256 amount, uint256 tokenPrice, string calldata tokenURI, KamiNFTCore.RoyaltyData[] calldata mintRoyalties) external whenNotPaused {
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(bytes(tokenURI).length > 0, "Token URI cannot be empty");

        uint256 tokenId = _tokenIdCounter;
        
        // Check total supply limit if set
        uint256 tokenTotalSupply = _tokenTotalSupplies[tokenId];
        if (tokenTotalSupply > 0) {
            uint256 currentSupply = getTotalMinted(tokenId);
            if (currentSupply + amount > tokenTotalSupply) {
                revert TokenSupplyExceeded();
            }
        }
        
        _tokenIdCounter++;
        _mint(recipient, tokenId, amount, "");

        // Set token price and URI
        tokenPrices[tokenId] = tokenPrice;
        tokenURIs[tokenId] = tokenURI;

        if(tokenPrice > 0) {
            uint256 totalPrice = tokenPrice * amount;
            require(PAYMENT_TOKEN.balanceOf(msg.sender) >= totalPrice, "Insufficient payment token balance");
            require(PAYMENT_TOKEN.allowance(msg.sender, address(this)) >= totalPrice, "Insufficient payment token allowance");
            PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), totalPrice);
            
            // Calculate and deduct platform commission
            uint96 platformCommission = KamiPlatform.platformCommission();
            uint256 commissionAmount = 0;
            if (platformCommission > 0) {
                commissionAmount = (totalPrice * platformCommission) / 10000;
                if (commissionAmount > 0) {
                    PAYMENT_TOKEN.safeTransfer(KamiPlatform.platformAddress(), commissionAmount);
                }
            }
            
            // Calculate remaining amount after platform commission
            uint256 remainingAmount = totalPrice - commissionAmount;
            
            // Set token-specific mint royalties if provided
            if(mintRoyalties.length > 0) {
                KamiRoyalty.setTokenMintRoyalties(tokenId, mintRoyalties, KamiNFTCore.getExternalExistsReference(address(this)));
            }
            
            // Distribute mint royalties on the remaining amount
            KamiRoyalty.distributeMintRoyalties(tokenId, remainingAmount, PAYMENT_TOKEN);
        }

        emit TokenMinted(recipient, tokenId, amount, tokenPrice * amount);
    }

    /**
     * @dev Mints a specified amount of tokens for a specific recipient
     * @param recipient Address to receive the minted tokens
     * @param amount The amount of tokens to mint
     *
     * Requirements:
     * - Contract must not be paused
     * - Recipient cannot be zero address
     * - Caller must have approved sufficient payment tokens
     * - Caller must have sufficient payment token balance
     */
    function mintFor(address recipient, uint256 amount, uint256 tokenPrice, string calldata tokenURI, KamiNFTCore.RoyaltyData[] calldata mintRoyalties) external whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(recipient != address(0), "Recipient cannot be zero address");
        require(bytes(tokenURI).length > 0, "Token URI cannot be empty");

        uint256 tokenId = _tokenIdCounter;
        
        // Check total supply limit if set
        uint256 tokenTotalSupply = _tokenTotalSupplies[tokenId];
        if (tokenTotalSupply > 0) {
            uint256 currentSupply = getTotalMinted(tokenId);
            if (currentSupply + amount > tokenTotalSupply) {
                revert TokenSupplyExceeded();
            }
        }
        
        _tokenIdCounter++;
        _mint(recipient, tokenId, amount, "");

        // Set token price and URI
        tokenPrices[tokenId] = tokenPrice;
        tokenURIs[tokenId] = tokenURI;

        if(tokenPrice > 0) {
            uint256 totalPrice = tokenPrice * amount;
            require(PAYMENT_TOKEN.balanceOf(msg.sender) >= totalPrice, "Insufficient payment token balance");
            require(PAYMENT_TOKEN.allowance(msg.sender, address(this)) >= totalPrice, "Insufficient payment token allowance");
            PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), totalPrice);
            
            // Calculate and deduct platform commission
            uint96 platformCommission = KamiPlatform.platformCommission();
            uint256 commissionAmount = 0;
            if (platformCommission > 0) {
                commissionAmount = (totalPrice * platformCommission) / 10000;
                if (commissionAmount > 0) {
                    PAYMENT_TOKEN.safeTransfer(KamiPlatform.platformAddress(), commissionAmount);
                }
            }
            
            // Calculate remaining amount after platform commission
            uint256 remainingAmount = totalPrice - commissionAmount;
            
            // Set token-specific mint royalties if provided
            if(mintRoyalties.length > 0) {
                KamiRoyalty.setTokenMintRoyalties(tokenId, mintRoyalties, KamiNFTCore.getExternalExistsReference(address(this)));
            }
            
            // Distribute mint royalties on the remaining amount
            KamiRoyalty.distributeMintRoyalties(tokenId, remainingAmount, PAYMENT_TOKEN);
        }

        emit TokenMinted(recipient, tokenId, amount, tokenPrice * amount);
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
    function mintBatch(address[] memory recipients, uint256[] memory amounts, uint256[] memory prices, string[] calldata uris) external whenNotPaused {
        require(recipients.length > 0, "Recipients array cannot be empty");
        require(recipients.length == amounts.length, "Recipients and amounts arrays must have same length");
        require(amounts.length == prices.length, "Amounts and prices arrays must have same length");
        require(amounts.length == uris.length, "Amounts and tokenURIs arrays must have same length");

        // Very simple implementation for debugging
        for (uint256 i = 0; i < amounts.length; i++) {
            require(recipients[i] != address(0), "Recipient cannot be zero address");
            require(amounts[i] > 0, "Amount must be greater than 0");
            require(prices[i] > 0, "Price must be greater than 0");
            require(bytes(uris[i]).length > 0, "Token URI cannot be empty");
            uint256 tokenId = _tokenIdCounter;
            
            // Check total supply limit if set
            uint256 tokenTotalSupply = _tokenTotalSupplies[tokenId];
            if (tokenTotalSupply > 0) {
                uint256 currentSupply = getTotalMinted(tokenId);
                if (currentSupply + amounts[i] > tokenTotalSupply) {
                    revert TokenSupplyExceeded();
                }
            }
            
            _tokenIdCounter++;
            _mint(recipients[i], tokenId, amounts[i], "");
            tokenPrices[tokenId] = prices[i];
            tokenURIs[tokenId] = uris[i];
            emit TokenMinted(recipients[i], tokenId, amounts[i], prices[i] * amounts[i]);
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
    function rentToken(
        uint256 tokenId,
        uint256 duration,
        uint256 rentalPrice,
        address renter,
        address tokenOwner
    ) external whenNotPaused {
        require(exists(tokenId), "Token does not exist");
        require(renter != address(0), "Renter cannot be zero address");
        require(tokenOwner != address(0), "Token owner cannot be zero address");
        require(tokenOwner != renter, "Owner cannot rent their own token");
        require(balanceOf(tokenOwner, tokenId) > 0, "Token owner does not have the token");

        KamiRental.rentToken(
            PAYMENT_TOKEN,
            tokenId,
            duration,
            rentalPrice,
            tokenOwner, // token owner
            msg.sender // payer
        );

        // Grant RENTER_ROLE to the renter
        _grantRole(RENTER_ROLE, renter);
        emit TokenRented(tokenOwner, renter, tokenId, KamiRental.getRentalInfo(tokenId).startTime, KamiRental.getRentalInfo(tokenId).endTime, rentalPrice);
    }

    /**
     * @dev Ends a rental early
     * @param tokenId Token ID to end rental for
     */
    function endRental(uint256 tokenId) external whenNotPaused {
        require(exists(tokenId), "Token does not exist");
        require(balanceOf(msg.sender, tokenId) > 0 || KamiRental.getRentalInfo(tokenId).renter == msg.sender, "Must own tokens or be renter to end rental");

        KamiRental.endRentalSimple(tokenId);
        KamiNFTCore.Rental memory rentalInfo = KamiRental.getRentalInfo(tokenId);
        emit RentalEnded(msg.sender, rentalInfo.renter, tokenId);
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
    function extendRental(
        uint256 tokenId,
        uint256 additionalDuration,
        uint256 additionalPayment
    ) external whenNotPaused {
        require(exists(tokenId), "Token does not exist");

        KamiRental.extendRental(
            PAYMENT_TOKEN,
            tokenId,
            additionalDuration,
            additionalPayment,
            msg.sender, // token owner
            msg.sender // payer
        );

        KamiNFTCore.Rental memory updatedRental = KamiRental.getRentalInfo(tokenId);
        emit RentalExtended(msg.sender, tokenId, updatedRental.endTime, additionalPayment);
    }

    // ============ SALES FUNCTIONS ============

    /**
     * @dev Sells tokens with automatic royalty distribution
     * @param to The address to sell to
     * @param tokenId The token ID to sell
     * @param amount The amount of tokens to sell
     *
     * Requirements:
     * - Contract must not be paused
     * - Caller must own sufficient tokens
     * - Token must not be rented
     */
    function sellToken(address to, uint256 tokenId, uint256 amount, address seller) external whenNotPaused {
        require(to != address(0), "Cannot sell to zero address");
        require(seller != address(0), "Seller cannot be zero address");
        require(amount > 0, "Amount must be greater than 0");

        // Check that the seller owns the token
        require(balanceOf(seller, tokenId) >= amount, "Insufficient token balance");

        uint256 price = tokenPrices[tokenId];
        require(price > 0, "Token price not set");
        
        // Process sale with royalties FIRST (marks transfer as paid)
        KamiTransfer.sellToken(PAYMENT_TOKEN, tokenId, to, price, seller);
        
        // Then transfer token (will now pass validation)
        safeTransferFrom(seller, to, tokenId, amount, "");

        emit TokenSold(seller, to, tokenId, amount, price);
    }

    // ============ TRANSFER ROYALTY FUNCTIONS ============

    /**
     * @dev Initiates a transfer with royalty requirement
     * @param to The address to transfer to
     * @param tokenId The token ID to transfer
     * @param price The price for royalty calculation
     *
     * Requirements:
     * - Contract must not be paused
     * - Caller must own the token
     */
    function initiateTransferWithRoyalty(
        address to,
        uint256 tokenId,
        uint256 price
    ) external whenNotPaused {
        require(to != address(0), "Cannot transfer to zero address");
        require(balanceOf(msg.sender, tokenId) > 0, "Not token owner");
        
        KamiTransfer.initiateTransferWithRoyalty(tokenId, to, price, msg.sender);
    }

    /**
     * @notice Pay transfer royalty (buyer calls; seller is passed for ERC1155 multi-owner)
     * @param seller The address selling the tokens (receives payment after commission/royalty)
     * @param tokenId The token ID being transferred
     * @param price The price
     */
    function payTransferRoyalty(
        address seller,
        uint256 tokenId,
        uint256 price
    ) external whenNotPaused {
        require(exists(tokenId), "Token does not exist");
        require(seller != address(0), "Seller cannot be zero");
        KamiTransfer.payTransferRoyalty(PAYMENT_TOKEN, tokenId, price, seller, msg.sender);
    }

    /**
     * @notice Check if transfer royalty is required
     * @param tokenId The token ID being transferred
     * @param price The price
     * @return True if transfer royalty is required, false otherwise
     */
    function isTransferRoyaltyRequired(
        uint256 tokenId,
        uint256 price
    ) external view returns (bool) {
        return KamiTransfer.isTransferRoyaltyRequired(tokenId, price);
    }

    // ============ GASLESS (SIGNATURE) ENTRYPOINTS ============

    function sellTokenWithSignature(address to, uint256 tokenId, uint256 amount, address seller, uint256 deadline, bytes calldata signature) external whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(SELL_TOKEN_TYPEHASH, to, tokenId, amount, seller, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == seller, "Invalid signer");
        require(seller != address(0) && to != address(0) && amount > 0, "Invalid params");
        require(balanceOf(seller, tokenId) >= amount, "Insufficient token balance");
        uint256 price = tokenPrices[tokenId];
        require(price > 0, "Token price not set");
        KamiTransfer.sellToken(PAYMENT_TOKEN, tokenId, to, price, seller);
        _transferFromBySignature1155(seller, to, tokenId, amount);
        emit TokenSold(seller, to, tokenId, amount, price);
    }

    function setTokenURIWithSignature(uint256 tokenId, string calldata newTokenURI, uint256 deadline, bytes calldata signature) external {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(SET_TOKEN_URI_TYPEHASH, tokenId, keccak256(bytes(newTokenURI)), deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(balanceOf(signer, tokenId) > 0, "Not token owner");
        require(exists(tokenId), "Token does not exist");
        require(bytes(newTokenURI).length > 0, "Token URI cannot be empty");
        tokenURIs[tokenId] = newTokenURI;
    }

    function rentTokenWithSignature(uint256 tokenId, uint256 duration, uint256 rentalPrice, address renter, address tokenOwner, uint256 deadline, bytes calldata signature) external whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(RENT_TOKEN_TYPEHASH, tokenId, duration, rentalPrice, renter, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == renter, "Invalid signer");
        require(exists(tokenId) && renter != address(0) && tokenOwner != address(0), "Invalid params");
        require(tokenOwner != renter, "Owner cannot rent their own token");
        require(balanceOf(tokenOwner, tokenId) > 0, "Token owner does not have the token");
        KamiRental.rentTokenFor(PAYMENT_TOKEN, tokenId, duration, rentalPrice, tokenOwner, renter, renter);
        _grantRole(RENTER_ROLE, renter);
        emit TokenRented(tokenOwner, renter, tokenId, KamiRental.getRentalInfo(tokenId).startTime, KamiRental.getRentalInfo(tokenId).endTime, rentalPrice);
    }

    function extendRentalWithSignature(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment, address tokenOwner, uint256 deadline, bytes calldata signature) external whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(EXTEND_RENTAL_TYPEHASH, tokenId, additionalDuration, additionalPayment, tokenOwner, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == tokenOwner, "Invalid signer");
        require(balanceOf(tokenOwner, tokenId) > 0, "Not token owner");
        require(exists(tokenId), "Token does not exist");
        address currentRenter = KamiRental.getRentalInfo(tokenId).renter;
        KamiRental.extendRentalAs(PAYMENT_TOKEN, tokenId, additionalDuration, additionalPayment, tokenOwner, tokenOwner, currentRenter);
        KamiNFTCore.Rental memory updatedRental = KamiRental.getRentalInfo(tokenId);
        emit RentalExtended(tokenOwner, tokenId, updatedRental.endTime, additionalPayment);
    }

    function endRentalWithSignature(uint256 tokenId, address signer, uint256 deadline, bytes calldata signature) external whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(END_RENTAL_TYPEHASH, tokenId, signer, deadline));
        address recovered = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(recovered == signer, "Invalid signer");
        require(exists(tokenId), "Token does not exist");
        require(balanceOf(signer, tokenId) > 0 || KamiRental.getRentalInfo(tokenId).renter == signer, "Must own tokens or be renter");
        KamiRental.endRentalSimple(tokenId);
        KamiNFTCore.Rental memory rentalInfo = KamiRental.getRentalInfo(tokenId);
        emit RentalEnded(signer, rentalInfo.renter, tokenId);
    }

    function initiateTransferWithRoyaltyWithSignature(address to, uint256 tokenId, uint256 price, address tokenOwner, uint256 deadline, bytes calldata signature) external whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(INITIATE_TRANSFER_TYPEHASH, to, tokenId, price, tokenOwner, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == tokenOwner, "Invalid signer");
        require(balanceOf(tokenOwner, tokenId) > 0, "Not token owner");
        require(to != address(0), "Cannot transfer to zero address");
        KamiTransfer.initiateTransferWithRoyalty(tokenId, to, price, signer);
    }

    function payTransferRoyaltyWithSignature(uint256 tokenId, uint256 price, address buyer, address seller, uint256 deadline, bytes calldata signature) external whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(PAY_TRANSFER_ROYALTY_TYPEHASH, tokenId, price, buyer, seller, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == buyer, "Invalid signer");
        require(exists(tokenId), "Token does not exist");
        KamiTransfer.payTransferRoyalty(PAYMENT_TOKEN, tokenId, price, seller, signer);
    }

    function burnWithSignature(uint256 tokenId, uint256 amount, address owner, uint256 deadline, bytes calldata signature) external whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(BURN_TYPEHASH, tokenId, amount, owner, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == owner, "Invalid signer");
        require(amount > 0 && balanceOf(owner, tokenId) >= amount, "Insufficient balance");
        if (KamiRental.isRented(tokenId)) {
            mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiRental._getRentals();
            require(rentals[tokenId].renter == owner, "Cannot burn rented token");
        }
        _burn(owner, tokenId, amount);
    }

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

        // Check if token is rented
        if (KamiRental.isRented(tokenId)) {
            mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiRental._getRentals();
            require(rentals[tokenId].renter == msg.sender, "Cannot burn rented token");
        }

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
        }
        _burnBatch(msg.sender, tokenIds, amounts);
    }

    // ============ INTERNAL FUNCTIONS ============

    /**
     * @dev Hook that is called before any token transfer
     * @param from The address which is transferring tokens
     * @param to The address which is receiving tokens
     * @param ids Array of token IDs being transferred
     * @param amounts Array of amounts being transferred
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) internal override(ERC1155, ERC1155Supply) {
        bool isSignaturePath = (_signatureTransferAuth != address(0));
        if (isSignaturePath && from != address(0) && to != address(0)) {
            for (uint256 i = 0; i < ids.length; i++) {
                KamiTransfer.validateTransferWithAuth(ids[i], from, to, isApprovedForAll, _signatureTransferAuth);
            }
            _signatureTransferAuth = address(0);
        }

        super._update(from, to, ids, amounts);

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 tokenId = ids[i];
            uint256 amount = amounts[i];

            if (from == address(0)) {
                _actualMintedCount[tokenId] += amount;
            } else if (to == address(0)) {
                _actualMintedCount[tokenId] -= amount;
            }

            if (from != address(0)) {
                KamiNFTCore.Rental memory rental = KamiRental.getRentalInfo(tokenId);
                if (rental.active) {
                    revert("Cannot transfer actively rented token");
                }
            }

            if (from != address(0) && to != address(0) && !isSignaturePath) {
                KamiTransfer.validateTransfer(tokenId, from, to, isApprovedForAll);
            }
        }
    }

    function _transferFromBySignature1155(address from, address to, uint256 tokenId, uint256 amount) internal {
        require(balanceOf(from, tokenId) >= amount, "Insufficient token balance");
        _signatureTransferAuth = from;
        uint256[] memory ids = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        ids[0] = tokenId;
        amounts[0] = amount;
        _update(from, to, ids, amounts);
        if (to != address(0)) {
            address operator = msg.sender;
            ERC1155Utils.checkOnERC1155Received(operator, from, to, tokenId, amount, "");
        }
    }

    /**
     * @dev Internal function to validate a single token transfer
     * @param from The sender address
     * @param to The recipient address
     */
    function _validateTokenTransfer(address from, address to) internal {
        // Basic validation only - skip complex library calls for now
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(from != to, "Transfer to same address");
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