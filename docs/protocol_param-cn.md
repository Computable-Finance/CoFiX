# 协议参数

**Abstract:** 本文档梳理合约中与协议相关的参数。

&emsp;
## 涉及合约列表

1. CoFiXV2Controller 合约
2. CoFiXV2DAO 合约
3. CoFiXV2VaultForCNode 合约
4. CoFiXV2VaultForLP 合约
5. CoFiXV2VaultForTrader 合约
6. V2CoFiStakingRewards 合约
7. CoFiXV2Pair 合约

&emsp;
&emsp;

### CoFiXV2Controller 合约内协议参数列表

1. ` K_ALPHA = 2600; // α=2.6e-05*1e8`   参与k值计算
2. ``K_BETA = 1020500000; // β=10.205*1e8`` 参与k值计算
3. `T = 600;`   交易最大延迟时间


4. `K_EXPECTED_VALUE = 0.005*1E8`  默认k值


5. `C_BUYIN_ALPHA = 25700000000000; // α=2.570e-05*1e18 `参与冲击成本计算
6. `C_BUYIN_BETA = 854200000000; // β=8.542e-07*1e18 `参与冲击成本计算
7. `C_SELLOUT_ALPHA = 117100000000000; // α=-1.171e-04*1e18` 参与冲击成本计算
8. ``C_SELLOUT_BETA = 838600000000; // β=8.386e-07*1e18`` 参与冲击成本计算
9. ``PRICE_DEVIATION = 10; // price deviation < 10%`` 价格偏离系数
10. ``timespan = 14`` 出块时间

&emsp;
&emsp;

### CoFiXV2DAO 合约内协议参数列表

1. ``DAO_REPURCHASE_PRICE_DEVIATION = 5 // price deviation < 5% ``  回购价格偏离系数


&emsp;
&emsp;
###  CoFiXV2VaultForCNode 合约协议参数列表

1. `initCoFiRate = 0.5*1e18;`  节点初始出矿量


2. `decayPeriod = 2400000;` 出矿衰减周期


3. `decayRate = 80;`  出矿衰减系数

&emsp;
&emsp;

### CoFiXV2VaultForLP 合约协议参数列表

1. `initCoFiRate = 4.5*1e18;`  节点初始出矿量


2. `decayPeriod = 2400000;` 出矿衰减周期


3. `decayRate = 80;`  出矿衰减系数


&emsp;
&emsp;
### CoFiXV2VaultForTrader 合约协议参数列表

1. `SHARE_FOR_TRADER = 90`  对冲挖矿奖励交易者所分得比例


2. `SHARE_FOR_CNODE` 对冲挖矿奖励节点所分得比例


3. `cofiRate` 对冲交易标准出矿量

&emsp;
###  V2CoFiStakingRewards 合约协议参数列表

1. `dividendShare = 20`  cofi 持有者所获分红比例
