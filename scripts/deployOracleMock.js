const NEST3PriceOracleMock = artifacts.require("NEST3PriceOracleAutoUpdateConstMock.sol");
const ERC20 = artifacts.require("TestERC20");
const { BN } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-environment');
const Decimal = require('decimal.js');

const argv = require('yargs').argv;

module.exports = async function (callback) {

    try {
        console.log(`argv> nest=${argv.nest}`);
        const NEST = await ERC20.at(argv.nest);

        // await deployer.deploy(NEST3PriceOracleMock, NEST.address);
        const PriceOracle = await NEST3PriceOracleMock.new(NEST.address);

        console.log("new PriceOracle deployed at:", PriceOracle.address);

        callback();
    } catch (e) {
        callback(e);
    }
}