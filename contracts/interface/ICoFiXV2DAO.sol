// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

interface ICoFiXV2DAO {

    function setGovernance(address gov) external;
    function start() external; 

    function addETHReward() external payable; 

    event FlagSet(address gov, uint256 flag);
    event CoFiBurn(address gov, uint256 amount);
}