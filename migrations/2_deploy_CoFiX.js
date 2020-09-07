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
const { deployProxy } = require('@openzeppelin/truffle-upgrades');


module.exports = async function(deployer) {

    // USDT Test Token
    await deployer.deploy(USDT);

    // HBTC Test Token
    await deployer.deploy(HBTC);

    // NEST Test Token
    await deployer.deploy(NEST);

    // WETH contract
    await deployer.deploy(WETH9);

    // USDT = await USDT.at("0xD52d3bfCA0d39E4bD5378e0BBa8AD245C3F58C17");
    // HBTC = await HBTC.at("0x9aA0AF152cf141740f19D335b5ddE1F0E51008A7");
    // NEST = await NEST.at("0xB9746A8572DB5C27597fE88B86B6520599Bf62d4");
    // WETH9 = await WETH9.at("0xB3d7C7993BE7bEec23D005552224B2dAf18Bd85E");

    // NEST3 Price Oracle Mock
    await deployer.deploy(NestPriceOracle, NEST.address);

    // CoFiXFactory
    await deployer.deploy(CoFiXFactory, WETH9.address);

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
    console.log(`| NestPriceOracle | ${NestPriceOracle.address} |`);
    console.log(`| CoFiXController | ${CoFiXController.address} |`);
    console.log(`| CoFiXFactory | ${CoFiXFactory.address} |`);
    console.log(`| CoFiXKTable | ${CoFiXKTable.address} |`);
    console.log(`| CoFiXRouter | ${CoFiXRouter.address} |`);
};