// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.6;

import "./ERC20.sol";

contract USDT is ERC20 {

    constructor() ERC20(10**10*10**6, "USDT Test Token", "USDT", 6) public {
    }

}
