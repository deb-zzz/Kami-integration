// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {KamiNFTCore} from "./libraries/KamiNFTCore.sol";
import {KamiPlatform} from "./libraries/KamiPlatform.sol";
import {KamiRoyalty} from "./libraries/KamiRoyalty.sol";
import {KamiRental} from "./libraries/KamiRental.sol";
import {KamiTransfer} from "./libraries/KamiTransfer.sol";

/**
 * @title KAMI721AC
 * @dev Claimable ERC721 contract with advanced royalty, platform commission, and rental features.
 * - One claim per address (no traditional minting)
 * - ERC20 payment integration
 * - Platform commission system
 * - Time-based rental system
 * - Royalty enforcement
 * - Role-based access control
 * - Batch claiming
 * 
 * Uses split libraries for size optimization and SONEUM deployment compatibility.
 * @author Paul Stinchcombe
 * @custom:security-contact security@kami.com
 */
contract KAMI721AC is AccessControl, ERC721Enumerable, ERC2981, Pausable, EIP712 {
    using SafeERC20 for IERC20;
    // Libraries called explicitly to reduce contract size

    // ============ CUSTOM ERRORS ============
    error InvalidPaymentTokenAddress();
    error InvalidPlatformAddress();
    error PlatformCommissionTooHigh();
    error CallerNotOwner();
    error EmptyRecipientsArray();
    error TooManyRecipients();
    error InvalidRecipientAddress();
    error RecipientAlreadyClaimed();
    error AlreadyClaimed();
    error TokenPriceNotSet();
    error SalePriceNotSet();
    error MintPriceNotSet();
    error InvalidPrice();
    error EmptyTokenURI();
    error SellerNotTokenOwner();
    error OwnerCannotRentOwnToken();
    error ZeroAddress();
    error QueryForNonexistentToken();
    error CallerNotTokenOwnerOrApproved();
    error ArrayLengthMismatch();
    error TokenSupplyExceeded();
    error SignatureExpired();
    error InvalidSigner();

    // ============ EIP-712 TYPE HASHES (gasless entrypoints) ============
    bytes32 private constant SET_SALE_PRICE_TYPEHASH = keccak256("SetSalePrice(uint256 tokenId,uint256 newSalePrice,uint256 deadline)");
    bytes32 private constant BURN_TYPEHASH = keccak256("Burn(uint256 tokenId,uint256 deadline)");
    bytes32 private constant INITIATE_TRANSFER_TYPEHASH = keccak256("InitiateTransferWithRoyalty(address to,uint256 tokenId,uint256 price,uint256 deadline)");
    bytes32 private constant SELL_TOKEN_TYPEHASH = keccak256("SellToken(address to,uint256 tokenId,uint256 deadline)");
    bytes32 private constant SET_TOKEN_URI_TYPEHASH = keccak256("SetTokenURI(uint256 tokenId,string newTokenURI,uint256 deadline)");
    bytes32 private constant RENT_TOKEN_TYPEHASH = keccak256("RentToken(uint256 tokenId,uint256 duration,uint256 rentalPrice,address renter,uint256 deadline)");
    bytes32 private constant EXTEND_RENTAL_TYPEHASH = keccak256("ExtendRental(uint256 tokenId,uint256 additionalDuration,uint256 additionalPayment,address renter,uint256 deadline)");
    bytes32 private constant END_RENTAL_TYPEHASH = keccak256("EndRental(uint256 tokenId,address renter,uint256 deadline)");
    bytes32 private constant PAY_TRANSFER_ROYALTY_TYPEHASH = keccak256("PayTransferRoyalty(uint256 tokenId,uint256 price,address buyer,uint256 deadline)");
    bytes32 private constant CLAIM_TYPEHASH = keccak256("Claim(address claimer,string uri,uint256 deadline)");

    // ============ STORAGE VARIABLES ============

    /** @dev Transfer tracker for royalty enforcement - managed by library */
    KamiNFTCore.TransferTracker private _transferTracker;

    /** @dev Role definitions from library */
    bytes32 public constant OWNER_ROLE = KamiNFTCore.OWNER_ROLE;
    bytes32 public constant RENTER_ROLE = KamiNFTCore.RENTER_ROLE;
    bytes32 public constant PLATFORM_ROLE = KamiNFTCore.PLATFORM_ROLE;

    /** @dev Token ID counter for sequential token generation */
    uint256 private _tokenIdCounter = 1;
    
    /** @dev Global mint/claim price (settable by OWNER_ROLE) */
    uint256 public mintPrice;
    
    /** @dev Per-token sale prices (settable by token owner) */
    mapping(uint256 => uint256) public salePrices;

    /** @dev Backward compatibility: view alias for salePrices */
    function tokenPrices(uint256 tokenId) external view returns (uint256) {
        return salePrices[tokenId];
    }

    /** @dev Individual URI for each token */
    mapping(uint256 => string) public tokenURIs;
    
    /** @dev Base URI for token metadata (fallback) */
    string private _baseTokenURI;
    
    /** @dev ERC20 token used for all payments (immutable after deployment) */
    IERC20 public immutable PAYMENT_TOKEN;
    
    /// @notice Getter function for payment token address
    function paymentToken() external view returns (address) {
        return address(PAYMENT_TOKEN);
    }

    /** @dev Mapping to track which addresses have already claimed a token */
    mapping(address => bool) public hasClaimed;

    /** @dev Maximum total supply for the contract (0 means unlimited) */
    uint256 private _maxTotalSupply;

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

    /**
     * @dev Emitted when the global mint price is updated
     * @param oldPrice Previous mint price
     * @param newPrice New mint price
     */
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);

    /**
     * @dev Emitted when a token's sale price is updated
     * @param tokenId Token ID
     * @param oldPrice Previous sale price
     * @param newPrice New sale price
     */
    event SalePriceUpdated(uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice);

    // ============ CONSTRUCTOR ============

    /**
     * @notice Initializes the contract with configuration.
     * @param paymentToken_ ERC20 token address for payments
     * @param name_ NFT collection name
     * @param symbol_ NFT collection symbol
     * @param baseTokenURI_ Base URI for token metadata
     * @param platformAddress_ Platform commission recipient
     * @param platformCommissionPercentage_ Platform commission (basis points, max 2000 = 20%)
     * @param adminAddress_ Address to receive admin and owner roles
     * @param totalSupply_ Optional total supply limit (0 means unlimited for this contract)
     * @param mintPrice_ Optional initial mint price (default 0)
     */
    constructor(
        address paymentToken_,
        string memory name_,
        string memory symbol_,
        string memory baseTokenURI_,
        address platformAddress_,
        uint96 platformCommissionPercentage_,
        address adminAddress_,
        uint256 totalSupply_,
        uint256 mintPrice_
    ) ERC721(name_, symbol_) Pausable() EIP712("KAMI721AC", "1") {
        if (paymentToken_ == address(0)) revert InvalidPaymentTokenAddress();
        if (platformAddress_ == address(0)) revert InvalidPlatformAddress();
        if (adminAddress_ == address(0)) revert ZeroAddress();
        if (platformCommissionPercentage_ > 2000) revert PlatformCommissionTooHigh();
        
        PAYMENT_TOKEN = IERC20(paymentToken_);
        _baseTokenURI = baseTokenURI_;
        
        // Initialize libraries
        KamiPlatform.initializePlatform(platformAddress_, platformCommissionPercentage_);
        KamiRoyalty.initializeRoyaltyConfig();
        
        // Set up roles - grant admin role to the specified admin address instead of msg.sender
        _grantRole(DEFAULT_ADMIN_ROLE, adminAddress_);
        _grantRole(OWNER_ROLE, adminAddress_);
        _grantRole(PLATFORM_ROLE, platformAddress_);
        
        // Set total supply if provided (0 means unlimited)
        if (totalSupply_ > 0) {
            _maxTotalSupply = totalSupply_;
        }
        
        // Set initial mint price
        mintPrice = mintPrice_;
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
        override(ERC721Enumerable, ERC2981, AccessControl)
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
        if (!hasRole(OWNER_ROLE, msg.sender)) revert CallerNotOwner();
        KamiRoyalty.setRoyaltyPercentage(newRoyaltyPercentage);
    }

    /**
     * @notice Set mint royalty receivers (OWNER_ROLE only).
     * @param royalties Array of RoyaltyData (receiver, feeNumerator)
     */
    function setMintRoyalties(KamiNFTCore.RoyaltyData[] calldata royalties) external {
        if (!hasRole(OWNER_ROLE, msg.sender)) revert CallerNotOwner();
        KamiRoyalty.setMintRoyalties(royalties);
    }

    /**
     * @notice Set transfer royalty receivers (OWNER_ROLE only).
     * @param royalties Array of RoyaltyData (receiver, feeNumerator)
     */
    function setTransferRoyalties(KamiNFTCore.RoyaltyData[] calldata royalties) external {
        if (!hasRole(OWNER_ROLE, msg.sender)) revert CallerNotOwner();
        KamiRoyalty.setTransferRoyalties(royalties);
    }

    /**
     * @notice Set token-specific mint royalties (OWNER_ROLE only).
     * @param tokenId Token ID
     * @param royalties Array of RoyaltyData
     */
    function setTokenMintRoyalties(uint256 tokenId, KamiNFTCore.RoyaltyData[] calldata royalties) external {
        if (!hasRole(OWNER_ROLE, msg.sender)) revert CallerNotOwner();
        KamiRoyalty.setTokenMintRoyalties(tokenId, royalties, KamiNFTCore.getExternalExistsReference(address(this)));
    }

    /**
     * @notice Set token-specific transfer royalties (OWNER_ROLE only).
     * @param tokenId Token ID
     * @param royalties Array of RoyaltyData
     */
    function setTokenTransferRoyalties(uint256 tokenId, KamiNFTCore.RoyaltyData[] calldata royalties) external {
        if (!hasRole(OWNER_ROLE, msg.sender)) revert CallerNotOwner();
        KamiRoyalty.setTokenTransferRoyalties(tokenId, royalties, KamiNFTCore.getExternalExistsReference(address(this)));
    }

    /**
     * @notice Royalty info for a token sale (ERC2981).
     * @dev Uses salePrice parameter if provided, otherwise falls back to salePrices mapping
     * @param tokenId Token ID
     * @param salePrice Sale price (if 0, uses salePrices[tokenId])
     * @return receiver Royalty receiver (first receiver for ERC2981 compatibility)
     * @return royaltyAmount Royalty amount (first receiver's share)
     */
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        public
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        uint256 price = salePrice > 0 ? salePrice : salePrices[tokenId];
        if (price == 0) {
            return (address(0), 0);
        }
        
        uint256 totalRoyaltyAmount = (price * KamiRoyalty.royaltyPercentage()) / 10000;
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
        uint256 price = salePrices[tokenId];
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

    function exists(uint256 tokenId) public view returns (bool) {
        try this.ownerOf(tokenId) returns (address) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Returns an internal view function to check if an operator is approved for all tokens.
     *      This is used for compatibility with library functions that require an internal function pointer.
     */
    function _getIsApprovedForAllReference() internal pure returns (function(address, address) view returns (bool)) {
        return isApprovedForAll;
    }

    // ============ TOKEN SALES ============

    /**
     * @notice Sell a token with royalty distribution.
     * @param to Buyer address
     * @param tokenId Token ID
     */
    function sellToken(address to, uint256 tokenId, address seller) external {
        if (seller == address(0)) revert ZeroAddress();
        if (ownerOf(tokenId) != seller) revert SellerNotTokenOwner();
        uint256 price = salePrices[tokenId];
        if (price == 0) revert SalePriceNotSet();
        KamiTransfer.sellToken(PAYMENT_TOKEN, tokenId, to, price, seller);
        safeTransferFrom(seller, to, tokenId);
    }

    // ============ RENTAL SYSTEM ============

    /**
     * @notice Rent a token for a duration.
     * @param tokenId Token ID
     * @param duration Rental duration (seconds)
     * @param rentalPrice Total rental price
     */
    function rentToken(uint256 tokenId, uint256 duration, uint256 rentalPrice, address renter) external whenNotPaused {
        if (renter == address(0)) revert ZeroAddress();
        address tokenOwner = ownerOf(tokenId);
        if (tokenOwner == renter) revert OwnerCannotRentOwnToken();
        KamiRental.rentToken(PAYMENT_TOKEN, tokenId, duration, rentalPrice, tokenOwner, msg.sender);
        _grantRole(RENTER_ROLE, renter);
    }

    /**
     * @notice End a rental early.
     * @param tokenId Token ID
     */
    function endRental(uint256 tokenId) external whenNotPaused {
        // address tokenOwner = ownerOf(tokenId); // Unused variable
        KamiRental.endRentalSimple(tokenId);
        // mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiRental._getRentals(); // Unused variable
        address renter = KamiRental.getRentalInfo(tokenId).renter;
        if (!hasActiveRentals(renter)) {
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
        KamiRental.extendRental(PAYMENT_TOKEN, tokenId, additionalDuration, additionalPayment, tokenOwner, msg.sender);
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
        KamiNFTCore.Rental memory rental = KamiRental.getRentalInfo(tokenId);
        return (rental.renter, rental.startTime, rental.endTime, rental.rentalPrice, rental.active);
    }

    /**
     * @notice Check if a user has active rentals.
     * @param user User address
     * @return True if user has active rentals
     */
    function hasActiveRentals(address user) public view whenNotPaused returns (bool) {
        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiRental._getRentals();
        uint256 supply = _tokenIdCounter;
        for (uint256 i = 1; i <= supply; i++) {
            if (rentals[i].active && rentals[i].renter == user) {
                return true;
            }
        }
        return false;
    }

    // ============ TOKEN TRANSFER VALIDATION ============

    /**
     * @dev Hook before any token transfer. Handles rental expiry, role management, and transfer validation.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        address owner = super._update(to, tokenId, auth);
        
        // Skip validation for minting (from == owner means minting or from == address(0))
        if (from != owner && from != address(0) && to != address(0)) {
            // Check for expired rentals
            if (KamiRental.isRented(tokenId)) {
                KamiNFTCore.Rental memory rental = KamiRental.getRentalInfo(tokenId);
                if (block.timestamp >= rental.endTime) {
                    address rentalRenter = rental.renter;
                    if (!hasActiveRentals(rentalRenter)) {
                        _revokeRole(RENTER_ROLE, rentalRenter);
                    }
                }
            }
            
            // Validate transfer
            KamiTransfer.validateTransfer(
                tokenId,
                from,
                to,
                isApprovedForAll
            );
            
            // Update rental status on transfer
            KamiTransfer.updateRentalOnTransferSimple(tokenId);
            
            // Handle RENTER_ROLE revocation if a renter transfers their last rented token
            address renter = from;
            if (hasRole(RENTER_ROLE, renter) && !KamiRental.isRented(tokenId) && !hasActiveRentals(renter)) {
                _revokeRole(RENTER_ROLE, renter);
            }
        }
        
        return owner;
    }

    // ============ METADATA MANAGEMENT ============

    /**
     * @notice Set base URI for token metadata (OWNER_ROLE only).
     * @param baseURI New base URI
     */
    function setBaseURI(string memory baseURI) external {
        if (!hasRole(OWNER_ROLE, msg.sender)) revert CallerNotOwner();
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

    /**
     * @dev Transfer token using recovered signer as auth (for gasless sellToken).
     */
    function _transferFromBySignature(address from, address to, uint256 tokenId) internal {
        if (ownerOf(tokenId) != from) revert SellerNotTokenOwner();
        _update(to, tokenId, from);
    }

    /**
     * @dev Burn token using recovered signer as auth (for gasless burn).
     */
    function _burnBySignature(uint256 tokenId, address owner) internal {
        if (ownerOf(tokenId) != owner) revert CallerNotTokenOwnerOrApproved();
        _update(address(0), tokenId, owner);
    }

    /**
     * @dev Recover signer from EIP-712 typed data signature. Used by all gasless entrypoints to reduce bytecode.
     */
    function _recoverSigner(bytes32 structHash, bytes calldata signature) internal view returns (address) {
        return ECDSA.recover(_hashTypedDataV4(structHash), signature);
    }

    /**
     * @dev Revert if deadline has passed. Used by all gasless entrypoints.
     */
    function _requireNotExpired(uint256 deadline) internal view {
        _requireNotExpired(deadline);
    }

    // ============ PAUSE FUNCTIONALITY ============

    /**
     * @notice Pause all non-view functions (OWNER_ROLE only).
     */
    function pause() external {
        if (!hasRole(OWNER_ROLE, msg.sender)) revert CallerNotOwner();
        _pause();
    }

    /**
     * @notice Unpause all functions (OWNER_ROLE only).
     */
    function unpause() external {
        if (!hasRole(OWNER_ROLE, msg.sender)) revert CallerNotOwner();
        _unpause();
    }

    // ============ ROYALTY TRANSFER FUNCTIONS ============

    /**
     * @notice Initiate a transfer with royalty requirement.
     * @param to Recipient address
     * @param tokenId Token ID
     * @param price The price
     */
    function initiateTransferWithRoyalty(address to, uint256 tokenId, uint256 price) external {
        KamiTransfer.initiateTransferWithRoyalty(tokenId, to, price, ownerOf(tokenId));
    }

    /**
     * @notice Pay transfer royalty and complete transfer.
     * @param tokenId Token ID
     * @param price The price
     */
    function payTransferRoyalty(address /* to */, uint256 tokenId, uint256 price) external {
        KamiTransfer.payTransferRoyalty(PAYMENT_TOKEN, tokenId, price, ownerOf(tokenId), msg.sender);
    }

    /**
     * @notice Check if transfer royalty is required.
     * @param tokenId Token ID
     * @param price The price
     * @return True if royalty required
     */
    function isTransferRoyaltyRequired(address /* from */, address /* to */, uint256 tokenId, uint256 price) external view returns (bool) {
        return KamiTransfer.isTransferRoyaltyRequired(tokenId, price);
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
     * @notice Set global mint price (OWNER_ROLE only).
     * @param newMintPrice New mint price in payment token
     */
    function setMintPrice(uint256 newMintPrice) external {
        if (!hasRole(OWNER_ROLE, msg.sender)) revert CallerNotOwner();
        uint256 oldPrice = mintPrice;
        mintPrice = newMintPrice;
        emit MintPriceUpdated(oldPrice, newMintPrice);
    }

    /**
     * @dev Update sale price storage and emit. Shared by setSalePrice, setPrice, setSalePriceWithSignature.
     */
    function _setSalePriceStorage(uint256 tokenId, uint256 newSalePrice) internal {
        uint256 oldPrice = salePrices[tokenId];
        salePrices[tokenId] = newSalePrice;
        emit SalePriceUpdated(tokenId, oldPrice, newSalePrice);
    }

    /**
     * @notice Set sale price for a specific token (token owner only).
     * @param tokenId Token ID
     * @param newSalePrice New sale price in payment token
     */
    function setSalePrice(uint256 tokenId, uint256 newSalePrice) external {
        if (ownerOf(tokenId) != msg.sender) revert CallerNotTokenOwnerOrApproved();
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        _setSalePriceStorage(tokenId, newSalePrice);
    }

    /**
     * @notice Set price for a specific token (OWNER_ROLE only) - DEPRECATED, use setSalePrice
     * @dev Kept for backward compatibility, but delegates to setSalePrice
     * @param tokenId Token ID
     * @param newPrice New price in payment token
     */
    function setPrice(uint256 tokenId, uint256 newPrice) external {
        if (!hasRole(OWNER_ROLE, msg.sender)) revert CallerNotOwner();
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        _setSalePriceStorage(tokenId, newPrice);
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
        if (!hasRole(OWNER_ROLE, msg.sender)) revert CallerNotOwner();
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        if (bytes(newTokenURI).length == 0) revert EmptyTokenURI();
        tokenURIs[tokenId] = newTokenURI;
    }

    /**
     * @dev Returns the URI for a given token ID
     * @dev Returns individual token URI if set, otherwise falls back to base URI
     * @param tokenId The token ID to query
     * @return The token URI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!exists(tokenId)) revert QueryForNonexistentToken();
        
        string memory individualURI = tokenURIs[tokenId];
        if (bytes(individualURI).length > 0) {
            return individualURI;
        }
        
        return string(abi.encodePacked(_baseTokenURI, Strings.toString(tokenId)));
    }

    /**
     * @notice Set total supply limit for the contract (OWNER_ROLE only).
     * @param maxSupply Maximum number of tokens that can be minted/claimed for the contract
     */
    function setTotalSupply(uint256 maxSupply) external {
        if (!hasRole(OWNER_ROLE, msg.sender)) revert CallerNotOwner();
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
     * @notice Get the number of tokens minted so far.
     * @return Number of tokens minted
     */
    function getTotalMinted() public view returns (uint256) {
        return totalSupply(); // Use ERC721Enumerable's totalSupply() to get current count
    }

    // ============ GASLESS (SIGNATURE) ENTRYPOINTS ============

    /**
     * @notice Set sale price for a token (gasless; token owner signs).
     */
    function setSalePriceWithSignature(uint256 tokenId, uint256 newSalePrice, uint256 deadline, bytes calldata signature) external {
        _requireNotExpired(deadline);
        bytes32 structHash = keccak256(abi.encode(SET_SALE_PRICE_TYPEHASH, tokenId, newSalePrice, deadline));
        address signer = _recoverSigner(structHash, signature);
        if (ownerOf(tokenId) != signer) revert InvalidSigner();
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        _setSalePriceStorage(tokenId, newSalePrice);
    }

    /**
     * @notice Burn a token (gasless; token owner signs).
     */
    function burnWithSignature(uint256 tokenId, uint256 deadline, bytes calldata signature) external {
        _requireNotExpired(deadline);
        bytes32 structHash = keccak256(abi.encode(BURN_TYPEHASH, tokenId, deadline));
        address signer = _recoverSigner(structHash, signature);
        if (ownerOf(tokenId) != signer) revert InvalidSigner();
        KamiTransfer.validateBurn(tokenId, signer);
        _burnBySignature(tokenId, signer);
    }

    /**
     * @notice Initiate transfer with royalty (gasless; token owner signs).
     */
    function initiateTransferWithRoyaltyWithSignature(address to, uint256 tokenId, uint256 price, uint256 deadline, bytes calldata signature) external {
        _requireNotExpired(deadline);
        bytes32 structHash = keccak256(abi.encode(INITIATE_TRANSFER_TYPEHASH, to, tokenId, price, deadline));
        address signer = _recoverSigner(structHash, signature);
        if (ownerOf(tokenId) != signer) revert InvalidSigner();
        KamiTransfer.initiateTransferWithRoyalty(tokenId, to, price, signer);
    }

    /**
     * @notice Sell a token (gasless; seller signs).
     */
    function sellTokenWithSignature(address to, uint256 tokenId, uint256 deadline, bytes calldata signature) external {
        _requireNotExpired(deadline);
        bytes32 structHash = keccak256(abi.encode(SELL_TOKEN_TYPEHASH, to, tokenId, deadline));
        address seller = _recoverSigner(structHash, signature);
        if (seller == address(0)) revert ZeroAddress();
        if (ownerOf(tokenId) != seller) revert SellerNotTokenOwner();
        uint256 price = salePrices[tokenId];
        if (price == 0) revert SalePriceNotSet();
        KamiTransfer.sellToken(PAYMENT_TOKEN, tokenId, to, price, seller);
        _transferFromBySignature(seller, to, tokenId);
    }

    /**
     * @notice Set token URI (gasless; token owner signs).
     */
    function setTokenURIWithSignature(uint256 tokenId, string calldata newTokenURI, uint256 deadline, bytes calldata signature) external {
        _requireNotExpired(deadline);
        bytes32 structHash = keccak256(abi.encode(SET_TOKEN_URI_TYPEHASH, tokenId, keccak256(bytes(newTokenURI)), deadline));
        address signer = _recoverSigner(structHash, signature);
        if (ownerOf(tokenId) != signer) revert InvalidSigner();
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        if (bytes(newTokenURI).length == 0) revert EmptyTokenURI();
        tokenURIs[tokenId] = newTokenURI;
    }

    /**
     * @notice Rent a token (gasless; renter signs and pays).
     */
    function rentTokenWithSignature(uint256 tokenId, uint256 duration, uint256 rentalPrice, address renter, uint256 deadline, bytes calldata signature) external whenNotPaused {
        _requireNotExpired(deadline);
        bytes32 structHash = keccak256(abi.encode(RENT_TOKEN_TYPEHASH, tokenId, duration, rentalPrice, renter, deadline));
        address signer = _recoverSigner(structHash, signature);
        if (signer != renter) revert InvalidSigner();
        if (renter == address(0)) revert ZeroAddress();
        address tokenOwner = ownerOf(tokenId);
        if (tokenOwner == renter) revert OwnerCannotRentOwnToken();
        KamiRental.rentTokenFor(PAYMENT_TOKEN, tokenId, duration, rentalPrice, tokenOwner, renter, renter);
        _grantRole(RENTER_ROLE, renter);
    }

    /**
     * @notice Extend a rental (gasless; renter signs and pays).
     */
    function extendRentalWithSignature(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment, address renter, uint256 deadline, bytes calldata signature) external whenNotPaused {
        _requireNotExpired(deadline);
        bytes32 structHash = keccak256(abi.encode(EXTEND_RENTAL_TYPEHASH, tokenId, additionalDuration, additionalPayment, renter, deadline));
        address signer = _recoverSigner(structHash, signature);
        if (signer != renter) revert InvalidSigner();
        if (KamiRental.getRentalInfo(tokenId).renter != renter) revert InvalidSigner();
        address tokenOwner = ownerOf(tokenId);
        KamiRental.extendRentalAs(PAYMENT_TOKEN, tokenId, additionalDuration, additionalPayment, tokenOwner, renter, renter);
    }

    /**
     * @notice End a rental early (gasless; renter signs).
     */
    function endRentalWithSignature(uint256 tokenId, address renter, uint256 deadline, bytes calldata signature) external whenNotPaused {
        _requireNotExpired(deadline);
        bytes32 structHash = keccak256(abi.encode(END_RENTAL_TYPEHASH, tokenId, renter, deadline));
        address signer = _recoverSigner(structHash, signature);
        if (signer != renter) revert InvalidSigner();
        if (KamiRental.getRentalInfo(tokenId).renter != renter) revert InvalidSigner();
        KamiRental.endRentalSimple(tokenId);
        if (!hasActiveRentals(renter)) {
            _revokeRole(RENTER_ROLE, renter);
        }
    }

    /**
     * @notice Pay transfer royalty (gasless; buyer signs and pays).
     */
    function payTransferRoyaltyWithSignature(address /* to */, uint256 tokenId, uint256 price, address buyer, uint256 deadline, bytes calldata signature) external {
        _requireNotExpired(deadline);
        bytes32 structHash = keccak256(abi.encode(PAY_TRANSFER_ROYALTY_TYPEHASH, tokenId, price, buyer, deadline));
        address signer = _recoverSigner(structHash, signature);
        if (signer != buyer) revert InvalidSigner();
        KamiTransfer.payTransferRoyalty(PAYMENT_TOKEN, tokenId, price, ownerOf(tokenId), signer);
    }

    /**
     * @notice Claim a token (gasless; claimer signs and pays).
     */
    function claimWithSignature(address claimer, string calldata uri, KamiNFTCore.RoyaltyData[] calldata mintRoyalties, uint256 deadline, bytes calldata signature) external {
        _requireNotExpired(deadline);
        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, claimer, keccak256(bytes(uri)), deadline));
        address signer = _recoverSigner(structHash, signature);
        if (signer != claimer) revert InvalidSigner();
        if (hasClaimed[claimer]) revert AlreadyClaimed();
        if (mintPrice == 0) revert MintPriceNotSet();
        if (bytes(uri).length == 0) revert EmptyTokenURI();
        if (_maxTotalSupply > 0) {
            uint256 currentSupply = totalSupply();
            if (currentSupply >= _maxTotalSupply) revert TokenSupplyExceeded();
        }
        uint256 tokenId = _mintOne(claimer, uri);
        KamiRoyalty.processMintPayment(
            PAYMENT_TOKEN, claimer, address(this), mintPrice, tokenId, mintRoyalties,
            KamiNFTCore.getExternalExistsReference(address(this))
        );
        hasClaimed[claimer] = true;
        emit TokenClaimed(claimer, tokenId, mintPrice);
    }

    // ============ MINTING FUNCTIONS ============

    /**
     * @dev Allocate token ID, mint to recipient, set sale price and URI. Used by mint/claim/batch to reduce bytecode.
     */
    function _mintOne(address to, string calldata uri) internal returns (uint256 tokenId) {
        tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        salePrices[tokenId] = mintPrice;
        tokenURIs[tokenId] = uri;
        return tokenId;
    }

    /**
     * @notice Mint a new token (for compatibility with KAMI721C)
     * @dev Requires payment in the specified ERC20 token, uses global mintPrice
     * @param recipient Address to receive the minted token
     * @param uri Individual URI for this token's metadata
     * @param mintRoyalties Array of royalty receivers and percentages
     */
    function mint(address recipient, string calldata uri, KamiNFTCore.RoyaltyData[] calldata mintRoyalties) external whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();        
        if (bytes(uri).length == 0) revert EmptyTokenURI();
        if (mintPrice == 0) revert MintPriceNotSet();

        // Check total supply limit if set
        if (_maxTotalSupply > 0) {
            uint256 currentSupply = totalSupply(); // Get current count from ERC721Enumerable
            if (currentSupply >= _maxTotalSupply) {
                revert TokenSupplyExceeded();
            }
        }

        uint256 tokenId = _mintOne(recipient, uri);
        KamiRoyalty.processMintPayment(
            PAYMENT_TOKEN, msg.sender, address(this), mintPrice, tokenId, mintRoyalties,
            KamiNFTCore.getExternalExistsReference(address(this))
        );
    }

    // ============ CLAIMING FUNCTIONS ============

    /**
     * @notice Claim a single token (one per address).
     * Requirements:
     * - Caller must not have already claimed
     * - Caller must have approved sufficient payment tokens
     * - Caller must have sufficient payment token balance
     * - Global mint price must be set
     */
    function claim(string calldata uri, KamiNFTCore.RoyaltyData[] calldata mintRoyalties) external {
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();
        if (mintPrice == 0) revert MintPriceNotSet();
        if (bytes(uri).length == 0) revert EmptyTokenURI();

        // Check total supply limit if set
        if (_maxTotalSupply > 0) {
            uint256 currentSupply = totalSupply(); // Get current count from ERC721Enumerable
            if (currentSupply >= _maxTotalSupply) {
                revert TokenSupplyExceeded();
            }
        }

        uint256 tokenId = _mintOne(msg.sender, uri);
        KamiRoyalty.processMintPayment(
            PAYMENT_TOKEN, msg.sender, address(this), mintPrice, tokenId, mintRoyalties,
            KamiNFTCore.getExternalExistsReference(address(this))
        );
        hasClaimed[msg.sender] = true;
        emit TokenClaimed(msg.sender, tokenId, mintPrice);
    }

    /**
     * @notice Batch claim tokens for recipients (owner pays for all).
     * @param recipients Array of recipient addresses
     * @param uris Array of URIs for each token
     * @param mintRoyalties Array of royalty receivers and percentages
     * Requirements:
     * - Caller must have OWNER_ROLE
     * - All recipients must not have already claimed
     * - Owner must have approved sufficient payment tokens
     * - Recipients array must not be empty or exceed 100
     * - No zero addresses
     * - Global mint price must be set
     */
    function batchClaimFor(address[] calldata recipients, string[] calldata uris, KamiNFTCore.RoyaltyData[] calldata mintRoyalties) external {
        if (!hasRole(OWNER_ROLE, msg.sender)) revert CallerNotOwner();
        if (recipients.length == 0) revert EmptyRecipientsArray();
        if (recipients.length > 100) revert TooManyRecipients();
        if (recipients.length != uris.length) revert ArrayLengthMismatch();
        if (mintPrice == 0) revert MintPriceNotSet();
        
        uint256 totalCost = mintPrice * recipients.length;
        for (uint256 i = 0; i < uris.length; i++) {
            if (bytes(uris[i]).length == 0) revert EmptyTokenURI();
        }
        if(totalCost > 0) {
            PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), totalCost);
        }
        
        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            if (recipient == address(0)) revert InvalidRecipientAddress();
            if (hasClaimed[recipient]) revert RecipientAlreadyClaimed();
            
            // Check total supply limit if set (check before minting each token)
            if (_maxTotalSupply > 0) {
                uint256 currentSupply = totalSupply(); // Get current count from ERC721Enumerable
                if (currentSupply >= _maxTotalSupply) {
                    revert TokenSupplyExceeded();
                }
            }

            uint256 tokenId = _mintOne(recipient, uris[i]);
            hasClaimed[recipient] = true;
            KamiRoyalty.processMintPaymentFromReserve(
                PAYMENT_TOKEN, mintPrice, tokenId, mintRoyalties,
                KamiNFTCore.getExternalExistsReference(address(this))
            );
        }
        emit BatchClaimedFor(msg.sender, recipients, totalCost);
    }

    /**
     * @notice Batch claim tokens for recipients (each pays for themselves).
     * @param recipients Array of recipient addresses
     * @param uris Array of URIs for each token
     * @param mintRoyalties Array of royalty receivers and percentages
     * Requirements:
     * - All recipients must not have already claimed
     * - All recipients must have approved sufficient payment tokens
     * - Recipients array must not be empty or exceed 100
     * - No zero addresses
     * - Global mint price must be set
     */
    function batchClaim(address[] calldata recipients, string[] calldata uris, KamiNFTCore.RoyaltyData[] calldata mintRoyalties) external {
        if (recipients.length == 0) revert EmptyRecipientsArray();
        if (recipients.length > 100) revert TooManyRecipients();
        if (recipients.length != uris.length) revert ArrayLengthMismatch();
        if (mintPrice == 0) revert MintPriceNotSet();
        
        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            if (recipient == address(0)) revert InvalidRecipientAddress();
            if (hasClaimed[recipient]) revert RecipientAlreadyClaimed();
            if (bytes(uris[i]).length == 0) revert EmptyTokenURI();

            // Check total supply limit if set (check before minting each token)
            if (_maxTotalSupply > 0) {
                uint256 currentSupply = totalSupply(); // Get current count from ERC721Enumerable
                if (currentSupply >= _maxTotalSupply) {
                    revert TokenSupplyExceeded();
                }
            }

            uint256 tokenId = _mintOne(recipient, uris[i]);
            KamiRoyalty.processMintPayment(
                PAYMENT_TOKEN, recipient, address(this), mintPrice, tokenId, mintRoyalties,
                KamiNFTCore.getExternalExistsReference(address(this))
            );
            hasClaimed[recipient] = true;
        }
        emit BatchClaimed(msg.sender, recipients);
    }
}