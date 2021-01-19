// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.12;

/// @title The interface of NestQuery
/// @author Inf Loop - <inf-loop@nestprotocol.org>
/// @author Paradox  - <paradox@nestprotocol.org>
interface INestQuery {

    /// @notice Activate a pay-per-query defi client with NEST tokens
    /// @dev No contract is allowed to call it
    /// @param defi The addres of client (DeFi DApp)
    function activate(address defi) external;

    /// @notice Deactivate a pay-per-query defi client
    /// @param defi The address of a client (DeFi DApp)
    function deactivate(address defi) external;

    /// @notice Query for PPQ (pay-per-query) clients
    /// @dev Consider that if a user call a DeFi that queries NestQuery, DeFi should
    ///     pass the user's wallet address to query() as `payback`.
    /// @param token The address of token contract
    /// @param payback The address of change
    function query(address token, address payback) 
        external payable returns (uint256, uint256, uint256);

    /// @notice Query for PPQ (pay-per-query) clients
    /// @param token The address of token contract
    /// @param payback The address of change
    /// @return ethAmount The amount of ETH in pair (ETH, TOKEN)
    /// @return tokenAmount The amount of TOKEN in pair (ETH, TOKEN)
    /// @return avgPrice The average of last 50 prices 
    /// @return vola The volatility of prices 
    /// @return bn The block number when (ETH, TOKEN) takes into effective
    function queryPriceAvgVola(address token, address payback) 
        external payable returns (uint256, uint256, uint128, int128, uint256);

    /// @notice The main function called by DeFi clients, compatible to Nest Protocol v3.0 
    /// @dev  The payback address is ZERO, so the changes are kept in this contract
    ///         The ABI keeps consist with Nest v3.0
    /// @param tokenAddress The address of token contract address
    /// @return ethAmount The amount of ETH in price pair (ETH, ERC20)
    /// @return erc20Amount The amount of ERC20 in price pair (ETH, ERC20)
    /// @return blockNum The block.number where the price is being in effect
    function updateAndCheckPriceNow(address tokenAddress) 
        external payable returns (uint256, uint256, uint256);

    /// @notice A non-free function for querying price 
    /// @param token  The address of the token contract
    /// @param num    The number of price sheets in the list
    /// @param payback The address for change
    /// @return The array of prices, each of which is (blockNnumber, ethAmount, tokenAmount)
    function queryPriceList(address token, uint8 num, address payback) 
        external payable returns (uint128[] memory);

    /// @notice A view function returning the historical price list from the current block
    /// @param token  The address of the token contract
    /// @param num    The number of price sheets in the list
    /// @return The array of prices, each of which is (blockNnumber, ethAmount, tokenAmount)
    function priceList(address token, uint8 num) 
        external view returns (uint128[] memory);

    /// @notice A view function returning the latestPrice
    /// @param token  The address of the token contract
    function latestPrice(address token)
    external view returns (uint256 ethAmount, uint256 tokenAmount, uint128 avgPrice, int128 vola, uint256 bn) ;

    /// @dev Only for governance
    function loadContracts() external; 

    /// @dev Only for governance
    function loadGovernance() external; 


    event ClientActivated(address, uint256, uint256);
    // event ClientRenewed(address, uint256, uint256, uint256);
    event PriceQueried(address client, address token, uint256 ethAmount, uint256 tokenAmount, uint256 bn);
    event PriceAvgVolaQueried(address client, address token, uint256 bn, uint128 avgPrice, int128 vola);

    event PriceListQueried(address client, address token, uint256 bn, uint8 num);

    // governance events
    event ParamsSetup(address gov, uint256 oldParams, uint256 newParams);
    event FlagSet(address gov, uint256 flag);
}