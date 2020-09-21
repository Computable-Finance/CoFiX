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
const CoFiToken = artifacts.require("CoFiToken");

const { deployProxy } = require('@openzeppelin/truffle-upgrades');


module.exports = async function (deployer, network) {

    console.log(`truffle deploying to ${network} network`);

    if (network == "mainnet" || network == "mainnet-fork") {
        USDT = await USDT.at("0xdAC17F958D2ee523a2206206994597C13D831ec7");
        HBTC = await HBTC.at("0x0316EB71485b0Ab14103307bf65a021042c6d380");
        NEST = await NEST.at("0x04abEdA201850aC0124161F037Efd70c74ddC74C");
        WETH9 = await WETH9.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
        NestPriceOracle = await NestPriceOracle.at("0x7722891Ee45aD38AE05bDA8349bA4CF23cFd270F");
    } else if (network == "ropsten" || network == "ropsten-fork") {
        USDT = await USDT.at("0x200506568C2980B4943B5EaA8713A5740eb2c98A");
        HBTC = await HBTC.at("0xA674f71ce49CE7F298aea2F23D918d114965eb40");
        NEST = await NEST.at("0xD287Bc43eCD3D892204aA3792165fe8728636E29");
        WETH9 = await WETH9.at("0x59b8881812Ac484Ab78b8fc7c10b2543e079a6C3");
        NestPriceOracle = await NestPriceOracle.at("0x70B9b6F0e1E4073403cF7143b45a862fe73af3B9");
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
    }

    // CoFi Token

    await deployer.deploy(CoFiToken);

    // VaultForLP
    await deployer.deploy(CoFiXVaultForLP, CoFiToken.address);

    // CoFiXFactory
    await deployer.deploy(CoFiXFactory, WETH9.address, CoFiXVaultForLP.address);

    await deployer.deploy(CoFiXKTable);

    // CoFiXController
    await deployer.deploy(CoFiXController, NestPriceOracle.address, NEST.address, CoFiXFactory.address, CoFiXKTable.address);

    // set controller in factory
    let factory = await CoFiXFactory.deployed();
    await factory.setController(CoFiXController.address);

    // CoFiXRouter
    await deployer.deploy(CoFiXRouter, CoFiXFactory.address, WETH9.address);

    console.log(`Contract Deployed Summary\n=========================`);
    console.log(`| USDT | ${USDT.address} |`);
    console.log(`| HBTC | ${HBTC.address} |`);
    console.log(`| NEST | ${NEST.address} |`);
    console.log(`| WETH | ${WETH9.address} |`);
    console.log(`| CoFiToken | ${CoFiToken.address} |`);
    console.log(`| NestPriceOracle | ${NestPriceOracle.address} |`);
    console.log(`| CoFiXController | ${CoFiXController.address} |`);
    console.log(`| CoFiXFactory | ${CoFiXFactory.address} |`);
    console.log(`| CoFiXKTable | ${CoFiXKTable.address} |`);
    console.log(`| CoFiXRouter | ${CoFiXRouter.address} |`);
    console.log(`| CoFiXVaultForLP | ${CoFiXVaultForLP.address} |`);
};