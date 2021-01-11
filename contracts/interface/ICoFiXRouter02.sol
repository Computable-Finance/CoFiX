// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

interface ICoFiXRouter02 {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);

    enum DEX_TYPE { COFIX, UNISWAP }

    // All pairs: {ETH <-> ERC20 Token}

    /// @dev Maker add liquidity to pool, get pool token (mint XToken to maker) (notice: msg.value = amountETH + oracle fee)
    /// @param  token The address of ERC20 Token
    /// @param  amountETH The amount of ETH added to pool
    /// @param  amountToken The amount of Token added to pool
    /// @param  liquidityMin The minimum liquidity maker wanted
    /// @param  to The target address receiving the liquidity pool (XToken)
    /// @param  deadline The dealine of this request
    /// @return liquidity The real liquidity or XToken minted from pool
    function addLiquidity(
        address token,
        uint amountETH,
        uint amountToken,
        uint liquidityMin,
        address to,
        uint deadline
    ) external payable returns (uint liquidity);

    /// @dev Maker add liquidity to pool, get pool token (mint XToken) and stake automatically (notice: msg.value = amountETH + oracle fee)
    /// @param  token The address of ERC20 Token
    /// @param  amountETH The amount of ETH added to pool
    /// @param  amountToken The amount of Token added to pool
    /// @param  liquidityMin The minimum liquidity maker wanted
    /// @param  to The target address receiving the liquidity pool (XToken)
    /// @param  deadline The dealine of this request
    /// @return liquidity The real liquidity or XToken minted from pool
    function addLiquidityAndStake(
        address token,
        uint amountETH,
        uint amountToken,
        uint liquidityMin,
        address to,
        uint deadline
    ) external payable returns (uint liquidity);

    /// @dev Maker remove liquidity from pool to get ERC20 Token back (maker burn XToken) (notice: msg.value = oracle fee)
    /// @param  token The address of ERC20 Token
    /// @param  liquidity The amount of liquidity (XToken) sent to pool, or the liquidity to remove
    /// @param  amountTokenMin The minimum amount of Token wanted to get from pool
    /// @param  to The target address receiving the Token
    /// @param  deadline The dealine of this request
    /// @return amountToken The real amount of Token transferred from the pool
    function removeLiquidityGetToken(
        address token,
        uint liquidity,
        uint amountTokenMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken);

    /// @dev Maker remove liquidity from pool to get ETH back (maker burn XToken) (notice: msg.value = oracle fee)
    /// @param  token The address of ERC20 Token
    /// @param  liquidity The amount of liquidity (XToken) sent to pool, or the liquidity to remove
    /// @param  amountETHMin The minimum amount of ETH wanted to get from pool
    /// @param  to The target address receiving the ETH
    /// @param  deadline The dealine of this request
    /// @return amountETH The real amount of ETH transferred from the pool
    function removeLiquidityGetETH(
        address token,
        uint liquidity,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountETH);

    /// @dev Trader swap exact amount of ETH for ERC20 Tokens (notice: msg.value = amountIn + oracle fee)
    /// @param  token The address of ERC20 Token
    /// @param  amountIn The exact amount of ETH a trader want to swap into pool
    /// @param  amountOutMin The minimum amount of Token a trader want to swap out of pool
    /// @param  to The target address receiving the Token
    /// @param  rewardTo The target address receiving the CoFi Token as rewards
    /// @param  deadline The dealine of this request
    /// @return _amountIn The real amount of ETH transferred into pool
    /// @return _amountOut The real amount of Token transferred out of pool
    function swapExactETHForTokens(
        address token,
        uint amountIn,
        uint amountOutMin,
        address to,
        address rewardTo,
        uint deadline
    ) external payable returns (uint _amountIn, uint _amountOut);

    /// @dev Trader swap exact amount of ERC20 Tokens for ETH (notice: msg.value = oracle fee)
    /// @param  token The address of ERC20 Token
    /// @param  amountIn The exact amount of Token a trader want to swap into pool
    /// @param  amountOutMin The mininum amount of ETH a trader want to swap out of pool
    /// @param  to The target address receiving the ETH
    /// @param  rewardTo The target address receiving the CoFi Token as rewards
    /// @param  deadline The dealine of this request
    /// @return _amountIn The real amount of Token transferred into pool
    /// @return _amountOut The real amount of ETH transferred out of pool
    function swapExactTokensForETH(
        address token,
        uint amountIn,
        uint amountOutMin,
        address to,
        address rewardTo,
        uint deadline
    ) external payable returns (uint _amountIn, uint _amountOut);

    /// @dev Trader swap exact amount of ERC20 Tokens for other ERC20 Tokens (notice: msg.value = oracle fee)
    /// @param  tokenIn The address of ERC20 Token a trader want to swap into pool
    /// @param  tokenOut The address of ERC20 Token a trader want to swap out of pool
    /// @param  amountIn The exact amount of Token a trader want to swap into pool
    /// @param  amountOutMin The mininum amount of ETH a trader want to swap out of pool
    /// @param  to The target address receiving the Token
    /// @param  rewardTo The target address receiving the CoFi Token as rewards
    /// @param  deadline The dealine of this request
    /// @return _amountIn The real amount of Token transferred into pool
    /// @return _amountOut The real amount of Token transferred out of pool
    function swapExactTokensForTokens(
        address tokenIn,
        address tokenOut,
        uint amountIn,
        uint amountOutMin,
        address to,
        address rewardTo,
        uint deadline
    ) external payable returns (uint _amountIn, uint _amountOut);

    /// @dev Swaps an exact amount of input tokens for as many output tokens as possible, along the route determined by the path. The first element of path is the input token, the last is the output token, and any intermediate elements represent intermediate pairs to trade through (if, for example, a direct pair does not exist). `msg.sender` should have already given the router an allowance of at least amountIn on the input token. The swap execution can be done via cofix or uniswap. That's why it's called hybrid.
    /// @param amountIn The amount of input tokens to send.
    /// @param amountOutMin The minimum amount of output tokens that must be received for the transaction not to revert.
    /// @param path An array of token addresses. path.length must be >= 2. Pools for each consecutive pair of addresses must exist and have liquidity.
    /// @param dexes An array of dex type values, specifying the exchanges to be used, e.g. CoFiX, Uniswap.
    /// @param to Recipient of the output tokens.
    /// @param  rewardTo The target address receiving the CoFi Token as rewards.
    /// @param deadline Unix timestamp after which the transaction will revert.
    /// @return amounts The input token amount and all subsequent output token amounts.
    function hybridSwapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        DEX_TYPE[] calldata dexes,
        address to,
        address rewardTo,
        uint deadline
    ) external payable returns (uint[] memory amounts);

    /// @dev Swaps an exact amount of ETH for as many output tokens as possible, along the route determined by the path. The first element of path must be WETH, the last is the output token, and any intermediate elements represent intermediate pairs to trade through (if, for example, a direct pair does not exist).
    /// @param amountIn The amount of input tokens to send.
    /// @param amountOutMin The minimum amount of output tokens that must be received for the transaction not to revert.
    /// @param path An array of token addresses. path.length must be >= 2. Pools for each consecutive pair of addresses must exist and have liquidity.
    /// @param dexes An array of dex type values, specifying the exchanges to be used, e.g. CoFiX, Uniswap.
    /// @param to Recipient of the output tokens.
    /// @param  rewardTo The target address receiving the CoFi Token as rewards.
    /// @param deadline Unix timestamp after which the transaction will revert.
    /// @return amounts The input token amount and all subsequent output token amounts.
    function hybridSwapExactETHForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        DEX_TYPE[] calldata dexes,
        address to,
        address rewardTo,
        uint deadline
    ) external payable returns (uint[] memory amounts);

    /// @dev Swaps an exact amount of tokens for as much ETH as possible, along the route determined by the path. The first element of path is the input token, the last must be WETH, and any intermediate elements represent intermediate pairs to trade through (if, for example, a direct pair does not exist). If the to address is a smart contract, it must have the ability to receive ETH.
    /// @param amountIn The amount of input tokens to send.
    /// @param amountOutMin The minimum amount of output tokens that must be received for the transaction not to revert.
    /// @param path An array of token addresses. path.length must be >= 2. Pools for each consecutive pair of addresses must exist and have liquidity.
    /// @param dexes An array of dex type values, specifying the exchanges to be used, e.g. CoFiX, Uniswap.
    /// @param to Recipient of the output tokens.
    /// @param  rewardTo The target address receiving the CoFi Token as rewards.
    /// @param deadline Unix timestamp after which the transaction will revert.
    /// @return amounts The input token amount and all subsequent output token amounts.
    function hybridSwapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        DEX_TYPE[] calldata dexes,
        address to,
        address rewardTo,
        uint deadline
    ) external payable returns (uint[] memory amounts);

}
