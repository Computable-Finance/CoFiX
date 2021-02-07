# CoFiXRouter 合约

**Abstract:** 本文档梳理 CoFiXRouter 合约接口函数，包括函数的功能、权限、 参数要求、返回值。

&emsp;

## 提供调用接口函数

### `addLiquidity()`

**功能：** 打入双边资产提供流动性，获取 XToken

**调用时能否携带资金:** 能

**函数：** `addLiquidity(token, amountETH, amountToken, liquidityMin, to, deadline)`

+ token LP提供的地址，指定为此token对应资产池提供流动性
+ amountETH 添加到资产池的 eth 数量
+ amountToken 添加到资产池的 token 数量
+ liquidityMin 期望获得的最小流动性份额
+ to 接收 XToken 的地址
+ deadline 请求的截止日期

**权限：**

1. 任何人均可调用

**参数要求：**

1. `token` 不能是零地址，有对应资产池
2. `amountETH` `amountToken` 必须满足初始资产比例(k0) , 即 `k0 = amountToken / amountETH`。

**返回值:**

1. 返回获得的 XToken 数量

### `addLiquidityAndStake()`

**功能：** 打入双边资产提供流动性，获取 XToken，并将 XToken 存入 CoFiXStakingRewards 合约参与流动性挖矿

**调用时能否携带资金:** 能

**函数：** `addLiquidityAndStake(token, amountETH, amountToken, liquidityMin, to, deadline)`

+ token LP提供的地址，指定为此token对应资产池提供流动性
+ amountETH 添加到资产池的 eth 数量
+ amountToken 添加到资产池的 token 数量
+ liquidityMin 期望获得的最小流动性份额
+ to 接收 XToken 的地址
+ deadline 请求的截止日期

**权限：**

1. 任何人均可调用

**参数要求：**

1. `token` 不能是零地址，有对应资产池
2. `amountETH` `amountToken` 必须满足初始资产比例(k0) , 即 `k0 = amountToken / amountETH`。

**返回值:**

1. 返回获得的 XToken 数量

### `removeLiquidityGetTokenAndETH()`

**功能：** 移除流动性，取回 eth 和 token

**调用时能否携带资金:** 能

**函数：** `removeLiquidityGetTokenAndETH(token, liquidity, amountETHMin, to, deadline)`

+ token LP提供的地址，指定从此token对应资产池移除流动性
+ liquidity 移除的流动性，XToken 数量
+ amountETHMin 期望获得的最小 eth 数量
+ to 接收买入的 Token的地址
+ deadline 请求的截止日期

**权限：**

1. 任何人均可调用

**参数要求：**

1. `token` 不能是零地址，有对应资产池
2. `amountETH` `amountToken` 必须满足初始资产比例(k0) , 即 `k0 = amountToken / amountETH`。

**返回值:**

1. amountToken 返回获得的 token 数量
2. amountETH 返回获得的 eth 数量

### `swapExactETHForTokens()`

**功能：** 交易用户使用一定数量的 eth 换出 token

**调用时能否携带资金:** 能

**函数：** `swapExactETHForTokens(token, amountIn, amountOutMin, to, rewardTo, deadline)`

+ token token地址，指定从此token对应资产池交易
+ amountIn 参与交换的一定数量的 eth
+ amountOutMin 期望交换出最小 token 数量
+ to 接收买入的 Token 的地址
+ rewardTo 接收 CoFi 奖励的地址
+ deadline 请求的截止日期

**权限：**

1. 任何人均可调用

**参数要求：**

1. `token` 不能是零地址，有对应资产池
2. `rewardTo` 不能是零地址，不然获取不到对冲挖矿奖励

**返回值:**

1. _amountIn 返回卖出的 eth 数量
2. _amountOut 返回买入的 token 数量

### `swapExactTokensForETH()`

**功能：** 交易用户使用一定数量的 token 换出 eth

**调用时能否携带资金:** 能

**函数：** `swapExactTokensForETH(token, amountIn, amountOutMin, to, rewardTo, deadline)`

+ token token地址，指定从此token对应资产池交易
+ amountIn 参与交换的一定数量的 token
+ amountOutMin 期望交换出最小 eth 数量
+ to 接收买入的 Token 的地址
+ rewardTo 接收 CoFi 奖励的地址
+ deadline 请求的截止日期

**权限：**

1. 任何人均可调用

**参数要求：**

1. `token` 不能是零地址，有对应资产池
2. `rewardTo` 不能是零地址，不然获取不到对冲挖矿奖励

**返回值:**

