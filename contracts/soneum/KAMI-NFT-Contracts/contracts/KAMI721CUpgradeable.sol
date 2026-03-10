// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {ERC721EnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {KamiNFTCore} from "./libraries/KamiNFTCore.sol";
import {KamiPlatform} from "./libraries/KamiPlatform.sol";
import {KamiRoyalty} from "./libraries/KamiRoyalty.sol";
import {KamiRental} from "./libraries/KamiRental.sol";
import {KamiTransfer} from "./libraries/KamiTransfer.sol";

/**
 * @title KAMI721CUpgradeableOptimized
 * @dev Optimized upgradeable ERC721 contract using split libraries for size efficiency.
 * - Uses split libraries instead of monolithic library for reduced contract size
 * - Supports all features: ERC20 payments, royalties, platform commission, rental functionality
 * - Upgradeable via UUPS proxy pattern
 * - Deployable on size-constrained networks like SONEUM
 *
 * Roles:
 * - OWNER_ROLE: Can manage contract settings
 * - PLATFORM_ROLE: Receives platform commission payments
 * - RENTER_ROLE: Assigned to users renting tokens
 * - UPGRADER_ROLE: Can authorize contract upgrades
 */
contract KAMI721CUpgradeable is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ERC721EnumerableUpgradeable,
    ERC2981Upgradeable,
    PausableUpgradeable,
    EIP712Upgradeable
{
    using SafeERC20 for IERC20;
    // Libraries called explicitly to reduce contract size

    /// @dev Storage gap for upgradeable contracts
    uint256[50] private __gap;

    /// @notice Role for contract upgrades
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    /// @notice Role for contract owners (can manage contract settings)
    bytes32 public constant OWNER_ROLE = KamiNFTCore.OWNER_ROLE;
    /// @notice Role for renters (assigned to users renting tokens)
    bytes32 public constant RENTER_ROLE = KamiNFTCore.RENTER_ROLE;
    /// @notice Role for platform (receives commission payments)
    bytes32 public constant PLATFORM_ROLE = KamiNFTCore.PLATFORM_ROLE;

    // ============ CUSTOM ERRORS ============
    error ZeroAddress();
    error InvalidPlatformCommission();
    error CallerNotOwner();
    error CallerNotUpgrader();
    error TokenPriceNotSet();
    error InvalidPrice();
    error EmptyTokenURI();
    error SellerNotTokenOwner();
    error OwnerCannotRentOwnToken();
    error InsufficientPaymentBalance();
    error InsufficientPaymentAllowance();
    error ArrayLengthMismatch();
    error EmptyArray();
    error TooManyRecipients();
    error InvalidRecipient();
    error AlreadyClaimed();
    error ContractPaused();
    error InvalidDuration();
    error RentalNotActive();
    error InvalidRentalPrice();
    error InvalidRoyaltyPercentage();
    error InvalidTokenId();
    error TransferToZeroAddress();
    error ApprovalToCurrentOwner();
    error CallerNotTokenOwnerOrApproved();
    error TransferFromIncorrectOwner();
    error TransferToNonERC721ReceiverImplementer();
    error MintToZeroAddress();
    error TokenAlreadyMinted();
    error QueryForNonexistentToken();
    error SignatureExpired();
    error InvalidSigner();

    bytes32 private constant BURN_TYPEHASH = keccak256("Burn(uint256 tokenId,uint256 deadline)");
    bytes32 private constant INITIATE_TRANSFER_TYPEHASH = keccak256("InitiateTransferWithRoyalty(address to,uint256 tokenId,uint256 price,uint256 deadline)");
    bytes32 private constant SELL_TOKEN_TYPEHASH = keccak256("SellToken(address to,uint256 tokenId,uint256 deadline)");
    bytes32 private constant SET_TOKEN_URI_TYPEHASH = keccak256("SetTokenURI(uint256 tokenId,string newTokenURI,uint256 deadline)");
    bytes32 private constant RENT_TOKEN_TYPEHASH = keccak256("RentToken(uint256 tokenId,uint256 duration,uint256 rentalPrice,address renter,uint256 deadline)");
    bytes32 private constant EXTEND_RENTAL_TYPEHASH = keccak256("ExtendRental(uint256 tokenId,uint256 additionalDuration,uint256 additionalPayment,address renter,uint256 deadline)");
    bytes32 private constant END_RENTAL_TYPEHASH = keccak256("EndRental(uint256 tokenId,address renter,uint256 deadline)");
    bytes32 private constant PAY_TRANSFER_ROYALTY_TYPEHASH = keccak256("PayTransferRoyalty(uint256 tokenId,uint256 price,address buyer,uint256 deadline)");

    /// @dev Transfer tracker for royalty enforcement
    KamiNFTCore.TransferTracker private _transferTracker;

    /// @notice ERC20 token used for payments (e.g., USDC)
    IERC20 private _paymentToken;

    /// @notice Getter function for payment token address
    function paymentToken() external view returns (address) {
        return address(_paymentToken);
    }
    /// @notice Price in payment token (ERC20) for each token
    mapping(uint256 => uint256) public tokenPrices;
    /// @notice Individual URI for each token
    mapping(uint256 => string) public tokenURIs;
    /// @dev Base URI for token metadata (fallback)
    string private _baseTokenURI;
    /// @dev Counter for token IDs
    uint256 private _tokenIdCounter;
    
    // Added for upgradeable support for exists method to be available as an external function pointer
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

    /**
     * @dev Disables initializers for implementation contract
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract (replaces constructor for upgradeable pattern)
     * @param paymentToken_ ERC20 token address for payments
     * @param name_ ERC721 token name
     * @param symbol_ ERC721 token symbol
     * @param baseURI_ Base URI for token metadata
     * @param platformAddress_ Address to receive platform commission
     * @param platformCommissionPercentage_ Platform commission (basis points, max 2000 = 20%)
     */
    function initialize(
        address paymentToken_,
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        address platformAddress_,
        uint96 platformCommissionPercentage_,
        address adminAddress_
    ) public initializer {
        // Initialize upgradeable contracts
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ERC721_init(name_, symbol_);
        __ERC721Enumerable_init();
        __ERC2981_init();
        __Pausable_init();
        __EIP712_init("KAMI721C", "1");

        if (paymentToken_ == address(0)) revert ZeroAddress();
        if (platformAddress_ == address(0)) revert ZeroAddress();
        if (adminAddress_ == address(0)) revert ZeroAddress();
        if (platformCommissionPercentage_ > 2000) revert InvalidPlatformCommission();

        // Set contract state
        _paymentToken = IERC20(paymentToken_);
        _baseTokenURI = baseURI_;

        // Initialize library configurations
        KamiPlatform.initializePlatform(platformAddress_, platformCommissionPercentage_);
        KamiRoyalty.initializeRoyaltyConfig();

        // Grant roles - use adminAddress_ instead of msg.sender
        _grantRole(DEFAULT_ADMIN_ROLE, adminAddress_);
        _grantRole(OWNER_ROLE, adminAddress_);
        _grantRole(PLATFORM_ROLE, platformAddress_);
        _grantRole(UPGRADER_ROLE, adminAddress_);
        
        // Initialize token ID counter
        _tokenIdCounter = 1;
    }

    /**
     * @notice Authorizes contract upgrades (UUPS pattern)
     * @dev Only UPGRADER_ROLE can call.
     */
    function _authorizeUpgrade(address /* newImplementation */) internal view override {
        require(hasRole(UPGRADER_ROLE, msg.sender), "Caller is not an upgrader");
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
        override(ERC721EnumerableUpgradeable, ERC2981Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return ERC721EnumerableUpgradeable.supportsInterface(interfaceId) ||
               ERC2981Upgradeable.supportsInterface(interfaceId) ||
               AccessControlUpgradeable.supportsInterface(interfaceId);
    }

    /**
     * @notice Mint a new token
     * @dev Requires payment in the specified ERC20 token
     * @param recipient Address to receive the minted token
     * @param tokenPrice Price for this specific token
     * @param uri Individual URI for this token's metadata
     */
    function mint(address recipient, uint256 tokenPrice, string calldata uri, KamiNFTCore.RoyaltyData[] calldata mintRoyalties) external whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();
        if (bytes(uri).length == 0) revert EmptyTokenURI();

        // Mint token
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        _safeMint(recipient, tokenId);
        
        // Set token price and URI
        tokenPrices[tokenId] = tokenPrice;
        tokenURIs[tokenId] = uri;
        
        if(tokenPrice > 0) {
            // Transfer payment to contract
            _paymentToken.safeTransferFrom(msg.sender, address(this), tokenPrice);
            
            // Calculate and deduct platform commission
            uint96 platformCommission = KamiPlatform.platformCommission();
            uint256 commissionAmount = 0;
            if (platformCommission > 0) {
                commissionAmount = (tokenPrice * platformCommission) / 10000;
                if (commissionAmount > 0) {
                    IERC20(address(_paymentToken)).safeTransfer(KamiPlatform.platformAddress(), commissionAmount);
                }
            }
            
            // Calculate remaining amount after platform commission
            uint256 remainingAmount = tokenPrice - commissionAmount;
            
            // Set token-specific mint royalties if provided
            if(mintRoyalties.length > 0) {
                KamiRoyalty.setTokenMintRoyalties(tokenId, mintRoyalties, KamiNFTCore.getExternalExistsReference(address(this)));
            }
            
            // Distribute mint royalties on the remaining amount
            KamiRoyalty.distributeMintRoyalties(tokenId, remainingAmount, IERC20(address(_paymentToken)));
        }
    }

    /**
     * @notice Mint a new token for a specific recipient
     * @dev Requires payment in the specified ERC20 token from msg.sender
     * @param recipient Address to receive the minted token
     * @param tokenPrice Price for this specific token
     * @param uri Individual URI for this token's metadata
     */
    function mintFor(address recipient, uint256 tokenPrice, string calldata uri, KamiNFTCore.RoyaltyData[] calldata mintRoyalties) external whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();
        if (bytes(uri).length == 0) revert EmptyTokenURI();

        // Mint token to recipient
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        _safeMint(recipient, tokenId);

        // Set token price and URI
        tokenPrices[tokenId] = tokenPrice;
        tokenURIs[tokenId] = uri;
        
        if(tokenPrice > 0) {
            // Transfer payment from caller
            _paymentToken.safeTransferFrom(msg.sender, address(this), tokenPrice);
            
            // Calculate and deduct platform commission
            uint96 platformCommission = KamiPlatform.platformCommission();
            uint256 commissionAmount = 0;
            if (platformCommission > 0) {
                commissionAmount = (tokenPrice * platformCommission) / 10000;
                if (commissionAmount > 0) {
                    IERC20(address(_paymentToken)).safeTransfer(KamiPlatform.platformAddress(), commissionAmount);
                }
            }
            
            // Calculate remaining amount after platform commission
            uint256 remainingAmount = tokenPrice - commissionAmount;
            
            // Set token-specific mint royalties if provided
            if(mintRoyalties.length > 0) {
                KamiRoyalty.setTokenMintRoyalties(tokenId, mintRoyalties, KamiNFTCore.getExternalExistsReference(address(this)));
            }
            
            // Distribute mint royalties on the remaining amount
            KamiRoyalty.distributeMintRoyalties(tokenId, remainingAmount, IERC20(address(_paymentToken)));
        }
    }


    /**
     * @notice Set price for a specific token (only owner)
     * @param tokenId Token ID
     * @param newPrice New price in payment token
     */
    function setPrice(uint256 tokenId, uint256 newPrice) external onlyRole(OWNER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        tokenPrices[tokenId] = newPrice;
    }

    /**
     * @notice Set URI for a specific token
     * @param tokenId Token ID
     * @param newTokenURI New URI for the token's metadata
     */
    function setTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyRole(OWNER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(bytes(newTokenURI).length > 0, "Token URI cannot be empty");
        tokenURIs[tokenId] = newTokenURI;
    }

    /**
     * @notice Set base URI for token metadata
     * @param newBaseTokenURI New base URI
     */
    function setBaseURI(string memory newBaseTokenURI) external onlyRole(OWNER_ROLE) {
        _baseTokenURI = newBaseTokenURI;
    }

    /**
     * @notice Returns the URI for a given token ID
     * @dev Returns individual token URI if set, otherwise falls back to base URI
     * @param tokenId The token ID to query
     * @return The token URI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "URI query for nonexistent token");
        
        string memory individualURI = tokenURIs[tokenId];
        if (bytes(individualURI).length > 0) {
            return individualURI;
        }
        
        return string(abi.encodePacked(_baseTokenURI, Strings.toString(tokenId)));
    }

    /**
     * @notice Get base URI
     * @return Base URI string
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @notice Pause contract (only owner)
     */
    function pause() external onlyRole(OWNER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract (only owner)
     */
    function unpause() external onlyRole(OWNER_ROLE) {
        _unpause();
    }

    /**
     * @notice Set royalty percentage
     * @param newRoyaltyPercentage New royalty percentage in basis points
     */
    function setRoyaltyPercentage(uint96 newRoyaltyPercentage) external onlyRole(OWNER_ROLE) {
        KamiRoyalty.setRoyaltyPercentage(newRoyaltyPercentage);
    }

    /**
     * @notice Get royalty percentage
     * @return Royalty percentage in basis points
     */
    function royaltyPercentage() external view returns (uint96) {
        return KamiRoyalty.royaltyPercentage();
    }

    /**
     * @notice Get royalty info for a token
     * @param tokenId The token ID
     * @param price The sale price
     * @return receiver The royalty receiver address
     * @return royaltyAmount The royalty amount
     */
    function royaltyInfo(uint256 tokenId, uint256 price)
        public
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
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
     * @notice Get platform commission percentage
     * @return Platform commission percentage in basis points
     */
    function platformCommission() external view returns (uint96) {
        return KamiPlatform.platformCommission();
    }

    /**
     * @notice Get platform address
     * @return Platform address
     */
    function platformAddress() external view returns (address) {
        return KamiPlatform.platformAddress();
    }

    /**
     * @notice Set mint royalties
     * @param royalties Array of royalty receivers and percentages
     */
    function setMintRoyalties(KamiNFTCore.RoyaltyData[] calldata royalties) external onlyRole(OWNER_ROLE) {
        KamiRoyalty.setMintRoyalties(royalties);
    }

    /**
     * @notice Set transfer royalties
     * @param royalties Array of royalty receivers and percentages
     */
    function setTransferRoyalties(KamiNFTCore.RoyaltyData[] calldata royalties) external onlyRole(OWNER_ROLE) {
        KamiRoyalty.setTransferRoyalties(royalties);
    }

    /**
     * @notice Get mint royalty receivers for a token
     * @param tokenId Token ID
     * @return Array of royalty receivers
     */
    function getMintRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTCore.RoyaltyData[] memory) {
        return KamiRoyalty.getMintRoyaltyReceivers(tokenId);
    }

    /**
     * @notice Get transfer royalty receivers for a token
     * @param tokenId Token ID
     * @return Array of royalty receivers
     */
    function getTransferRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTCore.RoyaltyData[] memory) {
        return KamiRoyalty.getTransferRoyaltyReceivers(tokenId);
    }

    /**
     * @notice Update platform commission
     * @param newPlatformCommissionPercentage New platform commission percentage
     * @param newPlatformAddress New platform address
     */
    function updatePlatformCommission(
        uint96 newPlatformCommissionPercentage,
        address newPlatformAddress
    ) external onlyRole(OWNER_ROLE) {
        KamiPlatform.updatePlatformCommission(
            newPlatformCommissionPercentage,
            newPlatformAddress,
            address(this)
        );
    }

    /**
     * @notice Set token-specific mint royalties
     * @param tokenId The token ID to set royalties for
     * @param royalties Array of royalty receivers and percentages
     */
    function setTokenMintRoyalties(
        uint256 tokenId,
        KamiNFTCore.RoyaltyData[] calldata royalties
    ) external onlyRole(OWNER_ROLE) {
        KamiRoyalty.setTokenMintRoyalties(tokenId, royalties, KamiNFTCore.getExternalExistsReference(address(this)));
    }

    /**
     * @notice Set token-specific transfer royalties
     * @param tokenId The token ID to set royalties for
     * @param royalties Array of royalty receivers and percentages
     */
    function setTokenTransferRoyalties(
        uint256 tokenId,
        KamiNFTCore.RoyaltyData[] calldata royalties
    ) external onlyRole(OWNER_ROLE) {
        KamiRoyalty.setTokenTransferRoyalties(tokenId, royalties, KamiNFTCore.getExternalExistsReference(address(this)));
    }


    /**
     * @notice Rent a token
     * @param tokenId Token ID to rent
     * @param duration Rental duration in seconds
     * @param rentalPrice Total rental price
     */
    function rentToken(
        uint256 tokenId,
        uint256 duration,
        uint256 rentalPrice,
        address renter
    ) external whenNotPaused {
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        if (renter == address(0)) revert ZeroAddress();
        address rentalTokenOwner = ownerOf(tokenId);
        if (rentalTokenOwner == renter) revert OwnerCannotRentOwnToken();

        KamiRental.rentToken(
            _paymentToken,
            tokenId,
            duration,
            rentalPrice,
            rentalTokenOwner, // Pass the actual token owner to the library
            msg.sender // payer
        );

        // Grant RENTER_ROLE to the renter
        _grantRole(RENTER_ROLE, renter);
    }

    /**
     * @notice End a rental early
     * @param tokenId Token ID to end rental for
     */
    function endRental(uint256 tokenId) external {
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();

        KamiRental.endRentalSimple(tokenId);
    }

    /**
     * @notice Extend a rental period
     * @param tokenId Token ID to extend rental for
     * @param additionalDuration Additional duration in seconds
     * @param additionalPayment Additional payment required
     */
    function extendRental(
        uint256 tokenId,
        uint256 additionalDuration,
        uint256 additionalPayment
    ) external whenNotPaused {
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        // The token owner for rental payment will be the address that holds the token
        // In the context of this contract, `msg.sender` is implicitly the one who owns the token
        // when initiating a rental, as per the previous discussion of ERC1155 ownership.
        address rentalTokenOwner = ownerOf(tokenId);

        KamiRental.extendRental(
            _paymentToken,
            tokenId,
            additionalDuration,
            additionalPayment,
            rentalTokenOwner, // The token owner is msg.sender here (Manually updated by user)
            msg.sender // payer
        );
    }

    /**
     * @notice Get rental information for a token
     * @param tokenId Token ID to get rental info for
     * @return Rental information
     */
    function getRentalInfo(uint256 tokenId) external view returns (KamiNFTCore.Rental memory) {
        return KamiRental.getRentalInfo(tokenId);
    }

    /**
     * @notice Check if a token is currently rented
     * @param tokenId Token ID to check
     * @return True if the token is rented, false otherwise
     */
    function isRented(uint256 tokenId) external view returns (bool) {
        return KamiRental.isRented(tokenId);
    }

    /**
     * @notice Sell a token
     * @param to The buyer address
     * @param tokenId The token ID to sell
     */
    function sellToken(
        address to,
        uint256 tokenId,
        address seller
    ) external whenNotPaused {
        require(exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == seller, "Seller is not token owner");
        require(to != address(0), "Buyer cannot be zero address");
        require(seller != address(0), "Seller cannot be zero address");
        
        uint256 price = tokenPrices[tokenId];
        require(price > 0, "Token price not set");
        
        // Process sale with royalties FIRST (marks transfer as paid)
        KamiTransfer.sellToken(_paymentToken, tokenId, to, price, seller);
        
        // Then transfer token (will now pass validation)
        _transfer(seller, to, tokenId);
    }

    /**
     * @notice Burn a token
     * @param tokenId The token ID to burn
     */
    function burn(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "ERC721: token not minted");
        require(ownerOf(tokenId) == msg.sender, "ERC721: caller is not token owner");
        
        // Validate burn operation
        KamiTransfer.validateBurn(tokenId, msg.sender);
        
        _burn(tokenId);
    }

    function _transferFromBySignature(address from, address to, uint256 tokenId) internal {
        require(ownerOf(tokenId) == from, "Seller not token owner");
        _update(to, tokenId, from);
    }

    function _burnBySignature(uint256 tokenId, address owner) internal {
        require(ownerOf(tokenId) == owner, "Caller not token owner");
        _update(address(0), tokenId, owner);
    }

    function burnWithSignature(uint256 tokenId, uint256 deadline, bytes calldata signature) external {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(BURN_TYPEHASH, tokenId, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(ownerOf(tokenId) == signer, "Invalid signer");
        KamiTransfer.validateBurn(tokenId, signer);
        _burnBySignature(tokenId, signer);
    }

    function initiateTransferWithRoyaltyWithSignature(address to, uint256 tokenId, uint256 price, uint256 deadline, bytes calldata signature) external {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(INITIATE_TRANSFER_TYPEHASH, to, tokenId, price, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(ownerOf(tokenId) == signer, "Invalid signer");
        KamiTransfer.initiateTransferWithRoyalty(tokenId, to, price, signer);
    }

    function sellTokenWithSignature(address to, uint256 tokenId, uint256 deadline, bytes calldata signature) external whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(SELL_TOKEN_TYPEHASH, to, tokenId, deadline));
        address seller = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(seller != address(0) && to != address(0), "Invalid address");
        require(ownerOf(tokenId) == seller, "Seller not token owner");
        if (KamiRental.isRented(tokenId)) revert("ERC721: token is rented");
        uint256 price = tokenPrices[tokenId];
        require(price > 0, "Token price not set");
        KamiTransfer.sellToken(_paymentToken, tokenId, to, price, seller);
        _transferFromBySignature(seller, to, tokenId);
    }

    function setTokenURIWithSignature(uint256 tokenId, string calldata newTokenURI, uint256 deadline, bytes calldata signature) external {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(SET_TOKEN_URI_TYPEHASH, tokenId, keccak256(bytes(newTokenURI)), deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(ownerOf(tokenId) == signer, "Invalid signer");
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(bytes(newTokenURI).length > 0, "Empty token URI");
        tokenURIs[tokenId] = newTokenURI;
    }

    function rentTokenWithSignature(uint256 tokenId, uint256 duration, uint256 rentalPrice, address renter, uint256 deadline, bytes calldata signature) external whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(RENT_TOKEN_TYPEHASH, tokenId, duration, rentalPrice, renter, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == renter && renter != address(0), "Invalid signer");
        address tokenOwner = ownerOf(tokenId);
        require(tokenOwner != renter, "Owner cannot rent own token");
        KamiRental.rentTokenFor(_paymentToken, tokenId, duration, rentalPrice, tokenOwner, renter, renter);
        _grantRole(RENTER_ROLE, renter);
    }

    function extendRentalWithSignature(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment, address renter, uint256 deadline, bytes calldata signature) external whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(EXTEND_RENTAL_TYPEHASH, tokenId, additionalDuration, additionalPayment, renter, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == renter, "Invalid signer");
        require(KamiRental.getRentalInfo(tokenId).renter == renter, "Not renter");
        address tokenOwner = ownerOf(tokenId);
        KamiRental.extendRentalAs(_paymentToken, tokenId, additionalDuration, additionalPayment, tokenOwner, renter, renter);
    }

    function endRentalWithSignature(uint256 tokenId, address renter, uint256 deadline, bytes calldata signature) external {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(END_RENTAL_TYPEHASH, tokenId, renter, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == renter && KamiRental.getRentalInfo(tokenId).renter == renter, "Invalid signer");
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        KamiRental.endRentalSimple(tokenId);
    }

    function payTransferRoyaltyWithSignature(address seller, uint256 tokenId, uint256 price, address buyer, uint256 deadline, bytes calldata signature) external {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(PAY_TRANSFER_ROYALTY_TYPEHASH, tokenId, price, buyer, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == buyer, "Invalid signer");
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        KamiTransfer.payTransferRoyalty(_paymentToken, tokenId, price, seller, signer);
    }

    /**
     * @notice Initiate transfer with royalty requirement
     * @param to The recipient address
     * @param tokenId The token ID to transfer
     * @param price The price
     */
    function initiateTransferWithRoyalty(
        address to,
        uint256 tokenId,
        uint256 price
    ) external {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "ERC721: caller is not token owner");
        
        KamiTransfer.initiateTransferWithRoyalty(tokenId, to, price, msg.sender);
    }

    /**
     * @notice Pay transfer royalty
     * @param tokenId The token ID being transferred
     * @param price The price
     */
    function payTransferRoyalty(
        address seller,
        uint256 tokenId,
        uint256 price
    ) external {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        KamiTransfer.payTransferRoyalty(_paymentToken, tokenId, price, seller, msg.sender);
    }

    /**
     * @notice Check if transfer royalty is required
     * @param tokenId The token ID being transferred
     * @param price The price
     * @return True if transfer royalty is required, false otherwise
     */
    function isTransferRoyaltyRequired(
        address /* from */,
        address /* to */,
        uint256 tokenId,
        uint256 price
    ) external view returns (bool) {
        return KamiTransfer.isTransferRoyaltyRequired(tokenId, price);
    }

    /**
     * @notice Check if user has active rentals
     * @return True if user has active rentals, false otherwise
     */
    function hasActiveRentals(address /* user */) internal view returns (bool) {
        mapping(uint256 => KamiNFTCore.Rental) storage rentals = KamiRental._getRentals();
        uint256 supply = _tokenIdCounter; // For ERC721, iterate up to current token ID
        for (uint256 i = 1; i <= supply; i++) {
            if (rentals[i].active && rentals[i].renter == msg.sender && block.timestamp < rentals[i].endTime) {
                return true;
            }
        }
        return false;
    }

    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        address owner = super._update(to, tokenId, auth);

        if (from != owner && from != address(0)) {
            KamiNFTCore.Rental memory rental = KamiRental.getRentalInfo(tokenId);
            if (rental.active) {
                revert("ERC721: token is rented");
            }
        }

        // Handle RENTER_ROLE revocation if a renter transfers their last rented token
        if (from != owner && from != address(0) && to != address(0)) {
            address renter = from;
            if (hasRole(RENTER_ROLE, renter) && !KamiRental.isRented(tokenId) && !hasActiveRentals(renter)) {
                _revokeRole(RENTER_ROLE, renter);
            }
        }
        
        // Validate transfer if not minting or burning
        if (from != owner && from != address(0) && to != address(0)) {
            KamiTransfer.validateTransfer(
                tokenId,
                from,
                to,
                isApprovedForAll
            );
            // Update rental status on transfer
            KamiTransfer.updateRentalOnTransferSimple(tokenId);
        }
        
        return owner;
    }
}