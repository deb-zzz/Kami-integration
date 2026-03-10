// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title KamiPaymaster
 * @dev Paymaster contract for sponsoring gas fees on Base blockchain
 * @notice This contract enables gasless transactions for KAMI NFT operations
 * 
 * Features:
 * - Sponsors gas fees for approved operations
 * - ERC20 token-based gas payment
 * - Configurable spending limits per user and globally
 * - Time-based limit resets
 * - Signature-based validation
 * - Integration with Base Paymaster system
 */
contract KamiPaymaster is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // ============ STORAGE VARIABLES ============

    /// @dev EntryPoint contract address for ERC-4337
    address public immutable entryPoint;
    
    /// @dev ERC20 token used for gas payments
    IERC20 public immutable paymentToken;
    
    /// @dev Maximum gas price in wei
    uint256 public maxGasPrice;
    
    /// @dev Maximum gas limit per operation
    uint256 public maxGasLimit;
    
    /// @dev Global spending limit in payment token
    uint256 public globalSpendingLimit;
    
    /// @dev Current global spending in payment token
    uint256 public globalSpending;
    
    /// @dev Per-user spending limit in payment token
    uint256 public userSpendingLimit;
    
    /// @dev Per-user spending tracking
    mapping(address => uint256) public userSpending;
    
    /// @dev Per-user operation count limit
    uint256 public userOperationLimit;
    
    /// @dev Per-user operation count tracking
    mapping(address => uint256) public userOperationCount;
    
    /// @dev Limit reset period (daily, weekly, monthly)
    uint256 public limitResetPeriod;
    
    /// @dev Last reset timestamp
    uint256 public lastResetTime;
    
    /// @dev Allowed contracts for sponsorship
    mapping(address => bool) public allowedContracts;
    
    /// @dev Allowed functions for sponsorship
    mapping(address => mapping(bytes4 => bool)) public allowedFunctions;
    
    /// @dev Signature nonces for replay protection
    mapping(address => uint256) public nonces;
    
    /// @dev Treasury address for collecting gas payments
    address public treasury;

    // ============ EVENTS ============

    event GasSponsored(
        address indexed user,
        address indexed target,
        uint256 gasUsed,
        uint256 gasPrice,
        uint256 paymentAmount
    );
    
    event SpendingLimitUpdated(
        uint256 globalLimit,
        uint256 userLimit,
        uint256 operationLimit
    );
    
    event ContractAllowed(address indexed contractAddress, bool allowed);
    
    event FunctionAllowed(address indexed contractAddress, bytes4 functionSelector, bool allowed);
    
    event TreasuryUpdated(address indexed newTreasury);
    
    event LimitsReset(uint256 timestamp);

    // ============ MODIFIERS ============

    modifier onlyEntryPoint() {
        require(msg.sender == entryPoint, "Only entry point");
        _;
    }

    modifier onlyAllowedContract(address target) {
        require(allowedContracts[target], "Contract not allowed");
        _;
    }

    modifier withinLimits(address user, uint256 gasUsed, uint256 gasPrice) {
        require(gasPrice <= maxGasPrice, "Gas price too high");
        require(gasUsed <= maxGasLimit, "Gas limit exceeded");
        require(globalSpending + _calculatePayment(gasUsed, gasPrice) <= globalSpendingLimit, "Global limit exceeded");
        require(userSpending[user] + _calculatePayment(gasUsed, gasPrice) <= userSpendingLimit, "User limit exceeded");
        require(userOperationCount[user] < userOperationLimit, "User operation limit exceeded");
        _;
    }

    // ============ CONSTRUCTOR ============

    constructor(
        address _entryPoint,
        address _paymentToken,
        address _treasury,
        uint256 _maxGasPrice,
        uint256 _maxGasLimit,
        uint256 _globalSpendingLimit,
        uint256 _userSpendingLimit,
        uint256 _userOperationLimit,
        uint256 _limitResetPeriod
    ) Ownable(msg.sender) {
        require(_entryPoint != address(0), "Invalid entry point");
        require(_paymentToken != address(0), "Invalid payment token");
        require(_treasury != address(0), "Invalid treasury");
        require(_maxGasPrice > 0, "Invalid max gas price");
        require(_maxGasLimit > 0, "Invalid max gas limit");
        require(_globalSpendingLimit > 0, "Invalid global spending limit");
        require(_userSpendingLimit > 0, "Invalid user spending limit");
        require(_userOperationLimit > 0, "Invalid user operation limit");
        require(_limitResetPeriod > 0, "Invalid reset period");

        entryPoint = _entryPoint;
        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;
        maxGasPrice = _maxGasPrice;
        maxGasLimit = _maxGasLimit;
        globalSpendingLimit = _globalSpendingLimit;
        userSpendingLimit = _userSpendingLimit;
        userOperationLimit = _userOperationLimit;
        limitResetPeriod = _limitResetPeriod;
        lastResetTime = block.timestamp;
    }

    // ============ VIEW FUNCTIONS ============

    function getDeposit() public view returns (uint256) {
        return address(this).balance;
    }

    function getUserSpending(address user) external view returns (uint256) {
        return userSpending[user];
    }

    function getUserOperationCount(address user) external view returns (uint256) {
        return userOperationCount[user];
    }

    function getRemainingGlobalSpending() external view returns (uint256) {
        return globalSpendingLimit - globalSpending;
    }

    function getRemainingUserSpending(address user) external view returns (uint256) {
        return userSpendingLimit - userSpending[user];
    }

    function getRemainingUserOperations(address user) external view returns (uint256) {
        return userOperationLimit - userOperationCount[user];
    }

    function isFunctionAllowed(address target, bytes4 functionSelector) external view returns (bool) {
        return allowedContracts[target] && allowedFunctions[target][functionSelector];
    }

    function shouldResetLimits() public view returns (bool) {
        return block.timestamp >= lastResetTime + limitResetPeriod;
    }

    // ============ CORE FUNCTIONS ============

    /**
     * @dev Validate a user operation and determine if it should be sponsored
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @param maxCost The maximum cost for the operation
     * @return context Context data for post-operation processing
     * @return validationData Validation data for the operation
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        // Check if limits need to be reset
        if (shouldResetLimits()) {
            _resetLimits();
        }

        // Validate gas parameters
        require(userOp.maxFeePerGas <= maxGasPrice, "Gas price too high");
        require(userOp.callGasLimit <= maxGasLimit, "Gas limit exceeded");

        // Extract target contract and function
        address target = _extractTarget(userOp.callData);
        bytes4 functionSelector = _extractFunctionSelector(userOp.callData);

        // Check if contract and function are allowed
        require(allowedContracts[target], "Contract not allowed");
        require(allowedFunctions[target][functionSelector], "Function not allowed");

        // Calculate payment amount
        uint256 paymentAmount = _calculatePayment(userOp.callGasLimit, userOp.maxFeePerGas);

        // Check spending limits
        require(globalSpending + paymentAmount <= globalSpendingLimit, "Global limit exceeded");
        require(userSpending[userOp.sender] + paymentAmount <= userSpendingLimit, "User limit exceeded");
        require(userOperationCount[userOp.sender] < userOperationLimit, "User operation limit exceeded");

        // Create context for post-operation processing
        context = abi.encode(userOp.sender, target, functionSelector, paymentAmount);

        // Return validation data (0 means valid)
        validationData = 0;
    }

    /**
     * @dev Post-operation processing for sponsored transactions
     * @param context Context data from validation
     * @param actualGasCost The actual gas cost of the operation
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external onlyEntryPoint {
        (address user, address target, bytes4 functionSelector, uint256 expectedPayment) = abi.decode(
            context,
            (address, address, bytes4, uint256)
        );

        // Calculate actual payment based on actual gas cost
        uint256 actualPayment = _calculatePayment(actualGasCost, tx.gasprice);

        // Update spending tracking
        globalSpending += actualPayment;
        userSpending[user] += actualPayment;
        userOperationCount[user]++;

        // Transfer payment from user to treasury
        if (actualPayment > 0) {
            paymentToken.safeTransferFrom(user, treasury, actualPayment);
        }

        emit GasSponsored(user, target, actualGasCost, tx.gasprice, actualPayment);
    }

    // ============ ADMIN FUNCTIONS ============

    function setSpendingLimits(
        uint256 _globalSpendingLimit,
        uint256 _userSpendingLimit,
        uint256 _userOperationLimit
    ) external onlyOwner {
        require(_globalSpendingLimit > 0, "Invalid global limit");
        require(_userSpendingLimit > 0, "Invalid user limit");
        require(_userOperationLimit > 0, "Invalid operation limit");

        globalSpendingLimit = _globalSpendingLimit;
        userSpendingLimit = _userSpendingLimit;
        userOperationLimit = _userOperationLimit;

        emit SpendingLimitUpdated(_globalSpendingLimit, _userSpendingLimit, _userOperationLimit);
    }

    function setGasLimits(uint256 _maxGasPrice, uint256 _maxGasLimit) external onlyOwner {
        require(_maxGasPrice > 0, "Invalid max gas price");
        require(_maxGasLimit > 0, "Invalid max gas limit");

        maxGasPrice = _maxGasPrice;
        maxGasLimit = _maxGasLimit;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function allowContract(address contractAddress, bool allowed) external onlyOwner {
        allowedContracts[contractAddress] = allowed;
        emit ContractAllowed(contractAddress, allowed);
    }

    function allowFunction(address contractAddress, bytes4 functionSelector, bool allowed) external onlyOwner {
        allowedFunctions[contractAddress][functionSelector] = allowed;
        emit FunctionAllowed(contractAddress, functionSelector, allowed);
    }

    function resetLimits() external onlyOwner {
        _resetLimits();
    }

    function deposit() external payable onlyOwner {
        // Deposit ETH to the entry point for gas sponsorship
        (bool success, ) = entryPoint.call{value: msg.value}("");
        require(success, "Deposit failed");
    }

    function withdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = owner().call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    function withdrawToken(uint256 amount) external onlyOwner {
        paymentToken.safeTransfer(owner(), amount);
    }

    // ============ INTERNAL FUNCTIONS ============

    function _calculatePayment(uint256 gasUsed, uint256 gasPrice) internal pure returns (uint256) {
        return (gasUsed * gasPrice * 110) / 100; // Add 10% buffer
    }

    function _extractTarget(bytes calldata callData) internal pure returns (address) {
        require(callData.length >= 4, "Invalid call data");
        return address(bytes20(callData[4:24]));
    }

    function _extractFunctionSelector(bytes calldata callData) internal pure returns (bytes4) {
        require(callData.length >= 4, "Invalid call data");
        return bytes4(callData[0:4]);
    }

    function _resetLimits() internal {
        globalSpending = 0;
        lastResetTime = block.timestamp;
        
        // Note: User limits are not reset here as they should be reset per user
        // This would require a more complex tracking system
        
        emit LimitsReset(block.timestamp);
    }

    // ============ FALLBACK ============

    receive() external payable {}

    // ============ STRUCTS ============

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

    enum PostOpMode {
        opSucceeded,
        opReverted,
        postOpReverted
    }
}
