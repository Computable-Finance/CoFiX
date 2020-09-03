const USDT = artifacts.require("test/USDT");
const HBTC = artifacts.require("test/HBTC");
const NEST = artifacts.require("test/NEST");
const WETH9 = artifacts.require("test/WETH9");
const NEST3PriceOracleMock = artifacts.require("mock/NEST3PriceOracleMock");
const CoFiXFactory = artifacts.require("CoFiXFactory");
const CoFiXRouter = artifacts.require("CoFiXRouter");
const CoFiXController = artifacts.require("CoFiXController");
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

    // NEST3 Price Oracle Mock
    await deployer.deploy(NEST3PriceOracleMock, NEST.address);

    // let controller = await CoFiXController.deployed();
    // await controller.initialize(NEST3PriceOracleMock.address);

    // // Wait for NEST Oracle sending eth by `call` instead of `transfer`
    // await deployProxy(CoFiXController, [NEST3PriceOracleMock.address], { deployer });

    // CoFiXFactory
    await deployer.deploy(CoFiXFactory, WETH9.address);

    // CoFiXController
    await deployer.deploy(CoFiXController, NEST3PriceOracleMock.address, NEST.address, CoFiXFactory.address);

    // set controller in factory
    let factory = await CoFiXFactory.deployed();
    await factory.setController(CoFiXController.address);

    // CoFiXRouter
    await deployer.deploy(CoFiXRouter, CoFiXFactory.address, WETH9.address);

    console.log(`Contract Deployed Summary\n=========================`);
    console.log(`| USDT | ${USDT.address} |`);
    console.log(`| HBTC | ${HBTC.address} |`);
    console.log(`| WETH9 | ${WETH9.address} |`);
    console.log(`| NEST3PriceOracleMock | ${NEST3PriceOracleMock.address} |`);
    console.log(`| CoFiXController | ${CoFiXController.address} |`);
    console.log(`| CoFiXFactory | ${CoFiXFactory.address} |`);
    console.log(`| CoFiXRouter | ${CoFiXRouter.address} |`);
};