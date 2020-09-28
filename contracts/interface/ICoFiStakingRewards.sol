// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;


interface ICoFiStakingRewards {
    // Views

    /// @dev Reward amount represents by per staking token
    function rewardPerToken() external view returns (uint256);

    /// @dev How many reward tokens a user has earned but not claimed at present
    /// @param  account The target account
    /// @return The amount of reward tokens a user earned
    function earned(address account) external view returns (uint256);

    /// @dev How many reward tokens accrued recently
    /// @return The amount of reward tokens accrued recently
    function accrued() external view returns (uint256);

    /// @dev How many stakingToken (XToken) deposited into to this reward pool (staking pool)
    /// @return The total amount of XTokens deposited in this staking pool
    function totalSupply() external view returns (uint256);

    /// @dev How many stakingToken (XToken) deposited by the target account
    /// @param  account The target account
    /// @return The total amount of XToken deposited in this staking pool
    function balanceOf(address account) external view returns (uint256);

    /// @dev Get the address of token for staking in this staking pool
    /// @return The staking token address
    function stakingToken() external view returns (address);

    /// @dev Get the address of token for rewards in this staking pool
    /// @return The rewards token address
    function rewardsToken() external view returns (address);

    // Mutative

    /// @dev Stake/Deposit into the reward pool (staking pool)
    /// @param  amount The target amount
    function stake(uint256 amount) external;

    /// @dev Stake/Deposit into the reward pool (staking pool) for other account
    /// @param  other The target account
    /// @param  amount The target amount
    function stakeForOther(address other, uint256 amount) external;

    /// @dev Withdraw from the reward pool (staking pool), get the original tokens back
    /// @param  amount The target amount
    function withdraw(uint256 amount) external;
    
    /// @dev Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw() external;

    /// @dev Claim the reward the user earned
    function getReward() external;

    /// @dev Add ETH reward to the staking pool
    function addETHReward() external payable;

    /// @dev User exit the reward pool, it's actually withdraw and getReward
    function exit() external;

    // Events
    event Staked(address indexed user, uint256 amount);
    event StakedForOther(address indexed user, address indexed other, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event SavingWithdrawn(address indexed to, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    
}