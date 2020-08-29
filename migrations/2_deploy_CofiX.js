const USDT = artifacts.require("test/USDT");
const HBTC = artifacts.require("test/HBTC");
const WETH9 = artifacts.require("test/WETH9");
const NEST3PriceOracleMock = artifacts.require("mock/NEST3PriceOracleMock");
const CofiXFactory = artifacts.require("CofiXFactory");
const CofiXRouter = artifacts.require("CofiXRouter");
const CofiXController = artifacts.require("CofiXController");
const { deployProxy } = require('@openzeppelin/truffle-upgrades');


module.exports = async function(deployer) {

    // USDT Test Token
    await deployer.deploy(USDT);

    // HBTC Test Token
    await deployer.deploy(HBTC);

    // WETH contract
    await deployer.deploy(WETH9);

    // NEST3 Price Oracle Mock
    await deployer.deploy(NEST3PriceOracleMock);

    // CofiXController
    await deployer.deploy(CofiXController);

    let controller = await CofiXController.deployed();
    await controller.initialize(NEST3PriceOracleMock.address);

    // // Wait for NEST Oracle sending eth by `call` instead of `transfer`
    // await deployProxy(CofiXController, [NEST3PriceOracleMock.address], { deployer });

    // CofiXFactory
    await deployer.deploy(CofiXFactory, CofiXController.address, WETH9.address);

    // CofiXRouter
    await deployer.deploy(CofiXRouter, CofiXFactory.address, WETH9.address);

    console.log(`Contract Deployed Summary\n=========================`);
    console.log(`| USDT | ${USDT.address} |`);
    console.log(`| HBTC | ${HBTC.address} |`);
    console.log(`| WETH9 | ${WETH9.address} |`);
    console.log(`| NEST3PriceOracleMock | ${NEST3PriceOracleMock.address} |`);
    console.log(`| CofiXController | ${CofiXController.address} |`);
    console.log(`| CofixFactory | ${CofiXFactory.address} |`);
    console.log(`| CofixRouter | ${CofiXRouter.address} |`);
};