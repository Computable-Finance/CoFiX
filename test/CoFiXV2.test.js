const Contract = require("@truffle/contract");
const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
// const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
// const CoFiXRouter = contract.fromArtifact("CoFiXRouter");
// const ERC20 = contract.fromArtifact("ERC20");
// const CoFiXFactory = contract.fromArtifact("CoFiXFactory");
// const CoFiXPair = contract.fromArtifact("CoFiXPair");
// const WETH9 = contract.fromArtifact("WETH9");
// const NEST3PriceOracleMock = contract.fromArtifact("NEST3PriceOracleMock");
// const CoFiXController = contract.fromArtifact("CoFiXController");

const CoFiXRouter = artifacts.require("CoFiXV2Router");
// const ERC20 = artifacts.require("TestERC20");
const CoFiXFactory = artifacts.require("CoFiXV2Factory");
const CoFiXPair = artifacts.require("CoFiXV2Pair");
const WETH9 = artifacts.require("WETH9");
const NESTPriceOracleMock = artifacts.require("mock/NEST36PriceOracleMock");
const CoFiXController = artifacts.require("CoFiXV2Controller");
const TestUSDT = artifacts.require("test/USDT");
const TestHBTC = artifacts.require("test/HBTC");
const TestNEST = artifacts.require("test/NEST");
const CoFiXDAO = artifacts.require("CoFiXV2DAO");

const CoFiToken = artifacts.require("CoFiToken");
const CoFiXVaultForLP = artifacts.require("CoFiXV2VaultForLP");
const CoFiXStakingRewards = artifacts.require("CoFiXV2StakingRewards.sol");

const { printKInfoEvent } = require('../lib/print');
const Decimal = require('decimal.js');
const { calcK, convert_from_fixed_point, convert_into_fixed_point, calcRelativeDiff } = require('../lib/calc');

const UniswapV2Factory = Contract(require('@uniswap/v2-core/build/UniswapV2Factory.json'));
const UniswapV2Pair = Contract(require('@uniswap/v2-core/build/UniswapV2Pair.json'));
const UniswapV2Router02 = Contract(require('@uniswap/v2-periphery/build/UniswapV2Router02.json'))

const errorDelta = 10 ** -10;


