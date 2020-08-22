// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

interface ICofiXFactory {
    // All pairs: {ETH <-> ERC20 Token}
    event PairCreated(address indexed token, address pair, uint256);

    /// @dev Create a new token pair for trading
    /// @param  token the address of token to trade
    /// @return pair the address of new token pair
    function createPair(
        address token
        )
        external
        returns (address pair);

    function getPair(address token) external view returns (address pair);
    function allPairs(uint256) external view returns (address pair);
    function allPairsLength() external view returns (uint256);

    function updateAndCheckPriceNow(address tokenAddress) external payable returns(uint256 ethAmount, uint256 erc20Amount, uint256 blockNum);
}