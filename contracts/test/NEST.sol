// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.6;

import "./ERC20.sol";

contract NEST is ERC20 {

    constructor() ERC20(10**10*10**18, "NEST Token", "NEST", 18) public {
    }
}