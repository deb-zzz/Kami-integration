// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPaymaster} from "@account-abstraction/contracts/interfaces/IPaymaster.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";

// Import the EntryPoint interface
interface IEntryPoint {
    function getDepositInfo(address account) external view returns (uint256 deposit);
    function depositTo(address paymaster) external payable;
}

contract KamiPaymaster is IPaymaster {
    IEntryPoint public immutable entryPoint;
    address public owner;
    mapping(address => bool) public isAllowlisted;

    event AllowlistUpdated(address indexed user, bool isAllowlisted);

    constructor(address _entryPointAddress) {
        entryPoint = IEntryPoint(_entryPointAddress);
        owner = msg.sender;
    }

    // Fund the Paymaster with ETH to cover gas costs
    function deposit() public payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    // Add or remove addresses from the allowlist
    function setAllowlistAddress(address _user, bool _isAllowlisted) external {
        require(msg.sender == owner, "Unauthorized");
        isAllowlisted[_user] = _isAllowlisted;
        emit AllowlistUpdated(_user, _isAllowlisted);
    }

    // Called by the EntryPoint to validate if the Paymaster will pay for the userOp
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /* userOpHash */,
        uint256 /* maxCost */
    ) external view returns (bytes memory context, uint256 validationData) {
        // Only allow userOps from allowlisted addresses
        require(isAllowlisted[userOp.sender], "Not on allowlist");
        
        // This is where you would implement more complex logic.
        // For a simple sponsor, we just return a valid signature.
        // The EntryPoint will check our deposit and proceed.

        return ("", 0);
    }

    // Called by the EntryPoint after successful userOp execution
    function postOp(
        PostOpMode mode,
        bytes calldata,
        uint256 actualGasCost
    ) external pure {
        // For this simple paymaster, we do not need to take any action in postOp.
        // In a more advanced implementation, you might track gas usage, charge users, or update state.
        // This function is required by the IPaymaster interface.
        // Silence unused parameter warnings by referencing them.
        mode; 
        actualGasCost;
    }
}
