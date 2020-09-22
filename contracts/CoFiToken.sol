// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CoFiToken is ERC20("CoFiToken", "CoFi") {

    constructor() public {
        _mint(msg.sender, 1e8*1e18);
    }

}
