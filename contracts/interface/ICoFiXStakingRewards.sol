// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;


interface ICoFiXStakingRewards {
    // Views

    /// @dev The rewards vault contract address set in factory contract
    /// @return Returns the vault address
    function rewardsVault() external view returns (address);

    /// @dev The lastBlock reward applicable
    /// @return Returns the latest block.number on-chain
    function lastBlockRewardApplicable() external view returns (uint256);

    /// @dev Reward amount represents by per staking token
    function rewardPerToken() external view returns (uint256);

    /// @dev How many reward tokens a user has earned but not claimed at present
    /// @param  account The target account
    /// @return The amount of reward tokens a user earned
    function earned(address account) external view returns (uint256);

    /// @dev How many reward tokens accrued recently
    /// @return The amount of reward tokens accrued recently
    function accrued() external view returns (uint256);

    /// @dev Get the latest reward rate of this mining pool (tokens amount per block)
    /// @return The latest reward rate
    function rewardRate() external view returns (uint256);

    /// @dev How many stakingToken (XToken) deposited into to this reward pool (mining pool)
    /// @return The total amount of XTokens deposited in this mining pool
    function totalSupply() external view returns (uint256);

    /// @dev How many stakingToken (XToken) deposited by the target account
    /// @param  account The target account
    /// @return The total amount of XToken deposited in this mining pool
    function balanceOf(address account) external view returns (uint256);

    /// @dev Get the address of token for staking in this mining pool
    /// @return The staking token address
    function stakingToken() external view returns (address);

    /// @dev Get the address of token for rewards in this mining pool
    /// @return The rewards token address
    function rewardsToken() external view returns (address);

    // Mutative

    /// @dev Stake/Deposit into the reward pool (mining pool)
    /// @param  amount The target amount
    function stake(uint256 amount) external;

    /// @dev Stake/Deposit into the reward pool (mining pool) for other account
    /// @param  other The target account
    /// @param  amount The target amount
    function stakeForOther(address other, uint256 amount) external;

    /// @dev Withdraw from the reward pool (mining pool), get the original tokens back
    /// @param  amount The target amount
    function withdraw(uint256 amount) external;

    /// @dev Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw() external;

    /// @dev Claim the reward the user earned
    function getReward() external;

    function getRewardAndStake() external;

    /// @dev User exit the reward pool, it's actually withdraw and getReward
    function exit() external;

    /// @dev Add reward to the mining pool
    function addReward(uint256 amount) external;

    // Events
    event RewardAdded(address sender, uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event StakedForOther(address indexed user, address indexed other, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
}