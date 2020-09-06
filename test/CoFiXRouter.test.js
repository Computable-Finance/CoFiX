const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiXRouter = artifacts.require("CoFiXRouter");
// const ERC20 = artifacts.require("ERC20");
const CoFiXFactory = artifacts.require("CoFiXFactory");
const CoFiXPair = artifacts.require("CoFiXPair");
const WETH9 = artifacts.require("WETH9");
// const NEST3PriceOracleMock = artifacts.require("mock/NEST3PriceOracleMock");
const NEST3PriceOracleConstMock = artifacts.require("NEST3PriceOracleConstMock");
const CoFiXController = artifacts.require("CoFiXController");
const TestUSDT = artifacts.require("test/USDT");
const TestHBTC = artifacts.require("test/HBTC");
const TestNEST = artifacts.require("test/NEST");
const CoFiXKTable = artifacts.require("CoFiXKTable");
const verbose = process.env.VERBOSE;

contract('CoFiXRouter', (accounts) => {

    const owner = accounts[0];
    let deployer = owner;
    let LP = owner;
    let trader = owner;

    let ethAmount = new BN("10000000000000000000");
    let usdtAmount = new BN("3862600000");

    before(async () => {
        USDT = await TestUSDT.new({ from: deployer });
        HBTC = await TestHBTC.new({ from: deployer });
        NEST = await TestNEST.new({ from: deployer });
        WETH = await WETH9.new();
        ConstOracle = await NEST3PriceOracleConstMock.new({ from: deployer });
        CFactory = await CoFiXFactory.new(WETH.address, { from: deployer });
        KTable = await CoFiXKTable.new({ from: deployer });
        CoFiXCtrl = await CoFiXController.new(ConstOracle.address, NEST.address, CFactory.address, KTable.address);
        await CFactory.setController(CoFiXCtrl.address);
        // await CoFiXCtrl.initialize(ConstOracle.address, { from: deployer });
        CRouter = await CoFiXRouter.new(CFactory.address, WETH.address, { from: deployer });
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
            let oracleBalanceBefore = await web3.eth.getBalance(ConstOracle.address);

            let result = await CRouter.addLiquidity(USDT.address, _amountETH, 0, 0, LP, "99999999999", { from: LP, value: _msgValue, gasPrice: 0});
            usdtPairAddr = await CFactory.getPair(USDT.address);
            USDTPair = await CoFiXPair.at(usdtPairAddr);
            console.log("------------addLiquidity for USDT/ETH Pool with ETH------------");
            let liquidityUSDTPair = await USDTPair.balanceOf(LP);
            let wethInUSDTPoolAfter = await WETH.balanceOf(usdtPairAddr);
            let usdtInUSDTPoolAfter = await USDT.balanceOf(usdtPairAddr);
            let ethUserBalanceAfter = await web3.eth.getBalance(LP);
            let usdtUserBalanceAfter = await USDT.balanceOf(LP);
            let oracleBalanceAfter = await web3.eth.getBalance(ConstOracle.address);
            if (verbose) {
                console.log(`gasUsed: ${result.receipt.gasUsed}`);
                console.log(`before>pool balance WETH: ${wethInUSDTPoolBefore.toString()}`);
                console.log(`before>pool balance USDT: ${usdtInUSDTPoolBefore.toString()}`);
                console.log(`before>user balance ETH: ${ethUserBalanceBefore.toString()}`);
                console.log(`before>user balance USDT: ${usdtUserBalanceBefore.toString()}`);
                console.log(`before>oracle balance ETH: ${oracleBalanceBefore.toString()}`);
                console.log(`-------`);
                console.log(`got liquidity of ETH/USDT Pool: ${liquidityUSDTPair.toString()}`);
                console.log(`after>pool balance WETH: ${wethInUSDTPoolAfter.toString()}`);
                console.log(`after>pool balance USDT: ${usdtInUSDTPoolAfter.toString()}`);
                console.log(`after>user balance ETH: ${ethUserBalanceAfter.toString()}`);
                console.log(`after>user balance USDT: ${usdtUserBalanceAfter.toString()}`);
                console.log(`after>oracle balance ETH: ${oracleBalanceAfter.toString()}`);
            }
            // compare balance
            let ethSpent = balanceDiff(ethUserBalanceAfter, ethUserBalanceBefore).mul(new BN('-1')); // after <= before
            let ethToPool = balanceDiff(wethInUSDTPoolAfter, wethInUSDTPoolBefore);
            let ethToOracle = balanceDiff(oracleBalanceAfter, oracleBalanceBefore);
            expect(_amountETH).to.bignumber.equal(ethToPool); // pool got the eth amount user want to add
            expect('0').to.bignumber.equal(balanceDiff(usdtInUSDTPoolAfter, usdtInUSDTPoolBefore)); // no change for usdt balance in pool
            expect('0').to.bignumber.equal(balanceDiff(usdtUserBalanceAfter, usdtUserBalanceBefore)); // no change for user usdt balance
            expect(ethSpent).to.bignumber.equal(ethToPool.add(ethToOracle)); // eth user spent equals eth into pool plus eth as oracle fee (no gas fee here because gas price zero)
        });


        it("should add liquidity for USDT correctly", async () => {

        });
    });

    describe('template', function () {
        it("test", async () => {
        });
    });

});

function balanceDiff(after, before) {
    return web3.utils.toBN(after).sub(web3.utils.toBN(before))
}