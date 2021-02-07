// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "./interface/ICoFiXVaultForCNode.sol";
import "./CoFiXStakingRewards02.sol";


// Stake CNode Token to earn CoFi Token
contract CNodeStakingRewards02 is CoFiXStakingRewards02 {

    constructor(
        address _rewardsToken,
        address _stakingToken,
        address _factory
    ) public CoFiXStakingRewards02(
        _rewardsToken,
        _stakingToken,
        _factory
    ) {
        require(ICoFiXFactory02(_factory).getVaultForCNode() != address(0), "VaultForCNode not set yet"); // check
    }

    // replace cofixVault with rewardsVault, this could introduce more calls, but clear is more important 
    function rewardsVault() public virtual override view returns (address) {
        return ICoFiXFactory02(factory).getVaultForCNode();
    }

    function rewardRate() public virtual override view returns (uint256) {
        return ICoFiXVaultForCNode(rewardsVault()).currentCoFiRate();
    }

    function accrued() public virtual override view returns (uint256) {
        // calc block rewards
        uint256 blockReward = lastBlockRewardApplicable().sub(lastUpdateBlock).mul(rewardRate());
        // query pair trading rewards
        uint256 tradingReward = ICoFiXVaultForCNode(rewardsVault()).getPendingRewardOfCNode(); // trading rewards
        return blockReward.add(tradingReward);
    }

    modifier updateReward(address account) virtual override {
        // rewardPerTokenStored = rewardPerToken();
        // uint256 newAccrued = accrued();
        (uint256 newRewardPerToken, uint256 newAccrued) = _rewardPerTokenAndAccrued();
        rewardPerTokenStored = newRewardPerToken;
        if (newAccrued > 0) {
            // distributeReward could fail if CoFiXVaultForCNode is not minter of CoFi anymore
            // Should set reward rate to zero first, and then do a settlement of pool reward by call getReward
            ICoFiXVaultForCNode(rewardsVault()).distributeReward(address(this), newAccrued);
        } 
        lastUpdateBlock = lastBlockRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

}