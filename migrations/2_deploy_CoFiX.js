var USDT = artifacts.require("test/USDT");
var HBTC = artifacts.require("test/HBTC");
var NEST = artifacts.require("test/NEST");
var WETH9 = artifacts.require("test/WETH9");
// const NEST3PriceOracleMock = artifacts.require("mock/NEST3PriceOracleMock");
var NestPriceOracle = artifacts.require("mock/NEST3PriceOracleAutoUpdateConstMock");
var CoFiXKTable = artifacts.require("CoFiXKTable");
const CoFiXFactory = artifacts.require("CoFiXFactory");
const CoFiXController = artifacts.require("CoFiXController");
const CoFiXRouter = artifacts.require("CoFiXRouter");
const CoFiXVaultForLP = artifacts.require("CoFiXVaultForLP");
const CoFiXVaultForTrader = artifacts.require("CoFiXVaultForTrader");
const CoFiXVaultForCNode = artifacts.require("CoFiXVaultForCNode");
const CoFiStakingRewards = artifacts.require("CoFiStakingRewards");
const CoFiToken = artifacts.require("CoFiToken");
var CoFiXNode = artifacts.require("CoFiXNode");
const CoFiXStakingRewards = artifacts.require("CoFiXStakingRewards.sol");
// const CoFiXStakingRewardsForHBTC = artifacts.require("CoFiXStakingRewards.sol");
const CNodeStakingRewards = artifacts.require("CNodeStakingRewards.sol");


var NEST3VoteFactory = artifacts.require("NEST3VoteFactoryMock");

const { deployProxy } = require('@openzeppelin/truffle-upgrades');


