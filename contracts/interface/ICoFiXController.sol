// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

interface ICoFiXController {

    event newK(address token, int128 K, int128 sigma, uint256 T, uint256 ethAmount, uint256 erc20Amount, uint256 blockNum, uint256 tIdx, uint256 sigmaIdx, int128 K0);

    function addCaller(address caller) external;

    function queryOracle(address token, bytes memory data) external payable returns (uint256 k, uint256 ethAmount, uint256 erc20Amount, uint256 blockNum, uint256 theta);
}