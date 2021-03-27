const NEST3PriceOracleMock = artifacts.require("NEST3PriceOracleConstMock");
const CoFiXController = artifacts.require("CoFiXV2Controller");
const CoFiXFactory = artifacts.require("CoFiXV2Factory");
const ERC20 = artifacts.require("TestERC20");
const { BN } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-environment');
const Decimal = require('decimal.js');

const argv = require('yargs').argv;

module.exports = async function (callback) {

    try {
        // todo: use vote factory
        console.log(`argv> nest=${argv.nest}, oracle=${argv.oracle}, factory=${argv.factory}`);

        const NEST = await ERC20.at(argv.nest);
        const PriceOracle = await NEST3PriceOracleMock.at(argv.oracle);
        // const NEST3VoteFactory = await NEST3VoteFactoryMock.at(argv.vote);
        const Factory = await CoFiXFactory.at(argv.factory);

        // CoFiXController
        await deployer.deploy(CoFiXController, PriceOracle.address, NEST.address, Factory.address);
        // await deployer.deploy(CoFiXController, NEST3VoteFactory.address, NEST.address, CoFiXFactory.address, CoFiXKTable.address);
        // const Controller = await CoFiXController.new(NEST3VoteFactory.address, NEST.address, Factory.address, Table.address);

        console.log("new Controller deployed at:", Controller.address);

        callback();
    } catch (e) {
        callback(e);
    }
}