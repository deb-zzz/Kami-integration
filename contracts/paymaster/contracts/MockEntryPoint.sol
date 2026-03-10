// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockEntryPoint {
    event DepositTo(address indexed paymaster, uint256 amount);
    
    mapping(address => uint256) public deposits;
    
    function getDepositInfo(address account) external view returns (uint256 deposit) {
        return deposits[account];
    }
    
    function depositTo(address paymaster) external payable {
        deposits[paymaster] += msg.value;
        emit DepositTo(paymaster, msg.value);
    }
}
