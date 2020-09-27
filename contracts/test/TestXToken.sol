// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestXToken is ERC20("TestXToken", "XT-1") {

    constructor() public {
    }

    // ONLY TEST, NOT SAFE!
    function mint(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }

}