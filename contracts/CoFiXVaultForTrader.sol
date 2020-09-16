// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CoFiXVaultForTrader {
    using SafeMath for uint256;

    address public cofiToken;

    uint256 public genesisBlock; // TODO: make this constant to reduce gas cost

    // managed by governance
    address public governance;

    uint256 public initCoFiRate = 10*1e18; // yield per block
    uint256 public decayPeriod = 7200; // yield decays for every 2,400,000 blocks
    int128 public decayRate = 0x4189374BC6A7F0; // (0.001*2**64).toString(16), 0.001 as 64.64-bit fixed point


}