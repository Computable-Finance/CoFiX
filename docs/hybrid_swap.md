# Introduction to Hybrid Swap APIs

We provide users with hybrid swap features for swaping tokens via different DEXes, e.g. via CoFiX and Uniswap.

## Interfaces

The three related interfaces are shown below. [CoFiXRouter02](../contracts/interface/ICoFiXRouter02.sol) provides these functions.

- `hybridSwapExactTokensForTokens`
- `hybridSwapExactETHForTokens`
- `hybridSwapExactTokensForETH`

```js
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
```

The interface of these functions is basically the same as [uniswap](https://uniswap.org/docs/v2/smart-contracts/router01/). We have added a new parameter `dexes`, to specify through which exchange the swap is executed.

## Examples

If we wish to exchange USDT for NEST, we can first exchange USDT for ETH via CoFiX and then exchange ETH for NEST via Uniswap.

```js
    // hybrid swap (CoFiX: USDT -> ETH, Uniswap: ETH -> NEST)
    const path = [usdt, weth, nest];
    const dexes = [DEX_TYPE_COFIX, DEX_TYPE_UNISWAP]; // [0, 1]
    await CRouter.hybridSwapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        dexes,
        to,
        rewardTo,
        deadline,
        {value: oracleFee, from: deployer}
    );
```

More examples can be found in the [test cases](../test/CoFiXRouter02.test.js).

## Notes

1. To simplify the processing of NEST oracle fees, the hybrid swap interfaces currently do not perform oracle fee refunds in the contract. In order to prevent the user's ETH from being locked in the router contract, a strict check has been added to the contract that the amount of the oracle fee is equal to the actual amount used. For example, if the CoFiX swap is used once, then the oracle fee paid must be 0.01 ETH.

2. The swap `path` needs to be pre-calculated outside of the contract.

3. The `isCoFiXNativeSupported` interface can be used to determine whether two tokens can be exchanged via CoFiX.

    ```js
        function isCoFiXNativeSupported(address input, address output) public view returns (bool supported, address pair) {
            // NO WETH included
            if (input != WETH && output != WETH)
                return (false, pair);
            if (input != WETH) {
                pair = pairFor(factory, input);
            } else if (output != WETH) {
                pair = pairFor(factory, output);
            }
            // if tokenIn & tokenOut are both WETH, then the pair is zero
            if (pair != address(0)) // TODO: add check for reserves
                supported = true;
            return (supported, pair);
        }
    ```

4. The `amountOutMin` parameter needs to be calculated in conjunction with the specific path, the price of the token in the nest price oracle, and Uniswap pool state.

## Example Transactions

### CoFiX: USDT -> WETH, Uniswap: WETH -> NEST

```js
router.hybridSwapExactTokensForTokens(100000000, 0, [usdt.address, weth.address, nest.address], [0, 1], to, rewardTo, 99999999999, {value: web3.utils.toWei("0.01", "ether")})
```

[0xb15231f5260765224c9e6bd640f92f386ec2969a7895eb98f0e1156ba85e1dc3](https://ropsten.etherscan.io/tx/0xb15231f5260765224c9e6bd640f92f386ec2969a7895eb98f0e1156ba85e1dc3)

### Uniswap: NEST -> WETH, CoFiX: WETH -> USDT

```js
router.hybridSwapExactTokensForTokens("3000000000000000000000", 0, [nest.address, weth.address, usdt.address], [1, 0], to, rewardTo, 99999999999, {value: web3.utils.toWei("0.01", "ether")})
```

[0xce550eaf6f050cf62b1430d53758f11a81f7ab5fe7824b394ed790bacb34f5dd](https://ropsten.etherscan.io/tx/0xce550eaf6f050cf62b1430d53758f11a81f7ab5fe7824b394ed790bacb34f5dd)

### Uniswap: NEST -> WETH

```js
router.hybridSwapExactTokensForTokens("3000000000000000000000", 0, [nest.address, weth.address], [1], to, rewardTo, 99999999999, {value: 0})
```

[0x87a50d39ee97a376e6def19024ad39e492a270a4a14518b946f1b25f7fa748cc](https://ropsten.etherscan.io/tx/0x87a50d39ee97a376e6def19024ad39e492a270a4a14518b946f1b25f7fa748cc)

### CoFiX: USDT -> WETH, Uniswap: WETH -> MPH

```js
router.hybridSwapExactTokensForTokens(500000000, 0, [usdt.address, weth.address, mph], [0, 1], to, rewardTo, 99999999999, {value: web3.utils.toWei("0.01", "ether")})
```

[0xa3c956a29b5a7ce299116a46534db4f11df1e37e7d8514026d3ad3bcb1de1d38](https://etherscan.io/tx/0xa3c956a29b5a7ce299116a46534db4f11df1e37e7d8514026d3ad3bcb1de1d38)
## Deployment

- mainnet 0x5C35BaDebD40308e409df891aC56d17C8625c2bC
- ropsten 0xAdD27c75b7B003cc791E4062e20f9Eb872FafC65