const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiToken = artifacts.require("CoFiToken");
const TestXToken = artifacts.require("TestXToken");
const CoFiXFactory = artifacts.require("CoFiXV2Factory");
const WETH9 = artifacts.require("WETH9");
const CoFiXDAO = artifacts.require("CoFiXV2DAO");
const CoFiXController = artifacts.require("CoFiXV2Controller");
const TestNEST = artifacts.require("test/NEST");
const NESTPriceOracleAutoUpdateConstMock = artifacts.require("NEST36PriceOracleAutoUpdateConstMock");

const verbose = process.env.VERBOSE;

contract('CoFiXV2DAO', (accounts) => {

    const owner = accounts[0];
    let deployer = owner;
    let userB = accounts[1];
    let ethAmount = web3.utils.toWei('1', 'ether');
    let cofiPrice = web3.utils.toWei('500', 'ether');
    let cofiAvg = web3.utils.toWei('500', 'ether');
    let oracleFee = web3.utils.toWei('0.01', 'ether');
    const vola = new BN("3178364238");

    const userInitCofiAmount = web3.utils.toWei('10000', 'ether');

    before(async () => {
        WETH = await WETH9.new();
        NEST = await TestNEST.new({ from: deployer });
        ConstOracle = await NESTPriceOracleAutoUpdateConstMock.new({ from: deployer });
        CFactory = await CoFiXFactory.new(WETH.address, { from: deployer });
        CoFiXCtrl = await CoFiXController.new(ConstOracle.address, NEST.address, CFactory.address);
        await CFactory.setController(CoFiXCtrl.address);
        CoFi = await CoFiToken.new({ from: deployer });
        XToken = await TestXToken.new({ from: deployer });

        CDAO = await CoFiXDAO.new(CoFi.address, CFactory.address, { from: deployer});
        await CoFiXCtrl.addCaller(CDAO.address);
        await CoFi.addMinter(deployer, {from: deployer});
        await CoFi.mint(userB, userInitCofiAmount);
    });

    it("can start", async () => {
        await CDAO.start();
        expect(await CDAO.flag()).to.bignumber.equal(new BN("2"));
    });

    it("can quota", async () => {
        for (let i = 0; i < 5; i++) {
            await time.advanceBlock();
        }
        
        expect(await CDAO.quotaOf()).to.bignumber.equal(web3.utils.toWei('250', 'ether'));
    });

    it("can redeem", async () => {
        let _cofiAmount = web3.utils.toWei('50', 'ether');
        let _ethReward = web3.utils.toWei('0.1', 'ether');
        let expected = web3.utils.toWei('0.09', 'ether');

        // feedPrice(address token, uint256 latestPrice, uint256 triggeredPrice, uint256 triggeredAvgPrice, uint256 triggeredSigmaSQ)
        await ConstOracle.feedPrice(CoFi.address, cofiPrice, cofiPrice, cofiAvg, vola, { from: deployer });
        await CDAO.addETHReward({ value: _ethReward});

        const userEthBalanceBefore = await web3.eth.getBalance(userB);
        
        await CoFi.approve(CDAO.address, _cofiAmount, {from: userB, gasPrice: 0});
        await CDAO.redeem(_cofiAmount, {from: userB, value: oracleFee, gasPrice: 0});

        const userEthBalanceAfter = await web3.eth.getBalance(userB);

        const userEthDiff = balanceDiff(userEthBalanceAfter, userEthBalanceBefore);

        expect(userEthDiff).to.bignumber.equal(expected);
    });

    // should start failed
    it(" should start failed ", async () => {
        await expectRevert(CDAO.start( {from: userB}), "CDAO: not governance");
        await expectRevert(CDAO.start( {from: owner}), "CDAO: not initialized");
    });


    // should pause correctly
    it(" should pause failed ", async () => {
        await CDAO.pause({from: owner});
        await expectRevert(CDAO.pause({from: userB}), "CDAO: not governance");
    });

    
    // should resume failed
    it(" should resume failed ", async () => {
        await CDAO.resume({from: owner});
        await expectRevert(CDAO.resume({from: userB}), "CDAO: not governance");
    });

    // should redeem failed 
    it(" should redeem failed ", async () => {
        let _cofiAmount = web3.utils.toWei('50', 'ether');
        let _ethReward = web3.utils.toWei('0.1', 'ether');
        let _cofiAvg = web3.utils.toWei('400', 'ether');

        const bal = await CDAO.totalETHRewards();
        expect(bal).to.bignumber.equal(new BN("0"));

        await CoFi.approve(CDAO.address, _cofiAmount, {from: userB});
        // require bal > 0
        await expectRevert(CDAO.redeem(_cofiAmount, {from: userB, gasPrice: 0}), "CDAO: insufficient balance");
        
        await CDAO.addETHReward({from: userB, value: _ethReward});
        await expectRevert(CDAO.redeem(_cofiAmount, {from: userB, value: 0, gasPrice: 0}), "CDAO: !oracleFee");

        await ConstOracle.feedPrice(CoFi.address, cofiPrice, cofiPrice, _cofiAvg, vola, { from: deployer });
        await expectRevert(CDAO.redeem(_cofiAmount, {from: userB, value: oracleFee, gasPrice: 0}), "CDAO: price deviation");
        
        await ConstOracle.feedPrice(CoFi.address, cofiPrice, cofiPrice, cofiAvg, vola, { from: deployer });
        // flag = DAO_FLAG_PAUSED;
        await CDAO.pause({from: deployer});
        
        // require flag == DAO_FLAG_ACTIVE
        await expectRevert(CDAO.redeem(_cofiAmount, {from: userB, value: oracleFee, gasPrice: 0}), "CDAO: not active");

        await CDAO.resume({from: deployer});
        
        // require amount < quota
        await expectRevert(CDAO.redeem(web3.utils.toWei('20000', 'ether'), {from: userB, value: oracleFee, gasPrice: 0}), "CDAO: insufficient quota");

        // the eth to be redeemed is less than the current remaining eth
        const ethBalance = await CDAO.totalETHRewards();

        if (verbose) {
            console.log(`ethBalance: ${ethBalance}`);
        }

        const withdrawAmount = (new BN(_ethReward.toString())).mul(new BN(cofiPrice.toString())).div(new BN(ethAmount.toString())).mul(new BN("2"));
        if (verbose) {
            console.log(`withdrawAmount: ${withdrawAmount}`);
        }
        await expectRevert(CDAO.redeem(withdrawAmount, {from: userB, value: oracleFee, gasPrice: 0}), "CDAO: insufficient balance2");

        for (let i = 0; i < 10; i++) {
            await time.advanceBlock();
        }

        // should redeem succeed
        await CDAO.redeem(_cofiAmount, {from: userB, value: oracleFee, gasPrice: 0});
    });

    // check redeem funds
    it("can redeem correctly", async () => {
        let _cofiAmount = web3.utils.toWei('50', 'ether');
        let _ethReward = web3.utils.toWei('0.1', 'ether');
        let _oracleFee = web3.utils.toWei('0.01', 'ether'); 

        await ConstOracle.feedPrice(CoFi.address, cofiPrice, cofiPrice, cofiAvg, vola, { from: deployer });
        await CDAO.addETHReward({ value: _ethReward});

        const userEthBalanceBefore = await web3.eth.getBalance(userB);
        const userCofiBalanceBefore = await CoFi.balanceOf(userB);
        const daoEthBalanceBefore = await CDAO.totalETHRewards();
        const daoCofiBalanceBefore = await CoFi.balanceOf(CDAO.address);
        const redeemedAmountBefore = await CDAO.redeemedAmount();
        // const quotaBefore = await CDAO.quotaAmount();
        
        await CoFi.approve(CDAO.address, _cofiAmount, {from: userB, gasPrice: 0});
        const quotaBefore = await CDAO.quotaOf();
        await CDAO.redeem(_cofiAmount, {from: userB, value: _oracleFee, gasPrice: 0});

        const userEthBalanceAfter = await web3.eth.getBalance(userB);
        const userCofiBalanceAfter = await CoFi.balanceOf(userB);
        const daoEthBalanceAfter = await CDAO.totalETHRewards();
        const daoCofiBalanceAfter = await CoFi.balanceOf(CDAO.address);
        const redeemedAmountAfter = await CDAO.redeemedAmount();
        const quotaAfter = await CDAO.quotaAmount();

        const userEthDiff = balanceDiff(userEthBalanceAfter, userEthBalanceBefore);
        const userCofiBalanceDiff = balanceDiff(userCofiBalanceBefore, userCofiBalanceAfter);
        const daoEthBalanceDiff = balanceDiff(daoEthBalanceBefore, daoEthBalanceAfter);
        const daoCofiBalanceDiff = balanceDiff(daoCofiBalanceAfter, daoCofiBalanceBefore);
        const redeemedAmountDiff = balanceDiff(redeemedAmountAfter, redeemedAmountBefore);
        const quotaDiff = balanceDiff(quotaAfter, quotaBefore);

        if (verbose) {
            console.log(`userEthBalanceBefore: ${userEthBalanceBefore}`);
            console.log(`userCofiBalanceBefore: ${userCofiBalanceBefore}`);
            console.log(`daoEthBalanceBefore: ${daoEthBalanceBefore}`);
            console.log(`daoCofiBalanceBefore: ${daoCofiBalanceBefore}`);
            console.log(`redeemedAmountBefore: ${redeemedAmountBefore}`);
            console.log(`quotaBefore: ${quotaBefore}`);
            console.log(`userEthBalanceAfter: ${userEthBalanceAfter}`);
            console.log(`userCofiBalanceAfter: ${userCofiBalanceAfter}`);
            console.log(`daoEthBalanceAfter: ${daoEthBalanceAfter}`);
            console.log(`daoCofiBalanceAfter: ${daoCofiBalanceAfter}`);
            console.log(`redeemedAmountAfter: ${redeemedAmountAfter}`);
            console.log(`quotaAfter: ${quotaAfter}`);

            console.log(`userEthDiff: ${userEthDiff}`);
            console.log(`userCofiBalanceDiff: ${userCofiBalanceDiff}`);
            console.log(`daoEthBalanceDiff: ${daoEthBalanceDiff}`);
            console.log(`daoCofiBalanceDiff: ${daoCofiBalanceDiff}`); 
            console.log(`redeemedAmountDiff: ${redeemedAmountDiff}`); 
            console.log(`quotaDiff: ${quotaDiff}`); 
        }

        const expectEthOut = (new BN(_cofiAmount.toString())).mul(new BN(ethAmount.toString())).div(new BN(cofiPrice.toString()));
        const userEthDiffPlusFee = (new BN(userEthDiff.toString())).add(new BN(oracleFee.toString()));
        if (verbose) {
            console.log(`expectEthOut: ${expectEthOut}`);
            console.log(`userEthDiffPlusFee: ${userEthDiffPlusFee}`);
        }

        expect(_cofiAmount).to.bignumber.equal(userCofiBalanceDiff);
        expect(userCofiBalanceDiff).to.bignumber.equal(daoCofiBalanceDiff);
        expect(redeemedAmountDiff).to.bignumber.equal(_cofiAmount);
        expect(quotaDiff).to.bignumber.equal(new BN("0")); // because _cofiAmouont == quotaPerBlock
        expect(expectEthOut).to.bignumber.equal(daoEthBalanceDiff);
        expect(userEthDiffPlusFee).to.bignumber.equal(daoEthBalanceDiff);
    });

    // check quota function
    it("should run correctly", async () => {
        for (let i = 0; i < 310; i++) {
            await time.advanceBlock();
        }
        
        expect(await CDAO.quotaOf()).to.bignumber.equal(web3.utils.toWei('15000', 'ether'));
    });

    it("should burn cofi correctly", async () => {
        let burnCofiAmount = web3.utils.toWei('50', 'ether');

        await expectRevert(CDAO.burnCofi(burnCofiAmount, {from: userB}), "CDAO: not governance");
        await expectRevert(CDAO.burnCofi(new BN("0"), {from: deployer}), "CDAO: illegal amount");

        const daoCofiBalanceBefore = await CoFi.balanceOf(CDAO.address);
        await CDAO.burnCofi(burnCofiAmount, {from: deployer});
        const daoCofiBalanceAfter = await CoFi.balanceOf(CDAO.address);

        const daoCofiBalanceDiff = balanceDiff(daoCofiBalanceBefore, daoCofiBalanceAfter);
        expect(burnCofiAmount).to.bignumber.equal(daoCofiBalanceDiff);

        await expectRevert(CDAO.burnCofi(daoCofiBalanceAfter.add(new BN("1")), {from: deployer}), "CDAO: insufficient cofi");
    });

    it("should migrateTo new cofixdao correctly", async () => {
        let _ethReward = web3.utils.toWei('0.1', 'ether');
        await CDAO.addETHReward({ value: _ethReward});
        CDAO2 = await CoFiXDAO.new(CoFi.address, CFactory.address, { from: deployer});

        const dao2CofiBalanceBefore = await CoFi.balanceOf(CDAO2.address);
        const dao2EthBalanceBefore = await CDAO2.totalETHRewards();

        expect(dao2CofiBalanceBefore).to.bignumber.equal(new BN("0"));
        expect(dao2EthBalanceBefore).to.bignumber.equal(new BN("0"));

        await expectRevert(CDAO.migrateTo(CDAO2.address, {from: userB}), "CDAO: not governance");
        await expectRevert(CDAO.migrateTo(CDAO2.address, {from: deployer}), "CDAO: not paused");

        const daoCofiBalanceBefore = await CoFi.balanceOf(CDAO.address);
        const daoEthBalanceBefore = await CDAO.totalETHRewards();

        await CDAO.pause({from: deployer});
        await CDAO.migrateTo(CDAO2.address, {from: deployer});

        const daoCofiBalanceAfter = await CoFi.balanceOf(CDAO.address);
        const daoEthBalanceAfter = await CDAO.totalETHRewards();

        const dao2CofiBalanceAfter = await CoFi.balanceOf(CDAO2.address);
        const dao2EthBalanceAfter = await CDAO2.totalETHRewards();

        if (verbose) {
            console.log(`dao2CofiBalanceBefore: ${dao2CofiBalanceBefore}`);
            console.log(`dao2EthBalanceBefore: ${dao2EthBalanceBefore}`);
            console.log(`daoCofiBalanceBefore: ${daoCofiBalanceBefore}`);
            console.log(`daoEthBalanceBefore: ${daoEthBalanceBefore}`);
            console.log(`daoCofiBalanceAfter: ${daoCofiBalanceAfter}`);
            console.log(`daoEthBalanceAfter: ${daoEthBalanceAfter}`);
            console.log(`dao2CofiBalanceAfter: ${dao2CofiBalanceAfter}`);
            console.log(`dao2EthBalanceAfter: ${dao2EthBalanceAfter}`);

        }
        expect(daoCofiBalanceAfter).to.bignumber.equal(new BN("0"));
        expect(daoEthBalanceAfter).to.bignumber.equal(new BN("0"));

        expect(dao2CofiBalanceAfter).to.bignumber.equal(daoCofiBalanceBefore);
        expect(dao2EthBalanceAfter).to.bignumber.equal(daoEthBalanceBefore);
    });
});

function balanceDiff(after, before) {
    return web3.utils.toBN(after).sub(web3.utils.toBN(before))
}