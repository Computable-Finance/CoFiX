// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.6;

import "./ERC20.sol";

contract HBTC is ERC20 {

    constructor() ERC20(10**7*10**18, "HBTC Token", "HBTC", 18) public {
    }
}