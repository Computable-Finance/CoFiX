const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const CofiXRouter = contract.fromArtifact("CofiXRouter");
const ERC20 = contract.fromArtifact("ERC20");
const CofiXFactory = contract.fromArtifact("CofiXFactory");
const CofiXPair = contract.fromArtifact("CofiXPair");
const WETH9 = contract.fromArtifact("WETH9");
const NEST3PriceOracleMock = contract.fromArtifact("NEST3PriceOracleMock");
const DeviationRatio = contract.fromArtifact("DeviationRatio");

describe('CofiXRouter', function () {
    const [owner] = accounts;
    let deployer = owner;
    let LP = owner;
    let trader = owner;

    // let totalSupply_ = "10000000000000000";
    const totalSupply_ = new BN("10000000000000000");


    before(async () => {
        USDT = await ERC20.new("10000000000000000", "USDT Test Token", "USDT", 6, { from: deployer });
        WETH = await WETH9.new();
        PriceOracle = await NEST3PriceOracleMock.new();
        AGFactory = await CofiXFactory.new(PriceOracle.address, WETH.address)
        AGRouter = await CofiXRouter.new(AGFactory.address, WETH.address);
        KCalc = await DeviationRatio.new();
    });

    it("should USDT totalSupply equals", async () => {
        let totalSupply = await USDT.totalSupply();
        expect(totalSupply).to.bignumber.equal(totalSupply_);
    })

    it("should run correctly", async () => {

        // add enough prices in NEST3PriceOracleMock
        let ethAmount = new BN("10000000000000000000");
        let tokenAmount = new BN("3255000000");

        for (let i = 0; i < 50; i++) {
            await PriceOracle.addPriceToList(USDT.address, ethAmount, tokenAmount, "0", { from: deployer });
            tokenAmount = tokenAmount.mul(new BN("100")).div(new BN("100")); // very stable price
        }
        let priceLen = await PriceOracle.getPriceLength(USDT.address);
        console.log("priceLen:", priceLen.toString(), ", tokenAmount:", tokenAmount.toString());
        expect(priceLen).to.bignumber.equal(new BN("50"));
        // let gas = await KCalc.methods['calcK(address,address)'].estimateGas(PriceOracle.address, USDT.address, { from: deployer })
        // console.log("estimateGas:", gas.toString())
        let result = await KCalc.calcK(PriceOracle.address, USDT.address, { from: deployer });
        console.log("receipt.gasUsed:", result.receipt.gasUsed); // 494562
        let evtArgs0 = result.receipt.logs[0].args;
        console.log("evtArgs0> K:", evtArgs0.K.toString(), ", sigma:", evtArgs0.sigma.toString(), ", T:", evtArgs0.T.toString(), ", ethAmount:", evtArgs0.ethAmount.toString(), ", erc20Amount:", evtArgs0.erc20Amount.toString())
        // K = -0.016826326, when sigma equals to zero

        // add more prices
        for (let i = 0; i < 50; i++) {
            await PriceOracle.addPriceToList(USDT.address, ethAmount, tokenAmount, "0", { from: deployer });
            tokenAmount = tokenAmount.mul(new BN("101")).div(new BN("100")); // eth price rising
        }
        priceLen = await PriceOracle.getPriceLength(USDT.address);
        console.log("priceLen:", priceLen.toString(), ", tokenAmount:", tokenAmount.toString());
        expect(priceLen).to.bignumber.equal(new BN("100"));
        result = await KCalc.calcK(PriceOracle.address, USDT.address, { from: deployer });
        console.log("receipt.gasUsed:", result.receipt.gasUsed); // 544914
        evtArgs0 = result.receipt.logs[0].args;
        console.log("evtArgs0> K:", evtArgs0.K.toString(), ", sigma:", evtArgs0.sigma.toString(), ", T:", evtArgs0.T.toString(), ", ethAmount:", evtArgs0.ethAmount.toString(), ", erc20Amount:", evtArgs0.erc20Amount.toString())
        // python result, K=-0.009217843036355746, sigma=0.0004813196086030222
        // contract result, K=-170039189510192419/(2**64)=-0.00921784293373125, sigma=8878779697438274/(2**64)=0.0004813196118491383
        
        // debug
        let p = await PriceOracle.priceInfoList_(USDT.address, 99);
        console.log("debug>p:", p.ethAmount.toString(), p.erc20Amount.toString(), p.blockNumber.toString());
        let c = await PriceOracle.checkPriceList(USDT.address, 50);
        console.log("debug>c:", c[0].toString(), c[1].toString(), c[2].toString(), c[3].toString(), c[4].toString());

        // approve USDT to router
        await USDT.approve(AGRouter.address, totalSupply_, { from: LP });

        // approve successfully
        let allowance = await USDT.allowance(LP, AGRouter.address);
        console.log("allowance: ", allowance.toString());
        expect(allowance).to.bignumber.equal(totalSupply_);

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
        await AGRouter.addLiquidity(USDT.address, _amountETH, _amountToken, 0, LP, "99999999999", { from: LP, value: _msgValue }); // create pair automatically if not exists

        // check token balance
        let pairAddr = await AGFactory.getPair(USDT.address);
        let USDTPair = await CofiXPair.at(pairAddr);
        console.log("------------addLiquidity------------");
        let liquidity = await USDTPair.balanceOf(LP);
        let usdtInPool = await USDT.balanceOf(pairAddr);
        let wethInPool = await WETH.balanceOf(pairAddr);
        console.log("pool balance USDT: ", usdtInPool.toString());
        console.log("pool balance WETH: ", wethInPool.toString());
        console.log("got liquidity: ", liquidity.toString());

        // swapExactTokensForETH
        // - address token,
        // - uint amountIn,
        // - uint amountOutMin,
        // - address to,
        // - uint deadline
        let _amountIn = "100000000";
        _msgValue = web3.utils.toWei('1.1', 'ether');
        await AGRouter.swapExactTokensForETH(USDT.address, _amountIn, 0, trader, "99999999999", { from: trader, value: _msgValue });
        console.log("------------swapExactTokensForETH------------");
        usdtInPool = await USDT.balanceOf(pairAddr);
        wethInPool = await WETH.balanceOf(pairAddr);
        _liquidity = await USDTPair.balanceOf(LP);
        console.log("pool balance USDT: ", usdtInPool.toString());
        console.log("pool balance WETH: ", wethInPool.toString());
        console.log("liquidity of LP: ", _liquidity.toString());

        // swapExactETHForTokens
        // - address token,
        // - uint amountIn,
        // - uint amountOutMin,
        // - address to,
        // - uint deadline
        _amountIn = web3.utils.toWei('0.2', 'ether');
        _msgValue = web3.utils.toWei('0.3', 'ether');
        await AGRouter.swapExactETHForTokens(USDT.address, _amountIn, 0, trader, "99999999999", { from: trader, value: _msgValue });
        console.log("------------swapExactETHForTokens------------");
        usdtInPool = await USDT.balanceOf(pairAddr);
        wethInPool = await WETH.balanceOf(pairAddr);
        _liquidity = await USDTPair.balanceOf(LP);
        console.log("pool balance USDT: ", usdtInPool.toString());
        console.log("pool balance WETH: ", wethInPool.toString());
        console.log("liquidity of LP: ", _liquidity.toString());

        // removeLiquidityGetETH
        // - address token,
        // - uint liquidity,
        // - uint amountETHMin,
        // - address to,
        // - uint deadline
        // approve liquidity to router
        await USDTPair.approve(AGRouter.address, liquidity, { from: LP });
        let partLiquidity = liquidity.div(new web3.utils.BN('5'));
        _msgValue = web3.utils.toWei('0.1', 'ether');
        await AGRouter.removeLiquidityGetETH(USDT.address, partLiquidity, 0, LP, "99999999999", { from: LP, value: _msgValue });
        console.log("------------removeLiquidityGetETH------------");
        usdtInPool = await USDT.balanceOf(pairAddr);
        wethInPool = await WETH.balanceOf(pairAddr);
        _liquidity = await USDTPair.balanceOf(LP);
        console.log("pool balance USDT: ", usdtInPool.toString());
        console.log("pool balance WETH: ", wethInPool.toString());
        console.log("liquidity of LP: ", _liquidity.toString());

        // removeLiquidityGetToken
        // - address token,
        // - uint liquidity,
        // - uint amountTokenMin,
        // - address to,
        // - uint deadline
        let mostLeftLiquidity = liquidity.mul(new web3.utils.BN('3')).div(new web3.utils.BN('5'));
        _msgValue = web3.utils.toWei('0.1', 'ether');
        await AGRouter.removeLiquidityGetToken(USDT.address, mostLeftLiquidity, 0, LP, "99999999999", { from: LP, value: _msgValue });
        console.log("------------removeLiquidityGetToken------------");
        usdtInPool = await USDT.balanceOf(pairAddr);
        wethInPool = await WETH.balanceOf(pairAddr);
        _liquidity = await USDTPair.balanceOf(LP);
        console.log("pool balance USDT: ", usdtInPool.toString());
        console.log("pool balance WETH: ", wethInPool.toString());
        console.log("liquidity of LP: ", _liquidity.toString());

    });

})