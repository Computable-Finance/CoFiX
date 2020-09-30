// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "../CoFiXStakingRewards.sol";

// Stake XToken to earn CoFi Token
contract TestCoFiXStakingRewards is CoFiXStakingRewards {

    constructor(
        address _rewardsToken,
        address _stakingToken,
        address _factory
    ) public CoFiXStakingRewards(
        _rewardsToken,
        _stakingToken,
        _factory
    ) {}

    // ONLY FOR TEST
    function distributeReward(uint256 newAccrued) external {
        ICoFiXVaultForLP(rewardsVault()).distributeReward(address(this), newAccrued);
    }

}