// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

interface ICoFiXVaultForTrader {

    event RouterAllowed(address router);
    event RouterDisallowed(address router);

    function setGovernance(address gov) external;

    function allowRouter(address router) external;

    function disallowRouter(address router) external;

    function currentCoFiRate(address pair, uint256 np) external view returns (uint256);

    function currentThreshold(uint256 cofiRate) external view returns (uint256);

    function stdMiningRateAndAmount(address pair, uint256 np, uint256 thetaFee) external view returns (uint256 cofiRate, uint256 stdAmount);

    function calcDensity(uint256 _stdAmount) external view returns (uint256);

    function calcLambda(uint256 x, uint256 y) external pure returns (uint256);

    function actualMiningAmountAndDensity(address pair, uint256 thetaFee, uint256 x, uint256 y, uint256 np) external view returns (uint256 amount, uint256 density, uint256 cofiRate);

    function distributeReward(address pair, uint256 thetaFee, uint256 x, uint256 y, uint256 np, address rewardTo) external;

    function clearPendingRewardOfCNode() external;

    function clearPendingRewardOfLP(address pair) external;

    function getPendingRewardOfCNode() external view returns (uint256);

    function getPendingRewardOfLP(address pair) external view returns (uint256);

    function getCoFiRateCache(address pair) external view returns (uint256 cofiRate, uint256 updatedBlock);
}