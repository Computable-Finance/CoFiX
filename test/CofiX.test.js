const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
// const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
// const CofiXRouter = contract.fromArtifact("CofiXRouter");
// const ERC20 = contract.fromArtifact("ERC20");
// const CofiXFactory = contract.fromArtifact("CofiXFactory");
// const CofiXPair = contract.fromArtifact("CofiXPair");
// const WETH9 = contract.fromArtifact("WETH9");
// const NEST3PriceOracleMock = contract.fromArtifact("NEST3PriceOracleMock");
// const CofiXController = contract.fromArtifact("CofiXController");

const CofiXRouter = artifacts.require("CofiXRouter");
// const ERC20 = artifacts.require("ERC20");
const CofiXFactory = artifacts.require("CofiXFactory");
const CofiXPair = artifacts.require("CofiXPair");
const WETH9 = artifacts.require("WETH9");
const NEST3PriceOracleMock = artifacts.require("NEST3PriceOracleMock");
const CofiXController = artifacts.require("CofiXController");
const TestUSDT = artifacts.require("test/USDT");
const TestHBTC = artifacts.require("test/HBTC");
const TestNEST = artifacts.require("test/NEST");

contract('CofiX', (accounts) => {
// describe('CofiX', function () {
    // const [owner] = accounts;
    const owner = accounts[0];
    let deployer = owner;
    let LP = owner;
    let trader = owner;

    // let totalSupply_ = "10000000000000000";
    const USDTTotalSupply_ = new BN("10000000000000000");
    const HBTCTotalSupply_ = new BN("100000000000000000000000000");

    const DESTRUCTION_AMOUNT = web3.utils.toWei('10000', 'ether');

    before(async () => {
        // change to openzeppelin/test-environment if it has better support for test coverage and gas cost measure
        // USDT = await ERC20.new("10000000000000000", "USDT Test Token", "USDT", 6, { from: deployer });
        // WETH = await WETH9.new();
        // PriceOracle = await NEST3PriceOracleMock.new();
        // CofiXCtrl = await CofiXController.new(PriceOracle.address);
        // CFactory = await CofiXFactory.new(CofiXCtrl.address, WETH.address)
        // CRouter = await CofiXRouter.new(CFactory.address, WETH.address);
        // USDT = await ERC20.new("10000000000000000", "USDT Test Token", "USDT", 6, { from: deployer });
        // HBTC = await ERC20.new("100000000000000000000000000", "Huobi BTC", "HBTC", 18, { from: deployer });
        USDT = await TestUSDT.new();
        HBTC = await TestHBTC.new();
        WETH = await WETH9.deployed();
        NEST = await TestNEST.deployed()
        PriceOracle = await NEST3PriceOracleMock.deployed();
        CofiXCtrl = await CofiXController.deployed();
        // CofiXCtrl.initialize(PriceOracle.address, { from: deployer });
        CFactory = await CofiXFactory.deployed();
        CRouter = await CofiXRouter.deployed();
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

    describe('CofiXController', function () {
        it("should activate nest oracle correctly", async () => {
            await NEST.approve(CofiXCtrl.address, DESTRUCTION_AMOUNT);
            await CofiXCtrl.activate();
            await time.increase(time.duration.minutes(1)); // increase time to make activation be effective
        });

        it("should not activate again", async () => {
            await NEST.approve(CofiXCtrl.address, DESTRUCTION_AMOUNT);
            await expectRevert(CofiXCtrl.activate(), 'CofiXCtrl: activated');
        });

        it("K calculation", async () => {
            console.log("======================CofiXController TEST START======================");
            _msgValue = web3.utils.toWei('0.01', 'ether');

            // add enough prices in NEST3PriceOracleMock
            let ethAmount = new BN("10000000000000000000");
            let usdtAmount = new BN("3255000000");

            for (let i = 0; i < 50; i++) {
                await PriceOracle.addPriceToList(USDT.address, ethAmount, usdtAmount, "0", { from: deployer });
                usdtAmount = usdtAmount.mul(new BN("100")).div(new BN("100")); // very stable price
            }
            let priceLen = await PriceOracle.getPriceLength(USDT.address);
            console.log("USDT>priceLen:", priceLen.toString(), ", tokenAmount:", usdtAmount.toString());
            expect(priceLen).to.bignumber.equal(new BN("50"));

            // let gas = await CofiXCtrl.methods['queryOracle(address,address)'].estimateGas(USDT.address, deployer, { from: deployer })
            // console.log("estimateGas:", gas.toString())
            let result = await CofiXCtrl.queryOracle(USDT.address, deployer, { from: deployer, value: _msgValue });
            console.log("USDT>receipt.gasUsed:", result.receipt.gasUsed); // 494562
            let evtArgs0 = result.receipt.logs[0].args;
            console.log("USDT>evtArgs0> K:", evtArgs0.K.toString(), ", sigma:", evtArgs0.sigma.toString(), ", T:", evtArgs0.T.toString(), ", ethAmount:", evtArgs0.ethAmount.toString(), ", erc20Amount:", evtArgs0.erc20Amount.toString());
            // K = -0.016826326, when sigma equals to zero

            // add more prices
            for (let i = 0; i < 50; i++) {
                await PriceOracle.addPriceToList(USDT.address, ethAmount, usdtAmount, "0", { from: deployer });
                usdtAmount = usdtAmount.mul(new BN("101")).div(new BN("100")); // eth price rising
            }
            priceLen = await PriceOracle.getPriceLength(USDT.address);
            console.log("USDT>priceLen:", priceLen.toString(), ", tokenAmount:", usdtAmount.toString());
            expect(priceLen).to.bignumber.equal(new BN("100"));
            result = await CofiXCtrl.queryOracle(USDT.address, deployer, { from: deployer, value: _msgValue });
            console.log("USDT>receipt.gasUsed:", result.receipt.gasUsed); // 544914
            evtArgs0 = result.receipt.logs[0].args;
            console.log("USDT>evtArgs0> K:", evtArgs0.K.toString(), ", sigma:", evtArgs0.sigma.toString(), ", T:", evtArgs0.T.toString(), ", ethAmount:", evtArgs0.ethAmount.toString(), ", erc20Amount:", evtArgs0.erc20Amount.toString())
            // python result, K=-0.009217843036355746, sigma=0.0004813196086030222
            // contract result, K=-170039189510192419/(2**64)=-0.00921784293373125, sigma=8878779697438274/(2**64)=0.0004813196118491383

            // debug
            let p = await PriceOracle.priceInfoList_(USDT.address, 99);
            console.log("debug>USDT>p:", p.ethAmount.toString(), p.erc20Amount.toString(), p.blockNum.toString());
            let c = await PriceOracle.checkPriceList(USDT.address, 50);
            console.log("debug>USDT>c:", c[0].toString(), c[1].toString(), c[2].toString(), c[3].toString(), c[4].toString());
            console.log("======================CofiXController STATS END======================");

            // add price for HBTC
            let hbtcAmount = new BN("339880000000000000");
            for (let i = 0; i < 50; i++) {
                await PriceOracle.addPriceToList(HBTC.address, ethAmount, hbtcAmount, "0", { from: deployer });
                hbtcAmount = hbtcAmount.mul(new BN("100")).div(new BN("100")); // very stable price
            }
            let priceLenBTC = await PriceOracle.getPriceLength(HBTC.address);
            console.log("HBTC>priceLen:", priceLenBTC.toString(), ", tokenAmount:", hbtcAmount.toString());
            expect(priceLenBTC).to.bignumber.equal(new BN("50"));
        })
    });

    describe('Main flow', function () {
        it("should run correctly", async () => {
            let priceLenUSDT = await PriceOracle.getPriceLength(USDT.address);
            console.log("USDT priceLen:", priceLenUSDT.toString());

            let priceLenHBTC = await PriceOracle.getPriceLength(HBTC.address);
            console.log("HBTC priceLen:", priceLenHBTC.toString());

            // approve USDT to router
            await USDT.approve(CRouter.address, USDTTotalSupply_, { from: LP });

            // check if approve successfully
            let allowance = await USDT.allowance(LP, CRouter.address);
            console.log("allowanceUSDT: ", allowance.toString());
            expect(allowance).to.bignumber.equal(USDTTotalSupply_);

            // addLiquidity (create pair included)
            //  - address token,
            //  - uint amountETH,
            //  - uint amountToken,
            //  - uint liquidityMin,
            //  - address to,
            //  - uint deadline
            let _amountETH = web3.utils.toWei('1', 'ether');
            let _msgValue = web3.utils.toWei('1.1', 'ether');
            let _amountToken = "1000000000";
            let result = await CRouter.addLiquidity(USDT.address, _amountETH, _amountToken, 0, LP, "99999999999", { from: LP, value: _msgValue }); // create pair automatically if not exists
            let usdtPairAddr = await CFactory.getPair(USDT.address);
            let USDTPair = await CofiXPair.at(usdtPairAddr);
            console.log("------------addLiquidity for USDT/ETH------------");
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

            // add liquidity for HBTC
            // approve HBTC to router
            await HBTC.approve(CRouter.address, HBTCTotalSupply_, { from: LP });
            // check if approve successfully
            let allowanceHBTC = await HBTC.allowance(LP, CRouter.address);
            console.log("allowanceHBTC: ", allowanceHBTC.toString());
            expect(allowanceHBTC).to.bignumber.equal(HBTCTotalSupply_);
            _amountETH = web3.utils.toWei('1', 'ether');
            let _amountHBTC = "2000000000000000000"
            result = await CRouter.addLiquidity(HBTC.address, _amountETH, _amountHBTC, 0, LP, "99999999999", { from: LP, value: _msgValue }); // create pair automatically if not exists
            let hbtcPairAddr = await CFactory.getPair(HBTC.address);
            let HBTCPair = await CofiXPair.at(hbtcPairAddr);
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
            result = await CRouter.swapExactTokensForETH(USDT.address, _amountIn, 0, trader, "99999999999", { from: trader, value: _msgValue });
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
            result = await CRouter.swapExactETHForTokens(USDT.address, _amountIn, 0, trader, "99999999999", { from: trader, value: _msgValue });
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
            result = await CRouter.swapExactTokensForTokens(USDT.address, HBTC.address, _amountIn, 0, trader, "99999999999", { from: trader, value: _msgValue });
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
            result = await CRouter.removeLiquidityGetETH(USDT.address, partLiquidity, 0, LP, "99999999999", { from: LP, value: _msgValue });
            console.log("------------removeLiquidityGetETH------------");
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
            result = await CRouter.removeLiquidityGetToken(USDT.address, mostLeftLiquidity, 0, LP, "99999999999", { from: LP, value: _msgValue });
            console.log("------------removeLiquidityGetToken------------");
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
    });

    describe('Read from contract', function () {
        it("test", async () => {
            // get K_BASE from CofiXController contract
            let k_base = await CofiXCtrl.K_BASE(); // 100000
            expect(k_base).to.bignumber.equal(new BN("100000"));

            // get pair address
            let usdtPairAddr = await CFactory.getPair(USDT.address);
            let USDTPair = await CofiXPair.at(usdtPairAddr);

            // get NAVPS_BASE from CofiXPair contract
            let navps_base = await USDTPair.NAVPS_BASE();
            expect(navps_base).to.bignumber.equal(new BN("10000"));

            // get the latest k info from CofiXController contract, including k value & last updated time
            let kInfo = await CofiXCtrl.getKInfo(USDT.address);
            console.log("kInfo> k:", kInfo.k.toString(), "(", kInfo.k.toString() / k_base.toString(), ")", ", updatedAt:", kInfo.updatedAt.toString());

            // get price now from NEST3PriceOracleMock Contract
            let p = await PriceOracle.checkPriceNow(USDT.address);
            console.log("price now> ethAmount:", p.ethAmount.toString(), ", erc20Amount:", p.erc20Amount.toString(), p.erc20Amount.mul(new BN(web3.utils.toWei('1', 'ether'))).div(p.ethAmount).div(new BN('1000000')).toString(), "USDT/ETH");

            // get Net Asset Value Per Share for USDTPair contract
            let oraclePrice = [p.ethAmount, p.erc20Amount, new BN("0"), kInfo.k];
            let navps = await USDTPair.getNAVPerShare(oraclePrice);
            console.log("net asset value per share:", navps.toNumber() / navps_base.toNumber());

            // get total liquidity (totalSupply of pair/pool token)
            let totalLiquidity = await USDTPair.totalSupply();
            console.log("total liquidity of WETH/USDT pool:", totalLiquidity.toString());

            // estimate liquidity for addLiquidity() function in router
            // get estimated liquidity amount (it represents the amount of pool tokens will be minted if someone provide liquidity to the pool)
            let amount0 = web3.utils.toWei('1', 'ether'); // ethAmount
            let amount1 = new BN("500000000"); // erc20Amount
            let liquidity = await USDTPair.getLiquidity(amount0, amount1, oraclePrice);
            console.log("estimate addLiquidity> liquidity:", liquidity.toString(), ", ratio:", liquidity.toNumber() / totalLiquidity.toNumber());

            // estimate amountOut for removeLiquidityGetETH() function in router
            // calc amountOut for token0 (WETH) when send liquidity token to pool for burning
            let amountOutETH = await USDTPair.calcOutToken0ForBurn(liquidity, navps, oraclePrice);
            console.log("estimate removeLiquidityGetETH> amountOutETH:", amountOutETH.toString(), web3.utils.fromWei(amountOutETH, 'ether'), "ETH");

            // estimate amountOut for removeLiquidityGetToken() function in router
            // calc amountOut for token1 (ERC20 token) when send liquidity token to pool for burning
            let amountOutToken = await USDTPair.calcOutToken1ForBurn(liquidity, navps, oraclePrice);
            console.log("estimate removeLiquidityGetToken> amountOutETH:", amountOutToken.toString(), amountOutToken.div(new BN('1000000')).toString(), "USDT");

            // estimate amountOut for swapExactETHForTokens() function in router
            // get estimated amountOut for token1 (ERC20 token) when swapWithExact
            let amountInETH = web3.utils.toWei('1', 'ether');
            amountOutToken = await USDTPair.calcOutToken1(amountInETH, oraclePrice);
            console.log("estimate swapExactETHForTokens> amountOutToken:", amountOutToken.toString(), amountOutToken.div(new BN('1000000')).toString(), "USDT");

            // estimate amountOut for swapExactTokenForETH() function in router
            // get estimated amountOut for token0 (WETH) when swapWithExact
            amountInToken = new BN("530000000");
            amountOutETH = await USDTPair.calcOutToken0(amountInToken, oraclePrice);
            console.log("estimate swapExactTokenForETH> amountOutETH:", amountOutETH.toString(), web3.utils.fromWei(amountOutETH, 'ether'), "ETH");

            // estimate amountIn for swapETHForExactTokens() function in router
            // get estimate amountInNeeded for token0 (WETH) when swapForExact
            let amountInETHNeeded = await USDTPair.calcInNeededToken0(amountOutToken, oraclePrice);
            console.log("estimate swapETHForExactTokens> amountInETHNeeded:", amountInETHNeeded.toString(), web3.utils.fromWei(amountInETHNeeded, 'ether'), "ETH");


            // estimate amountIn for swapTokensForExactETH() function in router
            // get estimate amountInNeeded for token1 (ERC20 token) when swapForExact
            let amountInTokenNeeded = await USDTPair.calcInNeededToken1(amountOutETH, oraclePrice);
            // get estimate amountInNeeded for token0 (WETH) when swapForExact
            console.log("estimate swapTokensForExactETH> amountInTokenNeeded:", amountInTokenNeeded.toString(), amountInTokenNeeded.div(new BN('1000000')).toString(), "USDT");
        });
    });

})