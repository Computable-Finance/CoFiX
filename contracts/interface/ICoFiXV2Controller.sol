// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

interface ICoFiXV2Controller {

    event NewK(address token, uint256 K, uint256 sigma, uint256 T, uint256 ethAmount, uint256 erc20Amount, uint256 blockNum);
    event NewGovernance(address _new);
    event NewOracle(address _priceOracle);
    event NewKTable(address _kTable);
    event NewTimespan(uint256 _timeSpan);
    event NewKRefreshInterval(uint256 _interval);
    event NewKLimit(int128 maxK0);
    event NewGamma(int128 _gamma);
    event NewTheta(address token, uint32 theta);
    event NewK(address token, uint32 k);
    event NewCGamma(address token, uint32 gamma);

    function addCaller(address caller) external;

    function setCGamma(address token, uint32 gamma) external;

    function queryOracle(address token, uint8 op, bytes memory data) external payable returns (uint256 k, uint256 ethAmount, uint256 erc20Amount, uint256 blockNum, uint256 theta);

    function getKInfo(address token) external view returns (uint32 k, uint32 updatedAt, uint32 theta);

    function getLatestPriceAndAvgVola(address token) external payable returns (uint256, uint256, uint256, uint256);
}