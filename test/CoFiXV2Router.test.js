const Contract = require("@truffle/contract");

const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiXRouter = artifacts.require("CoFiXV2Router");
// const ERC20 = artifacts.require("TestERC20");
const CoFiXFactory = artifacts.require("CoFiXV2Factory");
const CoFiXPair = artifacts.require("CoFiXV2Pair");
const WETH9 = artifacts.require("WETH9");
// const NEST3PriceOracleMock = artifacts.require("mock/NEST3PriceOracleMock");
const NESTPriceOracleAutoUpdateConstMock = artifacts.require("NEST36PriceOracleAutoUpdateConstMock");
const CoFiXController = artifacts.require("CoFiXV2Controller");
const TestUSDT = artifacts.require("test/USDT");
const TestHBTC = artifacts.require("test/HBTC");
const TestNEST = artifacts.require("test/NEST");

const UniswapV2Factory = Contract(require('@uniswap/v2-core/build/UniswapV2Factory.json'));
const UniswapV2Pair = Contract(require('@uniswap/v2-core/build/UniswapV2Pair.json'));
const UniswapV2Router02 = Contract(require('@uniswap/v2-periphery/build/UniswapV2Router02.json'));


const verbose = process.env.VERBOSE;

contract('CoFiXV2Router', (accounts) => {

    const owner = accounts[0];
    let deployer = owner;
    let LP = owner;
    let trader = owner;

    let FEE_VAULT = accounts[1];

    let ethAmount = new BN("10000000000000000000");
    let usdtPrice = new BN("386260000");
    let usdtAvg = new BN("386260000");

    const USDT_INIT_TOKEN0_AMOUNT = web3.utils.toWei('1', 'ether');
    const USDT_INIT_TOKEN1_AMOUNT = new BN("500000000");

    const HBTC_INIT_TOKEN0_AMOUNT = web3.utils.toWei('1', 'ether');
    const HBTC_INIT_TOKEN1_AMOUNT =  web3.utils.toWei('0.1', 'ether');

    UniswapV2Factory.setProvider(web3.currentProvider);
    UniswapV2Pair.setProvider(web3.currentProvider);
    UniswapV2Router02.setProvider(web3.currentProvider);

    const DEX_TYPE_COFIX = 0;
    const DEX_TYPE_UNISWAP = 1;

    const vola = new BN("592390136");

    before(async () => {
        USDT = await TestUSDT.new({ from: deployer });
        HBTC = await TestHBTC.new({ from: deployer });
        NEST = await TestNEST.new({ from: deployer });
        WETH = await WETH9.new();
        ConstOracle = await NESTPriceOracleAutoUpdateConstMock.new({ from: deployer });
        CFactory = await CoFiXFactory.new(WETH.address, { from: deployer });
        CoFiXCtrl = await CoFiXController.new(ConstOracle.address, NEST.address, CFactory.address);
        await CFactory.setController(CoFiXCtrl.address);
        UFactory = await UniswapV2Factory.new(deployer, { from: deployer });
        URouter = await UniswapV2Router02.new(UFactory.address, WETH.address, { from: deployer });
        CRouter = await CoFiXRouter.new(CFactory.address, UFactory.address, WETH.address, { from: deployer });
    });

    describe('addLiquidity()', function () {
        it("should add liquidity for correctly", async () => {
            // for (let i = 0; i < 50; i++) {
            //     await time.advanceBlock();
            // }
            await ConstOracle.feedPrice(USDT.address, usdtPrice, usdtPrice, usdtAvg, vola, { from: deployer });
            await CFactory.createPair(USDT.address, USDT_INIT_TOKEN0_AMOUNT, USDT_INIT_TOKEN1_AMOUNT, { from: deployer});

            let _amountETH = web3.utils.toWei('1', 'ether');
            let _msgValue = web3.utils.toWei('1.1', 'ether');
            let _amountUSDT = new BN("500000000");

            await USDT.approve(CRouter.address, _amountUSDT, { from: LP, gasPrice: 0 });

            let usdtPairAddr = await CFactory.getPair(USDT.address);
            // let usdtPairAddr = "0x0000000000000000000000000000000000000000";
            let wethInUSDTPoolBefore = await WETH.balanceOf(usdtPairAddr);
            let usdtInUSDTPoolBefore = await USDT.balanceOf(usdtPairAddr);
            let ethUserBalanceBefore = await web3.eth.getBalance(LP);
            let usdtUserBalanceBefore = await USDT.balanceOf(LP);
            let oracleBalanceBefore = await web3.eth.getBalance(ConstOracle.address);

            await expectRevert(CRouter.addLiquidity(USDT.address, _amountETH, new BN("10"), 0, LP, "99999999999", { from: LP, value: _msgValue, gasPrice: 0 }), "CPair: invalid asset ratio");

            let result = await CRouter.addLiquidity(USDT.address, _amountETH, _amountUSDT, 0, LP, "99999999999", { from: LP, value: _msgValue, gasPrice: 0 });
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
            expect(_amountUSDT).to.bignumber.equal(balanceDiff(usdtInUSDTPoolAfter, usdtInUSDTPoolBefore)); // no change for usdt balance in pool
            expect(_amountUSDT).to.bignumber.equal(balanceDiff(usdtUserBalanceBefore, usdtUserBalanceAfter)); // no change for user usdt balance
            expect(ethSpent).to.bignumber.equal(ethToPool.add(ethToOracle)); // eth user spent equals eth into pool plus eth as oracle fee (no gas fee here because gas price zero)
        });

    });

    describe('new trading pair: HBTC', function () {
        it("should add liquidity for HBTC correctly", async () => {
            let hbtcPrice = new BN("33988000000000000");
            let hbtcAvg = new BN("33988000000000000");
            await ConstOracle.feedPrice(HBTC.address, hbtcPrice, hbtcPrice, hbtcAvg, vola, { from: deployer });
            await CFactory.createPair(HBTC.address, HBTC_INIT_TOKEN0_AMOUNT, HBTC_INIT_TOKEN1_AMOUNT, {from: deployer});

            let _amountETH = web3.utils.toWei('10', 'ether');
            let _amountHBTC = web3.utils.toWei('1', 'ether');
            let _msgValue = web3.utils.toWei('10.01', 'ether');

            let hbtcPairAddr = await CFactory.getPair(HBTC.address);
            // let hbtcPairAddr = "0x0000000000000000000000000000000000000000";
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

            let result = await CRouter.removeLiquidityGetTokenAndETH(HBTC.address, liquidityHBTCPairBefore, 0, LP, "99999999999", { from: LP, value: _msgValue, gasPrice: 0 });

            console.log("------------removeLiquidity for HBTC/ETH Pool get HBTC and ETH------------");
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
            let hbtcPrice = new BN("339880000000000000");
            // await ConstOracle.feedPrice(HBTC.address, ethAmount, hbtcPrice, { from: deployer });
            let _amountETH = web3.utils.toWei('10', 'ether');
            let _amountHBTC = web3.utils.toWei('1', 'ether');
            let _msgValue = web3.utils.toWei('10.01', 'ether');

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

            let result = await CRouter.removeLiquidityGetTokenAndETH(HBTC.address, liquidity, 0, LP, "99999999999", { from: LP, value: _msgValue, gasPrice: 0 });

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

    describe('integrate uniswap', function () {
        it("should create pair for NEST & WETH correctly (UniswapV2Factory)", async () => {
            // WETH / NEST
            await UFactory.createPair(WETH.address, NEST.address, { from: deployer });
            const pair = await UFactory.getPair(WETH.address, NEST.address);
            const cPair = await UniswapV2Pair.at(pair);
            const token0 = await cPair.token0();
            const token1 = await cPair.token1();
            if (verbose) {
                console.log(`cPair.address: ${cPair.address}, cPair.token0: ${token0}, cPair.token1: ${token1}`)
            }
        });

        it ("should add liquidity for NEST & WETH pair correctly (UniswapV2Router02)", async () => {
            const ethValue = web3.utils.toWei('20', 'ether');
            await WETH.deposit({value: ethValue, from: deployer})
            // function addLiquidity(
            //     address tokenA,
            //     address tokenB,
            //     uint amountADesired,
            //     uint amountBDesired,
            //     uint amountAMin,
            //     uint amountBMin,
            //     address to,
            //     uint deadline
            // )
            const tokenA = WETH.address;
            const tokenB = NEST.address;
            const amountADesired = web3.utils.toWei('10', 'ether'); // 10 ETH
            const amountBDesired = web3.utils.toWei('40000', 'ether'); // 40000 NEST
            // approve to router
            await WETH.approve(URouter.address, amountADesired, { from: deployer });
            await NEST.approve(URouter.address, amountBDesired, { from: deployer });

            const deadline = "999999999999999";
            const to = deployer;
            if (verbose) {
                console.log(`tokenA: ${tokenA}, tokenB: ${tokenB}`);
            }
            await URouter.addLiquidity(
                tokenA,
                tokenB,
                amountADesired,
                amountBDesired,
                0,
                0,
                to,
                deadline,
                {from: deployer}
            );
            const pair = await UFactory.getPair(WETH.address, NEST.address);
            const cPair = await UniswapV2Pair.at(pair);
            const res = await cPair.getReserves();
            if (verbose) {
                console.log(`reserve0: ${res[0]}, reserve1: ${res[1]}`);
            }
        });

        // it ("should swap NEST for WETH correctly (UniswapV2Router02)", async () => {
        //     // function swapExactTokensForTokens(
        //     //     uint amountIn,
        //     //     uint amountOutMin,
        //     //     address[] calldata path,
        //     //     address to,
        //     //     uint deadline
        //     // )
        //     const weth = WETH.address;
        //     const nest = NEST.address;
        //     const amountIn = web3.utils.toWei('1', 'ether'); // 1 NEST
        //     const amountOutMin = "0";
        //     const path = [nest, weth];
        //     const deadline = "999999999999999";
        //     const to = deployer;
        //     // approve to router
        //     await NEST.approve(URouter.address, amountIn, { from: deployer });
        //     await URouter.swapExactTokensForTokens(
        //         amountIn,
        //         amountOutMin,
        //         path,
        //         to,
        //         deadline,
        //         {from: deployer}
        //     );
        //     const pair = await UFactory.getPair(WETH.address, NEST.address);
        //     const cPair = await UniswapV2Pair.at(pair);
        //     const res = await cPair.getReserves();
        //     if (verbose) {
        //         console.log(`reserve0: ${res[0]}, reserve1: ${res[1]}`);
        //     }
        // });

        // it ("should swap WETH for NEST correctly (UniswapV2Router02)", async () => {
        //     // function swapExactTokensForTokens(
        //     //     uint amountIn,
        //     //     uint amountOutMin,
        //     //     address[] calldata path,
        //     //     address to,
        //     //     uint deadline
        //     // )
        //     const weth = WETH.address;
        //     const nest = NEST.address;
        //     const amountIn = web3.utils.toWei('0.01', 'ether'); // 0.01 ETH
        //     const amountOutMin = "0";
        //     const path = [weth, nest];
        //     const deadline = "999999999999999";
        //     const to = deployer;
        //     // approve to router
        //     await WETH.approve(URouter.address, amountIn, { from: deployer });
        //     await URouter.swapExactTokensForTokens(
        //         amountIn,
        //         amountOutMin,
        //         path,
        //         to,
        //         deadline,
        //         {from: deployer}
        //     );
        //     const pair = await UFactory.getPair(WETH.address, NEST.address);
        //     const cPair = await UniswapV2Pair.at(pair);
        //     const res = await cPair.getReserves();
        //     if (verbose) {
        //         console.log(`reserve0: ${res[0]}, reserve1: ${res[1]}`);
        //     }
        // });

        it ("should swap NEST for USDT (NEST -> WETH -> USDT) correctly (CoFiXRouter02)", async () => {
            // function hybridSwapExactTokensForTokens(
            //     uint amountIn,
            //     uint amountOutMin,
            //     address[] calldata path,
            //     DEX_TYPE[] calldata dexes,
            //     address to,
            //     uint deadline
            // )
            const weth = WETH.address;
            const nest = NEST.address;
            const usdt = USDT.address;
            const amountIn = web3.utils.toWei('1', 'ether'); // 1 NEST
            const amountOutMin = "0";
            const path = [nest, weth, usdt];
            const deadline = "999999999999999";
            const to = deployer;
            const rewardTo = to;
            const oracleFee = web3.utils.toWei('0.01', 'ether'); // 0.01 ETH
            const dexes = [DEX_TYPE_UNISWAP, DEX_TYPE_COFIX];

            // approve to router
            await NEST.approve(CRouter.address, amountIn, { from: deployer });
        
            // hybrid swap (Uniswap: NEST -> ETH, CoFiX: ETH -> USDT)
            await CRouter.hybridSwapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                dexes,
                to,
                rewardTo,
                deadline,
                {value: oracleFee, from: deployer}
            );
            const pair = await UFactory.getPair(WETH.address, NEST.address);
            const cPair = await UniswapV2Pair.at(pair);
            const res = await cPair.getReserves();
            if (verbose) {
                console.log(`reserve0: ${res[0]}, reserve1: ${res[1]}`);
            }
        });

        it ("should swap USDT for NEST (USDT -> WETH -> NEST) correctly (CoFiXRouter02)", async () => {
            const weth = WETH.address;
            const nest = NEST.address;
            const usdt = USDT.address;
            const amountIn = "10000000"; // 10 USDT
            const amountOutMin = "0";
            const path = [usdt, weth, nest];
            const deadline = "999999999999999";
            const to = deployer;
            const rewardTo = to;
            const oracleFee = web3.utils.toWei('0.01', 'ether'); // 0.01 ETH
            const dexes = [DEX_TYPE_COFIX, DEX_TYPE_UNISWAP];

            // approve to router
            await USDT.approve(CRouter.address, amountIn, { from: deployer });
        
            // hybrid swap (CoFiX: USDT -> ETH, Uniswap: ETH -> NEST)
            await CRouter.hybridSwapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                dexes,
                to,
                rewardTo,
                deadline,
                {value: oracleFee, from: deployer}
            );
            const pair = await UFactory.getPair(WETH.address, NEST.address);
            const cPair = await UniswapV2Pair.at(pair);
            const res = await cPair.getReserves();
            if (verbose) {
                console.log(`reserve0: ${res[0]}, reserve1: ${res[1]}`);
            }
        });

        it ("should swap USDT for WETH (USDT -> WETH) correctly (CoFiXRouter02)", async () => {
            const weth = WETH.address;
            const usdt = USDT.address;
            const amountIn = "10000000"; // 10 USDT
            const amountOutMin = "0";
            const path = [usdt, weth];
            const deadline = "999999999999999";
            const to = deployer;
            const rewardTo = to;
            const oracleFee = web3.utils.toWei('0.01', 'ether'); // 0.01 ETH
            const dexes = [DEX_TYPE_COFIX];

            // approve to router
            await USDT.approve(CRouter.address, amountIn, { from: deployer });
        
            // hybrid swap (CoFiX: USDT -> ETH)
            await CRouter.hybridSwapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                dexes,
                to,
                rewardTo,
                deadline,
                {value: oracleFee, from: deployer}
            );
            const pair = await UFactory.getPair(WETH.address, NEST.address);
            const cPair = await UniswapV2Pair.at(pair);
            const res = await cPair.getReserves();
            if (verbose) {
                console.log(`reserve0: ${res[0]}, reserve1: ${res[1]}`);
            }
        });

        it ("should swap USDT for ETH (USDT -> WETH) correctly (CoFiXRouter02/hybridSwapExactTokensForETH)", async () => {
            const weth = WETH.address;
            const usdt = USDT.address;
            const amountIn = "10000000"; // 10 USDT
            const amountOutMin = "0";
            const path = [usdt, weth];
            const deadline = "999999999999999";
            const to = deployer;
            const rewardTo = to;
            const oracleFee = web3.utils.toWei('0.01', 'ether'); // 0.01 ETH
            const dexes = [DEX_TYPE_COFIX];

            // approve to router
            await USDT.approve(CRouter.address, amountIn, { from: deployer });
        
            // hybrid swap (CoFiX: USDT -> ETH)
            await CRouter.hybridSwapExactTokensForETH(
                amountIn,
                amountOutMin,
                path,
                dexes,
                to,
                rewardTo,
                deadline,
                {value: oracleFee, from: deployer}
            );
            const pair = await UFactory.getPair(WETH.address, NEST.address);
            const cPair = await UniswapV2Pair.at(pair);
            const res = await cPair.getReserves();
            if (verbose) {
                console.log(`reserve0: ${res[0]}, reserve1: ${res[1]}`);
            }
        });

        it ("should swap WETH for USDT (WETH -> USDT) correctly (CoFiXRouter02)", async () => {
            const weth = WETH.address;
            const usdt = USDT.address;
            const amountIn = web3.utils.toWei('1', 'ether'); // 0.1 WETH
            const amountOutMin = "0";
            const path = [weth, usdt];
            const deadline = "999999999999999";
            const to = deployer;
            const rewardTo = to;
            const oracleFee = web3.utils.toWei('0.01', 'ether'); // 0.01 ETH
            const dexes = [DEX_TYPE_COFIX];

            // approve to router
            await WETH.approve(CRouter.address, amountIn, { from: deployer });
        
            // hybrid swap (CoFiX: WETH -> USDT)
            await CRouter.hybridSwapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                dexes,
                to,
                rewardTo,
                deadline,
                {value: oracleFee, from: deployer}
            );
            const pair = await UFactory.getPair(WETH.address, NEST.address);
            const cPair = await UniswapV2Pair.at(pair);
            const res = await cPair.getReserves();
            if (verbose) {
                console.log(`reserve0: ${res[0]}, reserve1: ${res[1]}`);
            }
        });

        it ("should swap NEST for WETH (NEST -> WETH) correctly (CoFiXRouter02)", async () => {
            const nest = NEST.address;
            const weth = WETH.address;
            const amountIn = web3.utils.toWei('100', 'ether'); // 100 NEST
            const amountOutMin = "0";
            const path = [nest, weth];
            const deadline = "999999999999999";
            const to = deployer;
            const rewardTo = to;
            // const oracleFee = web3.utils.toWei('0.01', 'ether'); // 0.01 ETH
            const dexes = [DEX_TYPE_UNISWAP];

            // approve to router
            await NEST.approve(CRouter.address, amountIn, { from: deployer });
        
            // hybrid swap (Uniswap: NEST -> WETH)
            await CRouter.hybridSwapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                dexes,
                to,
                rewardTo,
                deadline,
                {value: 0, from: deployer}
            );
            const pair = await UFactory.getPair(WETH.address, NEST.address);
            const cPair = await UniswapV2Pair.at(pair);
            const res = await cPair.getReserves();
            if (verbose) {
                console.log(`reserve0: ${res[0]}, reserve1: ${res[1]}`);
            }
        });

        it ("should swap NEST for ETH (NEST -> WETH) correctly (CoFiXRouter02/hybridSwapExactTokensForETH)", async () => {
            const nest = NEST.address;
            const weth = WETH.address;
            const amountIn = web3.utils.toWei('100', 'ether'); // 100 NEST
            const amountOutMin = "0";
            const path = [nest, weth];
            const deadline = "999999999999999";
            const to = deployer;
            const rewardTo = to;
            // const oracleFee = web3.utils.toWei('0.01', 'ether'); // 0.01 ETH
            const dexes = [DEX_TYPE_UNISWAP];

            // approve to router
            await NEST.approve(CRouter.address, amountIn, { from: deployer });
        
            // hybrid swap (Uniswap: NEST -> WETH)
            await CRouter.hybridSwapExactTokensForETH(
                amountIn,
                amountOutMin,
                path,
                dexes,
                to,
                rewardTo,
                deadline,
                {value: 0, from: deployer}
            );
            const pair = await UFactory.getPair(WETH.address, NEST.address);
            const cPair = await UniswapV2Pair.at(pair);
            const res = await cPair.getReserves();
            if (verbose) {
                console.log(`reserve0: ${res[0]}, reserve1: ${res[1]}`);
            }
        });

        it ("should swap WETH for NEST (WETH -> NEST) correctly (CoFiXRouter02)", async () => {
            const nest = NEST.address;
            const weth = WETH.address;
            const amountIn = web3.utils.toWei('0.1', 'ether'); // 0.1 ETH
            const amountOutMin = "0";
            const path = [weth, nest];
            const deadline = "999999999999999";
            const to = deployer;
            const rewardTo = to;
            // const oracleFee = web3.utils.toWei('0.01', 'ether'); // 0.01 ETH
            const dexes = [DEX_TYPE_UNISWAP];

            // approve to router
            await WETH.approve(CRouter.address, amountIn, { from: deployer });
        
            // hybrid swap (Uniswap: WETH -> NEST)
            await CRouter.hybridSwapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                dexes,
                to,
                rewardTo,
                deadline,
                {value: 0, from: deployer}
            );
            const pair = await UFactory.getPair(WETH.address, NEST.address);
            const cPair = await UniswapV2Pair.at(pair);
            const res = await cPair.getReserves();
            if (verbose) {
                console.log(`reserve0: ${res[0]}, reserve1: ${res[1]}`);
            }
        });

        it ("should swap ETH for NEST (WETH -> NEST) correctly (CoFiXRouter02/hybridSwapExactETHForTokens)", async () => {
            const nest = NEST.address;
            const weth = WETH.address;
            const amountIn = web3.utils.toWei('0.1', 'ether'); // 0.1 ETH
            const amountOutMin = "0";
            const path = [weth, nest];
            const deadline = "999999999999999";
            const to = deployer;
            const rewardTo = to;
            // const oracleFee = web3.utils.toWei('0.01', 'ether'); // 0.01 ETH
            const dexes = [DEX_TYPE_UNISWAP];
        
            // hybrid swap (Uniswap: WETH -> NEST)
            await CRouter.hybridSwapExactETHForTokens(
                amountIn,
                amountOutMin,
                path,
                dexes,
                to,
                rewardTo,
                deadline,
                {value: amountIn, from: deployer} // here: value is amountIn
            );
            const pair = await UFactory.getPair(WETH.address, NEST.address);
            const cPair = await UniswapV2Pair.at(pair);
            const res = await cPair.getReserves();
            if (verbose) {
                console.log(`reserve0: ${res[0]}, reserve1: ${res[1]}`);
            }
        });

        it ("should swap USDT for HBTC (USDT -> WETH -> HBTC) correctly (CoFiXRouter02)", async () => {
            const hbtc = HBTC.address;
            const weth = WETH.address;
            const usdt = USDT.address;
            const amountIn = "100000000"; // 100 USDT
            const amountOutMin = "0";
            const path = [usdt, weth, hbtc];
            const deadline = "999999999999999";
            const to = deployer;
            const rewardTo = to;
            const oracleFee = web3.utils.toWei('0.02', 'ether'); // 0.02 ETH
            const dexes = [DEX_TYPE_COFIX, DEX_TYPE_COFIX];

            // approve to router
            await USDT.approve(CRouter.address, amountIn, { from: deployer });
        
            // hybrid swap (CoFiX: USDT -> WETH, CoFiX: WETH -> HBTC)
            await CRouter.hybridSwapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                dexes,
                to,
                rewardTo,
                deadline,
                {value: oracleFee, from: deployer}
            );
            const pair = await UFactory.getPair(WETH.address, NEST.address);
            const cPair = await UniswapV2Pair.at(pair);
            const res = await cPair.getReserves();
            if (verbose) {
                console.log(`reserve0: ${res[0]}, reserve1: ${res[1]}`);
            }
        });

        it ("should swap HBTC for USDT (HBTC-> WETH -> USDT) correctly (CoFiXRouter02)", async () => {
            const hbtc = HBTC.address;
            const weth = WETH.address;
            const usdt = USDT.address;
            const amountIn = "100000000"; // 100 USDT
            const amountOutMin = "0";
            const path = [hbtc, weth, usdt];
            const deadline = "999999999999999";
            const to = deployer;
            const rewardTo = to;
            const oracleFee = web3.utils.toWei('0.02', 'ether'); // 0.02 ETH
            const dexes = [DEX_TYPE_COFIX, DEX_TYPE_COFIX];

            // approve to router
            await HBTC.approve(CRouter.address, amountIn, { from: deployer });
        
            // hybrid swap (CoFiX: HBTC -> WETH, CoFiX: WETH -> USDT)
            await CRouter.hybridSwapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                dexes,
                to,
                rewardTo,
                deadline,
                {value: oracleFee, from: deployer}
            );
            const pair = await UFactory.getPair(WETH.address, NEST.address);
            const cPair = await UniswapV2Pair.at(pair);
            const res = await cPair.getReserves();
            if (verbose) {
                console.log(`reserve0: ${res[0]}, reserve1: ${res[1]}`);
            }
        });

    });

    describe('removeLiquidity', function () {
        it("should remove all liquidity for USDT correctly", async () => {
            let usdtPairAddr = await CFactory.getPair(USDT.address);
            let USDTPair = await CoFiXPair.at(usdtPairAddr);
    
            // setTheta
            const theta = new BN(200000);
            await CoFiXCtrl.setTheta(USDT.address, theta, { from: deployer });
            let kInfo = await CoFiXCtrl.getKInfo(USDT.address);
            expect(kInfo.theta).to.bignumber.equal(theta);
    
            // setTradeMiningStatus
            await CFactory.setTradeMiningStatus(USDT.address, true);

            let usdtInUSDTPool = await USDT.balanceOf(usdtPairAddr);
            let wethInUSDTPool = await WETH.balanceOf(usdtPairAddr);
            let liquidityUSDTPair = await USDTPair.balanceOf(LP);
            let ethUserBalance = await web3.utils.fromWei(await web3.eth.getBalance(trader), 'ether')
            let usdtUserBalance = await USDT.balanceOf(trader);
            console.log("USDT pool balance USDT:", usdtInUSDTPool.toString());
            console.log("USDT pool balance WETH:", wethInUSDTPool.toString());
            console.log("ETH/USDT liquidity of LP:", liquidityUSDTPair.toString());
            console.log("user balance ETH:", ethUserBalance.toString());
            console.log("user balance USDT:", usdtUserBalance.toString());

            // returns (
            //     uint latestPriceBlockNumber, 
            //     uint latestPriceValue,
            //     uint triggeredPriceBlockNumber,
            //     uint triggeredPriceValue,
            //     uint triggeredAvgPrice,
            //     uint triggeredSigmaSQ )
            let p = await ConstOracle.checkPriceNow(USDT.address);
            let oraclePrice = [web3.utils.toWei('1', 'ether'), p.latestPriceValue, new BN("0"), new BN("0"), theta];
            let calcResult = await USDTPair.calcOutTokenAndETHForBurn(liquidityUSDTPair, oraclePrice);
            console.log(`amountEthOut: ${calcResult.amountEthOut}, amountTokenOut: ${calcResult.amountTokenOut}, fee: ${calcResult.fee}`);

            let _amountIn = "300000000";
            let _msgValue = web3.utils.toWei('0.01', 'ether');
            await USDT.approve(CRouter.address, _amountIn, { from: trader, gasPrice: 0 });
            let result = await CRouter.swapExactTokensForETH(USDT.address, _amountIn, 0, trader, trader, "99999999999", { from: trader, value: _msgValue });
            console.log("------------swapExactTokensForETH------------");
            usdtInUSDTPool = await USDT.balanceOf(usdtPairAddr);
            wethInUSDTPool = await WETH.balanceOf(usdtPairAddr);
            liquidityUSDTPair = await USDTPair.balanceOf(LP);
            ethUserBalance = await web3.utils.fromWei(await web3.eth.getBalance(trader), 'ether')
            usdtUserBalance = await USDT.balanceOf(trader);
            console.log("receipt.gasUsed:", result.receipt.gasUsed);
            console.log("USDT pool balance USDT:", usdtInUSDTPool.toString());
            console.log("USDT pool balance WETH:", wethInUSDTPool.toString());
            console.log("ETH/USDT liquidity of LP:", liquidityUSDTPair.toString());
            console.log("user balance ETH:", ethUserBalance.toString());
            console.log("user balance USDT:", usdtUserBalance.toString());
    
            calcResult = await USDTPair.calcOutTokenAndETHForBurn(liquidityUSDTPair, oraclePrice);
            console.log(`amountEthOut: ${calcResult.amountEthOut}, amountTokenOut: ${calcResult.amountTokenOut}, fee: ${calcResult.fee}`);

            // remove liquidity
            let liquidityUSDTPairBefore = await USDTPair.balanceOf(LP);
    
            await USDTPair.approve(CRouter.address, liquidityUSDTPairBefore, { from: LP, gasPrice: 0 });
            result = await CRouter.removeLiquidityGetTokenAndETH(USDT.address, liquidityUSDTPairBefore, 0, LP, "99999999999", { from: LP, value: _msgValue });
            console.log("------------removeLiquidityGetTokenAndETH------------");
            usdtInUSDTPool = await USDT.balanceOf(usdtPairAddr);
            wethInUSDTPool = await WETH.balanceOf(usdtPairAddr);
            liquidityUSDTPair = await USDTPair.balanceOf(LP);
            ethUserBalance = await web3.utils.fromWei(await web3.eth.getBalance(LP), 'ether')
            usdtUserBalance = await USDT.balanceOf(LP);
            console.log("receipt.gasUsed:", result.receipt.gasUsed);
            console.log("USDT pool balance USDT:", usdtInUSDTPool.toString());
            console.log("USDT pool balance WETH:", wethInUSDTPool.toString());
            console.log("ETH/USDT liquidity of LP:", liquidityUSDTPair.toString());
            console.log("user balance ETH:", ethUserBalance.toString());
            console.log("user balance USDT:", usdtUserBalance.toString());
        });
    });

});

function balanceDiff(after, before) {
    return web3.utils.toBN(after).sub(web3.utils.toBN(before))
}