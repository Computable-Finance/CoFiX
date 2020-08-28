const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const CofiXRouter = artifacts.require("CofiXRouter");
// const ERC20 = artifacts.require("ERC20");
const CofiXFactory = artifacts.require("CofiXFactory");
const CofiXPair = artifacts.require("CofiXPair");
const WETH9 = artifacts.require("WETH9");
const NEST3PriceOracleMock = artifacts.require("NEST3PriceOracleMock");
const CofiXController = artifacts.require("CofiXController");
const TestUSDT = artifacts.require("test/USDT");
const TestHBTC = artifacts.require("test/HBTC");


contract('CofiXRouter', (accounts) => {

    const owner = accounts[0];
    let deployer = owner;
    let LP = owner;
    let trader = owner;

    before(async () => {
        USDT = await TestUSDT.new({ from: deployer });
        HBTC = await TestHBTC.new({ from: deployer });
        WETH = await WETH9.deployed();
        PriceOracle = await NEST3PriceOracleMock.deployed();
        CofiXCtrl = await CofiXController.deployed();
        CFactory = await CofiXFactory.deployed();
        CRouter = await CofiXRouter.deployed();
    });

    

});