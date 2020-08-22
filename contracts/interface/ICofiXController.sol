// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

interface ICofiXController {

    event newK(address token, int128 K, int128 sigma, uint256 T, uint256 ethAmount, uint256 erc20Amount, uint256 blockNum);

    function queryOracle(address token, address payback) external payable returns (uint256 k, uint256 ethAmount, uint256 erc20Amount, uint256 blockNum);
}