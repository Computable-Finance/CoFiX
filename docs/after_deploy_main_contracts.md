# Memo on after mainnet deployments

## 1. Set theta

```shell
truffle exec scripts/setThetaToController.js --network mainnet --controller 0x2f51563044d96105611Cdb5Bee621a5002Ee0264 --token 0x0316EB71485b0Ab14103307bf65a021042c6d380 --theta 200000
```

## 2. Deploy USDT and HBTC LP Token Rewards Pool (deployCoFiXStakingRewards)

```shell
truffle exec scripts/deployCoFiXStakingRewards.js --cofi 0xc2283C20a61847240d2eb10e6925d85bcaef89aE --xtoken 0x5455064a184b41a8229E359b481c58F9CfEbc991 --factory 0x155BDA3255115b244Fe3767a9eDC002dC76023ad --network mainnet --addpool true
```

batchSetPoolWeight

## 3. Deploy CNode Rewards Pool (deployCNodeStakingRewards)

```shell
truffle exec scripts/deployCNodeStakingRewards.js --cofi 0xCbE24C43170e94E7B4D8fF186f1D72cFd90dC69D --cnode 0x1fD5A6B5AE1A809380eE795C61796f3001C20986 --factory 0x223A38936364632438295e196c56D379644b1a18 --network development --addpool true
```

Should be ready to go!