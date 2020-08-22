# AGROUP

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
|     AGroupRouter     | 0x07F4385F741f873423dedE6C2645698FcB287683 |
|    AGroupFactory     | 0x869EfF8B605E0B5Ba3E8B9F81C199B2BBB3e34Df |
|      USDT Token      | 0xB5852d2cC06cd394f52C9edEbF0f1d59aD4A0615 |
|         WETH         | 0x1A2c206FcE664440c0b953df0C976B1208F411Eb |
| NEST3PriceOracleMock | 0x9dE1109708926C90117DAFB23F13176Bb6d878E0 |


## Test Flow

check [`test/agroup_test.js`](test/agroup_test.js) for details.
