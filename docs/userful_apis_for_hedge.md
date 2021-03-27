# Useful APIs for Hedge

Market makers provide liquidity to the CoFiX protocol for profits. It is possible that the initial assets supplied by the market maker may be traded for other assets and that the price will be volatile between the different assets. The market maker, therefore, needs to hedge based on the trading information on the chain.

There are two types of information that smart contracts can provide to address this need.

1. a market maker's share of the trading pool, the total share of the trading pool, and the number of assets in the trading pool in real-time.
2. real-time trading information for each pool.

## ABI

ABI files of smart contracts are required to interact with the contracts.

The ABI files for all CoFiX contracts are located in this directory:

- [https://github.com/Computable-Finance/CoFiX/tree/master/abi](https://github.com/Computable-Finance/CoFiX/tree/master/abi)

Those that may be used here include:

- [https://github.com/Computable-Finance/CoFiX/blob/master/abi/CoFiXPair.json](https://github.com/Computable-Finance/CoFiX/blob/master/abi/CoFiXPair.json)
- [https://github.com/Computable-Finance/CoFiX/blob/master/abi/ERC20.json](https://github.com/Computable-Finance/CoFiX/blob/master/abi/ERC20.json)

## Checking shares and trading pool funds

When a new trading pool is created, a new `CoFiXPair` contract is created. Each `CoFiXPair` contract is a pool of funds for a specific trading pair used to process the trading logic and hold the funds.

The `CoFiXPair` contract itself is also an ERC-20 Token, or Liquidity Token, the market maker's credential for providing liquidity in that pool.

The name of the `CoFiXPair` contract as a Token is XToken, abbreviated as XT, followed by the serial number. For example, the CoFiXPair contract corresponding to an ETH/USDT trading pair is XToken 1 (XT-1).

The share and trading pool funds refer to:

- The number of XToken owned at a market maker's address represents the number of shares he has in the trading pool. The total supply of XToken issued represents the total share of the trading pool.

- The balance of the token for the pair on the `CoFiXPair` contract address represents the trading pool's current volume of funds.

The following ERC20 standard interfaces are used to check shares and funds.

```js
function balanceOf(address owner) external view returns (uint);

function totalSupply() external view returns (uint);
```

Where, `balanceOf()` queries the balance of the token at `owner` address, and `totalSupply()` queries the token's total supply.

Take the ETH/USDT trading pair as an example. The corresponding `CoFiXPair` trading pool contract is `XToken`, the market maker address is `maker`. ETH in `CoFiXPair` is converted to `WETH` Token for processing. The basic interface of `WETH` Token is the same as ERC20 Token. The detailed query method is as follows.

```js
makerShare = XToken.balanceOf(maker)
totalSupply = XToken.totalSupply()
ethInPool = WETH.balanceOf(XToken)
usdtInPool = USDT.balanceOf(XToken)
```

- `makerShare` is the market maker's share of the trading pool.
- `totalSupply` is the total share of the trading pool.
- `ethInPool` is the quantity of ETH in the trading pool.
- `usdtInPool` is the quantity of USDT in the trading pool.

## Real-time trading information

One may need to monitor real-time transactions that happened on the chain, which can be listened to or queried via [Ethereum Event](https://media.consensys.net/technical-introduction-to-events-and-logs-in-ethereum-a074d65dd61e) off the chain.

The `CoFiXPair` contract has three types of related events, the `Mint` `Burn` `Swap`, which represents share subscription, redemption, and trade in that order.

```js
event Mint(address indexed sender, uint amount0, uint amount1);
event Burn(address indexed sender, address outToken, uint outAmount, address indexed to);
event Burn(address indexed sender, address outToken, uint outAmount, address indexed to);
event Swap(
    address indexed sender,
    uint amountIn,
    uint amountOut,
    address outToken,
    address indexed to
);
```

The `Mint` event is automatically triggered on subscription.

- `sender`: The caller, usually the `CoFiXRouter` contract
- `amount0`: Amount of WETH subscribed by the market maker
- `amount1`: The number of tokens subscribed by the market maker

The `Burn` event is automatically triggered on redemption.

- `sender`: The caller, usually the `CoFiXRouter` contract
- `outToken`: The address of the token to be redeemed
- `outAmount`: The number of tokens to be redeemed
- `to`: The address receiving the tokens redeemed

The `Swap` event is automatically triggered by trade.

- `sender`: The caller, usually the `CoFiXRouter` contract
- `amountIn`: The number of tokens transferred into the pool by the trader
- `amountOut`: The number of tokens transferred out of the pool to the trader
- `outToken`: The outgoing token address
- `to`: The address receiving the tokens swapped out

The following JSON RPC APIs can be used to query or watch/listen to events.

- [https://eth.wiki/json-rpc/API#eth_getlogs](https://eth.wiki/json-rpc/API#eth_getlogs)
- [https://eth.wiki/json-rpc/API#eth_getfilterlogs](https://eth.wiki/json-rpc/API#eth_getfilterlogs)
- [https://eth.wiki/json-rpc/API#eth_getfilterchanges](https://eth.wiki/json-rpc/API#eth_getfilterchanges)

Using the web3 SDK makes it more accessible.

- [https://web3js.readthedocs.io/en/v1.2.11/web3-eth-contract.html#events](https://web3js.readthedocs.io/en/v1.2.11/web3-eth-contract.html#events)
- [https://web3js.readthedocs.io/en/v1.2.11/web3-eth-subscribe.html#subscribe-logs](https://web3js.readthedocs.io/en/v1.2.11/web3-eth-subscribe.html#subscribe-logs)
