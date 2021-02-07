// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

interface ICoFiXV2VaultForTrader {

    event RouterAllowed(address router);
    event RouterDisallowed(address router);

    event ClearPendingRewardOfCNode(uint256 pendingAmount);
    event ClearPendingRewardOfLP(uint256 pendingAmount);

    function setGovernance(address gov) external;

    function setExpectedYieldRatio(uint256 r) external;
    function setLRatio(uint256 lRatio) external;
    function setTheta(uint256 theta) external;
    function setCofiRate(uint256 cofiRate) external;

    function allowRouter(address router) external;

    function disallowRouter(address router) external;

    function calcMiningRate(address pair, uint256 neededETHAmount) external view returns (uint256);

    function calcNeededETHAmountForAdjustment(address pair, uint256 reserve0, uint256 reserve1, uint256 ethAmount, uint256 erc20Amount) external view returns (uint256);

    function actualMiningAmount(address pair, uint256 reserve0, uint256 reserve1, uint256 ethAmount, uint256 erc20Amount) external view returns (uint256 amount, uint256 totalAccruedAmount, uint256 neededETHAmount);

    function distributeReward(address pair, uint256 ethAmount, uint256 erc20Amount, address rewardTo) external;

    function clearPendingRewardOfCNode() external;

    function clearPendingRewardOfLP(address pair) external;

    function getPendingRewardOfCNode() external view returns (uint256);

    function getPendingRewardOfLP(address pair) external view returns (uint256);

}
