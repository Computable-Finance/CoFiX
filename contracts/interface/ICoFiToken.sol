// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICoFiToken is IERC20 {

    /// @dev An event thats emitted when a new governance account is set
    /// @param  _new The new governance address
    event NewGovernance(address _new);

    /// @dev An event thats emitted when a new minter account is added
    /// @param  _minter The new minter address added
    event MinterAdded(address _minter);

    /// @dev An event thats emitted when a minter account is removed
    /// @param  _minter The minter address removed
    event MinterRemoved(address _minter);

    /// @dev Set governance address of CoFi token. Only governance has the right to execute.
    /// @param  _new The new governance address
    function setGovernance(address _new) external;

    /// @dev Add a new minter account to CoFi token, who can mint tokens. Only governance has the right to execute.
    /// @param  _minter The new minter address
    function addMinter(address _minter) external;

    /// @dev Remove a minter account from CoFi token, who can mint tokens. Only governance has the right to execute.
    /// @param  _minter The minter address removed
    function removeMinter(address _minter) external;

    /// @dev mint is used to distribute CoFi token to users, minters are CoFi mining pools
    /// @param  _to The receiver address
    /// @param  _amount The amount of tokens minted
    function mint(address _to, uint256 _amount) external;
}