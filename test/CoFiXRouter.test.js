const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiXRouter = artifacts.require("CoFiXRouter");
// const ERC20 = artifacts.require("TestERC20");
const CoFiXFactory = artifacts.require("CoFiXFactory");
const CoFiXPair = artifacts.require("CoFiXPair");
const WETH9 = artifacts.require("WETH9");
// const NEST3PriceOracleMock = artifacts.require("mock/NEST3PriceOracleMock");
const NEST3PriceOracleAutoUpdateConstMock = artifacts.require("NEST3PriceOracleAutoUpdateConstMock");
const NEST3VoteFactoryMock = artifacts.require("NEST3VoteFactoryMock");
const CoFiXController = artifacts.require("CoFiXController02");
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

    let FEE_VAULT = accounts[1];

    let ethAmount = new BN("10000000000000000000");
    let usdtAmount = new BN("3862600000");

    before(async () => {
        USDT = await TestUSDT.new({ from: deployer });
        HBTC = await TestHBTC.new({ from: deployer });
        NEST = await TestNEST.new({ from: deployer });
        WETH = await WETH9.new();
        ConstOracle = await NEST3PriceOracleAutoUpdateConstMock.new({ from: deployer });
        NEST3VoteFactory = await NEST3VoteFactoryMock.new(ConstOracle.address);
        CFactory = await CoFiXFactory.new(WETH.address, { from: deployer });
        KTable = await CoFiXKTable.new({ from: deployer });
        CoFiXCtrl = await CoFiXController.new(NEST3VoteFactory.address, NEST.address, CFactory.address, KTable.address);
        await CFactory.setController(CoFiXCtrl.address);
        // await CoFiXCtrl.initialize(ConstOracle.address, { from: deployer });
        CRouter = await CoFiXRouter.new(CFactory.address, WETH.address, { from: deployer });
    });

    describe('addLiquidity()', function () {
        it("should add liquidity for ETH correctly", async () => {
            // for (let i = 0; i < 50; i++) {
            //     await time.advanceBlock();
            // }
            await ConstOracle.feedPrice(USDT.address, ethAmount, usdtAmount, { from: deployer });
            let _amountETH = web3.utils.toWei('1', 'ether');
            let _msgValue = web3.utils.toWei('1.1', 'ether');

            let usdtPairAddr = "0x0000000000000000000000000000000000000000";
            let wethInUSDTPoolBefore = await WETH.balanceOf(usdtPairAddr);
            let usdtInUSDTPoolBefore = await USDT.balanceOf(usdtPairAddr);
            let ethUserBalanceBefore = await web3.eth.getBalance(LP);
            let usdtUserBalanceBefore = await USDT.balanceOf(LP);
            let oracleBalanceBefore = await web3.eth.getBalance(ConstOracle.address);

            let result = await CRouter.addLiquidity(USDT.address, _amountETH, 0, 0, LP, "99999999999", { from: LP, value: _msgValue, gasPrice: 0 });
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

    describe('new trading pair: HBTC', function () {
        it("should add liquidity for HBTC correctly", async () => {
            let hbtcAmount = new BN("339880000000000000");
            await ConstOracle.feedPrice(HBTC.address, ethAmount, hbtcAmount, { from: deployer });
            let _amountETH = web3.utils.toWei('0', 'ether');
            let _amountHBTC = web3.utils.toWei('1', 'ether');
            let _msgValue = web3.utils.toWei('0.01', 'ether');

            let hbtcPairAddr = "0x0000000000000000000000000000000000000000";
            let wethInHBTCPoolBefore = await WETH.balanceOf(hbtcPairAddr);
            let hbtcInHBTCPoolBefore = await HBTC.balanceOf(hbtcPairAddr);
            let ethUserBalanceBefore = await web3.eth.getBalance(LP);
            let hbtcUserBalanceBefore = await HBTC.balanceOf(LP);
            let oracleBalanceBefore = await web3.eth.getBalance(ConstOracle.address);

            await HBTC.approve(CRouter.address, _amountHBTC, { from: LP, gasPrice: 0 });

            let result = await CRouter.addLiquidity(HBTC.address, _amountETH, _amountHBTC, 0, LP, "99999999999", { from: LP, value: _msgValue, gasPrice: 0 });
            hbtcPairAddr = await CFactory.getPair(HBTC.address);
            HBTCPair = await CoFiXPair.at(hbtcPairAddr);
            console.log("------------addLiquidity for HBTC/ETH Pool with HBTC------------");
            let liquidityHBTCPair = await HBTCPair.balanceOf(LP);
            let wethInHBTCPoolAfter = await WETH.balanceOf(hbtcPairAddr);
            let hbtcInHBTCPoolAfter = await HBTC.balanceOf(hbtcPairAddr);
            let ethUserBalanceAfter = await web3.eth.getBalance(LP);
            let hbtcUserBalanceAfter = await HBTC.balanceOf(LP);
            let oracleBalanceAfter = await web3.eth.getBalance(ConstOracle.address);
            if (verbose) {
                console.log(`gasUsed: ${result.receipt.gasUsed}`);
                console.log(`before>pool balance WETH: ${wethInHBTCPoolBefore.toString()}`);
                console.log(`before>pool balance HBTC: ${hbtcInHBTCPoolBefore.toString()}`);
                console.log(`before>user balance ETH: ${ethUserBalanceBefore.toString()}`);
                console.log(`before>user balance HBTC: ${hbtcUserBalanceBefore.toString()}`);
                console.log(`before>oracle balance ETH: ${oracleBalanceBefore.toString()}`);
                console.log(`-------`);
                console.log(`got liquidity of ETH/HBTC Pool: ${liquidityHBTCPair.toString()}`);
                console.log(`after>pool balance WETH: ${wethInHBTCPoolAfter.toString()}`);
                console.log(`after>pool balance HBTC: ${hbtcInHBTCPoolAfter.toString()}`);
                console.log(`after>user balance ETH: ${ethUserBalanceAfter.toString()}`);
                console.log(`after>user balance HBTC: ${hbtcUserBalanceAfter.toString()}`);
                console.log(`after>oracle balance ETH: ${oracleBalanceAfter.toString()}`);
            }
            // compare balance
            let ethSpent = balanceDiff(ethUserBalanceAfter, ethUserBalanceBefore).mul(new BN('-1')); // after <= before
            let ethToPool = balanceDiff(wethInHBTCPoolAfter, wethInHBTCPoolBefore);
            let ethToOracle = balanceDiff(oracleBalanceAfter, oracleBalanceBefore);
            expect(_amountETH).to.bignumber.equal(ethToPool); // pool got the eth amount user want to add
            expect(_amountHBTC).to.bignumber.equal(balanceDiff(hbtcInHBTCPoolAfter, hbtcInHBTCPoolBefore)); // no change for hbtc balance in pool
            let hbtcSpent = balanceDiff(hbtcUserBalanceAfter, hbtcUserBalanceBefore).mul(new BN('-1')); // after <= before
            expect(hbtcSpent).to.bignumber.equal(_amountHBTC); // no change for user hbtc balance
            expect(ethSpent).to.bignumber.equal(ethToPool.add(ethToOracle)); // eth user spent equals eth into pool plus eth as oracle fee (no gas fee here because gas price zero)
        });

        it("should remove all liquidity for HBTC correctly", async () => {
            // remove liquidity
            let hbtcPairAddr = await CFactory.getPair(HBTC.address);
            let HBTCPair = await CoFiXPair.at(hbtcPairAddr);
            let liquidityHBTCPairBefore = await HBTCPair.balanceOf(LP);
            let _msgValue = web3.utils.toWei('0.01', 'ether');
            await HBTCPair.approve(CRouter.address, liquidityHBTCPairBefore, { from: LP, gasPrice: 0 });

            let wethInHBTCPoolBefore = await WETH.balanceOf(hbtcPairAddr);
            let hbtcInHBTCPoolBefore = await HBTC.balanceOf(hbtcPairAddr);
            let ethUserBalanceBefore = await web3.eth.getBalance(LP);
            let hbtcUserBalanceBefore = await HBTC.balanceOf(LP);
            let oracleBalanceBefore = await web3.eth.getBalance(ConstOracle.address);

            // setTheta
            const theta = new BN(200000);
            await CoFiXCtrl.setTheta(HBTC.address, theta, { from: deployer });
            let kInfo = await CoFiXCtrl.getKInfo(HBTC.address);
            expect(kInfo.theta).to.bignumber.equal(theta);

            // setTradeMiningStatus
            await CFactory.setTradeMiningStatus(HBTC.address, true);

            let result = await CRouter.removeLiquidityGetToken(HBTC.address, liquidityHBTCPairBefore, 0, LP, "99999999999", { from: LP, value: _msgValue, gasPrice: 0 });

            console.log("------------removeLiquidity for HBTC/ETH Pool get HBTC------------");
            let liquidityHBTCPairAfter = await HBTCPair.balanceOf(LP);
            let wethInHBTCPoolAfter = await WETH.balanceOf(hbtcPairAddr);
            let hbtcInHBTCPoolAfter = await HBTC.balanceOf(hbtcPairAddr);
            let ethUserBalanceAfter = await web3.eth.getBalance(LP);
            let hbtcUserBalanceAfter = await HBTC.balanceOf(LP);
            let oracleBalanceAfter = await web3.eth.getBalance(ConstOracle.address);
            if (verbose) {
                console.log(`gasUsed: ${result.receipt.gasUsed}`);
                console.log(`liquidity of ETH/HBTC Pool before remove: ${liquidityHBTCPairBefore.toString()}`);
                console.log(`before>pool balance WETH: ${wethInHBTCPoolBefore.toString()}`);
                console.log(`before>pool balance HBTC: ${hbtcInHBTCPoolBefore.toString()}`);
                console.log(`before>user balance ETH: ${ethUserBalanceBefore.toString()}`);
                console.log(`before>user balance HBTC: ${hbtcUserBalanceBefore.toString()}`);
                console.log(`before>oracle balance ETH: ${oracleBalanceBefore.toString()}`);
                console.log(`-------`);
                console.log(`liquidity of ETH/HBTC Pool after remove: ${liquidityHBTCPairAfter.toString()}`);
                console.log(`after>pool balance WETH: ${wethInHBTCPoolAfter.toString()}`);
                console.log(`after>pool balance HBTC: ${hbtcInHBTCPoolAfter.toString()}`);
                console.log(`after>user balance ETH: ${ethUserBalanceAfter.toString()}`);
                console.log(`after>user balance HBTC: ${hbtcUserBalanceAfter.toString()}`);
                console.log(`after>oracle balance ETH: ${oracleBalanceAfter.toString()}`);
            }
        });

        it("should setTradeMiningStatus to false correctly ", async () => {
            // setTradeMiningStatus
            await CFactory.setTradeMiningStatus(HBTC.address, false);
            let status = await CFactory.getTradeMiningStatus(HBTC.address);
            expect(status).equal(false);
        });

        it("should add liquidity for HBTC correctly again", async () => {
            let hbtcAmount = new BN("339880000000000000");
            // await ConstOracle.feedPrice(HBTC.address, ethAmount, hbtcAmount, { from: deployer });
            let _amountETH = web3.utils.toWei('1', 'ether');
            let _amountHBTC = web3.utils.toWei('1', 'ether');
            let _msgValue = web3.utils.toWei('1.01', 'ether');

            let hbtcPairAddr = await CFactory.getPair(HBTC.address);
            let HBTCPair = await CoFiXPair.at(hbtcPairAddr);
            let wethInHBTCPoolBefore = await WETH.balanceOf(hbtcPairAddr);
            let hbtcInHBTCPoolBefore = await HBTC.balanceOf(hbtcPairAddr);
            let ethUserBalanceBefore = await web3.eth.getBalance(LP);
            let hbtcUserBalanceBefore = await HBTC.balanceOf(LP);
            let oracleBalanceBefore = await web3.eth.getBalance(ConstOracle.address);

            await HBTC.approve(CRouter.address, _amountHBTC, { from: LP, gasPrice: 0 });

            let result = await CRouter.addLiquidity(HBTC.address, _amountETH, _amountHBTC, 0, LP, "99999999999", { from: LP, value: _msgValue, gasPrice: 0 });
            console.log("------------addLiquidity for HBTC/ETH Pool with HBTC------------");
            let liquidityHBTCPair = await HBTCPair.balanceOf(LP);
            let wethInHBTCPoolAfter = await WETH.balanceOf(hbtcPairAddr);
            let hbtcInHBTCPoolAfter = await HBTC.balanceOf(hbtcPairAddr);
            let ethUserBalanceAfter = await web3.eth.getBalance(LP);
            let hbtcUserBalanceAfter = await HBTC.balanceOf(LP);
            let oracleBalanceAfter = await web3.eth.getBalance(ConstOracle.address);
            if (verbose) {
                console.log(`gasUsed: ${result.receipt.gasUsed}`);
                console.log(`before>pool balance WETH: ${wethInHBTCPoolBefore.toString()}`);
                console.log(`before>pool balance HBTC: ${hbtcInHBTCPoolBefore.toString()}`);
                console.log(`before>user balance ETH: ${ethUserBalanceBefore.toString()}`);
                console.log(`before>user balance HBTC: ${hbtcUserBalanceBefore.toString()}`);
                console.log(`before>oracle balance ETH: ${oracleBalanceBefore.toString()}`);
                console.log(`-------`);
                console.log(`got liquidity of ETH/HBTC Pool: ${liquidityHBTCPair.toString()}`);
                console.log(`after>pool balance WETH: ${wethInHBTCPoolAfter.toString()}`);
                console.log(`after>pool balance HBTC: ${hbtcInHBTCPoolAfter.toString()}`);
                console.log(`after>user balance ETH: ${ethUserBalanceAfter.toString()}`);
                console.log(`after>user balance HBTC: ${hbtcUserBalanceAfter.toString()}`);
                console.log(`after>oracle balance ETH: ${oracleBalanceAfter.toString()}`);
            }
            // compare balance
            let ethSpent = balanceDiff(ethUserBalanceAfter, ethUserBalanceBefore).mul(new BN('-1')); // after <= before
            let ethToPool = balanceDiff(wethInHBTCPoolAfter, wethInHBTCPoolBefore);
            let ethToOracle = balanceDiff(oracleBalanceAfter, oracleBalanceBefore);
            expect(_amountETH).to.bignumber.equal(ethToPool); // pool got the eth amount user want to add
            expect(_amountHBTC).to.bignumber.equal(balanceDiff(hbtcInHBTCPoolAfter, hbtcInHBTCPoolBefore)); // no change for hbtc balance in pool
            let hbtcSpent = balanceDiff(hbtcUserBalanceAfter, hbtcUserBalanceBefore).mul(new BN('-1')); // after <= before
            expect(hbtcSpent).to.bignumber.equal(_amountHBTC); // no change for user hbtc balance
            expect(ethSpent).to.bignumber.equal(ethToPool.add(ethToOracle)); // eth user spent equals eth into pool plus eth as oracle fee (no gas fee here because gas price zero)
        });

        it("should setFeeVaultForLP correctly ", async () => {
            // setFeeVaultForLP
            await CFactory.setFeeVaultForLP(HBTC.address, FEE_VAULT);
            let feeVault = await CFactory.getFeeVaultForLP(HBTC.address)
            expect(feeVault).equal(FEE_VAULT);
        });

        it("should remove all liquidity for HBTC correctly again", async () => {
            // remove liquidity
            let hbtcPairAddr = await CFactory.getPair(HBTC.address);
            let HBTCPair = await CoFiXPair.at(hbtcPairAddr);
            let liquidityHBTCPairBefore = await HBTCPair.balanceOf(LP);
            let _msgValue = web3.utils.toWei('0.01', 'ether');
            await HBTCPair.approve(CRouter.address, liquidityHBTCPairBefore, { from: LP, gasPrice: 0 });

            let wethInHBTCPoolBefore = await WETH.balanceOf(hbtcPairAddr);
            let hbtcInHBTCPoolBefore = await HBTC.balanceOf(hbtcPairAddr);
            let ethUserBalanceBefore = await web3.eth.getBalance(LP);
            let hbtcUserBalanceBefore = await HBTC.balanceOf(LP);
            let oracleBalanceBefore = await web3.eth.getBalance(ConstOracle.address);
            let wethInFeeVaultBefore = await WETH.balanceOf(FEE_VAULT);
            console.log("liquidityHBTCPairBefore:", liquidityHBTCPairBefore.toString())
            let liquidity = Math.round(liquidityHBTCPairBefore/2);

            let result = await CRouter.removeLiquidityGetToken(HBTC.address, liquidity, 0, LP, "99999999999", { from: LP, value: _msgValue, gasPrice: 0 });

            console.log("------------removeLiquidity for HBTC/ETH Pool get HBTC------------");
            let liquidityHBTCPairAfter = await HBTCPair.balanceOf(LP);
            let wethInHBTCPoolAfter = await WETH.balanceOf(hbtcPairAddr);
            let hbtcInHBTCPoolAfter = await HBTC.balanceOf(hbtcPairAddr);
            let ethUserBalanceAfter = await web3.eth.getBalance(LP);
            let hbtcUserBalanceAfter = await HBTC.balanceOf(LP);
            let oracleBalanceAfter = await web3.eth.getBalance(ConstOracle.address);
            let wethInFeeVaultAfter = await WETH.balanceOf(FEE_VAULT);
            if (verbose) {
                console.log(`gasUsed: ${result.receipt.gasUsed}`);
                console.log(`liquidity of ETH/HBTC Pool before remove: ${liquidityHBTCPairBefore.toString()}`);
                console.log(`before>pool balance WETH: ${wethInHBTCPoolBefore.toString()}`);
                console.log(`before>pool balance HBTC: ${hbtcInHBTCPoolBefore.toString()}`);
                console.log(`before>user balance ETH: ${ethUserBalanceBefore.toString()}`);
                console.log(`before>user balance HBTC: ${hbtcUserBalanceBefore.toString()}`);
                console.log(`before>oracle balance ETH: ${oracleBalanceBefore.toString()}`);
                console.log(`before>wethInFeeVault ${wethInFeeVaultBefore.toString()}`);
                console.log(`-------`);
                console.log(`liquidity of ETH/HBTC Pool after remove: ${liquidityHBTCPairAfter.toString()}`);
                console.log(`after>pool balance WETH: ${wethInHBTCPoolAfter.toString()}`);
                console.log(`after>pool balance HBTC: ${hbtcInHBTCPoolAfter.toString()}`);
                console.log(`after>user balance ETH: ${ethUserBalanceAfter.toString()}`);
                console.log(`after>user balance HBTC: ${hbtcUserBalanceAfter.toString()}`);
                console.log(`after>oracle balance ETH: ${oracleBalanceAfter.toString()}`);
                console.log(`after>wethInFeeVault ${wethInFeeVaultAfter.toString()}`);
            }
        });
    });
});

function balanceDiff(after, before) {
    return web3.utils.toBN(after).sub(web3.utils.toBN(before))
}