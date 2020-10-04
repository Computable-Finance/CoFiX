const NEST3PriceOracleMock = artifacts.require("NEST3PriceOracleConstMock");
const CoFiXController = artifacts.require("CoFiXController");
const CoFiXFactory = artifacts.require("CoFiXFactory");
const CoFiXKTable = artifacts.require("CoFiXKTable");
const NEST3VoteFactoryMock = artifacts.require("NEST3VoteFactoryMock");
const ERC20 = artifacts.require("TestERC20");
const { BN } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-environment');
const Decimal = require('decimal.js');

const argv = require('yargs').argv;

module.exports = async function (callback) {

    try {
        // todo: use vote factory
        console.log(`argv> nest=${argv.nest}, votefactory=${argv.vote}, factory=${argv.factory}, table=${argv.table}`);

        const NEST = await ERC20.at(argv.nest);
        // const PriceOracle = await NEST3PriceOracleMock.at(argv.oracle);
        const NEST3VoteFactory = await NEST3VoteFactoryMock.at(argv.vote);
        const Factory = await CoFiXFactory.at(argv.factory);
        const Table = await CoFiXKTable.at(argv.table);

        // CoFiXController
        // await deployer.deploy(CoFiXController, NEST3PriceOracleMock.address, NEST.address, CoFiXFactory.address, CoFiXKTable.address);
        // await deployer.deploy(CoFiXController, NEST3VoteFactory.address, NEST.address, CoFiXFactory.address, CoFiXKTable.address);
        const Controller = await CoFiXController.new(NEST3VoteFactory.address, NEST.address, Factory.address, Table.address);

        console.log("new Controller deployed at:", Controller.address);

        callback();
    } catch (e) {
        callback(e);
    }
}