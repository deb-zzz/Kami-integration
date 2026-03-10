// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title KamiSmartAccount
 * @dev Smart Account implementation for ERC-4337 Account Abstraction
 * @notice This contract enables sponsored transactions and custom validation logic
 */
contract KamiSmartAccount is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ERC-4337 EntryPoint contract
    address public immutable entryPoint;
    
    // Nonce for preventing replay attacks
    uint256 public nonce;
    
    // Events
    event TransactionExecuted(address indexed to, uint256 value, bytes data, bool success);
    event NonceUpdated(uint256 indexed newNonce);
    
    constructor(address _entryPoint) Ownable(msg.sender) {
        entryPoint = _entryPoint;
    }
    
    /**
     * @dev Initialize the smart account with an owner
     * @param _owner The address that will own this smart account
     */
    function initialize(address _owner) external {
        require(owner() == address(0), "Already initialized");
        _transferOwnership(_owner);
    }
    
    /**
     * @dev Validate a user operation according to ERC-4337
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @param missingAccountFunds The amount of funds missing for the operation
     * @return validationData Validation data for the operation
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        require(msg.sender == entryPoint, "Only entry point");
        
        // Check nonce
        require(userOp.nonce == nonce, "Invalid nonce");
        
        // Verify signature
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address recovered = hash.recover(userOp.signature);
        require(recovered == owner(), "Invalid signature");
        
        // Update nonce
        nonce++;
        emit NonceUpdated(nonce);
        
        // Pay for gas if needed
        if (missingAccountFunds > 0) {
            // This would typically be handled by a paymaster
            // For now, we'll just validate that the account has enough funds
            require(address(this).balance >= missingAccountFunds, "Insufficient funds");
        }
        
        return 0; // No validation errors
    }
    
    /**
     * @dev Execute a transaction from this smart account
     * @param to The target address
     * @param value The amount of ETH to send
     * @param data The calldata to send
     * @return success Whether the transaction succeeded
     */
    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlyOwner nonReentrant returns (bool success) {
        (success, ) = to.call{value: value}(data);
        emit TransactionExecuted(to, value, data, success);
    }
    
    /**
     * @dev Execute a batch of transactions
     * @param calls Array of call data
     * @return results Array of results for each call
     */
    function executeBatch(
        Call[] calldata calls
    ) external onlyOwner nonReentrant returns (bytes[] memory results) {
        results = new bytes[](calls.length);
        
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory result) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            if (!success) {
                // If any call fails, revert the entire batch
                assembly {
                    returndatacopy(0, 0, returndatasize())
                    revert(0, returndatasize())
                }
            }
            results[i] = result;
        }
    }
    
    /**
     * @dev Receive ETH
     */
    receive() external payable {}
    
    /**
     * @dev Fallback function
     */
    fallback() external payable {}
    
    // Structs for ERC-4337
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }
    
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }
}
