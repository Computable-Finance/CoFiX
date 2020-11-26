// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

interface ICoFiXController {

    event NewK(address token, int128 K, int128 sigma, uint256 T, uint256 ethAmount, uint256 erc20Amount, uint256 blockNum, uint256 tIdx, uint256 sigmaIdx, int128 K0);
    event NewGovernance(address _new);
    event NewOracle(address _priceOracle);
    event NewKTable(address _kTable);
    event NewTimespan(uint256 _timeSpan);
    event NewKRefreshInterval(uint256 _interval);
    event NewKLimit(int128 maxK0);
    event NewGamma(int128 _gamma);
    event NewTheta(address token, uint32 theta);
    event NewK(address token, uint32 k);

    function addCaller(address caller) external;

    function queryOracle(address token, uint8 op, bytes memory data) external payable returns (uint256 k, uint256 ethAmount, uint256 erc20Amount, uint256 blockNum, uint256 theta);
}