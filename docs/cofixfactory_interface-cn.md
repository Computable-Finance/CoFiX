# CoFiXFactory 合约

**Abstract:** 本文档梳理 CoFiXFactory 合约接口函数

&emsp;


### `createPair`

**功能：** 创建一个 token 交易对

**函数:** `createPair(token, initToken0Amount, initToken1Amount)`

+ `token` ERC20 token 地址
+ `initToken0Amount` 初始资产比例 后项 eth 的值
+ `initToken1Amount` 初始资产比例 前项 token 的值

**权限:** 

1. 任何人均可调用

**参数要求:**
1. token 不能是零地址，token 之前没有创建过交易对
2. initToken0Amount 和 initToken1Amount 需大于 0

**返回值:**
1. 新创建的交易对地址

### `setController()`

**功能:** 设置 CoFiXController 合约地址

**调用时能否携带资金:** 否

**函数:** `setController(_new)`

   + `_new` 给定地址,新 CoFiXController 合约地址

**权限:** 

1. 仅 管理者 可以调用

**参数要求:**

1. 无要求

**返回值:**

1. 无返回值



### `setFeeReceiver()`

**功能:** 设置交易佣金接收地址

**调用时能否携带资金:** 否

**函数:** `setFeeReceiver(_new)`

   + `_new` 给定地址, 交易佣金接收地址，一般是 CoFiXStakingRewards 合约地址

**权限:** 

1. 仅 管理者 可以调用

**参数要求:**

1. 无要求

**返回值:**

1. 无返回值



### `setDAO()`

**功能:** 设置 CoFiXDAO 合约地址

**调用时能否携带资金:** 否

**函数:** `setDAO(_new)`

   + `_new` 给定地址, 新 CoFiXDAO 合约地址

**权限:** 

1. 仅 管理者 可以调用

**参数要求:**

1. 无要求

**返回值:**

1. 无返回值



### `setVaultForTrader()`

**功能:** 设置 CoFiXVaultForTrader 合约地址

**调用时能否携带资金:** 否

**函数:** `setVaultForTrader(_new)`

   + `_new` 给定地址,新 CoFiXVaultForTrader合约地址

**权限:** 

1. 仅 管理者 可以调用

**参数要求:**

1. 无要求

**返回值:**

1. 无返回值



### `setVaultForLP()`

**功能:** 设置 CoFiXVaultForLP 合约地址

**调用时能否携带资金:** 否

**函数:** `setVaultForLP(_new)`

   + `_new` 给定地址,新 CoFiXVaultForLP合约地址

**权限:** 

1. 仅 管理者 可以调用

**参数要求:**

1. 无要求

**返回值:**

1. 无返回值



### `setVaultForCNode()`

**功能:** 设置 CoFiXVaultForCNode合约地址

**调用时能否携带资金:** 否

**函数:** `setVaultForCNode(_new)`

   + `_new` 给定地址,新 CoFiXVaultForCNode合约地址

**权限:** 

1. 仅 管理者 可以调用

**参数要求:**

1. 无要求

**返回值:**

1. 无返回值