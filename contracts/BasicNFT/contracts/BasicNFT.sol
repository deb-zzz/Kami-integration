// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BasicNFT
 * @dev NFT contract that accepts ERC20 tokens as payment for minting
 */
contract BasicNFT is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    // Payment token details
    IERC20 public paymentToken;
    uint8 public paymentTokenDecimals;
    uint256 public mintPrice;
    
    // Token ID counter
    uint256 private _nextTokenId;
    
    // Track token existence
    mapping(uint256 => bool) private _tokenExists;
    
    // Events
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint256 price);
    event PaymentTokenUpdated(address indexed oldToken, address indexed newToken);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    
    /**
     * @dev Constructor initializes the NFT contract with payment token details
     * @param name The name of the NFT collection
     * @param symbol The symbol of the NFT collection
     * @param paymentTokenAddress The address of the ERC20 payment token
     * @param paymentTokenDecimals_ The number of decimals for the payment token
     * @param mintPrice_ The price to mint one NFT (in payment token units)
     */
    constructor(
        string memory name,
        string memory symbol,
        address paymentTokenAddress,
        uint8 paymentTokenDecimals_,
        uint256 mintPrice_
    ) ERC721(name, symbol) Ownable(msg.sender) {
        require(paymentTokenAddress != address(0), "Payment token address cannot be zero");
        require(mintPrice_ > 0, "Mint price must be greater than zero");
        
        paymentToken = IERC20(paymentTokenAddress);
        paymentTokenDecimals = paymentTokenDecimals_;
        mintPrice = mintPrice_;
        _nextTokenId = 1; // Start token IDs from 1
    }
    
    /**
     * @dev Mint a new NFT to the caller
     * @param _tokenURI The URI pointing to the NFT metadata
     * @param tokenId The specific token ID to mint (must be unique)
     */
    function mint(string memory _tokenURI, uint256 tokenId) external nonReentrant {
        require(tokenId > 0, "Token ID must be greater than zero");
        require(!_tokenExists[tokenId], "Token ID already exists");
        require(bytes(_tokenURI).length > 0, "Token URI cannot be empty");
        
        // Check if caller has enough payment tokens
        require(
            paymentToken.balanceOf(msg.sender) >= mintPrice,
            "Insufficient payment token balance"
        );
        
        // Transfer payment tokens from caller to contract owner
        require(
            paymentToken.transferFrom(msg.sender, owner(), mintPrice),
            "Payment token transfer failed"
        );
        
        // Mint the NFT
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        _tokenExists[tokenId] = true;
        
        emit NFTMinted(msg.sender, tokenId, _tokenURI, mintPrice);
    }
    
    /**
     * @dev Mint a new NFT with auto-incrementing token ID
     * @param _tokenURI The URI pointing to the NFT metadata
     */
    function mintWithAutoId(string memory _tokenURI) external nonReentrant {
        require(bytes(_tokenURI).length > 0, "Token URI cannot be empty");
        
        // Check if caller has enough payment tokens
        require(
            paymentToken.balanceOf(msg.sender) >= mintPrice,
            "Insufficient payment token balance"
        );
        
        // Transfer payment tokens from caller to contract owner
        require(
            paymentToken.transferFrom(msg.sender, owner(), mintPrice),
            "Payment token transfer failed"
        );
        
        // Mint the NFT with auto-incrementing ID
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        _tokenExists[tokenId] = true;
        
        emit NFTMinted(msg.sender, tokenId, _tokenURI, mintPrice);
    }
    
    /**
     * @dev Update the payment token address (only owner)
     * @param newPaymentToken The new ERC20 token address
     * @param newDecimals The number of decimals for the new payment token
     */
    function updatePaymentToken(address newPaymentToken, uint8 newDecimals) external onlyOwner {
        require(newPaymentToken != address(0), "Payment token address cannot be zero");
        
        address oldToken = address(paymentToken);
        paymentToken = IERC20(newPaymentToken);
        paymentTokenDecimals = newDecimals;
        
        emit PaymentTokenUpdated(oldToken, newPaymentToken);
    }
    
    /**
     * @dev Update the mint price (only owner)
     * @param newMintPrice The new price to mint one NFT
     */
    function updateMintPrice(uint256 newMintPrice) external onlyOwner {
        require(newMintPrice > 0, "Mint price must be greater than zero");
        
        uint256 oldPrice = mintPrice;
        mintPrice = newMintPrice;
        
        emit MintPriceUpdated(oldPrice, newMintPrice);
    }
    
    /**
     * @dev Get the current token ID counter
     * @return The next token ID that will be minted
     */
    function getNextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
    
    /**
     * @dev Check if a token ID exists
     * @param tokenId The token ID to check
     * @return True if the token exists, false otherwise
     */
    function tokenExists(uint256 tokenId) external view returns (bool) {
        return _tokenExists[tokenId];
    }
    
    // Required overrides for ERC721URIStorage
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
