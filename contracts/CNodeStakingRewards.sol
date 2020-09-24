// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

import "./interface/ICoFiXVaultForCNode.sol";
import "./CoFiXStakingRewards.sol";


// Stake CNode Token to earn CoFi Token
contract CNodeStakingRewards is CoFiXStakingRewards {

    constructor(
        address _rewardsToken,
        address _stakingToken,
        address _cofixVault
    ) public CoFiXStakingRewards(
        _rewardsToken,
        _stakingToken,
        _cofixVault
    ) {}

    function rewardRate() public virtual override view returns (uint256) {
        return ICoFiXVaultForCNode(cofixVault).currentCoFiRate();
    }

    function accrued() public virtual override view returns (uint256) {
        // TODO: collect pending reward from Trader pool
        uint256 blockReward = lastBlockRewardApplicable().sub(lastUpdateBlock).mul(rewardRate());
        uint256 tradingReward = ICoFiXVaultForCNode(cofixVault).getPendingRewardOfCNode(); // trading rewards
        return blockReward.add(tradingReward); // TODO: handle the last mining issue
    }

    modifier updateReward(address account) virtual override {
        // rewardPerTokenStored = rewardPerToken();
        // uint256 newAccrued = accrued();
        (uint256 newRewardPerToken, uint256 newAccrued) = _rewardPerTokenAndAccrued();
        rewardPerTokenStored = newRewardPerToken;
        if (newAccrued > 0) {
            // distributeReward could fail if CoFiXVaultForCNode is not minter of CoFi anymore
            // Should set reward rate to zero first, and then do a settlement of pool reward by call getReward
            ICoFiXVaultForCNode(cofixVault).distributeReward(address(this), newAccrued);
        } 
        lastUpdateBlock = lastBlockRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

}