const AGroupRouter = artifacts.require("AGroupRouter");
const ERC20 = artifacts.require("test/ERC20");
const AGroupFactory = artifacts.require("AGroupFactory");
const AGroupPair = artifacts.require("AGroupPair");
const WETH9 = artifacts.require("test/WETH9");
const { getWeb3 } = require("./helpers");
const web3 = getWeb3();
const truffleAssert = require('truffle-assertions');


contract("AGroutRouter", async (accounts) => {

    let deployer = accounts[0];
    let LP = accounts[0]; // liquidity provider
    let trader = accounts[0];

    let totalSupply_ = "10000000000000000";

    before(async () => {
        AGRouter = await AGroupRouter.deployed();
        USDT = await ERC20.deployed();
        AGFactory = await AGroupFactory.deployed();
        WETH = await WETH9.deployed();
    });

    it("should USDT totalSupply equals", async () => {
        let totalSupply = await USDT.totalSupply();
        assert.equal(totalSupply, totalSupply_);
    })

    it("should run correctly", async () => {
        // approve USDT to router
        await USDT.approve(AGRouter.address, totalSupply_);

        // approve successfully
        let allowance = await USDT.allowance(deployer, AGRouter.address);
        assert.equal(allowance, totalSupply_);

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
        await AGRouter.addLiquidity(USDT.address, _amountETH, _amountToken, 0, LP, "99999999999", {value: _msgValue}); // create pair automatically if not exists

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
        await AGRouter.swapExactTokensForETH(USDT.address, _amountIn, 0, trader, "99999999999", {value: _msgValue});
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
        await AGRouter.swapExactETHForTokens(USDT.address, _amountIn, 0, trader, "99999999999", {value: _msgValue});
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
        await USDTPair.approve(AGRouter.address, liquidity);
        let partLiquidity = liquidity.div(new web3.utils.BN('5'));
        _msgValue = web3.utils.toWei('0.1', 'ether');
        await AGRouter.removeLiquidityGetETH(USDT.address, partLiquidity, 0, LP, "99999999999", {value: _msgValue});
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
        await AGRouter.removeLiquidityGetToken(USDT.address, mostLeftLiquidity, 0, LP, "99999999999", {value: _msgValue});
        console.log("------------removeLiquidityGetToken------------");
        usdtInPool = await USDT.balanceOf(pairAddr);
        wethInPool = await WETH.balanceOf(pairAddr);
        _liquidity = await USDTPair.balanceOf(LP);
        console.log("pool balance USDT: ", usdtInPool.toString());
        console.log("pool balance WETH: ", wethInPool.toString());
        console.log("liquidity of LP: ", _liquidity.toString());

    });

})