// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract KamiSigils is ERC1155, Ownable {

    uint256 private constant NUM_TOKENS = 6;
    
    // Mapping to store the specific URI for each tokenId (1-6)
    mapping(uint256 => string) private tokenUris;
    
    // 💡 NEW STATE VARIABLE: Mapping to track the total supply minted for each token ID
    mapping(uint256 => uint256) private totalSupply;

    constructor(
        string memory initialUri
    )
        ERC1155(initialUri)
        Ownable(msg.sender)
    {}
    
    /**
     * @dev Overrides the standard ERC1155 URI function to return the token-specific URI.
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        return tokenUris[tokenId];
    }

    /**
     * @notice Allows the owner to set the unique metadata URI for a specific token ID (1-6).
     */
    function setTokenURI(
        uint256 tokenId, 
        string memory newUri
    ) public onlyOwner {
        require(tokenId >= 1 && tokenId <= NUM_TOKENS, "KamiSigils: Invalid Token ID. Must be 1-6.");
        
        tokenUris[tokenId] = newUri;
        
        emit URI(newUri, tokenId);
    }

    /**
     * @notice Mints a specific quantity of a specific token ID (1-6) to a recipient.
     * @dev Only callable by the contract owner. Updates the total supply count.
     */
    function mint(
        uint256 tokenId,
        uint256 amount,
        address recipient
    ) public onlyOwner {
        // 1. Validate Token ID range (1 to 6)
        require(tokenId >= 1 && tokenId <= NUM_TOKENS, "KamiSigils: Invalid Token ID. Must be 1-6.");
        
        // 2. Validate amount
        require(amount > 0, "KamiSigils: Amount must be greater than zero.");

        // 3. Mint the specified amount
        _mint(recipient, tokenId, amount, "");

        // 💡 NEW: Update the total supply for this token ID
        totalSupply[tokenId] += amount;

        emit TokenSupply(tokenId, recipient, amount);
    }

    event TokenSupply(uint256 indexed tokenId, address indexed recipient, uint256 amount);

    /**
     * @notice Returns the total number of tokens minted for a specific token ID (1-6).
     * @param tokenId The ID (1-6) of the token type.
     * @return The total number of tokens minted (total supply).
     */
    function getTotalSupply(uint256 tokenId) public view returns (uint256) {
        require(tokenId >= 1 && tokenId <= NUM_TOKENS, "KamiSigils: Invalid Token ID. Must be 1-6.");
        return totalSupply[tokenId];
    }

    // --- Soul-Bound (Non-Transferable) Enforcement ---
    /**
     * @dev Overrides the standard ERC-1155 update function to block all transfers.
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        // Block all transfers between user addresses.
        if (from != address(0) && to != address(0)) {
            revert("KamiSigils: Token is soul-bound and non-transferable");
        }

        super._update(from, to, ids, values);
    }
}