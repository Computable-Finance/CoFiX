# CoFiX

![CoFiX](https://github.com/kazamio/CoFiX/workflows/CoFiX/badge.svg)
[![Build Status](https://travis-ci.org/kazamio/CoFiX.svg?branch=master)](https://travis-ci.org/kazamio/CoFiX)
[![Coverage Status](https://coveralls.io/repos/github/kazamio/CoFiX/badge.svg?branch=master)](https://coveralls.io/github/kazamio/CoFiX?branch=master)

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
| USDT | 0x11D9e0Cf91A33C76ABaF921ac945CC3b56E039A2 |
| HBTC | 0x20E491Ed8915561EfF4b7f67D32DB7805baD8c71 |
| WETH9 | 0xc1237B8f5081Dc1678668bd99EAfffDC85826211 |
| NEST3PriceOracleMock | 0xF7d849622fF48A6ad082D923a99a26FCD7D35307 |
| CoFiXController | 0x6b21fAd05646042c36E896346Ed74B2a1f7b94cE |
| CoFiXFactory | 0xD2FD9B718359d943597ab209cb31B71740b0D1Fa |
| CoFiXKTable | 0x944AF601d6aCf56EE4C81282ac7cE19987D25E3B |
| CoFiXRouter | 0x63bf14E4514D7aBa14A3c6eafAd5258487663783 |

## Test Flow

check [`test/CoFiX.test.js`](test/CoFiX.test.js) for details.
