const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CofiXRouter = artifacts.require("CofiXRouter");
// const ERC20 = artifacts.require("ERC20");
const CofiXFactory = artifacts.require("CofiXFactory");
const CofiXPair = artifacts.require("CofiXPair");
const WETH9 = artifacts.require("WETH9");
// const NEST3PriceOracleMock = artifacts.require("NEST3PriceOracleMock");
const NEST3PriceOracleConstMock = artifacts.require("NEST3PriceOracleConstMock");
const CofiXController = artifacts.require("CofiXController");
const TestUSDT = artifacts.require("test/USDT");
const TestHBTC = artifacts.require("test/HBTC");
const verbose = process.env.VERBOSE;

contract('CofiXRouter', (accounts) => {

    const owner = accounts[0];
    let deployer = owner;
    let LP = owner;
    let trader = owner;

    let ethAmount = new BN("10000000000000000000");
    let usdtAmount = new BN("3862600000");

    before(async () => {
        USDT = await TestUSDT.new({ from: deployer });
        HBTC = await TestHBTC.new({ from: deployer });
        WETH = await WETH9.new();
        ConstOracle = await NEST3PriceOracleConstMock.new({ from: deployer });
        CofiXCtrl = await CofiXController.new();
        await CofiXCtrl.initialize(ConstOracle.address, { from: deployer });
        CFactory = await CofiXFactory.new(CofiXCtrl.address, WETH.address, { from: deployer });
        CRouter = await CofiXRouter.new(CFactory.address, WETH.address, { from: deployer });
    });

    describe('addLiquidity()', function () {
        it("should add liquidity for ETH correctly", async () => {
            for (let i = 0; i < 50; i++) {
                await time.advanceBlock();
            }
            await ConstOracle.feedPrice(USDT.address, ethAmount, usdtAmount, { from: deployer });
            let _amountETH = web3.utils.toWei('1', 'ether');
            let _msgValue = web3.utils.toWei('1.1', 'ether');

            let usdtPairAddr = "0x0000000000000000000000000000000000000000";
            let wethInUSDTPoolBefore = await WETH.balanceOf(usdtPairAddr);
            let usdtInUSDTPoolBefore = await USDT.balanceOf(usdtPairAddr);
            let ethUserBalanceBefore = await web3.eth.getBalance(LP);
            let usdtUserBalanceBefore = await USDT.balanceOf(LP);

            let result = await CRouter.addLiquidity(USDT.address, _amountETH, 0, 0, LP, "99999999999", { from: LP, value: _msgValue, gasPrice: 0});
            usdtPairAddr = await CFactory.getPair(USDT.address);
            USDTPair = await CofiXPair.at(usdtPairAddr);
            console.log("------------addLiquidity for USDT/ETH Pool with ETH------------");
            let liquidityUSDTPair = await USDTPair.balanceOf(LP);
            let wethInUSDTPoolAfter = await WETH.balanceOf(usdtPairAddr);
            let usdtInUSDTPoolAfter = await USDT.balanceOf(usdtPairAddr);
            let ethUserBalanceAfter = await web3.eth.getBalance(LP);
            let usdtUserBalanceAfter = await USDT.balanceOf(LP);
            if (verbose) {
                console.log(`gasUsed: ${result.receipt.gasUsed}`);
                console.log(`before>pool balance WETH: ${wethInUSDTPoolBefore.toString()}`);
                console.log(`before>pool balance USDT: ${usdtInUSDTPoolBefore.toString()}`);
                console.log(`before>user balance ETH: ${ethUserBalanceBefore.toString()}`);
                console.log(`before>user balance USDT: ${usdtUserBalanceBefore.toString()}`);
                console.log(`-------`);
                console.log(`got liquidity of ETH/USDT Pool: ${liquidityUSDTPair.toString()}`);
                console.log(`after>pool balance WETH: ${wethInUSDTPoolAfter.toString()}`);
                console.log(`after>pool balance USDT: ${usdtInUSDTPoolAfter.toString()}`);
                console.log(`after>user balance ETH: ${ethUserBalanceAfter.toString()}`);
                console.log(`after>user balance USDT: ${usdtUserBalanceAfter.toString()}`);
            }
        });


        it("should add liquidity for USDT correctly", async () => {

        });
    });

    describe('template', function () {
        it("test", async () => {
        });
    });

});