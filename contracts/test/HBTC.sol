// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;

import "./TestERC20.sol";

contract HBTC is TestERC20 {

    constructor() TestERC20(10**7*10**18, "HBTC Token", "HBTC", 18) public {
    }
}