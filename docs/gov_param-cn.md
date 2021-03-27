# 合约中管理员可以设置的参数

**Abstract:** 本文档梳理合约中管理员能够设置的参数。

&emsp;
## 涉及合约列表

1. CoFiXV2Controller 合约函数
2. CoFiXV2Factory 合约函数
3. CoFiXV2VaultForCNode 合约函数
4. CoFiXV2VaultForLP 合约函数
5. CoFiXV2VaultForTrader 合约函数
6. V2CoFiStakingRewards 合约函数

&emsp;
&emsp;

### CoFiXV2Controller合约内管理员设置函数（参数）列表

1. `setGovernance()` 函数，修改管理员地址

    `governance`    // 管理员地址设置

2. `setTimespan()` 函数，设置出块时间

   `timespan`    // 出块时间


3. `setOracleDestructionAmount()` 


4. `setTLimit()`  设置交易最大延迟时间


5. `setK()` 函数，设置k值

6. `setTheta`函数，设置手续费比例

    `theta` // 佣金比例

7. `addCaller`函数，设置允许通过Controller查询价格的地址

&emsp;
&emsp;
### CoFiXV2Factory 合约内管理员设置函数（参数）列表

1. `setGovernance()` 函数，修改管理员地址
   `governance`    // 管理员地址设置


2. `setController` 设置 Controller 地址


3. `setFeeReceiver()` 函数，设置交易佣金接收地址
4. `setVaultForLP()` 函数，设置 CoFiXV2VaultForLP 地址
5. `setVaultForTrader()` 函数，设置 CoFiXV2VaultForTrader 地址
6. `setVaultForCNode()` 函数，设置 CoFiXV2VaultForCNode 地址
7. `setDAO()` 函数，设置 dao 地址
8. `setTradeMiningStatus()` 函数，设置交易挖矿开或关


&emsp;
&emsp;
###  CoFiXV2VaultForCNode 合约管理员设置函数（参数）列表

1. `setGovernance()` 函数，修改管理员地址
    `governance`    // 管理员地址设置


2. `setCNodePool()` 函数，设置节点池地址


3. `setInitCoFiRate()` 函数，设置节点初始出矿量


4. `setDecayPeriod()` 函数，设置衰减周期
5. `setDecayRate()` 函数，设置衰减系数

&emsp;
&emsp;

### CoFiXV2VaultForLP 合约管理员设置函数（参数）列表

1. `setGovernance()` 函数，修改管理员地址
   `governance`    // 管理员地址设置


2. `addPool()` 函数，添加流动性矿池
3. `enablePool()`函数，启用一个流动性矿池
4. `disablePool()`函数，禁用一个流动性矿池
5. `setPoolWeight()`函数，设置矿池出矿系数
6. `batchSetPoolWeight()`函数，批量设置矿池出矿系数
7. `setInitCoFiRate()` 函数，设置做市商初始出矿量
8. `setDecayPeriod()` 函数，设置衰减周期
9. `setDecayRate()` 函数，设置衰减率


&emsp;
&emsp;
### CoFiXV2VaultForTrader 合约管理员设置函数（参数）列表

1. `setGovernance()` 函数，修改管理员地址
   `governance`    // 管理员地址设置


2. `setTheta()` 函数，设置佣金比例


3. `setCofiRate()` 函数，设置对冲交易标准出矿量


4. `allowRouter()` 函数，设置能调用 distributeReward 函数的地址
5. `disallowRouter()` 函数，设置不能调用 distributeReward 函数的地址

&emsp;
###  V2CoFiStakingRewards 合约管理员设置函数（参数）列表

1. `setGovernance()` 函数，修改管理员地址
   `governance`    // 管理员地址设置


2. `setDividendShare()` 函数，设置分红比例
