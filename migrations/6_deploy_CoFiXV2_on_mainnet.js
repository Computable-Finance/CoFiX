var USDT = artifacts.require("test/USDT");
var HBTC = artifacts.require("test/HBTC");
var NEST = artifacts.require("test/NEST");
var WETH9 = artifacts.require("test/WETH9");
var NestPriceOracle = artifacts.require("mock/NEST35PriceOracleAutoUpdateConstMock");
var CoFiXFactory = artifacts.require("CoFiXFactory02");
var CoFiXController = artifacts.require("CoFiXController04");
var CoFiXPair = artifacts.require("CoFiXPair02");
var CoFiXRouter = artifacts.require("CoFiXRouter03");
const CoFiXVaultForLP = artifacts.require("CoFiXVaultForLP02");
var CoFiXVaultForTrader = artifacts.require("CoFiXVaultForTrader02");
const CoFiXVaultForCNode = artifacts.require("CoFiXVaultForCNode02");
const CoFiXDAO = artifacts.require("CoFiXDAO");
const CoFiStakingRewards = artifacts.require("CoFiStakingRewards02");
var CoFiToken = artifacts.require("CoFiToken");
var CoFiXNode = artifacts.require("CoFiXNode");
const CoFiXStakingRewards = artifacts.require("CoFiXStakingRewards02.sol");
const CNodeStakingRewards = artifacts.require("CNodeStakingRewards02.sol");

