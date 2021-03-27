# Steps to change vaults

- CoFiXVaultForLP
- CoFiXVaultForTrader
- CoFiXVaultForCNode

## CoFiXVaultForLP Examples

```shell
cofi = await CoFiToken.at("0xE68976a81572B185899205C7b8BCBD1515DF4f5b")
factory = await CoFiXFactory.at("0xC85987c73300CFd1838da40F0A4b29bB64EAed8e")
vaultForLP = await CoFiXVaultForLP.new(cofi.address, factory.address)
# vaultForLP.address 0x7e6dCD3581d596fe5F628B77fd6784F10D09b43d
# add pools
usdtPool = "0xA3904574E4Fbf7592B3A3c1439cAe97D5622FBFD"
hbtcPool = "0xe6c3bd6D258cE7fc7554723fc2b93F848CEF30E7"
vaultForLP.addPool(usdtPool)
vaultForLP.addPool(hbtcPool)
# set pool weights
vaultForLP.batchSetPoolWeight([usdtPool, hbtcPool], ["50", "50"])
# check pool info
vaultForLP.getPoolInfo(usdtPool)
vaultForLP.getPoolInfo(hbtcPool)
usdt = "0x200506568C2980B4943B5EaA8713A5740eb2c98A"
hbtc = "0xA674f71ce49CE7F298aea2F23D918d114965eb40"
vaultForLP.getPoolInfoByPair(usdt)
vaultForLP.getPoolInfoByPair(hbtc)
# CoFi set minter
cofi.addMinter(vaultForLP.address)
# set vaultForLP in factory
factory.setVaultForLP(vaultForLP.address)
# validate
pool = await CoFiXStakingRewards.at(usdtPool)
(await pool.accrued()).toString()
(await pool.rewardRate()).toString()
# remove old vaultForLP from CoFi minter
```

## CoFiXVaultForTrader Examples

```shell
cofi = await CoFiToken.at("0xE68976a81572B185899205C7b8BCBD1515DF4f5b")
factory = await CoFiXFactory.at("0xC85987c73300CFd1838da40F0A4b29bB64EAed8e")
vaultForTrader = await CoFiXVaultForTrader.new(cofi.address, factory.address)
# vaultForTrader.address 0x12Fc8391e7C868e7aa90C69E204C60f18aA0afab
# allowRouter
router = "0x66aa2AC8F6557B956AE144efe85feF860d848851"
vaultForTrader.allowRouter(router)
# CoFi set minter
cofi.addMinter(vaultForTrader.address)
# set vaultForLP in factory
factory.setVaultForTrader(vaultForTrader.address)
# remove old vaultForTrader from CoFi minter
```