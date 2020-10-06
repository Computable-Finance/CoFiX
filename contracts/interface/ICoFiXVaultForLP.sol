// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

interface ICoFiXVaultForLP {

    enum POOL_STATE {INVALID, ENABLED, DISABLED}

    event NewPoolAdded(address pool, uint256 index);
    event PoolEnabled(address pool);
    event PoolDisabled(address pool);

    function setGovernance(address _new) external;
    function setInitCoFiRate(uint256 _new) external;
    function setDecayPeriod(uint256 _new) external;
    function setDecayRate(uint256 _new) external;

    function addPool(address pool) external;
    function enablePool(address pool) external;
    function disablePool(address pool) external;
    function setPoolWeight(address pool, uint256 weight) external;
    function batchSetPoolWeight(address[] memory pools, uint256[] memory weights) external;
    function distributeReward(address to, uint256 amount) external;

    function getPendingRewardOfLP(address pair) external view returns (uint256);
    function currentPeriod() external view returns (uint256);
    function currentCoFiRate() external view returns (uint256);
    function currentPoolRate(address pool) external view returns (uint256 poolRate);
    function currentPoolRateByPair(address pair) external view returns (uint256 poolRate);

    /// @dev Get the award staking pool address of pair (XToken)
    /// @param  pair The address of XToken(pair) contract
    /// @return pool The pool address
    function stakingPoolForPair(address pair) external view returns (address pool);

    function getPoolInfo(address pool) external view returns (POOL_STATE state, uint256 weight);
    function getPoolInfoByPair(address pair) external view returns (POOL_STATE state, uint256 weight);

    function getEnabledPoolCnt() external view returns (uint256);

    function getCoFiStakingPool() external view returns (address pool);

}