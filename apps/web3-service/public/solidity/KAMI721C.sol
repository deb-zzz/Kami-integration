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
 * @title KAMI721CMinimal
 * @dev Minimal ERC721 contract with essential features using split libraries.
 * This version uses separate libraries to reduce contract size and enable deployment.
 * 
 * Features:
 * - Basic ERC721 functionality
 * - Platform management
 * - Royalty system
 * - Rental system
 * - Transfer validation
 * 
 * Roles:
 * - OWNER_ROLE: Can manage contract settings
 * - PLATFORM_ROLE: Receives platform commission payments
 * - RENTER_ROLE: Assigned to users renting tokens
 */
contract KAMI721C is AccessControl, ERC721Enumerable, ERC2981, Pausable, EIP712 {
    using SafeERC20 for IERC20;
    // Libraries called explicitly to reduce contract size

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

    // EIP-712 type hashes (gasless entrypoints)
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

    /// @notice Role for contract owners (can manage contract settings)
    bytes32 public constant OWNER_ROLE = KamiNFTCore.OWNER_ROLE;
    /// @notice Role for renters (assigned to users renting tokens)
    bytes32 public constant RENTER_ROLE = KamiNFTCore.RENTER_ROLE;
    /// @notice Role for platform (receives commission payments)
    bytes32 public constant PLATFORM_ROLE = KamiNFTCore.PLATFORM_ROLE;

    /// @dev Counter for token IDs
    uint256 private _tokenIdCounter = 1;
    /// @notice Price in payment token (ERC20) for each token
    mapping(uint256 => uint256) public tokenPrices;
    /// @notice Individual URI for each token
    mapping(uint256 => string) public tokenURIs;
    /// @dev Base URI for token metadata (fallback)
    string private _baseTokenURI;

    /// @notice ERC20 token used for payments (e.g., USDC)
    IERC20 public immutable PAYMENT_TOKEN;
    
    /// @notice Getter function for payment token address
    function paymentToken() external view returns (address) {
        return address(PAYMENT_TOKEN);
    }

    /**
     * @notice Contract constructor
     * @param paymentToken_ ERC20 token address for payments
     * @param name_ ERC721 token name
     * @param symbol_ ERC721 token symbol
     * @param baseTokenURI_ Base URI for token metadata
     * @param platformAddress_ Address to receive platform commission
     * @param platformCommissionPercentage_ Platform commission (basis points, max 2000 = 20%)
     * @param adminAddress_ Address to receive admin and owner roles
     */
    constructor(
        address paymentToken_,
        string memory name_,
        string memory symbol_,
        string memory baseTokenURI_,
        address platformAddress_,
        uint96 platformCommissionPercentage_,
        address adminAddress_
    ) ERC721(name_, symbol_) Pausable() EIP712("KAMI721C", "1") {
        if (paymentToken_ == address(0)) revert ZeroAddress();
        if (platformAddress_ == address(0)) revert ZeroAddress();
        if (adminAddress_ == address(0)) revert ZeroAddress();
        if (platformCommissionPercentage_ > 2000) revert InvalidPlatformCommission();

        PAYMENT_TOKEN = IERC20(paymentToken_);
        _baseTokenURI = baseTokenURI_;

        // Set up roles - grant admin role to the specified admin address instead of msg.sender
        _grantRole(DEFAULT_ADMIN_ROLE, adminAddress_);
        _grantRole(OWNER_ROLE, adminAddress_);
        _grantRole(PLATFORM_ROLE, platformAddress_);

        // Initialize libraries
        KamiPlatform.initializePlatform(platformAddress_, platformCommissionPercentage_);
        KamiRoyalty.initializeRoyaltyConfig();
    }

    function exists(uint256 tokenId) public view returns (bool) {
        return ownerOf(tokenId) != address(0);
    }

    /**
     * @dev Returns an internal view function to check if an operator is approved for all tokens.
     *      This is used for compatibility with library functions that require an internal function pointer.
     */
    function _getIsApprovedForAllReference() internal pure returns (function(address, address) view returns (bool)) {
        return isApprovedForAll;
    }

    /**
     * @notice Mint a new token
     * @dev Requires payment in the specified ERC20 token
     * @param recipient Address to receive the minted token
     * @param tokenPrice Price for this specific token
     * @param uri Individual URI for this token's metadata
     * @param mintRoyalties Array of royalty receivers and percentages
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
            PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), tokenPrice);
            
            // Calculate and deduct platform commission
            uint96 platformCommission = KamiPlatform.platformCommission();
            uint256 commissionAmount = 0;
            if (platformCommission > 0) {
                commissionAmount = (tokenPrice * platformCommission) / 10000;
                if (commissionAmount > 0) {
                    PAYMENT_TOKEN.safeTransfer(KamiPlatform.platformAddress(), commissionAmount);
                }
            }
            
            // Calculate remaining amount after platform commission
            uint256 remainingAmount = tokenPrice - commissionAmount;
            
            // Set token-specific mint royalties if provided
            if(mintRoyalties.length > 0) {
                KamiRoyalty.setTokenMintRoyalties(tokenId, mintRoyalties, KamiNFTCore.getExternalExistsReference(address(this)));
            }
            
            // Distribute mint royalties on the remaining amount
            KamiRoyalty.distributeMintRoyalties(tokenId, remainingAmount, PAYMENT_TOKEN);
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
        
        // Transfer payment from caller and distribute
        if(tokenPrice > 0) {
            PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), tokenPrice);
            
            // Calculate and deduct platform commission
            uint96 platformCommission = KamiPlatform.platformCommission();
            uint256 commissionAmount = 0;
            if (platformCommission > 0) {
                commissionAmount = (tokenPrice * platformCommission) / 10000;
                if (commissionAmount > 0) {
                    PAYMENT_TOKEN.safeTransfer(KamiPlatform.platformAddress(), commissionAmount);
                }
            }
            
            // Calculate remaining amount after platform commission
            uint256 remainingAmount = tokenPrice - commissionAmount;
            
            // Set token-specific mint royalties if provided
            if(mintRoyalties.length > 0) {
                KamiRoyalty.setTokenMintRoyalties(tokenId, mintRoyalties, KamiNFTCore.getExternalExistsReference(address(this)));
            }
            
            // Distribute mint royalties on the remaining amount
            KamiRoyalty.distributeMintRoyalties(tokenId, remainingAmount, PAYMENT_TOKEN);
        }
    }

    /**
     * @notice Set price for a specific token
     * @param tokenId Token ID
     * @param newPrice New price in payment token
     */
    function setPrice(uint256 tokenId, uint256 newPrice) external onlyRole(OWNER_ROLE) {
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        tokenPrices[tokenId] = newPrice;
    }

    /**
     * @notice Set URI for a specific token
     * @param tokenId Token ID
     * @param newTokenURI New URI for the token's metadata
     */
    function setTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyRole(OWNER_ROLE) {
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        if (bytes(newTokenURI).length == 0) revert EmptyTokenURI();
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
        if (!exists(tokenId)) revert QueryForNonexistentToken();
        
        string memory individualURI = tokenURIs[tokenId];
        if (bytes(individualURI).length > 0) {
            return individualURI;
        }
        
        return string(abi.encodePacked(_baseTokenURI, Strings.toString(tokenId)));
    }

    /**
     * @notice Set royalty percentage
     * @param newRoyaltyPercentage New royalty percentage in basis points
     */
    function setRoyaltyPercentage(uint96 newRoyaltyPercentage) external onlyRole(OWNER_ROLE) {
        KamiRoyalty.setRoyaltyPercentage(newRoyaltyPercentage);
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
     * @notice Rent a token
     * @param tokenId The token ID to rent
     * @param duration The rental duration in seconds
     * @param rentalPrice The total rental price
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
            PAYMENT_TOKEN,
            tokenId,
            duration,
            rentalPrice,
            rentalTokenOwner,
            msg.sender // payer
        );

        // Grant RENTER_ROLE to the renter
        _grantRole(RENTER_ROLE, renter);
    }

    /**
     * @notice End a rental
     * @param tokenId The token ID to end rental for
     */
    function endRental(uint256 tokenId) external {
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        
        KamiRental.endRentalSimple(tokenId);
    }

    /**
     * @notice Extend a rental
     * @param tokenId The token ID to extend rental for
     * @param additionalDuration The additional duration in seconds
     * @param additionalPayment The additional payment required
     */
    function extendRental(
        uint256 tokenId,
        uint256 additionalDuration,
        uint256 additionalPayment
    ) external whenNotPaused {
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        address rentalTokenOwner = ownerOf(tokenId);

        KamiRental.extendRental(
            PAYMENT_TOKEN,
            tokenId,
            additionalDuration,
            additionalPayment,
            rentalTokenOwner, // The token owner
            msg.sender // payer
        );
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
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        if (ownerOf(tokenId) != seller) revert SellerNotTokenOwner();
        if (to == address(0)) revert ZeroAddress();
        if (seller == address(0)) revert ZeroAddress();
        
        // Check if token is rented
        if (KamiRental.isRented(tokenId)) {
            revert("ERC721: token is rented");
        }
        
        uint256 price = tokenPrices[tokenId];
        if (price == 0) revert TokenPriceNotSet();
        
        // Process sale with royalties FIRST (marks transfer as paid)
        KamiTransfer.sellToken(PAYMENT_TOKEN, tokenId, to, price, seller);
        
        // Then transfer token (will now pass validation)
        _transfer(seller, to, tokenId);
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyRole(OWNER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyRole(OWNER_ROLE) {
        _unpause();
    }

    /**
     * @notice Get base URI
     * @return The base URI
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @notice Get royalty percentage
     * @return The royalty percentage in basis points
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
     * @notice Get platform address
     * @return The platform address
     */
    function platformAddress() external view returns (address) {
        return KamiPlatform.platformAddress();
    }

    /**
     * @notice Get platform commission percentage
     * @return The platform commission percentage in basis points
     */
    function platformCommission() external view returns (uint96) {
        return KamiPlatform.platformCommission();
    }

    /**
     * @notice Check if token is rented
     * @param tokenId The token ID to check
     * @return True if token is rented, false otherwise
     */
    function isRented(uint256 tokenId) external view returns (bool) {
        return KamiRental.isRented(tokenId);
    }

    /**
     * @notice Get rental information
     * @param tokenId The token ID to get rental info for
     * @return The rental information
     */
    function getRentalInfo(uint256 tokenId) external view returns (KamiNFTCore.Rental memory) {
        return KamiRental.getRentalInfo(tokenId);
    }

    /**
     * @notice Get mint royalty receivers
     * @param tokenId The token ID to get royalty receivers for
     * @return Array of royalty receivers
     */
    function getMintRoyaltyReceivers(uint256 tokenId) external view returns (KamiNFTCore.RoyaltyData[] memory) {
        return KamiRoyalty.getMintRoyaltyReceivers(tokenId);
    }

    /**
     * @notice Get transfer royalty receivers
     * @param tokenId The token ID to get royalty receivers for
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
    function setPlatformCommission(
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

    /**
     * @notice Burn a token
     * @param tokenId The token ID to burn
     */
    function burn(uint256 tokenId) external {
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        if (ownerOf(tokenId) != msg.sender) revert CallerNotTokenOwnerOrApproved();
        
        // Validate burn operation
        KamiTransfer.validateBurn(tokenId, msg.sender);
        
        _burn(tokenId);
    }

    function _transferFromBySignature(address from, address to, uint256 tokenId) internal {
        if (ownerOf(tokenId) != from) revert SellerNotTokenOwner();
        _update(to, tokenId, from);
    }

    function _burnBySignature(uint256 tokenId, address owner) internal {
        if (ownerOf(tokenId) != owner) revert CallerNotTokenOwnerOrApproved();
        _update(address(0), tokenId, owner);
    }

    // ============ GASLESS (SIGNATURE) ENTRYPOINTS ============

    function burnWithSignature(uint256 tokenId, uint256 deadline, bytes calldata signature) external {
        if (block.timestamp > deadline) revert SignatureExpired();
        bytes32 structHash = keccak256(abi.encode(BURN_TYPEHASH, tokenId, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (ownerOf(tokenId) != signer) revert InvalidSigner();
        KamiTransfer.validateBurn(tokenId, signer);
        _burnBySignature(tokenId, signer);
    }

    function initiateTransferWithRoyaltyWithSignature(address to, uint256 tokenId, uint256 price, uint256 deadline, bytes calldata signature) external {
        if (block.timestamp > deadline) revert SignatureExpired();
        bytes32 structHash = keccak256(abi.encode(INITIATE_TRANSFER_TYPEHASH, to, tokenId, price, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (ownerOf(tokenId) != signer) revert InvalidSigner();
        KamiTransfer.initiateTransferWithRoyalty(tokenId, to, price, signer);
    }

    function sellTokenWithSignature(address to, uint256 tokenId, uint256 deadline, bytes calldata signature) external whenNotPaused {
        if (block.timestamp > deadline) revert SignatureExpired();
        bytes32 structHash = keccak256(abi.encode(SELL_TOKEN_TYPEHASH, to, tokenId, deadline));
        address seller = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (seller == address(0)) revert ZeroAddress();
        if (ownerOf(tokenId) != seller) revert SellerNotTokenOwner();
        if (to == address(0)) revert ZeroAddress();
        if (KamiRental.isRented(tokenId)) revert("ERC721: token is rented");
        uint256 price = tokenPrices[tokenId];
        if (price == 0) revert TokenPriceNotSet();
        KamiTransfer.sellToken(PAYMENT_TOKEN, tokenId, to, price, seller);
        _transferFromBySignature(seller, to, tokenId);
    }

    function setTokenURIWithSignature(uint256 tokenId, string calldata newTokenURI, uint256 deadline, bytes calldata signature) external {
        if (block.timestamp > deadline) revert SignatureExpired();
        bytes32 structHash = keccak256(abi.encode(SET_TOKEN_URI_TYPEHASH, tokenId, keccak256(bytes(newTokenURI)), deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (ownerOf(tokenId) != signer) revert InvalidSigner();
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        if (bytes(newTokenURI).length == 0) revert EmptyTokenURI();
        tokenURIs[tokenId] = newTokenURI;
    }

    function rentTokenWithSignature(uint256 tokenId, uint256 duration, uint256 rentalPrice, address renter, uint256 deadline, bytes calldata signature) external whenNotPaused {
        if (block.timestamp > deadline) revert SignatureExpired();
        bytes32 structHash = keccak256(abi.encode(RENT_TOKEN_TYPEHASH, tokenId, duration, rentalPrice, renter, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (signer != renter) revert InvalidSigner();
        if (renter == address(0)) revert ZeroAddress();
        address tokenOwner = ownerOf(tokenId);
        if (tokenOwner == renter) revert OwnerCannotRentOwnToken();
        KamiRental.rentTokenFor(PAYMENT_TOKEN, tokenId, duration, rentalPrice, tokenOwner, renter, renter);
        _grantRole(RENTER_ROLE, renter);
    }

    function extendRentalWithSignature(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment, address renter, uint256 deadline, bytes calldata signature) external whenNotPaused {
        if (block.timestamp > deadline) revert SignatureExpired();
        bytes32 structHash = keccak256(abi.encode(EXTEND_RENTAL_TYPEHASH, tokenId, additionalDuration, additionalPayment, renter, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (signer != renter) revert InvalidSigner();
        if (KamiRental.getRentalInfo(tokenId).renter != renter) revert InvalidSigner();
        address tokenOwner = ownerOf(tokenId);
        KamiRental.extendRentalAs(PAYMENT_TOKEN, tokenId, additionalDuration, additionalPayment, tokenOwner, renter, renter);
    }

    function endRentalWithSignature(uint256 tokenId, address renter, uint256 deadline, bytes calldata signature) external {
        if (block.timestamp > deadline) revert SignatureExpired();
        bytes32 structHash = keccak256(abi.encode(END_RENTAL_TYPEHASH, tokenId, renter, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (signer != renter) revert InvalidSigner();
        if (KamiRental.getRentalInfo(tokenId).renter != renter) revert InvalidSigner();
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        KamiRental.endRentalSimple(tokenId);
    }

    function payTransferRoyaltyWithSignature(address seller, uint256 tokenId, uint256 price, address buyer, uint256 deadline, bytes calldata signature) external {
        if (block.timestamp > deadline) revert SignatureExpired();
        bytes32 structHash = keccak256(abi.encode(PAY_TRANSFER_ROYALTY_TYPEHASH, tokenId, price, buyer, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (signer != buyer) revert InvalidSigner();
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        KamiTransfer.payTransferRoyalty(PAYMENT_TOKEN, tokenId, price, seller, signer);
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
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        if (ownerOf(tokenId) != msg.sender) revert CallerNotTokenOwnerOrApproved();
        
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
        if (!exists(tokenId)) revert KamiRoyalty.TokenDoesNotExist();
        
        KamiTransfer.payTransferRoyalty(PAYMENT_TOKEN, tokenId, price, seller, msg.sender);
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
     * @notice Override supportsInterface to include ERC2981
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, ERC2981, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
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
        }
        
        return owner;
    }
}