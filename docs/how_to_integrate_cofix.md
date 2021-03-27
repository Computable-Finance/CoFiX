# How to Integrate with CoFiX

***Note: Some of the Nest-related content may be out of date, as NEST v3.5 has changed some interfaces compared to NEST v3.0.***


CoFiX uses the NEST Protocol as the price oracle. The unique design of the NEST makes integrating CoFiX a little different from regular DeFi projects. Here's how to integrate CoFiX Smart Contracts in detail.

## Main Contracts

![CoFiX Smart Contract](./cofix-smart-contract.svg)

### Introduction to Main Contracts

The main contracts associated with integrating CoFiX core functionality are:

- [CoFiXRouter](https://github.com/Computable-Finance/CoFiX/blob/master/contracts/CoFiXRouter.sol) ➡️ Router contract to interact with each CoFiXPair
- [CoFiXController](https://github.com/Computable-Finance/CoFiX/blob/master/contracts/CoFiXController.sol) ➡️ Controller contract to call NEST Oracle for prices and compute K values
- [CoFiXPair](https://github.com/Computable-Finance/CoFiX/blob/master/contracts/CoFiXPair.sol) ➡️ Pair contract for each trader pair, storing assets and handling settlement

Key external smart contracts of NEST are:

- [Nest_3_VoteFactory](https://github.com/NEST-Protocol/NEST-oracle-V3/blob/master/VoteContract/Nest_3_VoteFactory.sol) ➡️ NEST vote factory contract, acting as DAO and storing necessary contract address mappings
- [Nest_3_OfferPrice](https://github.com/NEST-Protocol/NEST-oracle-V3/blob/master/NestOffer/Nest_3_OfferPrice.sol) ➡️ NEST Price Oracle for offering the latest on-chain price

### Key Interfaces

Key contract interfaces and parameters.

- [ICoFiXRouter.sol](https://github.com/Computable-Finance/CoFiX/blob/master/contracts/interface/ICoFiXRouter.sol)
- [ICoFiXPair.sol](https://github.com/Computable-Finance/CoFiX/blob/master/contracts/interface/ICoFiXPair.sol)
- [ICoFiXController.sol](https://github.com/Computable-Finance/CoFiX/blob/master/contracts/interface/ICoFiXController.sol)

ABI files:

[https://github.com/Computable-Finance/CoFiX/tree/master/abi](https://github.com/Computable-Finance/CoFiX/tree/master/abi)

### Contract Addresses

- [Lastest release on mainnet](https://github.com/Computable-Finance/CoFiX#-release-)
- [Latest v0.9.5 on ropsten testnet](https://github.com/Computable-Finance/CoFiX#beta-v095)

## How to Calculate Prices and Execute Swaps

### Get Prices from NEST Oracle

*Note: CoFiX integrates NEST v3.5 currently. Check the next section [Get Latest Price and Calculate Accurate K Value (Updates on NEST v3.5)] to get latest price of some token.*

CoFiX uses paid NEST price oracle as a price source for trading.

*Smart Contract Interface*:

```solidity
function checkPriceNow(address tokenAddress) public view returns (uint256 ethAmount, uint256 erc20Amount, uint256 blockNum) {
    require(address(msg.sender) == address(tx.origin), "It can't be a contract");
    ...
}
```

There is only one free read-only API called [`checkPriceNow`](https://github.com/NEST-Protocol/NEST-Oracle-V3/blob/8f69c2982e7a0721ca6110f51f4f58e312188d25/NestOffer/Nest_3_OfferPrice.sol#L228-L242) in NEST, which blocks calls from external smart contracts. So we could not estimate the trading price directly from CoFiX.

The users and the clients need to check the latest price from NEST oracle themselves and calculate the trading output amounts based on the latest price.

The address of the NEST price oracle may change. It is recommended to look up the latest address from the `Nest_3_VoteFactory` contract.

*Examples*:

```js
const oracle = await Nest_3_VoteFactory.checkAddress("nest.v3.offerPrice");
```

```js
const price = await Nest_3_OfferPrice.checkPriceNow(token);
```

The input `token` is the address of the target token. The return values `uint256 ethAmount, uint256 erc20Amount, uint256 blockNum` represent the assets price in NEST protocol, which represents the ETH quantity, token quantity, and the height of the block where the price is valid.

Take the ETH/USDT trading pair as an example.

```js
[ checkPriceNow method Response ]
  ethAmount uint256 : 30000000000000000000
  erc20Amount uint256 : 13403100000
  blockNum uint256 : 11229587
```

The above response represents 30 ETH equal to the value of 13,403.1 USDT.

For a more detailed description of smart contracts integration to the NEST protocol, please refer to the [NEST Oracle Documentation](https://github.com/NEST-Protocol/NEST-oracle-V3/blob/master/NestOffer/README.md).

### NEST Oracle Usage Cost

The NEST price oracle currently costs 0.01 Ether per call. For trades between the ETH and any ERC20 tokens, the NEST oracle is only queried once per trade, thus costing 0.01 Ether.

For ETH/USDT or ETH/HBTC pairs, the oracle usage cost is 0.01 Ether, and for HBTC/USDT trades, the cost is 0.02 Ether.

### K and Theta Values

Compensation factor K is the coefficient related to the volatility rate δ and delay T. The theta is the extra transaction fee rate.

K and theta values are used to calculate the final price. More details can be found at [https://github.com/Computable-Finance/Doc/blob/master/README.md#32-price-compensation-coefficient-k](https://github.com/Computable-Finance/Doc/blob/master/README.md#32-price-compensation-coefficient-k).

The [`getKInfo()`](https://github.com/Computable-Finance/CoFiX/blob/9306e6ea157358dbcd1493d72e8720a8ef62748b/contracts/CoFiXController.sol#L276) function in the CoFiXController contract can be used to query the latest cached K and theta for a specific token.

*Smart Contract Interface*:

```solidity
function getKInfo(address token) external view returns (uint32 k, uint32 updatedAt, uint32 theta)
```

*Examples*:

```js
const K_BASE = 1e8;
const THETA_BASE = 1e8;
const kInfo = CoFiXController.getKInfo(token); const THETA_BASE = 1e8;
const kInfo = CoFiXController.getKInfo(token)
// e.g. (k=250000, updatedAt=1604927915, theta=200000)
```

*Note: CoFiX integrates NEST v3.5 currently. Check the next section [Get Latest Price and Calculate Accurate K Value (Updates on NEST v3.5)] to calculate accurate K value.*

The result is multiplied by a factor `1e8` o support decimal representation. So`k=250000` `theta=200000`, representing K as 0.0025 and theta as 0.002. They are also the current default value for all pairs. These values may be dynamically calculated and adjusted in the future, so it is recommended to query them using the method above.

### Get Latest Price and Calculate Accurate K Value (Updates on NEST v3.5)

#### Get latestPrice and volatility

*Query Price from NEST Oracle 3.5 For Free (web/non-contract).*

NEST v3.5 provides new API for querying the latest price and volatility of recent prices.

Check [INestQuery](https://github.com/NEST-Protocol/NEST-Oracle-V3.5/blob/c3272bae356f9904bcf426bb8a5e394768b48d12/contracts/iface/INestQuery.sol#L63-L66) interface.

*INestQuery::latestPrice interface*:

```js
    /// @notice A view function returning the latestPrice
    /// @param token  The address of the token contract
    function latestPrice(address token)
    external view returns (uint256 ethAmount, uint256 tokenAmount, uint128 avgPrice, int128 vola, uint256 bn);
```

- *ethAmount*: The amount of ETH in pair (ETH, TOKEN)
- *tokenAmount*: The amount of TOKEN in pair (ETH, TOKEN)
- *avgPrice*: The average of last 50 prices
- *vola*: The volatility of prices
- *bn*: The block number when (ETH, TOKEN) takes into effective

NestQuery Contract on mainnet [0x3bf046c114385357838D9cAE9509C6fBBfE306d2](https://etherscan.io/address/0x3bf046c114385357838D9cAE9509C6fBBfE306d2)

#### Calculate accurate K value

The original `getKInfo` interface is used to get the constant K value or the cached K value. NEST v3.5 provides the latest volatility of recent prices for each token. So we can calculate the accurate K value directly according to the volatility value.

However, due to the design of the nest, there is no way to read price and volatility information directly into the contract for free.

To simplify the external calculation, CoFiXController03 provides a query interface for the front-end to calculate K value. One can get the volatility `vola` and effective block number `bn` from `NestQuery::latestPrice()` and pass them to the `CoFiXController03::calcK()` interface to calculate latest accurate K value.

*CoFiXController03::calcK interface*:

```js
   /**
    * @notice Calc K value
    * @param vola The volatility of prices
    * @param bn The block number when (ETH, TOKEN) price takes into effective
    * @return k The K value
    */
    function calcK(int128 vola, uint256 bn) external view returns (uint32 k)
```

*Examples*:

```js
const token = USDT; // or HBTC
const p = await NestQuery.latestPrice(token);
// [ latestPrice method Response ]
//   ethAmount   uint256 :  30000000000000000000
//   tokenAmount   uint256 :  39714300000
//   avgPrice   uint128 :  1334454001
//   vola   int128 :  8618535544881214
//   bn   uint256 :  11696577
const K = await CoFiXController03.calcK(p.vola, p.bn);
// [ calcK method Response ]
//   k   uint32 :  848824
// k: 848824, means 848824/1e8=0.00848824
```

The result is multiplied by a factor `1e8` o support decimal representation. So`k=250000`, representing K as 0.0025.

Note: Due to the use of dynamic K values, a protection condition can be triggered [in some cases](https://github.com/Computable-Finance/Doc#62-circuit-breakers). In this case, swap cannot be executed. The calcK interface may report the following errors.

- `CKTable: sigmaIdx must < 20`
- `CKTable: tIdx must < 91`

### Impact Costs

To reduce the impact of large individual trades on market maker hedging costs, CoFiX introduces impact costs. That is, it will increase the cost of large trades. Specific calculation rules can be found in:

- [https://github.com/Computable-Finance/Doc/blob/master/README.md#share-redemption-price-impact](https://github.com/Computable-Finance/Doc/blob/master/README.md#share-redemption-price-impact)

- [https://github.com/Computable-Finance/Doc/blob/master/README.md#trading-price-impact](https://github.com/Computable-Finance/Doc/blob/master/README.md#trading-price-impact)

The current impact cost is 0 for trading volumes less than 500 ETH. Otherwise, it is estimated using a simple linear formula. The contract provides [`calcImpactCostFor_SWAP_WITH_EXACT`](https://github.com/Computable-Finance/CoFiX/blob/master/contracts/CoFiXController.sol#L154) interface in CoFiXController is used to calculate the impact cost.

*Smart Contract Interface*:

```solidity
function calcImpactCostFor_SWAP_WITH_EXACT(address token, bytes memory data, uint256 ethAmount, uint256 erc20Amount) public pure returns (uint256 impactCost)
```

*Examples*:

```js
const token = USDT; // or HBTC
const price = await Nest_3_OfferPrice.checkPriceNow(token);
// e.g. ethAmount: 30000000000000000000, erc20Amount: 13403100000
const ethAmount = price.ethAmount; // ETH
const erc20Amount = price.erc20Amount; // e.g. USDT
const zeroAddress = "0x0000000000000000000000000000000000000000" // enough for impact cost function
const outToken = WETH; // swap USDT for ETH
const amountIn = (223385000000).toString(); // amountIn is USDT in this example
const data = web3.eth.abi.encodeParameters(['address', 'address', 'address', 'uint256'], [zeroAddress, WETH, zeroAddress, amountIn]);
const c = await CoFiXController.calcImpactCostFor_SWAP_WITH_EXACT(token, data, ethAmount, erc20Amount)
// c: 45280, means 45280/1e8=0.0004528
```

The user converts 223,385 USDT to ETH at a price shown in the example. The above interface is used to calculate the impact cost `c` of the transaction. The resulting `c` is added to K as the final K value.

### Estimated Trade Results

Estimating trade results depends on the current latest price, K, theta, and the impact cost `c`. The method of obtaining these parameters has already been mentioned earlier.

Estimation of trade results is possible through the `calcOutToken0` `calcOutToken1` interface of the CoFiXPair contract.

*Smart Contract Interface*:

```solidity
struct OraclePrice {
    uint256 ethAmount;
    uint256 erc20Amount;
    uint256 blockNum;
    uint256 K;
    uint256 theta;
}

// get estimated amountOut for token0 (WETH) when swapWithExact
function calcOutToken0(uint256 amountIn, OraclePrice memory _op) public pure returns (uint256 amountOut, uint256 fee)

// get estimated amountOut for token1 (ERC20 token) when swapWithExact
function calcOutToken1(uint256 amountIn, OraclePrice memory _op) public pure returns (uint256 amountOut, uint256 fee)
```

*Examples*:

```js
const token = USDT; // or HBTC
const price = await Nest_3_OfferPrice.checkPriceNow(token);
const kInfo = CoFiXController.getKInfo(token);
let p = {
    ethAmount: "30000000000000000000", // price.ethAmount
    erc20Amount: "13403100000", // price.erc20Amount
    blockNum: "0", // 0 is ok
    K: "250000", // kInfo.k + c (impact cost)
    theta: "200000", // kInfo.theta
};
const amountInUSDT = "223385000000"; // USDT amount
await usdtPair.calcOutToken0(amountInUSDT, p); // swap USDT for ETH
// amountOut (ETH): 497755610972568578553, fee (ETH): 997506234413965087
const amountInETH = (500*1e18).toString();
await usdtPair.calcOutToken1(amountInETH, p); // swap ETH for USDT
// amountOut (USDT): 222380884425, fee (ETH): 1000000000000000000
```

### Execute Swaps

The CoFiXRouter contract provides interfaces [to execute swaps](https://github.com/Computable-Finance/CoFiX/blob/master/contracts/interface/ICoFiXRouter.sol).

*Smart Contract Interface*:

```solidity
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
```

The above interfaces are similar to Uniswap. Note the handling of oracle fees, and the `rewardTo` address is used for receiving mining rewards [CoFi](https://etherscan.io/token/0x1a23a6BfBAdB59fa563008c0fB7cf96dfCF34Ea1).

Note: swapETHForExactTokens and swapTokensForExactETH are for experimental purposes only. Please do not use them.

*Examples*:

```js
// swapExactETHForTokens
// - address token,
// - uint amountIn,
// - uint amountOutMin,
// - address to,
// - address rewardTo,
// - uint deadline
_amountIn = web3.utils.toWei('1', 'ether');
_msgValue = web3.utils.toWei('1.01', 'ether'); // msg.value = amountIn + oracle fee
await CRouter.swapExactETHForTokens(USDT.address, _amountIn, 0, trader, trader, "99999999999", { from: trader, value: _msgValue });
```

### Maximum Transaction Volume Limit

The maximum trading volume for each pair is limited by the number of target assets remaining in the pool. This can be accessed through the [`getReserves` interface](https://github.com/Computable-Finance/CoFiX/blob/master/contracts/CoFiXPair.sol#L71) of the CoFiXPair contract.

*Smart Contract Interface*:

```solidity
function getReserves() public override view returns (uint112 _reserve0, uint112 _reserve1)
```

Where `_reserve0` represents the amount of WETH in the pool, and `_reserve1` represents the amount of another trading asset, such as USDT or HBTC.

## Other Useful Information

### Currently Supported Trading Pairs

- ETH/USDT Pair (XT-1) [0xb2b7BeDd7d7fc19804C7Dd4a4E8174C4c73C210d](https://etherscan.io/address/0xb2b7BeDd7d7fc19804C7Dd4a4E8174C4c73C210d)

- ETH/HBTC Pair (XT-2) [0x7C2d7b53AcA4038f2Eb649164181114B9AEE93CB](https://etherscan.io/address/0x7C2d7b53AcA4038f2Eb649164181114B9AEE93CB)

ETH is currently included in all trading pairs.

### Querying the Address of a Supported Trading Pair

The `getPair` interface of the CoFiXFactory can be used to query the pair's address to which a token corresponds.

*Examples*:

```js
const token = USDT;
const usdtPair = await CoFiXFactory.getPair(token);
// usdtPair: 0xb2b7BeDd7d7fc19804C7Dd4a4E8174C4c73C210d
```

### More Documentations

- CoFiX Product Documentation [https://github.com/Computable-Finance/Doc](https://github.com/Computable-Finance/Doc)
- White Paper [https://cofix.io/doc/CoFiX_White_Paper.pdf](https://cofix.io/doc/CoFiX_White_Paper.pdf)
- Trading Compensation of CoFiX [https://cofix.io/doc/Trading_Compensation_CoFiX.pdf](https://cofix.io/doc/Trading_Compensation_CoFiX.pdf)

### More Examples

More examples of interacting with contracts are included in [https://github.com/Computable-Finance/CoFiX/blob/master/test/CoFiX.test.js](https://github.com/Computable-Finance/CoFiX/blob/master/test/CoFiX.test.js).
