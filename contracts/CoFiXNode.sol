// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CoFiXNode is ERC20("CoFiX Node", "CN") {

    constructor() public {
        _setupDecimals(0);
        _mint(msg.sender, 100);
    }

}