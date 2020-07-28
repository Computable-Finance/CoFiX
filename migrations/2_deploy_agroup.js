const ERC20 = artifacts.require("test/ERC20");
const WETH9 = artifacts.require("test/WETH9");
const NEST3PriceOracleMock = artifacts.require("mock/NEST3PriceOracleMock");
const AGroupFactory = artifacts.require("AGroupFactory");
const AGroupRouter = artifacts.require("AGroupRouter");

module.exports = async function(deployer) {

    // Test token
    // let totalSupply = (10**12)*(10**6);  
    await deployer.deploy(ERC20, "10000000000000000", "USDT Test Token", "USDT", 6);

    // WETH contract
    await deployer.deploy(WETH9);

    // NEST3 Price Oracle Mock
    await deployer.deploy(NEST3PriceOracleMock, WETH9.address);

    // AGroupFactory
    await deployer.deploy(AGroupFactory, NEST3PriceOracleMock.address, WETH9.address);

    // AGroupRouter
    await deployer.deploy(AGroupRouter, AGroupFactory.address, WETH9.address);

};