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
    truffle exec scripts/feedPriceToConstOracleMock.js --network ropsten --token 0x200506568C2980B4943B5EaA8713A5740eb2c98A  --ethAmount "10000000000000000000" --tokenAmount "3862600000"  --avg "1320675549" --vola "7511686039347830" --oracle 0x70B9b6F0e1E4073403cF7143b45a862fe73af3B9

    truffle exec scripts/feedPriceToConstOracleMock.js --network ropsten --token 0xA674f71ce49CE7F298aea2F23D918d114965eb40   --ethAmount "10000000000000000000" --tokenAmount "339880000000000000" --avg "38071631665285588" --vola "5441325017383007" --oracle 0x70B9b6F0e1E4073403cF7143b45a862fe73af3B9
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