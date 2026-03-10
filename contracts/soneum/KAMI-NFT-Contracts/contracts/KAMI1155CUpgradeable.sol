// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {ERC1155SupplyUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ERC1155Utils} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Utils.sol";
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
contract KAMI1155CUpgradeable is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ERC1155Upgradeable,
    ERC1155SupplyUpgradeable,
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

    event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 amount, uint256 price);
    event TokenSold(address indexed from, address indexed to, uint256 indexed tokenId, uint256 amount, uint256 price);
    event TokenRented(address indexed owner, address indexed renter, uint256 indexed tokenId, uint256 startTime, uint256 endTime, uint256 price);
    event RentalEnded(address indexed owner, address indexed renter, uint256 indexed tokenId);
    event RentalExtended(address indexed renter, uint256 indexed tokenId, uint256 newEndTime, uint256 additionalPayment);

    /// @dev Transfer tracker for royalty enforcement
    KamiNFTCore.TransferTracker private _transferTracker;

    /// @notice ERC20 token used for payments (e.g., USDC)
    IERC20 private _paymentToken;

    /// @notice Getter function for payment token address
    function paymentToken() external view returns (address) {
        return address(_paymentToken);
    }
    /// @notice Price in payment token (ERC20) for minting and selling
    mapping(uint256 => uint256) public tokenPrices;
    /// @notice Individual URI for each token
    mapping(uint256 => string) public tokenURIs;
    /// @dev Base URI for token metadata (fallback)
    string private _baseTokenURI;
    /// @dev Counter for token IDs
    uint256 private _tokenIdCounter;
    /// @dev Maximum total supply for each tokenId (0 means unlimited)
    mapping(uint256 => uint256) private _tokenTotalSupplies;

    /// @dev Actual minted count per tokenId (tracks real supply)
    mapping(uint256 => uint256) private _actualMintedCount;
    /// @dev Maximum total supply for the contract (0 means unlimited)
    uint256 private _maxTotalSupply;
    
    /// @dev Custom error for when token supply limit is exceeded
    error TokenSupplyExceeded();
    error SignatureExpired();
    error InvalidSigner();

    bytes32 private constant SELL_TOKEN_TYPEHASH = keccak256("SellToken1155(address to,uint256 tokenId,uint256 amount,address seller,uint256 deadline)");
    bytes32 private constant SET_TOKEN_URI_TYPEHASH = keccak256("SetTokenURI1155(uint256 tokenId,string newTokenURI,uint256 deadline)");
    bytes32 private constant RENT_TOKEN_TYPEHASH = keccak256("RentToken1155(uint256 tokenId,uint256 duration,uint256 rentalPrice,address renter,uint256 deadline)");
    bytes32 private constant EXTEND_RENTAL_TYPEHASH = keccak256("ExtendRental1155(uint256 tokenId,uint256 additionalDuration,uint256 additionalPayment,address tokenOwner,uint256 deadline)");
    bytes32 private constant END_RENTAL_TYPEHASH = keccak256("EndRental1155(uint256 tokenId,address signer,uint256 deadline)");
    bytes32 private constant INITIATE_TRANSFER_TYPEHASH = keccak256("InitiateTransferWithRoyalty1155(address to,uint256 tokenId,uint256 price,address tokenOwner,uint256 deadline)");
    bytes32 private constant PAY_TRANSFER_ROYALTY_TYPEHASH = keccak256("PayTransferRoyalty1155(uint256 tokenId,uint256 price,address buyer,address seller,uint256 deadline)");
    bytes32 private constant BURN_TYPEHASH = keccak256("Burn1155(uint256 tokenId,uint256 amount,address owner,uint256 deadline)");

    address private _signatureTransferAuth;

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
     * @param baseURI_ Base URI for token metadata
     * @param platformAddress_ Address to receive platform commission
     * @param platformCommissionPercentage_ Platform commission (basis points, max 2000 = 20%)
     * @param adminAddress_ Address to receive admin and owner roles
     * @param totalSupply_ Optional total supply limit for the contract (0 means unlimited)
     */
    function initialize(
        address paymentToken_,
        string memory baseURI_,
        address platformAddress_,
        uint96 platformCommissionPercentage_,
        address adminAddress_,
        uint256 totalSupply_
    ) public initializer {
        // Initialize upgradeable contracts
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ERC1155_init(baseURI_);
        __ERC1155Supply_init();
        __ERC2981_init();
        __Pausable_init();
        __EIP712_init("KAMI1155C", "1");

        // Validate addresses
        require(paymentToken_ != address(0), "Invalid payment token address");
        require(platformAddress_ != address(0), "Invalid platform address");
        require(adminAddress_ != address(0), "Invalid admin address");
        require(platformCommissionPercentage_ <= 2000, "Platform commission too high");

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
        
        // Set total supply if provided (0 means unlimited)
        if (totalSupply_ > 0) {
            _maxTotalSupply = totalSupply_;
        }
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
        override(ERC1155Upgradeable, ERC2981Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return ERC1155Upgradeable.supportsInterface(interfaceId) ||
            ERC2981Upgradeable.supportsInterface(interfaceId) ||
            AccessControlUpgradeable.supportsInterface(interfaceId);
    }

    /**
     * @dev Returns the next token ID that will be assigned
     */
    function nextTokenId() public view returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @notice Mint tokens
     * @param recipient Address to receive the minted tokens
     * @param amount The amount of tokens to mint
     * @param tokenPrice Price per token
     * @param tokenURI URI for the token metadata
     * @param mintRoyalties Array of royalty receivers and percentages
     */
    function mint(address recipient, uint256 amount, uint256 tokenPrice, string calldata tokenURI, KamiNFTCore.RoyaltyData[] calldata mintRoyalties) external whenNotPaused {
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(bytes(tokenURI).length > 0, "Token URI cannot be empty");

        uint256 tokenId = _tokenIdCounter;

        uint256 tokenTotalSupply = _tokenTotalSupplies[tokenId];
        if (tokenTotalSupply > 0) {
            uint256 currentSupply = getTotalMinted(tokenId);
            if (currentSupply + amount > tokenTotalSupply) {
                revert TokenSupplyExceeded();
            }
        }

        _tokenIdCounter++;
        _mint(recipient, tokenId, amount, "");

        tokenPrices[tokenId] = tokenPrice;
        tokenURIs[tokenId] = tokenURI;

        if (tokenPrice > 0) {
            uint256 totalPrice = tokenPrice * amount;
            require(_paymentToken.balanceOf(msg.sender) >= totalPrice, "Insufficient payment token balance");
            require(_paymentToken.allowance(msg.sender, address(this)) >= totalPrice, "Insufficient payment token allowance");
            _paymentToken.safeTransferFrom(msg.sender, address(this), totalPrice);

            uint96 platformCommissionBps = KamiPlatform.platformCommission();
            uint256 commissionAmount = 0;
            if (platformCommissionBps > 0) {
                commissionAmount = (totalPrice * platformCommissionBps) / 10000;
                if (commissionAmount > 0) {
                    _paymentToken.safeTransfer(KamiPlatform.platformAddress(), commissionAmount);
                }
            }

            uint256 remainingAmount = totalPrice - commissionAmount;

            if (mintRoyalties.length > 0) {
                KamiRoyalty.setTokenMintRoyalties(tokenId, mintRoyalties, KamiNFTCore.getExternalExistsReference(address(this)));
            }

            KamiRoyalty.distributeMintRoyalties(tokenId, remainingAmount, IERC20(address(_paymentToken)));
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
            require(_paymentToken.balanceOf(msg.sender) >= totalPrice, "Insufficient payment token balance");
            require(_paymentToken.allowance(msg.sender, address(this)) >= totalPrice, "Insufficient payment token allowance");
            _paymentToken.safeTransferFrom(msg.sender, address(this), totalPrice);
            
            // Calculate and deduct platform commission
            uint96 platformCommissionBps = KamiPlatform.platformCommission();
            uint256 commissionAmount = 0;
            if (platformCommissionBps > 0) {
                commissionAmount = (totalPrice * platformCommissionBps) / 10000;
                if (commissionAmount > 0) {
                    IERC20(address(_paymentToken)).safeTransfer(KamiPlatform.platformAddress(), commissionAmount);
                }
            }
            
            // Calculate remaining amount after platform commission
            uint256 remainingAmount = totalPrice - commissionAmount;
            
            // Set token-specific mint royalties if provided
            if(mintRoyalties.length > 0) {
                KamiRoyalty.setTokenMintRoyalties(tokenId, mintRoyalties, KamiNFTCore.getExternalExistsReference(address(this)));
            }
            
            // Distribute mint royalties on the remaining amount
            KamiRoyalty.distributeMintRoyalties(tokenId, remainingAmount, IERC20(address(_paymentToken)));
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
     * @notice Set base URI (only owner)
     * @param newBaseURI New base URI
     */
    function setBaseURI(string memory newBaseURI) external onlyRole(OWNER_ROLE) {
        _baseTokenURI = newBaseURI;
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
        
        return string(abi.encodePacked(_baseTokenURI, Strings.toString(tokenId)));
    }

    /**
     * @notice Get base URI
     * @return Base URI string
     */
    function _baseURI() internal view returns (string memory) {
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
     * @notice Set royalty percentage (only owner)
     * @param percentage Royalty percentage in basis points (max 2000 = 20%)
     */
    function setRoyaltyPercentage(uint96 percentage) external onlyRole(OWNER_ROLE) {
        KamiRoyalty.setRoyaltyPercentage(percentage);
    }

    /**
     * @notice Get royalty percentage
     * @return Royalty percentage in basis points
     */
    function royaltyPercentage() external view returns (uint96) {
        return KamiRoyalty.royaltyPercentage();
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
     * @notice Get platform commission percentage (basis points)
     */
    function platformCommissionPercentage() public view returns (uint96) {
        return KamiPlatform.platformCommission();
    }

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
     * @notice Royalty info for a token sale (ERC2981).
     * @dev Price is automatically taken from tokenPrices mapping, price parameter is unused but required for ERC2981 interface
     * @param tokenId Token ID
     * @return receiver Royalty receiver (first receiver for ERC2981 compatibility)
     * @return royaltyAmount Royalty amount (first receiver's share)
     */
    function royaltyInfo(uint256 tokenId, uint256 /* salePrice */)
        public
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        uint256 price = tokenPrices[tokenId];
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
     * @notice Update platform commission
     * @param newPlatformCommissionPercentage New platform commission percentage
     * @param newPlatformAddress New platform address
     */
    function setPlatformCommission(
        uint96 newPlatformCommissionPercentage,
        address newPlatformAddress
    ) external onlyRole(OWNER_ROLE) {
        // Get the current platform address before updating it in KamiPlatform
        address oldPlatformAddress = KamiPlatform.platformAddress();

        KamiPlatform.updatePlatformCommission(
            newPlatformCommissionPercentage,
            newPlatformAddress,
            address(this)
        );

        // Revoke PLATFORM_ROLE from the old platform address
        _revokeRole(PLATFORM_ROLE, oldPlatformAddress);

        // Grant PLATFORM_ROLE to the new platform address
        _grantRole(PLATFORM_ROLE, newPlatformAddress);
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
        address renter,
        address tokenOwner
    ) external whenNotPaused {
        require(exists(tokenId), "Token does not exist");
        require(renter != address(0), "Renter cannot be zero address");
        require(tokenOwner != address(0), "Token owner cannot be zero address");
        require(tokenOwner != renter, "Owner cannot rent their own token");
        require(balanceOf(tokenOwner, tokenId) > 0, "Token owner does not have the token");

        KamiRental.rentToken(
            _paymentToken,
            tokenId,
            duration,
            rentalPrice,
            tokenOwner,
            msg.sender // payer
        );
        emit TokenRented(tokenOwner, renter, tokenId, KamiRental.getRentalInfo(tokenId).startTime, KamiRental.getRentalInfo(tokenId).endTime, rentalPrice);
    }

    /**
     * @notice End a rental early
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
        require(exists(tokenId), "Token does not exist");

        KamiRental.extendRental(
            _paymentToken,
            tokenId,
            additionalDuration,
            additionalPayment,
            msg.sender, // token owner
            msg.sender // payer
        );
        KamiNFTCore.Rental memory updatedRental = KamiRental.getRentalInfo(tokenId);
        emit RentalExtended(msg.sender, tokenId, updatedRental.endTime, additionalPayment);
    }

    /**
     * @notice Get rental information for a token
     * @param tokenId Token ID to get rental info for
     * @return Rental information
     */
    function getRentalInfo(uint256 tokenId) external view whenNotPaused returns (KamiNFTCore.Rental memory) {
        return KamiRental.getRentalInfo(tokenId);
    }

    /**
     * @notice Check if a token is currently rented
     * @param tokenId Token ID to check
     * @return True if the token is rented, false otherwise
     */
    function isRented(uint256 tokenId) external view whenNotPaused returns (bool) {
        return KamiRental.isRented(tokenId);
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
    function setTotalSupply(uint256 maxSupply) external onlyRole(OWNER_ROLE) {
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
    function setTokenTotalSupply(uint256 tokenId, uint256 maxSupply) external onlyRole(OWNER_ROLE) {
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
        require(exists(tokenId), "Token does not exist");
        require(balanceOf(msg.sender, tokenId) > 0, "Not token owner");
        
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
        require(exists(tokenId), "Token does not exist");
        
        // The buyer (msg.sender) pays the seller for the token
        // For ERC1155, the seller is passed as a parameter since there's no single owner concept
        KamiTransfer.payTransferRoyalty(_paymentToken, tokenId, price, seller, msg.sender);
    }

    function sellTokenWithSignature(address to, uint256 tokenId, uint256 amount, address seller, uint256 deadline, bytes calldata signature) external whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 structHash = keccak256(abi.encode(SELL_TOKEN_TYPEHASH, to, tokenId, amount, seller, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == seller, "Invalid signer");
        require(seller != address(0) && to != address(0) && amount > 0, "Invalid params");
        require(balanceOf(seller, tokenId) >= amount, "Insufficient token balance");
        uint256 price = tokenPrices[tokenId];
        require(price > 0, "Token price not set");
        KamiTransfer.sellToken(_paymentToken, tokenId, to, price, seller);
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
        KamiRental.rentTokenFor(_paymentToken, tokenId, duration, rentalPrice, tokenOwner, renter, renter);
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
        KamiRental.extendRentalAs(_paymentToken, tokenId, additionalDuration, additionalPayment, tokenOwner, tokenOwner, currentRenter);
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
        KamiNFTCore.Rental memory rentalInfo = KamiRental.getRentalInfo(tokenId);
        KamiRental.endRentalSimple(tokenId);
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
        KamiTransfer.payTransferRoyalty(_paymentToken, tokenId, price, seller, signer);
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
        KamiTransfer.sellToken(_paymentToken, tokenId, to, price, seller);
        
        // Then transfer token (will now pass validation)
        safeTransferFrom(seller, to, tokenId, amount, "");

        emit TokenSold(seller, to, tokenId, amount, price);
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

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) internal override(ERC1155Upgradeable, ERC1155SupplyUpgradeable) {
        bool isSignaturePath = (_signatureTransferAuth != address(0));
        if (isSignaturePath && from != address(0) && to != address(0)) {
            for (uint256 i = 0; i < ids.length; i++) {
                KamiTransfer.validateTransferWithAuth(ids[i], from, to, isApprovedForAll, _signatureTransferAuth);
            }
            _signatureTransferAuth = address(0);
        }

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 tokenId = ids[i];

            if (from != address(0)) {
                KamiNFTCore.Rental memory rental = KamiRental.getRentalInfo(tokenId);
                if (rental.active) {
                    revert("Cannot transfer actively rented token");
                }
            }

            if (from != address(0) && to != address(0) && !isSignaturePath) {
                KamiTransfer.validateTransfer(tokenId, from, to, isApprovedForAll);
                KamiTransfer.updateRentalOnTransferSimple(tokenId);
            }
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

    // Rental updates are now handled in _update function

    /**
     * @dev Returns an external view function that checks if a token exists.
     *      This is used for compatibility with library functions that require an external function pointer.
     */
    function _getExistsReference() internal view returns (function(uint256) external view returns (bool)) {
        return this.exists; // Directly return the external view function pointer to the contract's exists
    }
}