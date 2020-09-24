// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CNodeToken is ERC20("CNodeToken", "CNode") {

    constructor() public {
        _mint(msg.sender, 100*1e18);
    }

}