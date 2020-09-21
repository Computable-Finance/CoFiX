// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;

import "./TestERC20.sol";

contract USDT is TestERC20 {

    constructor() TestERC20(10**10*10**6, "USDT Test Token", "USDT", 6) public {
    }

}
