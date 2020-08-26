const ERC20 = artifacts.require("test/ERC20");
const WETH9 = artifacts.require("test/WETH9");
const NEST3PriceOracleMock = artifacts.require("mock/NEST3PriceOracleMock");
const CofiXFactory = artifacts.require("CofiXFactory");
const CofiXRouter = artifacts.require("CofiXRouter");
const CofiXController = artifacts.require("CofiXController");
const { deployProxy } = require('@openzeppelin/truffle-upgrades');


module.exports = async function(deployer) {

    // Test token
    // let totalSupply = (10**12)*(10**6);  
    await deployer.deploy(ERC20, "10000000000000000", "USDT Test Token", "USDT", 6);

    // WETH contract
    await deployer.deploy(WETH9);

    // NEST3 Price Oracle Mock
    await deployer.deploy(NEST3PriceOracleMock, WETH9.address);

    // CofiXController
    // await deployer.deploy(CofiXController, NEST3PriceOracleMock.address);
    await deployProxy(CofiXController, [NEST3PriceOracleMock.address], { deployer });

    // CofiXFactory
    await deployer.deploy(CofiXFactory, CofiXController.address, WETH9.address);

    // CofiXRouter
    await deployer.deploy(CofiXRouter, CofiXFactory.address, WETH9.address);

};