// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./KamiSmartAccount.sol";

/**
 * @title KamiSmartAccountFactory
 * @dev Factory contract for creating KAMI Smart Accounts using ERC-4337
 * @notice This factory creates smart accounts that can be used for sponsored transactions
 */
contract KamiSmartAccountFactory {
    using Create2 for bytes32;

    // Base entry point address for ERC-4337
    address public immutable entryPoint;
    
    // Implementation contract for smart accounts
    address public immutable accountImplementation;
    
    // Events
    event AccountCreated(address indexed account, address indexed owner, uint256 salt);
    
    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
        accountImplementation = address(new KamiSmartAccount(_entryPoint));
    }
    
    /**
     * @dev Create a new smart account for a given owner
     * @param owner The address that will own the smart account
     * @param salt A random salt for deterministic address generation
     * @return account The address of the created smart account
     */
    function createAccount(address owner, uint256 salt) external returns (address account) {
        bytes32 saltHash = keccak256(abi.encodePacked(owner, salt));
        bytes memory bytecode = abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(accountImplementation, abi.encodeCall(KamiSmartAccount.initialize, (owner)))
        );
        
        account = Create2.computeAddress(saltHash, keccak256(bytecode), address(this));
        
        if (account.code.length > 0) {
            return account;
        }
        
        account = Create2.deploy(0, saltHash, bytecode);
        emit AccountCreated(account, owner, salt);
    }
    
    /**
     * @dev Get the address of a smart account that would be created
     * @param owner The address that will own the smart account
     * @param salt A random salt for deterministic address generation
     * @return The address of the smart account
     */
    function getAddress(address owner, uint256 salt) external view returns (address) {
        bytes32 saltHash = keccak256(abi.encodePacked(owner, salt));
        bytes memory bytecode = abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(accountImplementation, abi.encodeCall(KamiSmartAccount.initialize, (owner)))
        );
        
        return Create2.computeAddress(saltHash, keccak256(bytecode), address(this));
    }
    
    /**
     * @dev Check if an account exists
     * @param account The address to check
     * @return True if the account exists
     */
    function isAccount(address account) external view returns (bool) {
        return account.code.length > 0;
    }
}
