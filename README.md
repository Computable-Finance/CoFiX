<h1 align=center><a href="https://cofix.io"><code>CoFiX</code></a></h1>

<p align=center> <i>A computable financial transaction model</i> </p>
<p align=center> <i>The Future of On-Chain Market Making is Here 🤑 📈📉💰</i> </p>


<p align="center">
  <a href="https://github.com/Computable-Finance/CoFiX/actions?query=workflow%3ACoFiX">
    <img src="https://github.com/Computable-Finance/CoFiX/workflows/CoFiX/badge.svg" />
  </a>
  <a href="https://travis-ci.org/Computable-Finance/CoFiX">
    <img src="https://travis-ci.org/Computable-Finance/CoFiX.svg?branch=master" />
  </a>
  <a href="https://coveralls.io/github/Computable-Finance/CoFiX?branch=master">
    <img src="https://coveralls.io/repos/github/Computable-Finance/CoFiX/badge.svg?branch=master" />
  </a>
  <a href="https://www.gnu.org/licenses/gpl-3.0">
    <img src="https://img.shields.io/badge/License-GPLv3-green.svg" />
  </a>
</p>

<!-- # [CoFiX](https://cofix.io/)

*A computable financial transaction model*

![CoFiX](https://github.com/Computable-Finance/CoFiX/workflows/CoFiX/badge.svg)
[![Build Status](https://travis-ci.org/Computable-Finance/CoFiX.svg?branch=master)](https://travis-ci.org/Computable-Finance/CoFiX)
[![Coverage Status](https://coveralls.io/repos/github/Computable-Finance/CoFiX/badge.svg?branch=master)](https://coveralls.io/github/Computable-Finance/CoFiX?branch=master) -->

## Whitepaper

**[https://cofix.io/doc/CoFiX_White_Paper.pdf](https://cofix.io/doc/CoFiX_White_Paper.pdf)**

## Documentation

**[https://docs.cofix.io/](https://docs.cofix.io/)**

**[https://github.com/Computable-Finance/Doc](https://github.com/Computable-Finance/Doc)**

**[Guide: How to Integrate with CoFiX](./docs/how_to_integrate_cofix.md)**

## Smart Contract Diagrams

![CoFiX Smart Contract](docs/cofix-smart-contract.svg)

<p align=center> <i>thanks 🦄 for great contract architecture</i> </p>

## Usage

### Run test

```shell
npm install

npm run test
```

### Compile

Run `truffle compile`, get build results in `build/contracts` folder, including `ABI` json files.

or

Use `npx oz compile` to adopt `@openzeppelin/cli` toolchain.

### Deploy

Deploy with `truffle` and you will get a contract deployement summary on contract addresses.

```shell
truffle migrate --network ropsten
```

You may need to `activate()` the price oracle through `CoFiXController` contract manually and set kTable with the help of [scripts/setKTable.js](scripts/setKTable.js).

### Scripts

There are several scripts used to invoke with the protocol in [`scripts/`](scripts) folder. Simplely run `truffle exec scripts/SPECIFIC_SCRIPT.JS` with flags to execute. Here are some [examples](docs/change_controller.md).

### Generate ABI

```shell
npm run genabi
```

## Mainnet

### Governance

CoFiX Governance (Multi-Sig) https://gnosis-safe.io/app/#/safes/0xF51d8FdF98286e1EA846c79f1526ECC95b93AbB8/balances

Check *Record of Governance Authority Transfer to Multi-Sig Wallet* and *Details on CoFiX Multi-Sig Governance Contract* [here](docs/transfer_governance_record.md).

*Governance ownership will be transferred to the CoFiX DAO in the next stage when the CoFi token is widely distributed.*

### 🎉 Release 🎉

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0xdAC17F958D2ee523a2206206994597C13D831ec7 |
| HBTC | 0x0316EB71485b0Ab14103307bf65a021042c6d380 |
| NEST | 0x04abEdA201850aC0124161F037Efd70c74ddC74C |
| WETH | 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 |
| NestPriceOracle (deprecated, use NestQuery) | 0x94F36FAa6bB4f74009637292b09C355CcD3e80Eb |
| NestQuery | 0x3bf046c114385357838D9cAE9509C6fBBfE306d2 |
| NEST3VoteFactory | 0x6Cd5698E8854Fb6879d6B1C694223b389B465dea |
| CoFiXKTable | 0x75E360Be6248Bd46030C6818624a09403EF5eC21 |
| CoFiToken | 0x1a23a6BfBAdB59fa563008c0fB7cf96dfCF34Ea1 |
| CoFiXNode | 0x558201DC4741efc11031Cdc3BC1bC728C23bF512 |
| CoFiXFactory | 0x66C64ecC3A6014733325a8f2EBEE46B4CA3ED550 |
| CoFiXRouter | 0x26aaD4D82f6c9FA6E34D8c1067429C986A055872 |
| CoFiXRouter02 (Beta) | 0x5C35BaDebD40308e409df891aC56d17C8625c2bC |
| CoFiXController (deprecated) | 0xd694eF4C82E50F3f184877572dCD6A45B8FEae87 |
| CoFiXController02 (deprecated) | 0x7e497Be7532CC4954D73c6dF93F016c53CC0C29a |
| CoFiXController03 | 0xc6f45eB40609c9CD30c8750A95042De1b8B1DBFf |
| CoFiXVaultForLP | 0x6903b1C17A5A0A9484c7346E5c0956027A713fCF |
| CoFiXVaultForTrader | 0xE6183d3094a9e360B123Ec1330afAE76A74d1cbF |
| CoFiXVaultForCNode | 0x7eDa8251aC08E7898E986DbeC4Ba97B421d545DD |
| CoFiStakingRewards | 0x0061c52768378b84306b2665f098c3e0b2C03308 |
| ETH/USDT Pair | 0xb2b7BeDd7d7fc19804C7Dd4a4E8174C4c73C210d |
| ETH/HBTC Pair | 0x7C2d7b53AcA4038f2Eb649164181114B9AEE93CB |
| CoFiXStakingRewards for ETH/USDT Pair | 0x3B67fe44216d3e147bA8ccF6E49d2E576441cb10 |
| CoFiXStakingRewards for ETH/HBTC Pair | 0x5Fd4Eb552965F0Db9F50Ac285C55C8397F19F45B |
| CNodeStakingRewards for CNode | 0xb697A2528D57a2BA8E75E2F33eD56B594cf9F308 |

- ETH/USDT
  - Pair (XToken): 0xb2b7BeDd7d7fc19804C7Dd4a4E8174C4c73C210d
  - XToken StakingRewards Pool: 0x3B67fe44216d3e147bA8ccF6E49d2E576441cb10
- ETH/HBTC
  - Pair (XToken): 0x7C2d7b53AcA4038f2Eb649164181114B9AEE93CB
  - XToken StakingRewards Pool: 0x5Fd4Eb552965F0Db9F50Ac285C55C8397F19F45B
- CNode Token StakingRewards Pool (CNodeStakingRewards): 0xb697A2528D57a2BA8E75E2F33eD56B594cf9F308

---
<!-- 
### Beta-V0.9.4

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0xdAC17F958D2ee523a2206206994597C13D831ec7 |
| HBTC | 0x0316EB71485b0Ab14103307bf65a021042c6d380 |
| NEST | 0x04abEdA201850aC0124161F037Efd70c74ddC74C |
| WETH | 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 |
| NestPriceOracle | 0x94F36FAa6bB4f74009637292b09C355CcD3e80Eb |
| NEST3VoteFactory | 0x6Cd5698E8854Fb6879d6B1C694223b389B465dea |
| CoFiXKTable | 0x75E360Be6248Bd46030C6818624a09403EF5eC21 |
| CoFiToken | 0xBF4d534CfE1C293c9bb1cBaA01Bb17C8FF65b670 |
| CoFiXNode | 0x2BAAc0aD6b54b90b07eC89bB8C3542af6c26E81f |
| CoFiXFactory | 0xFb374D926E34Add1e5036ef3Edd5d9D698722e97 |
| CoFiXRouter | 0x84d9e80D3759AADB5658bcFFbC54Cd2Cf0008b81 |
| CoFiXController | 0x1A53be16D7fAE6180692E9fd3d0C4AE90aD0a5f8 |
| CoFiXVaultForLP | 0xbc99A5e7764792cd1024fD5310e9867EE578c23D |
| CoFiXVaultForTrader | 0x8367f04C7d6c2E1cE9F68e77Cb850F09cfBAEB8D |
| CoFiXVaultForCNode | 0xB655feEc232c0b93A58846724Ad5bbDF44D135eD |
| CoFiStakingRewards | 0xf0F095E13b1D86C2C36812A64882565c8ec5f91B |
| ETH/USDT Pair | 0x1874C790b75b3e64C813F5bff2428Ca03D492063 |
| ETH/HBTC Pair | 0xE9Ba64C0315B9fF5c29ddf5BDaEEeC46fc3DC22E |

- ETH/USDT
  - Pair (XToken): 0x1874C790b75b3e64C813F5bff2428Ca03D492063
  - XToken StakingRewards Pool: 0x1092521C9cB34B7049efd61E47c2c3d8B726292f
- ETH/HBTC
  - Pair (XToken): 0xE9Ba64C0315B9fF5c29ddf5BDaEEeC46fc3DC22E
  - XToken StakingRewards Pool: 0xb13E3e7E3461D9c40C3Faa736CC852B6d61900E7
- CNode Token (Test) StakingRewards Pool (CNodeStakingRewards): 0x939B66CfFc1eD066A43bc2E0a075F93Bd9f8852E -->

<!-- ### Beta-V0.9.3

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0xdAC17F958D2ee523a2206206994597C13D831ec7 |
| HBTC | 0x0316EB71485b0Ab14103307bf65a021042c6d380 |
| NEST | 0x04abEdA201850aC0124161F037Efd70c74ddC74C |
| WETH | 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 |
| NestPriceOracle | 0x94F36FAa6bB4f74009637292b09C355CcD3e80Eb |
| NEST3VoteFactory | 0x6Cd5698E8854Fb6879d6B1C694223b389B465dea |
| CoFiXKTable | 0x75E360Be6248Bd46030C6818624a09403EF5eC21 |
| CoFiToken (Test) | 0xc2283C20a61847240d2eb10e6925d85bcaef89aE |
| CoFiXNode (Test) | 0x2BAAc0aD6b54b90b07eC89bB8C3542af6c26E81f |
| CoFiXFactory | 0x155BDA3255115b244Fe3767a9eDC002dC76023ad |
| CoFiXRouter | 0xA2B29F965b537a9D279f75E1498413248C265Ead |
| CoFiXController | 0x2f51563044d96105611Cdb5Bee621a5002Ee0264 |
| CoFiXVaultForLP | 0xF128802361580FB2A74574ddEd4E09F44f4Ec4cF |
| CoFiXVaultForTrader | 0x357811E0cA5AD4C66f1d44d05A3C73d98b4583CF |
| CoFiXVaultForCNode | 0x1500b2621042fB814C38D9322a62ae214beeeA77 |
| CoFiStakingRewards | 0xD16EeAfc4f614589eED0bc9294C1aE15F459831A |

- ETH/USDT
  - Pair (XToken): 0x893554c9D24583dc4A926A0E6F5118028f4145eB
  - XToken StakingRewards Pool: 0xaF6cE9CEc2D13773895A6B683f1Ce454505D89b1
- ETH/HBTC
  - Pair (XToken): 0x5455064a184b41a8229E359b481c58F9CfEbc991
  - XToken StakingRewards Pool: 0x12114849048B43cB57282027f574A8B92a01eaC7
- CNode Token (Test) StakingRewards Pool (CNodeStakingRewards): 0x64d96c347e4E860Af4624276c65F0B8Db0789b4e -->


<!-- ### Beta-V0.6

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0xdAC17F958D2ee523a2206206994597C13D831ec7 |
| HBTC | 0x0316EB71485b0Ab14103307bf65a021042c6d380 |
| NEST | 0x04abEdA201850aC0124161F037Efd70c74ddC74C |
| WETH | 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 |
| NestPriceOracle | 0x7722891Ee45aD38AE05bDA8349bA4CF23cFd270F |
| CoFiXController | 0xC16E5eECc0948604eb326296c71311aC8D9BC786 |
| CoFiXFactory | 0xD5a19E1ADb5592921dcC42E48623d75c4C91e405 |
| CoFiXKTable | 0x75E360Be6248Bd46030C6818624a09403EF5eC21 |
| CoFiXRouter | 0x2878469c466638E8c0878bB86898073CA6C91b45 | -->

## Ropsten Testnet

### Beta-V2.0.0 (Latest)

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0xc82C867f9e25303C766e2ba83d512419223d4574 |
| HBTC | 0xe089A4d2CBC409f30eb4E6c6661502ceDD5510b5 |
| NEST | 0x2CFa7278ecf2DB7f6f97C07EefaC4aAD19b81d80 |
| WETH | 0x59b8881812Ac484Ab78b8fc7c10b2543e079a6C3 |
| NestPriceFacade | 0x406C82f4F116F4FAD75bb47A142C9B5Fb213133C |
| CoFiToken | 0x7E03E60925D27D6DeF4F05E725f5fD2f03BDbfD5 |
| CoFiXNode | 0x3f6b154C076fF69E92114199E376E908F32B3346 |
| CoFiXV2Factory | 0xebfF4f1E7D2B904876fc53424E2E99A720a71963 |
| CoFiXV2Router | 0x59291fa0828290252d743F3A424B35B7aabf6aFF |
| CoFiXV2Controller | 0x4C73A1f379bD5bC28DB20f4d2D3df344497000BF |
| CoFiXV2Controller(deprecated) | 0xBF629cf43D1B1F61fa22Eb472fDaa1f976ACC1B4 |
| CoFiXV2VaultForLP | 0x3d8470dA33f8cdEc90f8AcCF1643f9b5670B4823 |
| CoFiXV2VaultForTrader | 0xE81E2F1c77A3A2C8848494f423D3ff933954625A |
| CoFiXV2VaultForCNode | 0x7495EA57084127274E06826aF7A7b3Ab6006CF69 |
| CoFiXV2DAO | 0xF0BeE33D0db3514dFfC8dA41c81F9E7C2825944e |
| ETH/USDT V2Pair | 0x6710D19d8bF61a608f40D49d14873447131252B1 |
| ETH/HBTC V2Pair | 0xD0AE7cf7c412A1ce88995A63975D62161346C77d |
| ETH/NEST V2Pair | 0x19a8306D3C15C31E07B4eB5b2DbD29ECac302d05 |
| CoFiXV2StakingRewards ETH/USDT Pair | 0x330a541A2ae46951827c27C13f6deFD91f3f73fA |
| CoFiXV2StakingRewards ETH/HBTC Pair | 0xC2c9FDa54184EE6d92857D2Cc60bef723CE2E7Ee |
| CoFiXV2StakingRewards ETH/NEST Pair | 0xB6683c08DE654a8dC52353d2819480b40Ec42D09 |
| V2CNodeStakingRewards CNode | 0x7E224FB85AEB0Dc3254459Fd6f2023dd88083F20   |

- ETH/USDT
  - Pair (XToken): 0x6710D19d8bF61a608f40D49d14873447131252B1 
  - XToken StakingRewards Pool: 0x330a541A2ae46951827c27C13f6deFD91f3f73fA  
- ETH/HBTC
  - Pair (XToken): 0xD0AE7cf7c412A1ce88995A63975D62161346C77d  
  - XToken StakingRewards Pool: 0xC2c9FDa54184EE6d92857D2Cc60bef723CE2E7Ee  
- ETH/NEST
  - Pair (XToken): 0x19a8306D3C15C31E07B4eB5b2DbD29ECac302d05 
  - XToken StakingRewards Pool: 0xB6683c08DE654a8dC52353d2819480b40Ec42D09  
- CNode Token StakingRewards Pool (CNodeStakingRewards): 0x7E224FB85AEB0Dc3254459Fd6f2023dd88083F20  

### Beta-V0.9.6

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0x200506568C2980B4943B5EaA8713A5740eb2c98A |
| HBTC | 0xA674f71ce49CE7F298aea2F23D918d114965eb40 |
| NEST | 0xD287Bc43eCD3D892204aA3792165fe8728636E29 |
| WETH | 0x59b8881812Ac484Ab78b8fc7c10b2543e079a6C3 |
| NestPriceOracle (deprecated, use NestQuery) | 0x70B9b6F0e1E4073403cF7143b45a862fe73af3B9 |
| NestQuery | 0x3bF1d76A2fb912481022fdC31bD5016cC5A6c671 |
| NEST3VoteFactory | 0xAB996648c3e7E16253988d4a916456F6f63F04Ee |
| CoFiXKTable | 0xe609B978635c7Bb8D22Ffc4Ec7f7a16615a3b1cA |
| CoFiToken | 0x72Fd35b1dB364db812A8E726891685A25a9135D3 |
| CoFiXNode | 0x655C281DC8610003d8AE490D462B950BdA71582f |
| CoFiXFactory | 0x8E636BDB79752BFa2C41285535852bbBDd50b2ca |
| CoFiXRouter | 0xbeE8674291328D09831cAf96eFceaCDf53066B86 |
| CoFiXRouter02 (Beta) | 0xAdD27c75b7B003cc791E4062e20f9Eb872FafC65 |
| CoFiXController (deprecated) | 0xEB95E090b27A67f574005F41eea83794D5ac1650 |
| CoFiXController02 (deprecated) | 0x36f99d8500CB288c924B50cf4A081F4C3E6d48DD |
| CoFiXController03 (deprecated) | 0x8a814Da4d9Dfdebf6080BbE2d8C7bb238272507B |
| CoFiXController04 | 0xEACE857F795e23907C1C6e5e3ec901f98aD03302 |
| CoFiXVaultForLP | 0x2494853258c33A99581Abddc7b85b11D1D1885DF |
| CoFiXVaultForTrader | 0xe901e7f88a377D01028aE947cFA3192b3c5f7587 |
| CoFiXVaultForCNode | 0x159894c1e9712bF2EeDB4b2B84dFDA154893088B |
| CoFiStakingRewards | 0x2a603D9e8b3152B6e235c7eFA41dFc073764d96a |
| ETH/USDT Pair | 0xffe14368FC46EB507e5221459a480646F22558b6 |
| ETH/HBTC Pair | 0xe0297aBDCCf60Ab85365694E53AF92A433c2852e |
| CoFiXStakingRewards ETH/USDT Pair | 0x58FEf07559C7b19926BF4104463F80360A677144 |
| CoFiXStakingRewards ETH/HBTC Pair | 0xfdFc41f8b9D8b667b7DE8a976F446C557c697981 |
| CNodeStakingRewards CNode | 0x3ECD22524CDdC3E3AC2f52a595A9C7FA3b677ec1 |

- ETH/USDT
  - Pair (XToken): 0xffe14368FC46EB507e5221459a480646F22558b6
  - XToken StakingRewards Pool: 0x58FEf07559C7b19926BF4104463F80360A677144
- ETH/HBTC
  - Pair (XToken): 0xe0297aBDCCf60Ab85365694E53AF92A433c2852e
  - XToken StakingRewards Pool: 0xfdFc41f8b9D8b667b7DE8a976F446C557c697981
- CNode Token StakingRewards Pool (CNodeStakingRewards): 0x3ECD22524CDdC3E3AC2f52a595A9C7FA3b677ec1 

<!-- ### Beta-V0.9.5

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0x200506568C2980B4943B5EaA8713A5740eb2c98A |
| HBTC | 0xA674f71ce49CE7F298aea2F23D918d114965eb40 |
| NEST | 0xD287Bc43eCD3D892204aA3792165fe8728636E29 |
| WETH | 0x59b8881812Ac484Ab78b8fc7c10b2543e079a6C3 |
| NestPriceOracle (deprecated, use NestQuery) | 0x70B9b6F0e1E4073403cF7143b45a862fe73af3B9 |
| NestQuery | 0x3bF1d76A2fb912481022fdC31bD5016cC5A6c671 |
| NEST3VoteFactory | 0xAB996648c3e7E16253988d4a916456F6f63F04Ee |
| CoFiXKTable | 0xe609B978635c7Bb8D22Ffc4Ec7f7a16615a3b1cA |
| CoFiToken | 0x72Fd35b1dB364db812A8E726891685A25a9135D3 |
| CoFiXNode | 0x655C281DC8610003d8AE490D462B950BdA71582f |
| CoFiXFactory | 0x8E636BDB79752BFa2C41285535852bbBDd50b2ca |
| CoFiXRouter | 0xbeE8674291328D09831cAf96eFceaCDf53066B86 |
| CoFiXRouter02 (Beta) | 0xAdD27c75b7B003cc791E4062e20f9Eb872FafC65 |
| CoFiXController (deprecated) | 0xEB95E090b27A67f574005F41eea83794D5ac1650 |
| CoFiXController02 (deprecated) | 0x36f99d8500CB288c924B50cf4A081F4C3E6d48DD |
| CoFiXController03 | 0x8a814Da4d9Dfdebf6080BbE2d8C7bb238272507B |
| CoFiXVaultForLP | 0x2494853258c33A99581Abddc7b85b11D1D1885DF |
| CoFiXVaultForTrader | 0xe901e7f88a377D01028aE947cFA3192b3c5f7587 |
| CoFiXVaultForCNode | 0x159894c1e9712bF2EeDB4b2B84dFDA154893088B |
| CoFiStakingRewards | 0x2a603D9e8b3152B6e235c7eFA41dFc073764d96a |
| ETH/USDT Pair | 0xffe14368FC46EB507e5221459a480646F22558b6 |
| ETH/HBTC Pair | 0xe0297aBDCCf60Ab85365694E53AF92A433c2852e |
| CoFiXStakingRewards ETH/USDT Pair | 0x58FEf07559C7b19926BF4104463F80360A677144 |
| CoFiXStakingRewards ETH/HBTC Pair | 0xfdFc41f8b9D8b667b7DE8a976F446C557c697981 |
| CNodeStakingRewards CNode | 0x3ECD22524CDdC3E3AC2f52a595A9C7FA3b677ec1 |

- ETH/USDT
  - Pair (XToken): 0xffe14368FC46EB507e5221459a480646F22558b6
  - XToken StakingRewards Pool: 0x58FEf07559C7b19926BF4104463F80360A677144
- ETH/HBTC
  - Pair (XToken): 0xe0297aBDCCf60Ab85365694E53AF92A433c2852e
  - XToken StakingRewards Pool: 0xfdFc41f8b9D8b667b7DE8a976F446C557c697981
- CNode Token StakingRewards Pool (CNodeStakingRewards): 0x3ECD22524CDdC3E3AC2f52a595A9C7FA3b677ec1 -->

<!-- ### Beta-V0.9.3

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0x200506568C2980B4943B5EaA8713A5740eb2c98A |
| HBTC | 0xA674f71ce49CE7F298aea2F23D918d114965eb40 |
| NEST | 0xD287Bc43eCD3D892204aA3792165fe8728636E29 |
| WETH | 0x59b8881812Ac484Ab78b8fc7c10b2543e079a6C3 |
| NestPriceOracle | 0x70B9b6F0e1E4073403cF7143b45a862fe73af3B9 |
| CoFiXKTable | 0xe609B978635c7Bb8D22Ffc4Ec7f7a16615a3b1cA |
| CoFiToken | 0xE68976a81572B185899205C7b8BCBD1515DF4f5b |
| CoFiXNode | 0x1467459E5BC77C5D350D6c31bA69351Df1e1E3A2 |
| CoFiXFactory | 0xC85987c73300CFd1838da40F0A4b29bB64EAed8e |
| CoFiXRouter | 0x66aa2AC8F6557B956AE144efe85feF860d848851 |
| CoFiXController | 0xff460A541DC7Af7FeA7b98E0Ba5eF64C80B1409B |
| CoFiXVaultForLP | 0x7e6dCD3581d596fe5F628B77fd6784F10D09b43d |
| CoFiXVaultForTrader | 0x12Fc8391e7C868e7aa90C69E204C60f18aA0afab |
| CoFiXVaultForCNode | 0x1a31b517ABF0D2F4f11A797d7b8622859429AA25 |
| CoFiStakingRewards | 0xDe80d5423569Ea4104d127e14E3fC1BE0486531d |

- ETH/USDT
  - Pair (XToken): 0x5f22a04F81A87a7aBe9191C338fA5Ba092Af4562
  - XToken StakingRewards Pool (CoFiXStakingRewards): 0xA3904574E4Fbf7592B3A3c1439cAe97D5622FBFD
- ETH/HBTC
  - Pair (XToken): 0x9D90e9e5AFF7545046FF66544B7848C21118Da22
  - XToken StakingRewards Pool (CoFiXStakingRewards): 0xe6c3bd6D258cE7fc7554723fc2b93F848CEF30E7
- CNode Token StakingRewards Pool (CNodeStakingRewards): 0x6c62b1ed1c2Aa3C9F51C9D7657E6d73dBE4607C0 -->

<!-- ### Beta-V0.1

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
|     CoFiXRouter     | 0x07F4385F741f873423dedE6C2645698FcB287683 |
|    CoFiXFactory     | 0x869EfF8B605E0B5Ba3E8B9F81C199B2BBB3e34Df |
|      USDT Token      | 0xB5852d2cC06cd394f52C9edEbF0f1d59aD4A0615 |
|         WETH         | 0x1A2c206FcE664440c0b953df0C976B1208F411Eb |
| NEST3PriceOracleMock | 0x9dE1109708926C90117DAFB23F13176Bb6d878E0 |

### Beta-V0.2

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
|      CoFiXRouter     | 0xEa19497F26eeF50A68CD4502410471f41C23B563 |
|     CoFiXFactory     | 0x2F3DC9488C8cea30c2DcA6Bb78aD15d1E37206B7 |
|      USDT Token      | 0x83a1e68dA9Fa81B3a54dDc49Fbb2c13cf4f7239d |
|         WETH         | 0xd44b717a5d54a9520b411d0f297eD69ef81Af10e |
|   CoFiXController    | 0x01B5fF069b49d2dA08cCBce9D8506d59472Ea868 |
| NEST3PriceOracleMock | 0xf137Dd7C6f091494597e0907D234E486128Bc937 |

### Beta-V0.3

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0xDc9E7381678EfA251E403F8F9fafcBdbf91a5C6C |
| HBTC | 0x081B96b53f887ef4543649CED7fD7A5a872bDd29 |
| WETH9 | 0xcfcF136eEc1C4A03BC2F684090844bF67168bF90 |
| NEST3PriceOracleMock | 0x33EB7860427220684D6d69E0CE1914FfBFaC56B1 |
| CoFiXController | 0x6D631e101BC36A6f51fB875059347B1D4830BdBB |
| CoFiXFactory | 0xD9aB2Ca67641f11e808d32ffc5741a3A0d44E05c |
| CoFiXRouter | 0x442A92e41EEFA4567a75d27773A9A64e8d3A6880 |

### Beta-V0.4

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0xD52d3bfCA0d39E4bD5378e0BBa8AD245C3F58C17 |
| HBTC | 0x9aA0AF152cf141740f19D335b5ddE1F0E51008A7 |
| NEST | 0xB9746A8572DB5C27597fE88B86B6520599Bf62d4 |
| WETH9 | 0xB3d7C7993BE7bEec23D005552224B2dAf18Bd85E |
| NEST3PriceOracleMock | 0x2183B4bC72c299FDDFf27D4bDBc635bbc8cA5e44 |
| CoFiXController | 0xf2Fe41C81C60698E2abE1B8cb7BB56C5570e3C55 |
| CoFiXFactory | 0xde33584665ea098748897B1292150c003b855df6 |
| CoFiXKTable | 0xDB69107004694428aab5E6F196dcdd588F52B745 |
| CoFiXRouter | 0x2cC5b038bd296779A3a50430179cB8C6a02B9D13 |

### Beta-V0.7

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0x200506568C2980B4943B5EaA8713A5740eb2c98A |
| HBTC | 0xA674f71ce49CE7F298aea2F23D918d114965eb40 |
| NEST | 0xD287Bc43eCD3D892204aA3792165fe8728636E29 |
| WETH | 0x59b8881812Ac484Ab78b8fc7c10b2543e079a6C3 |
| CoFiToken | 0xA1B66D21DC42cCCDe55F06f381CbcecD422Ef4d4 |
| CoFiStakingRewards | 0x8bEEfdc9Ba635E2451d275Ca1b9AfEe3C13D65d7 |
| NestPriceOracle | 0x70B9b6F0e1E4073403cF7143b45a862fe73af3B9 |
| CoFiXController | 0x636520329ee488Cb99552Ab225267668608b179a |
| CoFiXFactory | 0xf56E0C6E9D3233b99FA439710147E52b9ef26F60 |
| CoFiXKTable | 0xe609B978635c7Bb8D22Ffc4Ec7f7a16615a3b1cA |
| CoFiXRouter | 0x30f1c72CfcF96c4de2e279fa256567F8ADbEf888 |
| CoFiXVaultForLP | 0x4F6544aF9Ea4107b52D4563F16c2A660D1E7EB41 | -->

### Beta-V0.8

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0x200506568C2980B4943B5EaA8713A5740eb2c98A |
| HBTC | 0xA674f71ce49CE7F298aea2F23D918d114965eb40 |
| NEST | 0xD287Bc43eCD3D892204aA3792165fe8728636E29 |
| WETH | 0x59b8881812Ac484Ab78b8fc7c10b2543e079a6C3 |
| NestPriceOracle | 0x70B9b6F0e1E4073403cF7143b45a862fe73af3B9 |
| CoFiXKTable | 0xe609B978635c7Bb8D22Ffc4Ec7f7a16615a3b1cA |
| CoFiToken | 0x0c7caD803686a284542d807406f4CD0b2c6B5d17 |
| CoFiXNode | 0xA4B1412EcabAbB6F3188Aa411546491790bde89B |
| CoFiXFactory | 0xB19EbE64A0ca9626824abBdbdeC4a76294D460A5 |
| CoFiXRouter | 0xB9a933FE0Eeb184b2E35372B3ad55fDC4b325469 |
| CoFiXController | 0xe4fa2dAA56e87a927386790D41E3F9906e40f4C2 |
| CoFiXVaultForLP | 0xB6ae9774D2C743B0886123A1C98d4fc92558BaBC |
| CoFiXVaultForTrader | 0xcF3167AFCAf33f899d4Fa0ab431D3B6038C79dbf |
| CoFiXVaultForCNode | 0xEf1976634a2fbCCeD89DFAa44FAd85A4A211E4B3 |
| CoFiStakingRewards | 0xC8b29e0b4F5e9A55a0130934A690655BefbA34B4 |

## Kovan Testnet

### Beta-V0.9

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0x3399EB8165888221A30c822753648dfc16ed3803 |
| HBTC | 0xC34156BE35c870D47638eFdCfA20E39e299607B0 |
| NEST | 0xa50CB75ee798268aeA5de0F0aEE271595e1CAAa2 |
| WETH | 0x39edE2c2ca91295BEA2F20080C0B82872B7C64b7 |
| NestPriceOracle | 0x505A054e6064fADB9277864647641EF64B7c783B |
| CoFiXKTable | 0xa01FeCbeD543DCF5612D379ecbE23b0D2763c0D6 |
| CoFiToken | 0x61f423C704FcFd84adF006dB84a905dDca2ba4fA |
| CoFiXNode | 0xC2B66C87bFCA3900031b246a169fB6A67A911D8a |
| CoFiXFactory | 0x3B4d6962A3f5184D9eb240D70070516addC3F4c5 |
| CoFiXRouter | 0x5f6c887B22a8b30C2eca90B9C63ff370494790B7 |
| CoFiXController | 0xed03772aFF6B83875De68C89961f83899D29EeD1 |
| CoFiXVaultForLP | 0x1eAF116d62eB943fcf28A0645b8059EFBb829FAB |
| CoFiXVaultForTrader | 0x37289c1d3BEAE79c0EEF494ABf5209668E1704B9 |
| CoFiXVaultForCNode | 0x04983eEA3aA0A73A1487B255abA688619844B023 |
| CoFiStakingRewards | 0x453FEd6fE31a17C8277bd7F477ebbCB542D4Ad5D |

### Beta-V0.5

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0x04716BaA169f6E5BAFe92E4643C2f18480ba46D3 |
| HBTC | 0xcae23767DF5BbEBD0d64402a7d3d82776f97bE46 |
| NEST | 0x08cFf00044dECe1D817F3D30A7cc8aef43A284De |
| WETH | 0x6A04aF9c9793D9eE1a27eB7A343f940282a0AB9e |
| NestPriceOracle | 0x93Afa4ff16874Cf9D4f29da4973be277f53607Af |
| CoFiXController | 0xf71141F66e15740DB5d59E4c31ee0D84d6584452 |
| CoFiXFactory | 0x9984dCe65387d9AE8a495452F72dF0A0D4F85d2c |
| CoFiXKTable | 0x0441e7e4C1ecd73a068F0696Cf4cB10Ea69dD74A |
| CoFiXRouter | 0xB5852d2cC06cd394f52C9edEbF0f1d59aD4A0615 |

## Test Flow

check [`test/CoFiX.test.js`](test/CoFiX.test.js) for details.
