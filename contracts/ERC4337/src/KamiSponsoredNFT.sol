// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
// import "@openzeppelin/contracts/utils/Counters.sol"; // Not available in this version
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./KamiSmartAccount.sol";

/**
 * @title KamiSponsoredNFT
 * @dev ERC721 contract with ERC20 payments and ERC-4337 sponsored transaction support
 * @notice This contract enables gasless transactions for NFT operations on Base blockchain
 * 
 * Features:
 * - ERC-4337 Account Abstraction integration
 * - ERC20 token payments (no ETH required for gas)
 * - Sponsored transaction support via Paymaster
 * - Royalty system with programmable receivers
 * - Platform commission system
 * - Rental functionality
 * - Role-based access control
 */
contract KamiSponsoredNFT is AccessControl, ERC721Enumerable, ERC2981, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    // ============ STORAGE VARIABLES ============

    /// @dev Counter for token IDs
    uint256 private _tokenIdCounter;
    
    /// @dev Mint price in payment token (ERC20)
    uint256 public mintPrice;
    
    /// @dev Base URI for token metadata
    string private _baseTokenURI;
    
    /// @dev ERC20 token used for payments (e.g., USDC)
    IERC20 public immutable paymentToken;
    
    /// @dev Smart Account Factory for creating user accounts
    address public immutable smartAccountFactory;
    
    /// @dev Paymaster contract for sponsoring transactions
    address public immutable paymaster;
    
    /// @dev Platform commission percentage (basis points, max 2000 = 20%)
    uint96 public platformCommissionPercentage;
    
    /// @dev Platform address to receive commissions
    address public platformAddress;
    
    /// @dev Global royalty percentage (basis points, max 3000 = 30%)
    uint96 public royaltyPercentage;
    
    /// @dev Mint royalty receivers
    mapping(uint256 => RoyaltyData[]) public mintRoyaltyReceivers;
    
    /// @dev Transfer royalty receivers
    mapping(uint256 => RoyaltyData[]) public transferRoyaltyReceivers;
    
    /// @dev Rental information
    mapping(uint256 => Rental) public rentals;
    
    /// @dev Transfer tracker for royalty enforcement
    mapping(bytes32 => bool) public transferTracker;

    // ============ STRUCTS ============

    struct RoyaltyData {
        address receiver;
        uint96 feeNumerator; // basis points (10000 = 100%)
    }
    
    struct Rental {
        address renter;
        uint256 startTime;
        uint256 endTime;
        uint256 rentalPrice;
        bool active;
    }

    // ============ EVENTS ============

    event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 price);
    event TokenSold(address indexed from, address indexed to, uint256 indexed tokenId, uint256 price);
    event TokenRented(address indexed owner, address indexed renter, uint256 indexed tokenId, uint256 duration, uint256 price);
    event RentalEnded(address indexed owner, address indexed renter, uint256 indexed tokenId);
    event RentalExtended(address indexed renter, uint256 indexed tokenId, uint256 newEndTime, uint256 additionalPayment);
    event PlatformCommissionUpdated(address indexed newPlatform, uint96 newPercentage);
    event RoyaltyPercentageUpdated(uint96 newPercentage);
    event MintRoyaltiesSet(uint256 indexed tokenId, RoyaltyData[] royalties);
    event TransferRoyaltiesSet(uint256 indexed tokenId, RoyaltyData[] royalties);
    event SmartAccountCreated(address indexed user, address indexed smartAccount);

    // ============ ROLES ============

    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant RENTER_ROLE = keccak256("RENTER_ROLE");
    bytes32 public constant PLATFORM_ROLE = keccak256("PLATFORM_ROLE");

    // ============ MODIFIERS ============

    modifier onlySmartAccount() {
        require(_isSmartAccount(msg.sender), "Only smart accounts allowed");
        _;
    }

    modifier onlyOwnerOrSmartAccount() {
        require(hasRole(OWNER_ROLE, msg.sender) || _isSmartAccount(msg.sender), "Not authorized");
        _;
    }

    // ============ CONSTRUCTOR ============

    constructor(
        address _paymentToken,
        string memory _name,
        string memory _symbol,
        string memory baseTokenURI_,
        uint256 _initialMintPrice,
        address _platformAddress,
        uint96 _platformCommissionPercentage,
        address _smartAccountFactory,
        address _paymaster
    ) ERC721(_name, _symbol) Pausable() {
        require(_paymentToken != address(0), "Invalid payment token");
        require(_platformAddress != address(0), "Invalid platform address");
        require(_platformCommissionPercentage <= 2000, "Platform commission too high");
        require(_smartAccountFactory != address(0), "Invalid smart account factory");
        require(_paymaster != address(0), "Invalid paymaster");

        paymentToken = IERC20(_paymentToken);
        _baseTokenURI = baseTokenURI_;
        mintPrice = _initialMintPrice;
        platformAddress = _platformAddress;
        platformCommissionPercentage = _platformCommissionPercentage;
        smartAccountFactory = _smartAccountFactory;
        paymaster = _paymaster;

        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OWNER_ROLE, msg.sender);
        _grantRole(PLATFORM_ROLE, _platformAddress);
    }

    // ============ VIEW FUNCTIONS ============

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

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        public
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        uint256 totalRoyaltyAmount = (salePrice * royaltyPercentage) / 10000;
        RoyaltyData[] memory royalties = transferRoyaltyReceivers[tokenId];
        
        if (royalties.length > 0) {
            RoyaltyData memory info = royalties[0];
            uint256 receiverShare = (totalRoyaltyAmount * info.feeNumerator) / 10000;
            return (info.receiver, receiverShare);
        }
        
        return (address(0), 0);
    }

    function isRented(uint256 tokenId) external view returns (bool) {
        return rentals[tokenId].active && block.timestamp < rentals[tokenId].endTime;
    }

    function getRentalInfo(uint256 tokenId) external view returns (
        address renter,
        uint256 startTime,
        uint256 endTime,
        uint256 rentalPrice,
        bool active
    ) {
        Rental memory rental = rentals[tokenId];
        return (rental.renter, rental.startTime, rental.endTime, rental.rentalPrice, rental.active);
    }

    function hasActiveRentals(address user) public view returns (bool) {
        uint256 totalSupply = _tokenIdCounter;
        for (uint256 i = 0; i < totalSupply; i++) {
            if (rentals[i].renter == user && rentals[i].active && block.timestamp < rentals[i].endTime) {
                return true;
            }
        }
        return false;
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    // ============ SMART ACCOUNT FUNCTIONS ============

    function createSmartAccount(address user) external returns (address smartAccount) {
        require(msg.sender == smartAccountFactory, "Only factory can create accounts");
        
        // This would typically call the factory to create a smart account
        // For now, we'll emit an event and return a placeholder
        emit SmartAccountCreated(user, address(0));
        return address(0);
    }

    function _isSmartAccount(address account) internal view returns (bool) {
        // Check if the account is a smart account by verifying it's a contract
        // and has the expected interface
        if (account.code.length == 0) return false;
        
        // Additional checks could be added here to verify it's a valid smart account
        return true;
    }

    // ============ MINTING FUNCTIONS ============

    function mint() external onlySmartAccount whenNotPaused nonReentrant {
        address minter = _getSmartAccountOwner(msg.sender);
        require(minter != address(0), "Invalid smart account");
        
        paymentToken.safeTransferFrom(minter, address(this), mintPrice);
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        _safeMint(minter, tokenId);
        
        // Distribute mint royalties
        _distributeMintRoyalties(tokenId, mintPrice);
        
        emit TokenMinted(minter, tokenId, mintPrice);
    }

    function mintTo(address to) external onlySmartAccount whenNotPaused nonReentrant {
        address minter = _getSmartAccountOwner(msg.sender);
        require(minter != address(0), "Invalid smart account");
        require(to != address(0), "Invalid recipient");
        
        paymentToken.safeTransferFrom(minter, address(this), mintPrice);
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        _safeMint(to, tokenId);
        
        // Distribute mint royalties
        _distributeMintRoyalties(tokenId, mintPrice);
        
        emit TokenMinted(to, tokenId, mintPrice);
    }

    // ============ SALES FUNCTIONS ============

    function sellToken(address to, uint256 tokenId, uint256 salePrice) external onlySmartAccount whenNotPaused nonReentrant {
        address seller = _getSmartAccountOwner(msg.sender);
        require(seller != address(0), "Invalid smart account");
        require(ownerOf(tokenId) == seller, "Not token owner");
        require(to != address(0), "Invalid buyer");
        require(salePrice > 0, "Invalid sale price");
        
        // Transfer payment
        paymentToken.safeTransferFrom(to, address(this), salePrice);
        
        // Distribute royalties and commission
        _distributeSaleProceeds(tokenId, salePrice, seller);
        
        // Transfer token
        safeTransferFrom(seller, to, tokenId);
        
        emit TokenSold(seller, to, tokenId, salePrice);
    }

    // ============ RENTAL FUNCTIONS ============

    function rentToken(uint256 tokenId, uint256 duration, uint256 rentalPrice) external onlySmartAccount whenNotPaused nonReentrant {
        address renter = _getSmartAccountOwner(msg.sender);
        require(renter != address(0), "Invalid smart account");
        require(ownerOf(tokenId) == renter, "Not token owner");
        require(duration > 0, "Invalid duration");
        require(rentalPrice > 0, "Invalid rental price");
        require(!rentals[tokenId].active, "Token already rented");
        
        // Transfer payment
        paymentToken.safeTransferFrom(renter, address(this), rentalPrice);
        
        // Create rental
        rentals[tokenId] = Rental({
            renter: renter,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            rentalPrice: rentalPrice,
            active: true
        });
        
        // Grant renter role
        _grantRole(RENTER_ROLE, renter);
        
        emit TokenRented(renter, renter, tokenId, duration, rentalPrice);
    }

    function endRental(uint256 tokenId) external onlySmartAccount whenNotPaused nonReentrant {
        address caller = _getSmartAccountOwner(msg.sender);
        require(caller != address(0), "Invalid smart account");
        
        Rental storage rental = rentals[tokenId];
        require(rental.active, "Token not rented");
        require(rental.renter == caller || ownerOf(tokenId) == caller, "Not authorized");
        
        rental.active = false;
        
        // Revoke renter role if no other active rentals
        if (!hasActiveRentals(rental.renter)) {
            _revokeRole(RENTER_ROLE, rental.renter);
        }
        
        emit RentalEnded(ownerOf(tokenId), rental.renter, tokenId);
    }

    function extendRental(uint256 tokenId, uint256 additionalDuration, uint256 additionalPayment) external onlySmartAccount whenNotPaused nonReentrant {
        address renter = _getSmartAccountOwner(msg.sender);
        require(renter != address(0), "Invalid smart account");
        
        Rental storage rental = rentals[tokenId];
        require(rental.active, "Token not rented");
        require(rental.renter == renter, "Not the renter");
        require(additionalDuration > 0, "Invalid duration");
        require(additionalPayment > 0, "Invalid payment");
        
        // Transfer additional payment
        paymentToken.safeTransferFrom(renter, address(this), additionalPayment);
        
        // Extend rental
        rental.endTime += additionalDuration;
        rental.rentalPrice += additionalPayment;
        
        emit RentalExtended(renter, tokenId, rental.endTime, additionalPayment);
    }

    // ============ ADMIN FUNCTIONS ============

    function setPlatformCommission(uint96 newPercentage, address newPlatform) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Not authorized");
        require(newPercentage <= 2000, "Commission too high");
        require(newPlatform != address(0), "Invalid platform address");
        
        platformCommissionPercentage = newPercentage;
        platformAddress = newPlatform;
        
        // Update role
        _revokeRole(PLATFORM_ROLE, platformAddress);
        _grantRole(PLATFORM_ROLE, newPlatform);
        
        emit PlatformCommissionUpdated(newPlatform, newPercentage);
    }

    function setRoyaltyPercentage(uint96 newPercentage) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Not authorized");
        require(newPercentage <= 3000, "Royalty too high");
        
        royaltyPercentage = newPercentage;
        emit RoyaltyPercentageUpdated(newPercentage);
    }

    function setMintRoyalties(uint256 tokenId, RoyaltyData[] calldata royalties) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Not authorized");
        require(_exists(tokenId), "Token does not exist");
        
        delete mintRoyaltyReceivers[tokenId];
        for (uint256 i = 0; i < royalties.length; i++) {
            mintRoyaltyReceivers[tokenId].push(royalties[i]);
        }
        
        emit MintRoyaltiesSet(tokenId, royalties);
    }

    function setTransferRoyalties(uint256 tokenId, RoyaltyData[] calldata royalties) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Not authorized");
        require(_exists(tokenId), "Token does not exist");
        
        delete transferRoyaltyReceivers[tokenId];
        for (uint256 i = 0; i < royalties.length; i++) {
            transferRoyaltyReceivers[tokenId].push(royalties[i]);
        }
        
        emit TransferRoyaltiesSet(tokenId, royalties);
    }

    function setMintPrice(uint256 newPrice) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Not authorized");
        mintPrice = newPrice;
    }

    function setBaseURI(string memory newBaseURI) external {
        require(hasRole(OWNER_ROLE, msg.sender), "Not authorized");
        _baseTokenURI = newBaseURI;
    }

    function pause() external {
        require(hasRole(OWNER_ROLE, msg.sender), "Not authorized");
        _pause();
    }

    function unpause() external {
        require(hasRole(OWNER_ROLE, msg.sender), "Not authorized");
        _unpause();
    }

    // ============ INTERNAL FUNCTIONS ============

    function _getSmartAccountOwner(address smartAccount) internal view returns (address) {
        // This would typically call the smart account to get its owner
        // For now, we'll return the smart account address as a placeholder
        return smartAccount;
    }

    function _distributeMintRoyalties(uint256 tokenId, uint256 amount) internal {
        RoyaltyData[] memory royalties = mintRoyaltyReceivers[tokenId];
        if (royalties.length == 0) return;
        
        for (uint256 i = 0; i < royalties.length; i++) {
            uint256 royaltyAmount = (amount * royalties[i].feeNumerator) / 10000;
            if (royaltyAmount > 0) {
                paymentToken.safeTransfer(royalties[i].receiver, royaltyAmount);
            }
        }
    }

    function _distributeSaleProceeds(uint256 tokenId, uint256 salePrice, address seller) internal {
        // Calculate platform commission
        uint256 commissionAmount = (salePrice * platformCommissionPercentage) / 10000;
        if (commissionAmount > 0) {
            paymentToken.safeTransfer(platformAddress, commissionAmount);
        }
        
        // Calculate royalties
        uint256 totalRoyaltyAmount = (salePrice * royaltyPercentage) / 10000;
        RoyaltyData[] memory royalties = transferRoyaltyReceivers[tokenId];
        
        uint256 distributedRoyalties = 0;
        for (uint256 i = 0; i < royalties.length; i++) {
            uint256 royaltyAmount = (totalRoyaltyAmount * royalties[i].feeNumerator) / 10000;
            if (royaltyAmount > 0) {
                paymentToken.safeTransfer(royalties[i].receiver, royaltyAmount);
                distributedRoyalties += royaltyAmount;
            }
        }
        
        // Send remaining amount to seller
        uint256 remainingAmount = salePrice - commissionAmount - distributedRoyalties;
        if (remainingAmount > 0) {
            paymentToken.safeTransfer(seller, remainingAmount);
        }
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual {
        // Check if rental has expired
        if (rentals[tokenId].active && block.timestamp >= rentals[tokenId].endTime) {
            rentals[tokenId].active = false;
            if (!hasActiveRentals(rentals[tokenId].renter)) {
                _revokeRole(RENTER_ROLE, rentals[tokenId].renter);
            }
        }
        
        // Validate transfer (not rented or authorized)
        if (rentals[tokenId].active && block.timestamp < rentals[tokenId].endTime) {
            require(rentals[tokenId].renter == from || hasRole(RENTER_ROLE, from), "Token is rented");
        }
    }
}
