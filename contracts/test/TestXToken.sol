// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.6;

import "./TestERC20.sol";

contract TestXToken is TestERC20 {

    constructor() TestERC20(10**9*10**18, "TestXToken", "XT-1", 18) public {
    }
}