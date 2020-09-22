// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;

import "./TestERC20.sol";

contract NEST is TestERC20 {

    constructor() TestERC20(10**10*10**18, "NEST Token", "NEST", 18) public {
    }
}