contract('CoFiXV2', (accounts) => {
// describe('CoFiX', function () {
    // const [owner] = accounts;
    const owner = accounts[0];
    let deployer = owner;
    let LP = owner;
    let trader = owner;

    // let totalSupply_ = "10000000000000000";
    const USDTTotalSupply_ = new BN("10000000000000000");
    const HBTCTotalSupply_ = new BN("100000000000000000000000000");

    const USDT_INIT_TOKEN0_AMOUNT = web3.utils.toWei('1', 'ether');
    const USDT_INIT_TOKEN1_AMOUNT = new BN("500000000");

    const HBTC_INIT_TOKEN0_AMOUNT = web3.utils.toWei('1', 'ether');
    const HBTC_INIT_TOKEN1_AMOUNT =  web3.utils.toWei('0.1', 'ether');

    const vola = new BN("99999999999999");

    const DESTRUCTION_AMOUNT = web3.utils.toWei('0', 'ether');

    // enum POOL_STATE {INVALID, ENABLED, DISABLED}
    const POOL_STATE_INVALID = "0";
    const POOL_STATE_ENABLED = "1";
    const POOL_STATE_DISABLED = "2";

    UniswapV2Factory.setProvider(web3.currentProvider);
    UniswapV2Pair.setProvider(web3.currentProvider);
    UniswapV2Router02.setProvider(web3.currentProvider)

    before(async () => {
        // change to openzeppelin/test-environment if it has better support for test coverage and gas cost measure
        // USDT = await ERC20.new("10000000000000000", "USDT Test Token", "USDT", 6, { from: deployer });
        // WETH = await WETH9.new();
        // PriceOracle = await NEST3PriceOracleMock.new();
        // CoFiXCtrl = await CoFiXController.new(PriceOracle.address);
        // CFactory = await CoFiXFactory.new(CoFiXCtrl.address, WETH.address)
        // CRouter = await CoFiXRouter.new(CFactory.address, WETH.address);
        // USDT = await ERC20.new("10000000000000000", "USDT Test Token", "USDT", 6, { from: deployer });
        // HBTC = await ERC20.new("100000000000000000000000000", "Huobi BTC", "HBTC", 18, { from: deployer });
        USDT = await TestUSDT.new();
        HBTC = await TestHBTC.new();
        // WETH = await WETH9.deployed();
        // NEST = await TestNEST.deployed()
        // PriceOracle = await NEST3PriceOracleMock.deployed();
        // CoFiXCtrl = await CoFiXController.deployed();
        // // CoFiXCtrl.initialize(PriceOracle.address, { from: deployer });
        // CFactory = await CoFiXFactory.deployed();
        // CRouter = await CoFiXRouter.deployed();

        NEST = await TestNEST.new({ from: deployer });
        WETH = await WETH9.new();
        CoFi = await CoFiToken.new({ from: deployer });
        CFactory = await CoFiXFactory.new(WETH.address, { from: deployer });
        VaultForLP = await CoFiXVaultForLP.new(CoFi.address, CFactory.address, { from: deployer });
        await CFactory.setVaultForLP(VaultForLP.address);
        PriceOracle = await NESTPriceOracleMock.new(NEST.address, { from: deployer });
        CoFiXCtrl = await CoFiXController.new(PriceOracle.address, NEST.address, CFactory.address);
        await CFactory.setController(CoFiXCtrl.address);
        CDAO = await CoFiXDAO.new(CoFi.address, CFactory.address, { from: deployer});
        await CFactory.setFeeReceiver(CDAO.address);
        // await CoFiXCtrl.initialize(ConstOracle.address, { from: deployer });
        UFactory = await UniswapV2Factory.new(deployer, { from: deployer });
        URouter = await UniswapV2Router02.new(UFactory.address, WETH.address, { from: deployer })
        CRouter = await CoFiXRouter.new(CFactory.address, URouter.address, WETH.address, { from: deployer });
    });

    describe('template', function () {
        it("test", async () => {
        });
    });

    describe('ERC20 Token', function () {
        it("should USDT totalSupply equals", async () => {
            let totalSupply = await USDT.totalSupply();
            expect(totalSupply).to.bignumber.equal(USDTTotalSupply_);
        })
    });

    describe('CoFiXController', function () {  

        // it("should activate nest oracle correctly", async () => {
        //     await NEST.approve(CoFiXCtrl.address, DESTRUCTION_AMOUNT);
        //     await PriceOracle.activate(CoFiXCtrl.address);
        //     await time.increase(time.duration.minutes(1)); // increase time to make activation be effective
        // });

        // it("should activate again correctly by governance", async () => {
        //     await NEST.approve(CoFiXCtrl.address, DESTRUCTION_AMOUNT);
        //     await PriceOracle.activate(CoFiXCtrl.address);
        //     await time.increase(time.duration.minutes(2)); // increase time to make activation be effective
        // });

        // it("K calculation", async () => {
            // console.log("======================CoFiXController TEST START======================");
            // _msgValue = web3.utils.toWei('0.01', 'ether');

            // // add enough prices in NEST3PriceOracleMock
            // let ethAmount = new BN("10000000000000000000");
            // let usdtAmount = new BN("3255000000");

            // for (let i = 0; i < 50; i++) {
                // await PriceOracle.addPriceToList(USDT.address, ethAmount, usdtAmount, "0", { from: deployer });
                // usdtAmount = usdtAmount.mul(new BN("100")).div(new BN("100")); // very stable price
            // }
            // let priceLen = await PriceOracle.getPriceLength(USDT.address);
            // console.log("USDT>priceLen:", priceLen.toString(), ", tokenAmount:", usdtAmount.toString());
            // expect(priceLen).to.bignumber.equal(new BN("50"));

            // // add caller
            // await CoFiXCtrl.addCaller(deployer, { from: deployer });

            // // let gas = await CoFiXCtrl.methods['queryOracle(address,address)'].estimateGas(USDT.address, deployer, { from: deployer })
            // // console.log("estimateGas:", gas.toString())
            // let result = await CoFiXCtrl.queryOracle(USDT.address, "0", deployer, { from: deployer, value: _msgValue });
            // console.log("USDT>receipt.gasUsed:", result.receipt.gasUsed); // 494562
            // // let evtArgs0 = result.receipt.logs[0].args;
            // // printKInfoEvent(evtArgs0);
            // // console.log("USDT>evtArgs0> K:", evtArgs0.K.toString(), ", sigma:", evtArgs0.sigma.toString(), ", T:", evtArgs0.T.toString(), ", ethAmount:", evtArgs0.ethAmount.toString(), ", erc20Amount:", evtArgs0.erc20Amount.toString());
            // // K = -0.016826326, when sigma equals to zero

            // // add more prices
            // for (let i = 0; i < 50; i++) {
                // await PriceOracle.addPriceToList(USDT.address, ethAmount, usdtAmount, "0", { from: deployer });
                // usdtAmount = usdtAmount.mul(new BN("101")).div(new BN("100")); // eth price rising
            // }
            // priceLen = await PriceOracle.getPriceLength(USDT.address);
            // console.log("USDT>priceLen:", priceLen.toString(), ", tokenAmount:", usdtAmount.toString());
            // expect(priceLen).to.bignumber.equal(new BN("100"));
            // result = await CoFiXCtrl.queryOracle(USDT.address, "0", deployer, { from: deployer, value: _msgValue });
            // console.log("USDT>receipt.gasUsed:", result.receipt.gasUsed); // 544914
            // if (result.receipt.logs[0]) {
                // evtArgs0 = result.receipt.logs[0].args;
                // printKInfoEvent(evtArgs0);
            // }

            // // console.log("USDT>evtArgs0> K:", evtArgs0.K.toString(), ", sigma:", evtArgs0.sigma.toString(), ", T:", evtArgs0.T.toString(), ", ethAmount:", evtArgs0.ethAmount.toString(), ", erc20Amount:", evtArgs0.erc20Amount.toString())
            // // python result, K=-0.009217843036355746, sigma=0.0004813196086030222
            // // contract result, K=-170039189510192419/(2**64)=-0.00921784293373125, sigma=8878779697438274/(2**64)=0.0004813196118491383

            // // debug
            // let p = await PriceOracle.priceInfoList_(USDT.address, 99);
            // console.log("debug>USDT>p:", p.ethAmount.toString(), p.erc20Amount.toString(), p.blockNum.toString());
            // let c = await PriceOracle.checkPriceList(USDT.address, 50);
            // console.log("debug>USDT>c:", c[0].toString(), c[1].toString(), c[2].toString(), c[3].toString(), c[4].toString());
            // console.log("======================CoFiXController STATS END======================");

            // // add price for HBTC
            // let hbtcAmount = new BN("339880000000000000");
            // for (let i = 0; i < 50; i++) {
                // await PriceOracle.addPriceToList(HBTC.address, ethAmount, hbtcAmount, "0", { from: deployer });
                // hbtcAmount = hbtcAmount.mul(new BN("100")).div(new BN("100")); // very stable price
            // }
            // let priceLenBTC = await PriceOracle.getPriceLength(HBTC.address);
            // console.log("HBTC>priceLen:", priceLenBTC.toString(), ", tokenAmount:", hbtcAmount.toString());
            // expect(priceLenBTC).to.bignumber.equal(new BN("50"));
        // })
    });

    describe('Main flow', function () {
        it("should run correctly", async () => {
            // approve USDT to router
            await USDT.approve(CRouter.address, USDTTotalSupply_, { from: LP });

            // check if approve successfully
            let allowance = await USDT.allowance(LP, CRouter.address);
            console.log("allowanceUSDT: ", allowance.toString());
            expect(allowance).to.bignumber.equal(USDTTotalSupply_);


            let ethAmount = new BN("10000000000000000000");
            let usdtPrice = new BN("500000000");
            let hbtcPrice = new BN("33988000000000000");
            let usdtAvg = new BN("500000000");
            let hbtcAvg = new BN("33988000000000000");

            await PriceOracle.feedPrice(USDT.address, usdtPrice, usdtPrice, usdtAvg, vola, { from: deployer });
            await CFactory.createPair(USDT.address, USDT_INIT_TOKEN0_AMOUNT, USDT_INIT_TOKEN1_AMOUNT, { from: deployer})
            await PriceOracle.feedPrice(HBTC.address, hbtcPrice, hbtcPrice, hbtcAvg, vola, { from: deployer });
            await CFactory.createPair(HBTC.address, HBTC_INIT_TOKEN0_AMOUNT, HBTC_INIT_TOKEN1_AMOUNT, {from: deployer});

            // addLiquidity (create pair included)
            //  - address token,
            //  - uint amountETH,
            //  - uint amountToken,
            //  - uint liquidityMin,
            //  - address to,
            //  - uint deadline
            let _amountETH = web3.utils.toWei('1', 'ether');
            let _msgValue = web3.utils.toWei('1.1', 'ether');
            let _amountToken = "500000000";
            let result = await CRouter.addLiquidity(USDT.address, _amountETH, _amountToken, 0, LP, "99999999999", { from: LP, value: _msgValue }); // create pair automatically if not exists
            let usdtPairAddr = await CFactory.getPair(USDT.address);
            let USDTPair = await CoFiXPair.at(usdtPairAddr);
            console.log("------------addLiquidity for USDT/ETH------------");
            const pairName = await USDTPair.name();
            const pairSymbol = await USDTPair.symbol();
            console.log(`pair name: ${pairName}, pair symbol: ${pairSymbol}`);
            // pair name: CoFiX Pool Token 1, pair symbol: CPT-1

            expect(pairName).to.equal("XToken 1");
            expect(pairSymbol).to.equal("XT-1");

            let liquidityUSDTPair = await USDTPair.balanceOf(LP);
            let usdtInUSDTPool = await USDT.balanceOf(usdtPairAddr);
            let wethInUSDTPool = await WETH.balanceOf(usdtPairAddr);
            let ethUserBalance = await web3.utils.fromWei(await web3.eth.getBalance(LP), 'ether')
            let usdtUserBalance = await USDT.balanceOf(LP);
            let hbtcUserBalance = await HBTC.balanceOf(LP);
            console.log("receipt.gasUsed:", result.receipt.gasUsed);
            console.log("pool balance USDT:", usdtInUSDTPool.toString());
            console.log("pool balance WETH:", wethInUSDTPool.toString());
            console.log("got liquidity ETH/USDT:", liquidityUSDTPair.toString());
            console.log("user balance ETH:", ethUserBalance.toString());
            console.log("user balance USDT:", usdtUserBalance.toString());
            console.log("user balance HBTC:", hbtcUserBalance.toString());
            
            
            {
                // for benchmark gas cost when not creating new pair
                for (let i = 0; i < 10; i++) {
                    await CRouter.addLiquidity(USDT.address, _amountETH, _amountToken, 0, LP, "99999999999", { from: LP, value: _msgValue });
                }
            }

            await PriceOracle.feedPrice(USDT.address, usdtPrice, usdtPrice, usdtAvg, vola, { from: deployer });
            await PriceOracle.feedPrice(HBTC.address, hbtcPrice, hbtcPrice, hbtcAvg, vola, { from: deployer });

            // add liquidity for HBTC
            // approve HBTC to router
            await HBTC.approve(CRouter.address, HBTCTotalSupply_, { from: LP });
            // check if approve successfully
            let allowanceHBTC = await HBTC.allowance(LP, CRouter.address);
            console.log("allowanceHBTC: ", allowanceHBTC.toString());
            expect(allowanceHBTC).to.bignumber.equal(HBTCTotalSupply_);
            _amountETH = web3.utils.toWei('1', 'ether');
            let _amountHBTC = "100000000000000000"
            result = await CRouter.addLiquidity(HBTC.address, _amountETH, _amountHBTC, 0, LP, "99999999999", { from: LP, value: _msgValue }); // create pair automatically if not exists
            let hbtcPairAddr = await CFactory.getPair(HBTC.address);
            let HBTCPair = await CoFiXPair.at(hbtcPairAddr);
            usdtInUSDTPool = await USDT.balanceOf(usdtPairAddr);
            wethInUSDTPool = await WETH.balanceOf(usdtPairAddr);
            hbtcInHBTCTPool = await HBTC.balanceOf(hbtcPairAddr);
            wethInHBTCPool = await WETH.balanceOf(hbtcPairAddr);
            let _liquidityUSDTPair = await USDTPair.balanceOf(LP);
            let _liquidityHBTCPair = await HBTCPair.balanceOf(LP);
            ethUserBalance = await web3.utils.fromWei(await web3.eth.getBalance(trader), 'ether')
            usdtUserBalance = await USDT.balanceOf(trader);
            hbtcUserBalance = await HBTC.balanceOf(trader);
            console.log("------------addLiquidity for HBTC/ETH------------");
            console.log("receipt.gasUsed:", result.receipt.gasUsed);
            console.log("USDT pool balance USDT:", usdtInUSDTPool.toString());
            console.log("USDT pool balance WETH:", wethInUSDTPool.toString());
            console.log("HBTC pool balance HBTC:", hbtcInHBTCTPool.toString());
            console.log("HBTC pool balance WETH:", wethInHBTCPool.toString());
            console.log("ETH/USDT liquidity of LP:", _liquidityUSDTPair.toString());
            console.log("ETH/HBTC liquidity of LP:", _liquidityHBTCPair.toString());
            console.log("user balance ETH:", ethUserBalance.toString());
            console.log("user balance USDT:", usdtUserBalance.toString());
            console.log("user balance HBTC:", hbtcUserBalance.toString());
            // swapExactTokensForETH
            // - address token,
            // - uint amountIn,
            // - uint amountOutMin,
            // - address to,
            // - uint deadline
            let _amountIn = "100000000";
            _msgValue = web3.utils.toWei('1.1', 'ether');
            result = await CRouter.swapExactTokensForETH(USDT.address, _amountIn, 0, trader, trader, "99999999999", { from: trader, value: _msgValue });
            console.log("------------swapExactTokensForETH------------");
            usdtInUSDTPool = await USDT.balanceOf(usdtPairAddr);
            wethInUSDTPool = await WETH.balanceOf(usdtPairAddr);
            hbtcInHBTCTPool = await HBTC.balanceOf(hbtcPairAddr);
            wethInHBTCPool = await WETH.balanceOf(hbtcPairAddr);
            _liquidityUSDTPair = await USDTPair.balanceOf(LP);
            _liquidityHBTCPair = await HBTCPair.balanceOf(LP);
            ethUserBalance = await web3.utils.fromWei(await web3.eth.getBalance(trader), 'ether')
            usdtUserBalance = await USDT.balanceOf(trader);
            hbtcUserBalance = await HBTC.balanceOf(trader);
            console.log("receipt.gasUsed:", result.receipt.gasUsed);
            console.log("USDT pool balance USDT:", usdtInUSDTPool.toString());
            console.log("USDT pool balance WETH:", wethInUSDTPool.toString());
            console.log("HBTC pool balance HBTC:", hbtcInHBTCTPool.toString());
            console.log("HBTC pool balance WETH:", wethInHBTCPool.toString());
            console.log("ETH/USDT liquidity of LP:", _liquidityUSDTPair.toString());
            console.log("ETH/HBTC liquidity of LP:", _liquidityHBTCPair.toString());
            console.log("user balance ETH:", ethUserBalance.toString());
            console.log("user balance USDT:", usdtUserBalance.toString());
            console.log("user balance HBTC:", hbtcUserBalance.toString());

            // swapExactETHForTokens
            // - address token,
            // - uint amountIn,
            // - uint amountOutMin,
            // - address to,
            // - uint deadline
            _amountIn = web3.utils.toWei('0.2', 'ether');
            _msgValue = web3.utils.toWei('0.3', 'ether');
            result = await CRouter.swapExactETHForTokens(USDT.address, _amountIn, 0, trader, trader, "99999999999", { from: trader, value: _msgValue });
            console.log("------------swapExactETHForTokens------------");
            usdtInUSDTPool = await USDT.balanceOf(usdtPairAddr);
            wethInUSDTPool = await WETH.balanceOf(usdtPairAddr);
            hbtcInHBTCTPool = await HBTC.balanceOf(hbtcPairAddr);
            wethInHBTCPool = await WETH.balanceOf(hbtcPairAddr);
            _liquidityUSDTPair = await USDTPair.balanceOf(LP);
            _liquidityHBTCPair = await HBTCPair.balanceOf(LP);
            ethUserBalance = await web3.utils.fromWei(await web3.eth.getBalance(trader), 'ether')
            usdtUserBalance = await USDT.balanceOf(trader);
            hbtcUserBalance = await HBTC.balanceOf(trader);
            console.log("receipt.gasUsed:", result.receipt.gasUsed);
            console.log("USDT pool balance USDT:", usdtInUSDTPool.toString());
            console.log("USDT pool balance WETH:", wethInUSDTPool.toString());
            console.log("HBTC pool balance HBTC:", hbtcInHBTCTPool.toString());
            console.log("HBTC pool balance WETH:", wethInHBTCPool.toString());
            console.log("ETH/USDT liquidity of LP:", _liquidityUSDTPair.toString());
            console.log("ETH/HBTC liquidity of LP:", _liquidityHBTCPair.toString());
            console.log("user balance ETH:", ethUserBalance.toString());
            console.log("user balance USDT:", usdtUserBalance.toString());
            console.log("user balance HBTC:", hbtcUserBalance.toString());

            // setTheta
            const theta = new BN(200000);
            await CoFiXCtrl.setTheta(USDT.address, theta, { from: deployer });
            let kInfo = await CoFiXCtrl.getKInfo(USDT.address);
            expect(kInfo.theta).to.bignumber.equal(theta);

            // swapExactTokensForTokens
            // - address tokenIn,
            // - address tokenOut,
            // - uint amountIn,
            // - uint amountOutMin,
            // - address to,
            // - uint deadline
            // USDT -> HBTC
            _amountIn = "100000000";
            _msgValue = web3.utils.toWei('0.1', 'ether');
            // get price now from NEST3PriceOracleMock Contract
            let p = await PriceOracle.checkPriceNow(USDT.address);
            console.log("price now>  erc20Amount:", p.latestPriceValue.toString(), p.latestPriceValue.div(new BN('1000000')).toString(), "USDT/ETH");
            result = await CRouter.swapExactTokensForTokens(USDT.address, HBTC.address, _amountIn, 0, trader, trader, "99999999999", { from: trader, value: _msgValue });
            console.log("------------swapExactTokensForTokens------------");
            usdtInUSDTPool = await USDT.balanceOf(usdtPairAddr);
            wethInUSDTPool = await WETH.balanceOf(usdtPairAddr);
            hbtcInHBTCTPool = await HBTC.balanceOf(hbtcPairAddr);
            wethInHBTCPool = await WETH.balanceOf(hbtcPairAddr);
            _liquidityUSDTPair = await USDTPair.balanceOf(LP);
            _liquidityHBTCPair = await HBTCPair.balanceOf(LP);
            ethUserBalance = await web3.utils.fromWei(await web3.eth.getBalance(trader), 'ether')
            usdtUserBalance = await USDT.balanceOf(trader);
            hbtcUserBalance = await HBTC.balanceOf(trader);
            // console.log("tx result:", result);
            console.log("receipt.gasUsed:", result.receipt.gasUsed);
            console.log("USDT pool balance USDT:", usdtInUSDTPool.toString());
            console.log("USDT pool balance WETH:", wethInUSDTPool.toString());
            console.log("HBTC pool balance HBTC:", hbtcInHBTCTPool.toString());
            console.log("HBTC pool balance WETH:", wethInHBTCPool.toString());
            console.log("ETH/USDT liquidity of LP:", _liquidityUSDTPair.toString());
            console.log("ETH/HBTC liquidity of LP:", _liquidityHBTCPair.toString());
            console.log("user balance ETH:", ethUserBalance.toString());
            console.log("user balance USDT:", usdtUserBalance.toString());
            console.log("user balance HBTC:", hbtcUserBalance.toString());
            // check if fee receiver get the fee reward
            let feeReceiver = await CFactory.getFeeReceiver();
            let ethInFeeReceiver = await web3.eth.getBalance(feeReceiver);
            console.log("ETH balance in feeReceiver:", ethInFeeReceiver.toString(), ", feeReceiver:", feeReceiver);
            expect(ethInFeeReceiver).to.bignumber.equal("0"); // if not setTradeMiningStatus, the trading fee is kept in pool

            // setTradeMiningStatus
            await CFactory.setTradeMiningStatus(USDT.address, true);

            await PriceOracle.feedPrice(USDT.address, usdtPrice, usdtPrice, usdtAvg, vola, { from: deployer });
            await PriceOracle.feedPrice(HBTC.address, hbtcPrice, hbtcPrice, hbtcAvg, vola, { from: deployer });
            p = await PriceOracle.checkPriceNow(USDT.address);
            
            // swap again after we setTradeMiningStatus to true
            await CRouter.swapExactTokensForTokens(USDT.address, HBTC.address, _amountIn, 0, trader, trader, "99999999999", { from: trader, value: _msgValue });
            ethInFeeReceiver = await web3.eth.getBalance(feeReceiver); // not zero this time
            kInfo = await CoFiXCtrl.getKInfo(USDT.address);
            let k_base = await CoFiXCtrl.K_BASE(); 
            console.log("kInfo> k:", kInfo.k.toString(), "(", kInfo.k.toString() / k_base.toString(), ")", ", updatedAt:", kInfo.updatedAt.toString());
            // get the latest k info from CoFiXController contract, including k value & last updated time
            // fee = amountIn.mul(_op.ethAmount).mul(K_BASE).mul(_op.theta).div(_op.erc20Amount).div(K_BASE.add(_op.K)).div(THETA_BASE);
            // let oraclePrice = [p.ethAmount, p.erc20Amount, new BN("0"), kInfo.k, theta];
            // let calcOutToken0Result = await USDTPair.calcOutToken0(_amountIn, oraclePrice);
            // console.log(`fee: ${calcOutToken0Result.fee}`);
            const THETA_BASE = "1E8";
            const expectedFee = Decimal(_amountIn).mul(Decimal(web3.utils.toWei('1', 'ether').toString())).mul(Decimal(k_base.toString())).mul(Decimal(theta.toString())).div(Decimal(p.latestPriceValue.toString())).div(Decimal(k_base.toString()).add(Decimal(kInfo.k.toString()))).div(Decimal(THETA_BASE));
            console.log(`expectedFee: ${expectedFee.toString()}, calculatedFee: ${ethInFeeReceiver.toString()}`);
            let error = calcRelativeDiff(expectedFee, ethInFeeReceiver.toString());
            console.log(`expected: ${expectedFee}, actual:${ethInFeeReceiver}, error:${error}`);
            assert.isAtMost(error.toNumber(), errorDelta);

            // removeLiquidityGetETH
            // - address token,
            // - uint liquidity,
            // - uint amountETHMin,
            // - address to,
            // - uint deadline
            // approve liquidity to router
            await USDTPair.approve(CRouter.address, liquidityUSDTPair, { from: LP });
            let partLiquidity = liquidityUSDTPair.div(new web3.utils.BN('5'));
            _msgValue = web3.utils.toWei('0.1', 'ether');
            result = await CRouter.removeLiquidityGetTokenAndETH(USDT.address, partLiquidity, 0, LP, "99999999999", { from: LP, value: _msgValue });
            console.log("------------removeLiquidityGetTokenAndETH------------");
            usdtInUSDTPool = await USDT.balanceOf(usdtPairAddr);
            wethInUSDTPool = await WETH.balanceOf(usdtPairAddr);
            hbtcInHBTCTPool = await HBTC.balanceOf(hbtcPairAddr);
            wethInHBTCPool = await WETH.balanceOf(hbtcPairAddr);
            _liquidityUSDTPair = await USDTPair.balanceOf(LP);
            _liquidityHBTCPair = await HBTCPair.balanceOf(LP);
            ethUserBalance = await web3.utils.fromWei(await web3.eth.getBalance(LP), 'ether')
            usdtUserBalance = await USDT.balanceOf(LP);
            hbtcUserBalance = await HBTC.balanceOf(LP);
            console.log("receipt.gasUsed:", result.receipt.gasUsed);
            console.log("USDT pool balance USDT:", usdtInUSDTPool.toString());
            console.log("USDT pool balance WETH:", wethInUSDTPool.toString());
            console.log("HBTC pool balance HBTC:", hbtcInHBTCTPool.toString());
            console.log("HBTC pool balance WETH:", wethInHBTCPool.toString());
            console.log("ETH/USDT liquidity of LP:", _liquidityUSDTPair.toString());
            console.log("ETH/HBTC liquidity of LP:", _liquidityHBTCPair.toString());
            console.log("user balance ETH:", ethUserBalance.toString());
            console.log("user balance USDT:", usdtUserBalance.toString());
            console.log("user balance HBTC:", hbtcUserBalance.toString());

            // removeLiquidityGetToken
            // - address token,
            // - uint liquidity,
            // - uint amountTokenMin,
            // - address to,
            // - uint deadline
            let mostLeftLiquidity = liquidityUSDTPair.mul(new web3.utils.BN('3')).div(new web3.utils.BN('5'));
            _msgValue = web3.utils.toWei('0.1', 'ether');
            result = await CRouter.removeLiquidityGetTokenAndETH(USDT.address, mostLeftLiquidity, 0, LP, "99999999999", { from: LP, value: _msgValue });
            console.log("------------removeLiquidityGetTokenAndETH------------");
            usdtInUSDTPool = await USDT.balanceOf(usdtPairAddr);
            wethInUSDTPool = await WETH.balanceOf(usdtPairAddr);
            hbtcInHBTCTPool = await HBTC.balanceOf(hbtcPairAddr);
            wethInHBTCPool = await WETH.balanceOf(hbtcPairAddr);
            _liquidityUSDTPair = await USDTPair.balanceOf(LP);
            _liquidityHBTCPair = await HBTCPair.balanceOf(LP);
            ethUserBalance = await web3.utils.fromWei(await web3.eth.getBalance(LP), 'ether')
            usdtUserBalance = await USDT.balanceOf(LP);
            hbtcUserBalance = await HBTC.balanceOf(LP);
            console.log("receipt.gasUsed:", result.receipt.gasUsed);
            console.log("USDT pool balance USDT:", usdtInUSDTPool.toString());
            console.log("USDT pool balance WETH:", wethInUSDTPool.toString());
            console.log("HBTC pool balance HBTC:", hbtcInHBTCTPool.toString());
            console.log("HBTC pool balance WETH:", wethInHBTCPool.toString());
            console.log("ETH/USDT liquidity of LP:", _liquidityUSDTPair.toString());
            console.log("ETH/HBTC liquidity of LP:", _liquidityHBTCPair.toString());
            console.log("user balance ETH:", ethUserBalance.toString());
            console.log("user balance USDT:", usdtUserBalance.toString());
            console.log("user balance HBTC:", hbtcUserBalance.toString());
        });

        it("should addPool correctly", async () => {
            let usdtPairAddr = await CFactory.getPair(USDT.address);
            let USDTPair = await CoFiXPair.at(usdtPairAddr);
            const StakingRewards = await CoFiXStakingRewards.new(CoFi.address, USDTPair.address, CFactory.address, { from: deployer });

            await VaultForLP.addPool(StakingRewards.address, {from: deployer});
            const poolInfo = await VaultForLP.getPoolInfo(StakingRewards.address);
            expect(poolInfo.state).to.bignumber.equal(POOL_STATE_ENABLED);
            expect(poolInfo.weight).to.bignumber.equal("0"); // default weight
            const stakingPool = await VaultForLP.stakingPoolForPair(USDTPair.address);
            expect(stakingPool).equal(StakingRewards.address);
        });

        it("should addLiquidityAndStake correctly", async () => {
            let usdtPairAddr = await CFactory.getPair(USDT.address);
            let USDTPair = await CoFiXPair.at(usdtPairAddr);
            const stakingPool = await VaultForLP.stakingPoolForPair(USDTPair.address);
            const StakingRewards = await CoFiXStakingRewards.at(stakingPool);

            let _amountETH = web3.utils.toWei('1', 'ether');
            let _msgValue = web3.utils.toWei('1.1', 'ether');
            let _amountToken = "500000000";
            let result = await CRouter.addLiquidityAndStake(USDT.address, _amountETH, _amountToken, 0, LP, "99999999999", { from: LP, value: _msgValue });

            console.log("------------addLiquidityAndStake for USDT/ETH------------");
            let liquidityUSDTPair = await USDTPair.balanceOf(LP);
            let usdtInUSDTPool = await USDT.balanceOf(usdtPairAddr);
            let wethInUSDTPool = await WETH.balanceOf(usdtPairAddr);
            let ethUserBalance = await web3.utils.fromWei(await web3.eth.getBalance(LP), 'ether')
            let usdtUserBalance = await USDT.balanceOf(LP);
            let hbtcUserBalance = await HBTC.balanceOf(LP);
            console.log("receipt.gasUsed:", result.receipt.gasUsed);
            console.log("pool balance USDT:", usdtInUSDTPool.toString());
            console.log("pool balance WETH:", wethInUSDTPool.toString());
            console.log("got liquidity ETH/USDT:", liquidityUSDTPair.toString());
            console.log("user balance ETH:", ethUserBalance.toString());
            console.log("user balance USDT:", usdtUserBalance.toString());
            console.log("user balance HBTC:", hbtcUserBalance.toString());

            const balanceInStake = await StakingRewards.balanceOf(LP);
            const totalSupply = await StakingRewards.totalSupply();
            console.log("staking> balanceInStake:", balanceInStake.toString());
            console.log("staking> pool totalSupply:", totalSupply.toString());
        });
    });


    describe('Read from contract', function () {
        it("test", async () => {
            // get K_BASE from CoFiXController contract
            let k_base = await CoFiXCtrl.K_BASE(); // 1E8
            expect(k_base).to.bignumber.equal(new BN(1E8));

            // get pair address
            let usdtPairAddr = await CFactory.getPair(USDT.address);
            let USDTPair = await CoFiXPair.at(usdtPairAddr);

            // get NAVPS_BASE from CoFiXPair contract
            let navps_base = await USDTPair.NAVPS_BASE();
            expect(navps_base).to.bignumber.equal((new BN('10')).pow(new BN(18)));

            // get the latest k info from CoFiXController contract, including k value & last updated time
            let kInfo = await CoFiXCtrl.getKInfo(USDT.address);
            console.log("kInfo> k:", kInfo.k.toString(), "(", kInfo.k.toString() / k_base.toString(), ")", ", updatedAt:", kInfo.updatedAt.toString());

            // get price now from NEST3PriceOracleMock Contract
            let p = await PriceOracle.checkPriceNow(USDT.address);
            console.log("price now> ethAmount:", web3.utils.toWei('1', 'ether').toString(), ", erc20Amount:", p.latestPriceValue.toString(), p.latestPriceValue.div(new BN('1000000')).toString(), "USDT/ETH");

            // get Net Asset Value Per Share for USDTPair contract
            let oraclePrice = [ web3.utils.toWei('1', 'ether'), p.latestPriceValue, new BN("0"), kInfo.k, new BN("0")];

            let navpsForMint = await USDTPair.getNAVPerShareForMint(oraclePrice);

            let navps_value_for_mint = (Decimal(navpsForMint.toString())).div(Decimal(navps_base.toString()));
            console.log("net asset value per share for mint:", navps_value_for_mint);

            const expected = "1";
            let errorMint = calcRelativeDiff(expected, navps_value_for_mint.toString());
            console.log(`navps_value_for_mint> expected: ${expected}, actual: ${navps_value_for_mint.toString()}, error: ${errorMint}`);
            assert.isAtMost(errorMint.toNumber(), 10 ** -1);

            let navpsForBurn = await USDTPair.getNAVPerShareForBurn(oraclePrice);
            let navps_value_for_burn = (Decimal(navpsForBurn.toString())).div(Decimal(navps_base.toString()));
            // let navps_value_for_burn = navpsForBurn.toNumber() / navps_base.toNumber();
            console.log("net asset value per share for burn:", navps_value_for_burn);

            let errorBurn = calcRelativeDiff(expected, navps_value_for_burn.toString());
            console.log(`navps_value_for_burn> expected: ${expected}, actual: ${navps_value_for_burn.toString()}, error: ${errorBurn}`);
            assert.isAtMost(errorBurn.toNumber(), 10 ** -1);

            expect(errorMint.toString()).to.bignumber.equal(errorBurn.toString());

            // get total liquidity (totalSupply of pair/pool token)
            let totalLiquidity = await USDTPair.totalSupply();
            console.log("total liquidity of WETH/USDT pool:", totalLiquidity.toString());

            // estimate liquidity for addLiquidity() function in router
            // get estimated liquidity amount (it represents the amount of pool tokens will be minted if someone provide liquidity to the pool)
            let amount0 = web3.utils.toWei('1', 'ether'); // ethAmount
            let amount1 = new BN("500000000"); // erc20Amount
            let liquidity = await USDTPair.getLiquidity(amount0, oraclePrice);
            console.log("estimate addLiquidity> liquidity:", liquidity.toString(), ", ratio:", liquidity.toString() / totalLiquidity.toString());

            // estimate amountOut for removeLiquidityGetTokenAndETH() function in router
            // calc amountOut for token0 (WETH) when send liquidity token to pool for burning
            let result = await USDTPair.calcOutTokenAndETHForBurn(liquidity, oraclePrice);
            console.log("estimate removeLiquidityGetTokenAndETH> amountOutETH:", result.amountEthOut.toString(), web3.utils.fromWei(result.amountEthOut, 'ether'), "ETH");
            console.log("estimate removeLiquidityGetTokenAndETH> amountOutToken:", result.amountTokenOut.toString(), result.amountTokenOut.div(new BN('1000000')).toString(), "USDT");

            // estimate amountOut for swapExactETHForTokens() function in router
            // get estimated amountOut for token1 (ERC20 token) when swapWithExact
            let amountInETH = web3.utils.toWei('1', 'ether');
            result = await USDTPair.calcOutToken1(amountInETH, oraclePrice);
            console.log("estimate swapExactETHForTokens> amountOutToken:", result.amountOut.toString(), result.amountOut.div(new BN('1000000')).toString(), "USDT");

            // estimate amountOut for swapExactTokenForETH() function in router
            // get estimated amountOut for token0 (WETH) when swapWithExact
            amountInToken = new BN("530000000");
            let calcOutToken0Result = await USDTPair.calcOutToken0(amountInToken, oraclePrice);
            console.log("estimate swapExactTokenForETH> amountOutETH:", calcOutToken0Result.amountOut.toString(), web3.utils.fromWei(calcOutToken0Result.amountOut, 'ether'), "ETH");

            // estimate amountIn for swapETHForExactTokens() function in router
            // get estimate amountInNeeded for token0 (WETH) when swapForExact
            result = await USDTPair.calcInNeededToken0(result.amountOut, oraclePrice);
            console.log("estimate swapETHForExactTokens> amountInETHNeeded:", result.amountInNeeded.toString(), web3.utils.fromWei(result.amountInNeeded, 'ether'), "ETH");


            // estimate amountIn for swapTokensForExactETH() function in router
            // get estimate amountInNeeded for token1 (ERC20 token) when swapForExact
            result = await USDTPair.calcInNeededToken1(calcOutToken0Result.amountOut, oraclePrice);
            // get estimate amountInNeeded for token0 (WETH) when swapForExact
            console.log("estimate swapTokensForExactETH> amountInTokenNeeded:", result.amountInNeeded.toString(), result.amountInNeeded.div(new BN('1000000')).toString(), "USDT");
        });
    });

})