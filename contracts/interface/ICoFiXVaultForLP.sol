// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

interface ICoFiXVaultForLP {

    event NewPoolAdded(address pool, uint256 index);

    function setGovernance(address _new) external;
    function setInitCoFiRate(uint256 _new) external;
    function setDecayPeriod(uint256 _new) external;
    function setDecayRate(uint256 _new) external;

    function addPool(address pool) external;
    function addPoolForPair(address pool) external;
    function transferCoFi(uint256 amount) external returns (uint256);

    function currentPeriod() external view returns (uint256);
    function currentCoFiRate() external view returns (uint256);
    function currentPoolRate() external view returns (uint256 poolRate);

    /// @dev Get the award staking pool address of pair (XToken)
    /// @param  pair The address of XToken(pair) contract
    /// @return pool The pool address
    function stakingPoolForPair(address pair) external view returns (address pool);
}