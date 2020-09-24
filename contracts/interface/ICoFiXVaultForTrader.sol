// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

interface ICoFiXVaultForTrader {

    event RouterAllowed(address router);
    event RouterDisallowed(address router);

    function setGovernance(address gov) external;

    function allowRouter(address router) external;

    function disallowRouter(address router) external;

    function currentPeriod() external view returns (uint256);

    function currentDecay() external view returns (int128);

    function currentCoFiRate() external view returns (uint256);

    function currentThreshold(uint256 cofiRate) external view returns (uint256);

    function stdMiningRateAndAmount(uint256 thetaFee) external view returns (uint256 cofiRate, uint256 stdAmount);

    function calcDensity(uint256 _stdAmount) external view returns (uint256);

    function calcLambda(uint256 x, uint256 y) external pure returns (uint256);

    function actualMiningAmount(uint256 thetaFee, uint256 x, uint256 y) external view returns (uint256);

    function distributeReward(uint256 thetaFee, uint256 x, uint256 y, address mineTo) external;

}