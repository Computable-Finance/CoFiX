# Steps to migrate from v1 to v2

## Close trade mining

```shell
factory = await CoFiXFactory.at("0x66C64ecC3A6014733325a8f2EBEE46B4CA3ED550")
# set trade mining status to false
usdt = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
hbtc = "0x0316EB71485b0Ab14103307bf65a021042c6d380"
# USDT
await factory.setTradeMiningStatus(usdt, false)
# HBTC
await factory.setTradeMiningStatus(hbtc, false)
# validate
usdtPairMiningStatus = await factory.getTradeMiningStatus(usdt)
hbtcPairMiningStatus = await factory.getTradeMiningStatus(hbtc)
console.log(`usdtPairMiningStatus=${usdtPairMiningStatus}, hbtcPairMiningStatus=${hbtcPairMiningStatus}`);
```

## Close liquidity mining

```shell
vaultForLP = await CoFiXVaultForLP.at("0x6903b1C17A5A0A9484c7346E5c0956027A713fCF")
# set cofi rate to 0
await vaultForLP.setInitCoFiRate(0)
# validate
cofiRate = await valutForLP.initCoFiRate()
console.log(`cofiRate=${cofiRate}`);
```

## Close CNode mining

```shell
vaultForCNode = await CoFiXVaultForCNode.at("0x7eDa8251aC08E7898E986DbeC4Ba97B421d545DD")
# set cofi rate to 0
await vaultForCNode.setInitCoFiRate(0)
# validate
cofiRate = await vaultForCNode.initCoFiRate()
console.log(`cofiRate=${cofiRate}`);
```

## Withdraw saving to CoFiXDAO

```shell
StakingRewards = await CoFiStakingRewards.at("0x0061c52768378b84306b2665f098c3e0b2C03308")
savingAmount = await StakingRewards.pendingSavingAmount()
# withdraw saving to feeReceiver(CoFiXDAO) by gov
feeReceiver = "CoFiXDAO address"
await StakingRewards.withdrawSavingByGov(feeReceiver, savingAmount)
# validate
daoEthBalance = await CDAO.totalETHRewards();
console.log(`daoEthBalance=${daoEthBalance}`);
```

