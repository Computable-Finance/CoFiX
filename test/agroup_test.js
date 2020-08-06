const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const AGroupRouter = contract.fromArtifact("AGroupRouter");
const ERC20 = contract.fromArtifact("ERC20");
const AGroupFactory = contract.fromArtifact("AGroupFactory");
const AGroupPair = contract.fromArtifact("AGroupPair");
const WETH9 = contract.fromArtifact("WETH9");
const NEST3PriceOracleMock = contract.fromArtifact("NEST3PriceOracleMock");

describe('AGroupRouter', function () {
    const [ owner ] = accounts;
    let deployer = owner;
    let LP = owner;
    let trader = owner;

    // let totalSupply_ = "10000000000000000";
    const totalSupply_ = new BN("10000000000000000");

    
    before(async () => {
        USDT = await ERC20.new("10000000000000000", "USDT Test Token", "USDT", 6, {from: deployer});
        WETH = await WETH9.new();
        PriceOracle = await NEST3PriceOracleMock.new();
        AGFactory = await AGroupFactory.new(PriceOracle.address, WETH.address)
        AGRouter = await AGroupRouter.new(AGFactory.address, WETH.address);
    });

    it("should USDT totalSupply equals", async () => {
        let totalSupply = await USDT.totalSupply();
        expect(totalSupply).to.bignumber.equal(totalSupply_);
    })

    it("should run correctly", async () => {
        // approve USDT to router
        await USDT.approve(AGRouter.address, totalSupply_, {from: LP});

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
        await AGRouter.addLiquidity(USDT.address, _amountETH, _amountToken, 0, LP, "99999999999", {from: LP, value: _msgValue}); // create pair automatically if not exists

        // check token balance
        let pairAddr = await AGFactory.getPair(USDT.address);
        let USDTPair = await AGroupPair.at(pairAddr);
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
        await AGRouter.swapExactTokensForETH(USDT.address, _amountIn, 0, trader, "99999999999", {from: trader, value: _msgValue});
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
        await AGRouter.swapExactETHForTokens(USDT.address, _amountIn, 0, trader, "99999999999", {from: trader, value: _msgValue});
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
        await USDTPair.approve(AGRouter.address, liquidity, {from: LP});
        let partLiquidity = liquidity.div(new web3.utils.BN('5'));
        _msgValue = web3.utils.toWei('0.1', 'ether');
        await AGRouter.removeLiquidityGetETH(USDT.address, partLiquidity, 0, LP, "99999999999", {from: LP, value: _msgValue});
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
        await AGRouter.removeLiquidityGetToken(USDT.address, mostLeftLiquidity, 0, LP, "99999999999", {from: LP, value: _msgValue});
        console.log("------------removeLiquidityGetToken------------");
        usdtInPool = await USDT.balanceOf(pairAddr);
        wethInPool = await WETH.balanceOf(pairAddr);
        _liquidity = await USDTPair.balanceOf(LP);
        console.log("pool balance USDT: ", usdtInPool.toString());
        console.log("pool balance WETH: ", wethInPool.toString());
        console.log("liquidity of LP: ", _liquidity.toString());

    });

})