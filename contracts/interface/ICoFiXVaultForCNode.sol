// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

interface ICoFiXVaultForCNode {

    event NewCNodePool(address _new);

    function setGovernance(address _new) external;
    function setInitCoFiRate(uint256 _new) external;
    function setDecayPeriod(uint256 _new) external;
    function setDecayRate(uint256 _new) external;
    function setCNodePool(address _new) external;

    function distributeReward(address to, uint256 amount) external;

    function getPendingRewardOfCNode() external view returns (uint256);
    function currentPeriod() external view returns (uint256);
    function currentCoFiRate() external view returns (uint256);
    function getCoFiStakingPool() external view returns (address pool);

}