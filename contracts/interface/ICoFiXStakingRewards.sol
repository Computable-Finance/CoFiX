// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;


interface ICoFiXStakingRewards {
    // Views
    function lastBlockRewardApplicable() external view returns (uint256);

    function rewardPerToken() external view returns (uint256);

    function earned(address account) external view returns (uint256);

    function accrued() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    // Mutative

    function stake(uint256 amount) external;

    function stakeForOther(address other, uint256 amount) external;

    function withdraw(uint256 amount) external;

    function getReward() external;

    function exit() external;

    function addReward(uint256 amount) external;

    // Events
    event RewardAdded(address sender, uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event StakedForOther(address indexed user, address indexed other, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
}