module.exports = async function (deployer, network) {

    console.log(`truffle deploy CoFiXV2 to ${network} network`);

    const supportedNetwork = [ "mainnet", "mainnet-fork", "ropsten", "ropsten-fork"];

    if (!supportedNetwork.includes(network)) {
        console.log(`skip, only for ${supportedNetwork} network`);
        return;
    }

    if (network == "mainnet" || network == "mainnet-fork") {
        USDT = await USDT.at("0xdAC17F958D2ee523a2206206994597C13D831ec7");
        HBTC = await HBTC.at("0x0316EB71485b0Ab14103307bf65a021042c6d380");
        NEST = await NEST.at("0x04abEdA201850aC0124161F037Efd70c74ddC74C");
        WETH9 = await WETH9.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
        NestPriceOracle = await NestPriceOracle.at("0x3bf046c114385357838D9cAE9509C6fBBfE306d2"); // nest 3.5: NestQuery
        CoFiToken = await CoFiToken.at("0x1a23a6BfBAdB59fa563008c0fB7cf96dfCF34Ea1");
        // https://uniswap.org/docs/v2/smart-contracts/factory/
        UniswapFactory = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
        CoFiXNode = await CoFiXNode.at("0x558201DC4741efc11031Cdc3BC1bC728C23bF512");
    } else if (network == "ropsten" || network == "ropsten-fork") {
        USDT = await USDT.at("0x200506568C2980B4943B5EaA8713A5740eb2c98A");
        HBTC = await HBTC.at("0xA674f71ce49CE7F298aea2F23D918d114965eb40");
        NEST = await NEST.at("0xD287Bc43eCD3D892204aA3792165fe8728636E29");
        WETH9 = await WETH9.at("0x59b8881812Ac484Ab78b8fc7c10b2543e079a6C3");
        // NestPriceOracle = await NestPriceOracle.at("xxx");
        await deployer.deploy(NestPriceOracle);
        console.log(`feedPrice to new Nest Price Oarcle: ${NestPriceOracle.address}`);
        const nestQuery = await NestPriceOracle.deployed();
        // function feedPrice(address token, uint256 ethAmount, uint256 erc20Amount, uint128 avgPrice, int128 vola) external {
        await nestQuery.feedPrice(USDT.address, "30000000000000000000", "39010500000", "1320675549", "7511686039347830");
        await nestQuery.feedPrice(HBTC.address, "30000000000000000000", "1129440000000000000", "38071631665285588", "5441325017383007");
        await nestQuery.feedPrice(NEST.address, "30000000000000000000", "1149043740265046089421137", "38301458008834869647371", "6231125516313609");

        const pUSDT = await nestQuery.latestPrice(USDT.address);
        const pHBTC = await nestQuery.latestPrice(HBTC.address);
        const pNEST = await nestQuery.latestPrice(NEST.address);
        console.log(`pUSDT: ${USDT.address}, ethAmount: ${pUSDT.ethAmount.toString()}, erc20Amount: ${pUSDT.tokenAmount.toString()}, avgPrice: ${pUSDT.avgPrice.toString()}, vola: ${pUSDT.vola.toString()}, bn: ${pUSDT.bn.toString()}`);
        console.log(`pHBTC: ${USDT.address}, ethAmount: ${pHBTC.ethAmount.toString()}, erc20Amount: ${pHBTC.tokenAmount.toString()}, avgPrice: ${pHBTC.avgPrice.toString()}, vola: ${pHBTC.vola.toString()}, bn: ${pHBTC.bn.toString()}`);
        console.log(`pNEST: ${NEST.address}, ethAmount: ${pNEST.ethAmount.toString()}, erc20Amount: ${pNEST.tokenAmount.toString()}, avgPrice: ${pNEST.avgPrice.toString()}, vola: ${pNEST.vola.toString()}, bn: ${pNEST.bn.toString()}`);
        UniswapFactory = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
        // CoFiToken = await CoFiToken.at("0x72Fd35b1dB364db812A8E726891685A25a9135D3");
        await deployer.deploy(CoFiToken);
        // CoFiXNode = await CoFiXNode.at("0x655C281DC8610003d8AE490D462B950BdA71582f");
        await deployer.deploy(CoFiXNode);
    }

    // CoFiXFactory
    await deployer.deploy(CoFiXFactory, WETH9.address);

    // CoFiXRouter
    await deployer.deploy(CoFiXRouter, CoFiXFactory.address, UniswapFactory, WETH9.address);

    // CoFiXController
    await deployer.deploy(CoFiXController, NestPriceOracle.address, NEST.address, CoFiXFactory.address);

    // CoFiStakingRewards
    await deployer.deploy(CoFiStakingRewards, WETH9.address, CoFiToken.address, CoFiXFactory.address);

    // VaultForLP
    await deployer.deploy(CoFiXVaultForLP, CoFiToken.address, CoFiXFactory.address);

    // VaultForTrader
    await deployer.deploy(CoFiXVaultForTrader, CoFiToken.address, CoFiXFactory.address);

    // VaultForCNode
    await deployer.deploy(CoFiXVaultForCNode, CoFiToken.address, CoFiXFactory.address);

    // CoFiXDAO
    await deployer.deploy(CoFiXDAO, CoFiToken.address, CoFiStakingRewards.address, CoFiXFactory.address);

    let controller = await CoFiXController.deployed();

    // activate oracle
    if (network == "mainnet" || network == "mainnet-fork") {
        console.log(`approving nest to controller ${controller.address}`);
        await NEST.approve(NestPriceOracle.address, "0");
        console.log(`activating controller ${controller.address}`);
        await NestPriceOracle.activate(controller.address);
    }
    // add caller
    await controller.addCaller(CoFiXDAO.address);

    // set theta
    const theta = "200000";
    console.log(`setting theta for ${USDT.address}`);
    await controller.setTheta(USDT.address, theta);
    console.log(`setting theta for ${HBTC.address}`);
    await controller.setTheta(HBTC.address, theta);
    console.log(`setting theta for ${NEST.address}`);
    await controller.setTheta(NEST.address, theta);

    // set controller in factory
    let factory = await CoFiXFactory.deployed();
    await factory.setController(CoFiXController.address);
    await factory.setVaultForLP(CoFiXVaultForLP.address);
    await factory.setVaultForTrader(CoFiXVaultForTrader.address);
    await factory.setVaultForCNode(CoFiXVaultForCNode.address);
    await factory.setFeeReceiver(CoFiStakingRewards.address);
    await factory.setDAO(CoFiXDAO.address);
    
    // allowRouter
    console.log(`start allowRouter`);
    let vaultForTrader = await CoFiXVaultForTrader.deployed();
    await vaultForTrader.allowRouter(CoFiXRouter.address);
    console.log("allowRouter successfully for CoFiXRouter03");

    await deployer.deploy(CNodeStakingRewards, CoFiToken.address, CoFiXNode.address, CoFiXFactory.address);
    // set cnode pool
    let vaultForCNode = await CoFiXVaultForCNode.deployed();
    await vaultForCNode.setCNodePool(CNodeStakingRewards.address);
    const cnodePool = await vaultForCNode.cnodePool();
    console.log(`setCNodePool, CNodeStakingRewards.address: ${CNodeStakingRewards.address}, cnodePool: ${cnodePool}`);

    // set from multi sig gov for mainnet release
    // // set controller in factory
    if (network == "ropsten" || network == "ropsten-fork") {
        console.log(`setting controller of CoFiXFactory`);
        // createPair(address token, uint256 initToken0Amount, uint256 initToken1Amount)   
        await factory.createPair(USDT.address, "1000000000000000000", "1500000000"); // ETH/USDT 1:1500
        await factory.createPair(HBTC.address, "30000000000000000000", "1000000000000000000"); // ETH/HBTC  30:1
        await factory.createPair(NEST.address, "1000000000000000000", "10000000000000000000000"); // ETH/nest  1：10000
        const usdtPair = await factory.getPair(USDT.address);
        const hbtcPair = await factory.getPair(HBTC.address);
        const nestPair = await factory.getPair(NEST.address);
        await factory.setTradeMiningStatus(USDT.address, true);
        await factory.setTradeMiningStatus(HBTC.address, true);
        await factory.setTradeMiningStatus(NEST.address, true);

        // set minter of cofiToken
        let cofiToken = await CoFiToken.deployed();
        await cofiToken.addMinter(CoFiXVaultForTrader.address);
        await cofiToken.addMinter(CoFiXVaultForLP.address);
        await cofiToken.addMinter(CoFiXVaultForCNode.address);

        // deploy USDT HBTC NEST LP Token Rewards Pool (deployCoFiXStakingRewards)
        let CoFiXStakingRewardsForUSDT = await CoFiXStakingRewards.new(CoFiToken.address, usdtPair, CoFiXFactory.address);
        let CoFiXStakingRewardsForHBTC = await CoFiXStakingRewards.new(CoFiToken.address, hbtcPair, CoFiXFactory.address);
        let CoFiXStakingRewardsForNEST = await CoFiXStakingRewards.new(CoFiToken.address, nestPair, CoFiXFactory.address);

        // add pool and set pool weight
        let vaultForLP = await CoFiXVaultForLP.deployed();
        console.log(`CoFiXStakingRewardsForUSDT.address: ${CoFiXStakingRewardsForUSDT.address}, CoFiXStakingRewardsForHBTC: ${CoFiXStakingRewardsForHBTC.address}, CoFiXStakingRewardsForNEST: ${CoFiXStakingRewardsForNEST.address}`);
        await vaultForLP.addPool(CoFiXStakingRewardsForUSDT.address);
        await vaultForLP.addPool(CoFiXStakingRewardsForHBTC.address);
        await vaultForLP.addPool(CoFiXStakingRewardsForNEST.address);
        await vaultForLP.batchSetPoolWeight([CoFiXStakingRewardsForUSDT.address, CoFiXStakingRewardsForHBTC.address, CoFiXStakingRewardsForNEST.address], ["20", "20", "60"]);
        const usdtPoolInfo = await vaultForLP.getPoolInfo(CoFiXStakingRewardsForUSDT.address);
        console.log(`getPoolInfo, CoFiXStakingRewardsForUSDT.address: ${CoFiXStakingRewardsForUSDT.address}, state: ${usdtPoolInfo.state}, weight: ${usdtPoolInfo.weight}`);
        const hbtcPoolInfo = await vaultForLP.getPoolInfo(CoFiXStakingRewardsForHBTC.address);
        console.log(`getPoolInfo, CoFiXStakingRewardsForHBTC.address: ${CoFiXStakingRewardsForHBTC.address}, state: ${hbtcPoolInfo.state}, weight: ${hbtcPoolInfo.weight}`);
        const nestPoolInfo = await vaultForLP.getPoolInfo(CoFiXStakingRewardsForNEST.address);
        console.log(`getPoolInfo, CoFiXStakingRewardsForNEST.address: ${CoFiXStakingRewardsForNEST.address}, state: ${nestPoolInfo.state}, weight: ${nestPoolInfo.weight}`);

        console.log(`| ETH/USDT Pair02 | ${usdtPair} |`);
        console.log(`| ETH/HBTC Pair02 | ${hbtcPair} |`);
        console.log(`| ETH/NEST Pair02 | ${nestPair} |`);

        console.log(`| CoFiXStakingRewards02 ETH/USDT Pair | ${CoFiXStakingRewardsForUSDT.address} |`);
        console.log(`| CoFiXStakingRewards02 ETH/HBTC Pair | ${CoFiXStakingRewardsForHBTC.address} |`);
        console.log(`| CoFiXStakingRewards02 ETH/NEST Pair | ${CoFiXStakingRewardsForNEST.address} |`);
    }

    console.log(`Contract Deployed Summary\n=========================`);
    
    console.log(`| CoFiToken | ${CoFiToken.address} |`);
    console.log(`| CoFiXNode | ${CoFiXNode.address} |`);

    console.log(`| CoFiXFactory02 | ${CoFiXFactory.address} |`);
    console.log(`| CoFiXRouter03 | ${CoFiXRouter.address} |`);
    console.log(`| CoFiXController04 | ${CoFiXController.address} |`);

    console.log(`| CoFiXVaultForLP02 | ${CoFiXVaultForLP.address} |`);
    console.log(`| CoFiXVaultForTrader02 | ${CoFiXVaultForTrader.address} |`);
    console.log(`| CoFiXVaultForCNode02 | ${CoFiXVaultForCNode.address} |`);
    console.log(`| CoFiStakingRewards02 | ${CoFiStakingRewards.address} |`);

    console.log(`| CNodeStakingRewards02 CNode | ${CNodeStakingRewards.address} |`);

    // check deploying results
    const pairCnt = await factory.allPairsLength();
    for (let i = 0; i < pairCnt; i++) {
        const pair = await factory.allPairs(i);
        // await controller.addCaller(pair);
        const allowed = await controller.callerAllowed(pair);
        const CPair = await CoFiXPair.at(pair);
        const token = await CPair.token1();
        const kInfo = await controller.getKInfo(token);
        console.log(`pair: ${pair}, allowed: ${allowed}, token: ${token}, k: ${kInfo.k}, theta: ${kInfo.theta.toString()}`);
    }

};