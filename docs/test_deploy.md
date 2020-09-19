# Steps to deploy contracts for test

## Steps

1. Deployer: Deploy contracts by `truffle migrate --network ropsten`

    - Check `Contract Deployed Summary` for each smart contract

2. Deployer: Set KTable by `truffle exec scripts/setKTable.js`

    *e.g.*

    ```shell
    truffle exec scripts/setKTable.js --network ropsten --ktable 0xDB69107004694428aab5E6F196dcdd588F52B745
    ```

3. Deployer: Feed price to constant oracle mock by `truffle exec scripts/feedPriceToConstOracleMock.js`

    *e.g.*

    ```shell
    truffle exec scripts/feedPriceToConstOracleMock.js --network ropsten --token 0xD52d3bfCA0d39E4bD5378e0BBa8AD245C3F58C17  --ethAmount "10000000000000000000" --tokenAmount "3862600000" --oracle 0x2183B4bC72c299FDDFf27D4bDBc635bbc8cA5e44

    truffle exec scripts/feedPriceToConstOracleMock.js --network ropsten --token 0xcae23767DF5BbEBD0d64402a7d3d82776f97bE46  --ethAmount "10000000000000000000" --tokenAmount "339880000000000000" --oracle 0x93Afa4ff16874Cf9D4f29da4973be277f53607Af
    ```

4. User: add liquidity for ETH/Token trading pair by `CoFiXRouter::addLiquidity()`, new pair (XToken) created

5. User: call `CoFiXFactory::getPair(token)` to get the new pair address

6. Deployer: transfer CoFi Token to Vault for distribution by `truffle exec scripts/transferCoFi.js`

    *e.g.*

    ```shell
    truffle exec scripts/transferCoFi.js --cofi 0x5986B0f18E22eBB7AC8A46Ef7f6053ccB9793341 --vault 0xDB9ecE89B6A91023Ffb7C1602BB13241313C0491 --transfer true
    ```

7. Deployer: deploy a new CoFiXStakingRewards contract for the liquidity mining by `truffle exec scripts/deployCoFiXStakingRewards.js`

    - CoFiXStakingRewards: User deposit in XToken to earn CoFi Token
    - *e.g.*

      ```shell
      truffle exec scripts/deployCoFiXStakingRewards.js --cofi 0x308CC725450ddaE0AE49233a3c31b17638d85Aec --xtoken 0x308CC725450ddaE0AE49233a3c31b17638d85Aec --vault 0xDB9ecE89B6A91023Ffb7C1602BB13241313C0491
      ```

8. Deployer: add the CoFiXStakingRewards contract to Vault by `truffle exec scripts/addPoolToVaultForLP.js`

    *e.g.*

    ```shell
    truffle exec scripts/addPoolToVaultForLP.js  --cofi 0x308CC725450ddaE0AE49233a3c31b17638d85Aec --xtoken 0x308CC725450ddaE0AE49233a3c31b17638d85Aec --vault 0xDB9ecE89B6A91023Ffb7C1602BB13241313C0491 --pool 0x39033d82B422eAF9DF2e9B53799586809aCA671B
    ```

9. User: should be ready to add liquidity and trade. Call `CoFiXRouter::addLiquidityAndStake()` to earn CoFi tokens.


## Interface and Scripts

- https://github.com/Computable-Finance/CoFiX/tree/master/contracts/interface
- https://github.com/Computable-Finance/CoFiX/tree/master/abi
- https://github.com/Computable-Finance/CoFiX/tree/master/scripts