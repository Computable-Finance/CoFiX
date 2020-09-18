// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

interface ICoFiXVaultForTrader {

    event PairAllowed(address pair);
    event PairDisallowed(address pair);

    function allowPair(address pair) external;

    function disallowPair(address pair) external;

    function currentPeriod() external view returns (uint256);

    function currentDecay() external view returns (int128);

    function currentCoFiRate() external view returns (uint256);

    function stdMiningAmount(uint256 thetaFee) external view returns (uint256);

    function recentYield() external view returns (uint256);

    function calcLambda(uint256 x, uint256 y) external pure returns (uint256);

    function currentCoFiLeft() external view returns (uint256);

    function currentCoFiMined() external view returns (uint256);

    function currentS() external view returns (uint256);

    function actualMiningAmount(uint256 thetaFee, uint256 x, uint256 y) external view returns (uint256);

    function distributeTradingReward(uint256 thetaFee, uint256 x, uint256 y, address mineTo) external;

}