1. _amountIn 返回卖出的 token 数量
2. _amountOut 返回买入的 eth 数量

### `swapExactTokensForTokens()`

**功能：** 交易用户使用一定数量的 token 换出其他 token

**调用时能否携带资金:** 能

**函数：** `swapExactTokensForTokens(tokenIn, tokenOut, amountIn, amountOutMin, to, rewardTo, deadline)`

+ tokenIn 交易用户向交易池卖出的 token 地址
+ tokenOut 交易用户从交易池买出的 token 地址
+ amountIn 参与交换的一定数量的 token
+ amountOutMin 期望交换出最小 token 数量
+ to 接收买入的 Token 的地址
+ rewardTo 接收 CoFi 奖励的地址
+ deadline 请求的截止日期

**权限：**

1. 任何人均可调用

**参数要求：**

1. `token` 不能是零地址，有对应资产池
2. `rewardTo` 不能是零地址，不然获取不到对冲挖矿奖励

**返回值:**

1. _amountIn 返回卖出的 token 数量
2. _amountOut 返回买入的 token 数量

### `hybridSwapExactTokensForTokens()`

**功能：** 根据 path 数组，将准确数量的输入 token 交换为尽可能多的输出 token 。path 数组的第一个元素是输入 token 地址，最后一个是输出 token 地址，任何中间元素都表示要交换的中间交易对。交易通过 cofix 或 uniswap 来进行。

**调用时能否携带资金:** 能

**函数：** `hybridSwapExactTokensForTokens(amountIn, amountOutMin, path, dexes, to, rewardTo, deadline)`

+ amountIn 卖出的一定数量的 token
+ amountOutMin 期望买入的最小 token 数量
+ path 一个 token 地址数组，数组长度必须大于等于2
+ dexes  去中心化交易所类型数组，指定使用哪个交易所交易，比如：CoFiX, Uniswap
+ to 接收买入的 Token 的地址
+ rewardTo 接收 CoFi 奖励的地址
+ deadline 请求的截止日期

**权限：**

1. 任何人均可调用

**参数要求：**

1. `path` 数组长度必须大于等于2
2. `dexs` 数组长度必须等于 pair 的长度减1

**返回值:**

1. amounts 返回输入的 token 数量和所有后续的输出 token 数量

### `hybridSwapExactETHForTokens()`

**功能：** 根据 path 数组，将准确数量的 eth 交换为尽可能多的输出 token 。path 数组的第一个元素是WETH 地址，最后一个是输出 token 地址，任何中间元素都表示要交换的中间交易对。

**调用时能否携带资金:** 能

**函数：** `hybridSwapExactETHForTokens(amountIn, amountOutMin, path, dexes, to, rewardTo, deadline)`

+ amountIn 卖出的一定数量的 token
+ amountOutMin 期望买入的最小 token 数量
+ path 一个 token 地址数组，数组长度必须大于等于2
+ dexes  去中心化交易所类型数组，指定使用哪个交易所交易，比如：CoFiX, Uniswap
+ to 接收买入的 Token 的地址
+ rewardTo 接收 CoFi 奖励的地址
+ deadline 请求的截止日期

**权限：**

1. 任何人均可调用

**参数要求：**

1. `path` 数组长度必须大于等于2
2. `dexs` 数组长度必须等于 pair 的长度减1

**返回值:**

1. amounts 返回输入的 token 数量和所有后续的输出 token 数量

### `hybridSwapExactTokensForETH()`

**功能：** 根据 path 数组，将准确数量的 token 交换为尽可能多的 eth。path 数组的第一个元素是输入 token 地址，最后一个是 WETH 地址，任何中间元素斗都表示要交换的中间交易对。

**调用时能否携带资金:** 能

**函数：** `hybridSwapExactTokensForETH(amountIn, amountOutMin, path, dexes, to, rewardTo, deadline)`

+ amountIn 卖出的一定数量的 token
+ amountOutMin 期望买入的最小 token 数量
+ path 一个 token 地址数组，数组长度必须大于等于2
+ dexes  去中心化交易所类型数组，指定使用哪个交易所交易，比如：CoFiX, Uniswap
+ to 接收买入的 Token 的地址
+ rewardTo 接收 CoFi 奖励的地址
+ deadline 请求的截止日期

**权限：**

1. 任何人均可调用

**参数要求：**

1. `path` 数组长度必须大于等于2
2. `dexs` 数组长度必须等于 pair 的长度减1
3. `to` 如果to是合约地址，则该合约必须能接收 eth

**返回值:**

1. amounts 返回输入的 token 数量和所有后续的输出 token 数量
