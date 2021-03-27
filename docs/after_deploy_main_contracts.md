# Memo on after mainnet deployments

## 1. Set theta

```shell
truffle exec scripts/setThetaToController.js --network mainnet --controller 0x1A53be16D7fAE6180692E9fd3d0C4AE90aD0a5f8 --token 0xdAC17F958D2ee523a2206206994597C13D831ec7 --theta 200000

truffle exec scripts/setThetaToController.js --network mainnet --controller 0x1A53be16D7fAE6180692E9fd3d0C4AE90aD0a5f8 --token 0x0316EB71485b0Ab14103307bf65a021042c6d380 --theta 200000
```

## 2. Deploy USDT and HBTC LP Token Rewards Pool (deployCoFiXStakingRewards)

```shell
truffle exec scripts/deployCoFiXStakingRewards.js --cofi 0xBF4d534CfE1C293c9bb1cBaA01Bb17C8FF65b670 --xtoken 0x1874C790b75b3e64C813F5bff2428Ca03D492063 --factory 0xFb374D926E34Add1e5036ef3Edd5d9D698722e97 --network mainnet --addpool true

truffle exec scripts/deployCoFiXStakingRewards.js --cofi 0xBF4d534CfE1C293c9bb1cBaA01Bb17C8FF65b670 --xtoken 0xE9Ba64C0315B9fF5c29ddf5BDaEEeC46fc3DC22E --factory 0xFb374D926E34Add1e5036ef3Edd5d9D698722e97 --network mainnet --addpool true

vaultForLP.batchSetPoolWeight(["0x1092521C9cB34B7049efd61E47c2c3d8B726292f", "0xb13E3e7E3461D9c40C3Faa736CC852B6d61900E7"], ["70", "30"])
```

batchSetPoolWeight

## 3. Deploy CNode Rewards Pool (deployCNodeStakingRewards)

```shell
truffle exec scripts/deployCNodeStakingRewards.js --cofi 0xBF4d534CfE1C293c9bb1cBaA01Bb17C8FF65b670 --cnode 0x2BAAc0aD6b54b90b07eC89bB8C3542af6c26E81f --factory 0xFb374D926E34Add1e5036ef3Edd5d9D698722e97 --network mainnet --addpool true
```

Should be ready to go!