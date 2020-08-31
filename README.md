# CofiX

![CofiX](https://github.com/kazamio/CofiX/workflows/CofiX/badge.svg)
[![Build Status](https://travis-ci.org/kazamio/CofiX.svg?branch=master)](https://travis-ci.org/kazamio/CofiX)
[![Coverage Status](https://coveralls.io/repos/github/kazamio/CofiX/badge.svg?branch=master)](https://coveralls.io/github/kazamio/CofiX?branch=master)

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

```shell
truffle migrate --network ropsten
```

## Testnet (ropsten)

### Beta-V0.1

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
|     CofiXRouter     | 0x07F4385F741f873423dedE6C2645698FcB287683 |
|    CofiXFactory     | 0x869EfF8B605E0B5Ba3E8B9F81C199B2BBB3e34Df |
|      USDT Token      | 0xB5852d2cC06cd394f52C9edEbF0f1d59aD4A0615 |
|         WETH         | 0x1A2c206FcE664440c0b953df0C976B1208F411Eb |
| NEST3PriceOracleMock | 0x9dE1109708926C90117DAFB23F13176Bb6d878E0 |

### Beta-V0.2

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
|      CofiXRouter     | 0xEa19497F26eeF50A68CD4502410471f41C23B563 |
|     CofiXFactory     | 0x2F3DC9488C8cea30c2DcA6Bb78aD15d1E37206B7 |
|      USDT Token      | 0x83a1e68dA9Fa81B3a54dDc49Fbb2c13cf4f7239d |
|         WETH         | 0xd44b717a5d54a9520b411d0f297eD69ef81Af10e |
|   CofiXController    | 0x01B5fF069b49d2dA08cCBce9D8506d59472Ea868 |
| NEST3PriceOracleMock | 0xf137Dd7C6f091494597e0907D234E486128Bc937 |

### Beta-V0.3

|       Contract       |                  Address                   |
| :------------------: | :----------------------------------------: |
| USDT | 0xDc9E7381678EfA251E403F8F9fafcBdbf91a5C6C |
| HBTC | 0x9a6313FAf3b347687F86303835607463202AB7D4 |
| WETH9 | 0xcfcF136eEc1C4A03BC2F684090844bF67168bF90 |
| NEST3PriceOracleMock | 0x33EB7860427220684D6d69E0CE1914FfBFaC56B1 |
| CofiXController | 0x6D631e101BC36A6f51fB875059347B1D4830BdBB |
| CofixFactory | 0xD9aB2Ca67641f11e808d32ffc5741a3A0d44E05c |
| CofixRouter | 0x442A92e41EEFA4567a75d27773A9A64e8d3A6880 |

## Test Flow

check [`test/CofiX.test.js`](test/CofiX.test.js) for details.