module.exports = async function (deployer, network) {

    console.log(`truffle deploying to ${network} network`);

    if (network == "mainnet" || network == "mainnet-fork") {
        USDT = await USDT.at("0xdAC17F958D2ee523a2206206994597C13D831ec7");
        HBTC = await HBTC.at("0x0316EB71485b0Ab14103307bf65a021042c6d380");
        NEST = await NEST.at("0x04abEdA201850aC0124161F037Efd70c74ddC74C");
        WETH9 = await WETH9.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
        NestPriceOracle = await NestPriceOracle.at("0x94F36FAa6bB4f74009637292b09C355CcD3e80Eb");
        NEST3VoteFactory = await NEST3VoteFactory.at("0x6Cd5698E8854Fb6879d6B1C694223b389B465dea");
        const offerPrice = await NEST3VoteFactory.checkAddress("nest.v3.offerPrice");
        console.log(`NEST3VoteFactory: ${NEST3VoteFactory.address}, NestPriceOracle: ${NestPriceOracle.address}, offerPrice: ${offerPrice}`);
        CoFiXKTable = await CoFiXKTable.at("0x75E360Be6248Bd46030C6818624a09403EF5eC21");
        CoFiXNode = await CoFiXNode.at("0x558201DC4741efc11031Cdc3BC1bC728C23bF512");
    } else if (network == "ropsten" || network == "ropsten-fork") {
        USDT = await USDT.at("0x200506568C2980B4943B5EaA8713A5740eb2c98A");
        HBTC = await HBTC.at("0xA674f71ce49CE7F298aea2F23D918d114965eb40");
        NEST = await NEST.at("0xD287Bc43eCD3D892204aA3792165fe8728636E29");
        WETH9 = await WETH9.at("0x59b8881812Ac484Ab78b8fc7c10b2543e079a6C3");
        NestPriceOracle = await NestPriceOracle.at("0x70B9b6F0e1E4073403cF7143b45a862fe73af3B9");
        // Vote Factory
        await deployer.deploy(NEST3VoteFactory, NestPriceOracle.address);
        CoFiXKTable = await CoFiXKTable.at("0xe609B978635c7Bb8D22Ffc4Ec7f7a16615a3b1cA");
        // CNode Token
        await deployer.deploy(CoFiXNode);
    } else {
        // USDT Test Token
        await deployer.deploy(USDT);
        // HBTC Test Token
        await deployer.deploy(HBTC);
        // NEST Test Token
        await deployer.deploy(NEST);
        // WETH contract
        await deployer.deploy(WETH9);
        // NEST3 Price Oracle Mock
        await deployer.deploy(NestPriceOracle, NEST.address);
        // Vote Factory
        await deployer.deploy(NEST3VoteFactory, NestPriceOracle.address);
        // CoFiXTable
        await deployer.deploy(CoFiXKTable);
        // CNode Token
        await deployer.deploy(CoFiXNode);
    }

    // CoFi Token
    await deployer.deploy(CoFiToken);

    // CoFiXFactory
    await deployer.deploy(CoFiXFactory, WETH9.address);

    // CoFiXRouter
    await deployer.deploy(CoFiXRouter, CoFiXFactory.address, WETH9.address);

    // CoFiXController
    await deployer.deploy(CoFiXController, NEST3VoteFactory.address, NEST.address, CoFiXFactory.address, CoFiXKTable.address);

    // CoFiStakingRewards
    await deployer.deploy(CoFiStakingRewards, WETH9.address, CoFiToken.address);

    // VaultForLP
    await deployer.deploy(CoFiXVaultForLP, CoFiToken.address, CoFiXFactory.address);

    // VaultForTrader
    await deployer.deploy(CoFiXVaultForTrader, CoFiToken.address, CoFiXFactory.address);

    // VaultForCNode
    await deployer.deploy(CoFiXVaultForCNode, CoFiToken.address, CoFiXFactory.address);

    // activate oracle
    if (network == "mainnet" || network == "mainnet-fork") {
        let controller = await CoFiXController.deployed();
        await NEST.approve(CoFiXController.address, "0");
        await controller.activate();
        const theta = "200000";
        await controller.setTheta(USDT.address, theta);
        await controller.setTheta(HBTC.address, theta);
    }

    // set minter of cofiToken
    let cofiToken = await CoFiToken.deployed();
    await cofiToken.addMinter(CoFiXVaultForLP.address);
    await cofiToken.addMinter(CoFiXVaultForTrader.address);
    await cofiToken.addMinter(CoFiXVaultForCNode.address);

    // set controller in factory
    let factory = await CoFiXFactory.deployed();
    await factory.setController(CoFiXController.address);
    await factory.setVaultForLP(CoFiXVaultForLP.address);
    await factory.setVaultForTrader(CoFiXVaultForTrader.address);
    await factory.setVaultForCNode(CoFiXVaultForCNode.address);
    await factory.setFeeReceiver(CoFiStakingRewards.address);
    await factory.createPair(USDT.address);
    await factory.createPair(HBTC.address);
    const usdtPair = await factory.getPair(USDT.address);
    const hbtcPair = await factory.getPair(HBTC.address);
    await factory.setTradeMiningStatus(USDT.address, true);
    await factory.setTradeMiningStatus(HBTC.address, true);

    // allowRouter
    let vaultForTrader = await CoFiXVaultForTrader.deployed();
    await vaultForTrader.allowRouter(CoFiXRouter.address);

    // deploy USDT and HBTC LP Token Rewards Pool (deployCoFiXStakingRewards)
    let CoFiXStakingRewardsForUSDT = await CoFiXStakingRewards.new(CoFiToken.address, usdtPair, CoFiXFactory.address);
    let CoFiXStakingRewardsForHBTC = await CoFiXStakingRewards.new(CoFiToken.address, hbtcPair, CoFiXFactory.address);

    // add pool and set pool weight
    let vaultForLP = await CoFiXVaultForLP.deployed();
    console.log(`CoFiXStakingRewardsForUSDT.address: ${CoFiXStakingRewardsForUSDT.address}, CoFiXStakingRewardsForHBTC: ${CoFiXStakingRewardsForHBTC.address}`);
    await vaultForLP.addPool(CoFiXStakingRewardsForUSDT.address);
    await vaultForLP.addPool(CoFiXStakingRewardsForHBTC.address);
    await vaultForLP.batchSetPoolWeight([CoFiXStakingRewardsForUSDT.address, CoFiXStakingRewardsForHBTC.address], ["67", "33"]);
    const usdtPoolInfo = await vaultForLP.getPoolInfo(CoFiXStakingRewardsForUSDT.address);
    console.log(`getPoolInfo, CoFiXStakingRewardsForUSDT.address: ${CoFiXStakingRewardsForUSDT.address}, state: ${usdtPoolInfo.state}, weight: ${usdtPoolInfo.weight}`);
    const hbtcPoolInfo = await vaultForLP.getPoolInfo(CoFiXStakingRewardsForHBTC.address);
    console.log(`getPoolInfo, CoFiXStakingRewardsForHBTC.address: ${CoFiXStakingRewardsForHBTC.address}, state: ${hbtcPoolInfo.state}, weight: ${hbtcPoolInfo.weight}`);

    // deploy CNode Rewards Pool (deployCNodeStakingRewards)
    // await CNodeStakingRewards.new(CoFi.address, CNode.address, CFactory.address);
    await deployer.deploy(CNodeStakingRewards, CoFiToken.address, CoFiXNode.address, CoFiXFactory.address);
    // set cnode pool
    let vaultForCNode = await CoFiXVaultForCNode.deployed();
    await vaultForCNode.setCNodePool(CNodeStakingRewards.address);
    const cnodePool = await vaultForCNode.cnodePool();
    console.log(`setCNodePool, CNodeStakingRewards.address: ${CNodeStakingRewards.address}, cnodePool: ${cnodePool}`);

    console.log(`Contract Deployed Summary\n=========================`);
    console.log(`| USDT | ${USDT.address} |`);
    console.log(`| HBTC | ${HBTC.address} |`);
    console.log(`| NEST | ${NEST.address} |`);
    console.log(`| WETH | ${WETH9.address} |`);
    console.log(`| NestPriceOracle | ${NestPriceOracle.address} |`);
    console.log(`| NEST3VoteFactory | ${NEST3VoteFactory.address} |`);
    console.log(`| CoFiXKTable | ${CoFiXKTable.address} |`);

    console.log(`| CoFiToken | ${CoFiToken.address} |`);
    console.log(`| CoFiXNode | ${CoFiXNode.address} |`);

    console.log(`| CoFiXFactory | ${CoFiXFactory.address} |`);
    console.log(`| CoFiXRouter | ${CoFiXRouter.address} |`);
    console.log(`| CoFiXController | ${CoFiXController.address} |`);

    console.log(`| CoFiXVaultForLP | ${CoFiXVaultForLP.address} |`);
    console.log(`| CoFiXVaultForTrader | ${CoFiXVaultForTrader.address} |`);
    console.log(`| CoFiXVaultForCNode | ${CoFiXVaultForCNode.address} |`);
    console.log(`| CoFiStakingRewards | ${CoFiStakingRewards.address} |`);

    console.log(`| ETH/USDT Pair | ${usdtPair} |`);
    console.log(`| ETH/HBTC Pair | ${hbtcPair} |`);

    console.log(`| CoFiXStakingRewards ETH/USDT Pair | ${CoFiXStakingRewardsForUSDT.address} |`);
    console.log(`| CoFiXStakingRewards ETH/HBTC Pair | ${CoFiXStakingRewardsForHBTC.address} |`);
    console.log(`| CNodeStakingRewards CNode | ${CNodeStakingRewards.address} |`);

};