const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiXVaultForLP = artifacts.require("CoFiXV2VaultForLP");
const CoFiXVaultForTrader = artifacts.require("CoFiXV2VaultForTrader");
const TestCoFiXStakingRewards = artifacts.require("TestCoFiXStakingRewards.sol");
const CoFiToken = artifacts.require("CoFiToken");
const TestXToken = artifacts.require("TestXToken");
const CoFiXFactory = artifacts.require("CoFiXV2Factory");
const WETH9 = artifacts.require("WETH9");
const TestUSDT = artifacts.require("USDT");

const { calcK, convert_from_fixed_point, convert_into_fixed_point, calcRelativeDiff } = require('../lib/calc');

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const verbose = process.env.VERBOSE;

contract('CoFiXV2VaultForTrader', (accounts) => {
    const owner = accounts[0];
    let deployer = owner;

    const governance = deployer;
    const non_governance = accounts[1];

    // enum POOL_STATE {INVALID, ENABLED, DISABLED}
    const POOL_STATE_INVALID = "0";
    const POOL_STATE_ENABLED = "1";
    const POOL_STATE_DISABLED = "2";

    const TotalSupplyOfCoFi = new BN("100000000000000000000000000"); // 1e8 * 1e18
    const HalfSupplyOfCoFi = TotalSupplyOfCoFi.div(new BN(2)); // or the init supply to CoFiXVaultForLP

    const RATE_BASE = web3.utils.toWei('1', 'ether');
    const REWARD_MULTIPLE_BASE = new BN("100");

    const DECAY_RATE = 80;
    const INIT_COFI_RATE = web3.utils.toWei('9', 'ether');

    const USDT_INIT_TOKEN0_AMOUNT = web3.utils.toWei('1', 'ether');
    const USDT_INIT_TOKEN1_AMOUNT = web3.utils.toWei('500', 'ether');

    const COFI_RATE = web3.utils.toWei('0.1', 'ether'); // nt

    const theta = "2";

    const ROUTER_1 = accounts[1];
    const ROUTER_2 = accounts[2];


    // const PAIR = accounts[3];

    before(async () => {
        USDT = await TestUSDT.new();
        WETH = await WETH9.new();
        CFactory = await CoFiXFactory.new(WETH.address, { from: deployer });
        CoFi = await CoFiToken.new({ from: deployer });
        VaultForLP = await CoFiXVaultForLP.new(CoFi.address, CFactory.address, { from: deployer });
        await CFactory.setVaultForLP(VaultForLP.address);
        VaultForTrader = await CoFiXVaultForTrader.new(CoFi.address, CFactory.address, { from: deployer });
        XToken = await TestXToken.new({ from: deployer });
        await XToken.initialize(WETH.address, USDT.address, USDT_INIT_TOKEN0_AMOUNT, USDT_INIT_TOKEN1_AMOUNT);
        PAIR = XToken.address;
        StakingRewards = await TestCoFiXStakingRewards.new(CoFi.address, XToken.address, CFactory.address, { from: deployer });
        POOL_1 = StakingRewards.address;
        // const mint_amount = web3.utils.toWei('10000', 'ether');
        // await XToken.mint(deployer, mint_amount, { from: deployer });
    });

    it("should revert if no governance allowRouter", async () => {
        await expectRevert(VaultForTrader.allowRouter(ROUTER_1, { from: non_governance }), "CVaultForTrader: !governance");
    });

    it("should allowRouter successfully by governance", async () => {
        await VaultForTrader.allowRouter(ROUTER_1, { from: governance });
        const allowed = await VaultForTrader.routerAllowed(ROUTER_1);
        expect(allowed).equal(true);
    });

    it("should revert if allowRouter twice for the same address", async () => {
        await expectRevert(VaultForTrader.allowRouter(ROUTER_1, { from: governance }), "CVaultForTrader: router allowed");
    });

    it("should revert if no governance disallowRouter", async () => {
        await expectRevert(VaultForTrader.disallowRouter(ROUTER_1, { from: non_governance }), "CVaultForTrader: !governance");
    });

    it("should disallowRouter successfully by governance", async () => {
        await VaultForTrader.disallowRouter(ROUTER_1, { from: governance });
        const allowed = await VaultForTrader.routerAllowed(ROUTER_1);
        expect(allowed).equal(false);
    });

    it("should allowRouter again successfully by governance", async () => {
        await VaultForTrader.allowRouter(ROUTER_1, { from: governance });
        const allowed = await VaultForTrader.routerAllowed(ROUTER_1);
        expect(allowed).equal(true);
    });

    it("should addPool correctly", async () => {
        await VaultForLP.addPool(POOL_1, {from: governance});
        const poolInfo = await VaultForLP.getPoolInfo(POOL_1);
        expect(poolInfo.state).to.bignumber.equal(POOL_STATE_ENABLED);
        expect(poolInfo.weight).to.bignumber.equal("0");
    });

    it("should setWeight correctly", async () => {
        const weight = "100";
        await VaultForLP.setPoolWeight(POOL_1, weight);
        const poolInfo = await VaultForLP.getPoolInfo(POOL_1);
        expect(poolInfo.weight).to.bignumber.equal(weight);
    });

    it("should have correct current stats before anything", async () => {
        const pair = XToken.address;
        const ethAmount = web3.utils.toWei('1', 'ether'); 
        const erc20Amount = web3.utils.toWei('500', 'ether');
        const reserve0 = web3.utils.toWei('120', 'ether');
        const reserve1 = web3.utils.toWei('72000', 'ether');
        
        await XToken.update(reserve0, reserve1);

        const neededETHAmount = await VaultForTrader.calcNeededETHAmountForAdjustment(pair, reserve0, reserve1, ethAmount, erc20Amount);

        // |\frac{E_t * k_0 - U_t}{k_0 + P_t}|\\\\
        const k0 = USDT_INIT_TOKEN1_AMOUNT / USDT_INIT_TOKEN0_AMOUNT;
        const pt = erc20Amount / ethAmount;
        const expectedneededETHAmount = (reserve1 - reserve0 * k0) / (k0 + pt); 
        console.log(`expectedneededETHAmount: ${expectedneededETHAmount}`);
        expect(neededETHAmount).to.bignumber.equal(expectedneededETHAmount.toString());

        const miningRate = await VaultForTrader.calcMiningRate(pair, neededETHAmount);

        expect(miningRate).to.bignumber.equal("0");

        // res: (uint256 amount, uint256 totalAccruedAmount, uint256 neededETHAmount)
        const res = await VaultForTrader.actualMiningAmount(pair, reserve0, reserve1, ethAmount, erc20Amount);
        if (verbose) {
            console.log(`actualMiningAmount: ${res.amount}, totalAccruedAmount: ${res.totalAccruedAmount}, neededETHAmount: ${res.neededETHAmount}`);
        }

        expect(res.amount).to.bignumber.equal("0");
    });

    it("should revert if not set VaultForTrader as minter of CoFi", async () => {
        const pair = XToken.address;
        const ethAmount = web3.utils.toWei('1', 'ether'); 
        const erc20Amount = web3.utils.toWei('500', 'ether');
        const reserve0 = web3.utils.toWei('120', 'ether');
        const reserve1 = web3.utils.toWei('72000', 'ether');
        
        await XToken.update(reserve0, reserve1);

        const rewardTo = ROUTER_1;
        await expectRevert(VaultForTrader.distributeReward(pair, ethAmount, erc20Amount, rewardTo, { from: ROUTER_1 }), "CoFi: !minter");
    });

    it("should add VaultForTrader as minter of CoFi correctly", async () => {
        const receipt = await CoFi.addMinter(VaultForTrader.address, {from: governance});
        expectEvent(receipt, "MinterAdded", {_minter: VaultForTrader.address});
        const allowed = await CoFi.minters(VaultForTrader.address);
        expect(allowed).equal(true);
    });

    it("should revert if distributeReward by NON ROUTER_1", async () => {
        const pair = XToken.address;
        const ethAmount = web3.utils.toWei('1', 'ether'); 
        const erc20Amount = web3.utils.toWei('500', 'ether');
        const reserve0 = web3.utils.toWei('120', 'ether');
        const reserve1 = web3.utils.toWei('72000', 'ether');
        
        await XToken.update(reserve0, reserve1);

        const rewardTo = ROUTER_2;
        await expectRevert(VaultForTrader.distributeReward(pair, ethAmount, erc20Amount, rewardTo, { from: ROUTER_2 }), "CVaultForTrader: not allowed router");
    });

    it("should distributeReward correctly by ROUTER_1", async () => {
        const pair = XToken.address;
        const ethAmount = web3.utils.toWei('1', 'ether'); 
        const erc20Amount = web3.utils.toWei('500', 'ether');
        var reserve0 = web3.utils.toWei('120', 'ether');
        var reserve1 = web3.utils.toWei('72000', 'ether'); 
        await XToken.update(reserve0, reserve1);

        const res = await VaultForTrader.actualMiningAmount(pair, reserve0, reserve1, ethAmount, erc20Amount);
        if (verbose) {
            console.log(`actualMiningAmount: ${res.amount}, totalAccruedAmount: ${res.totalAccruedAmount}, neededETHAmount: ${res.neededETHAmount}`);
        }
        const rewardTo = ROUTER_1;
        await VaultForTrader.distributeReward(pair, ethAmount, erc20Amount, rewardTo, { from: ROUTER_1 });
        var cofiBalanceOfRouter1 = await CoFi.balanceOf(ROUTER_1);
        
        expect(cofiBalanceOfRouter1).to.bignumber.equal("0");

        // D_{t - 1} == D_t => v_t == 0
        var lastMinedBlockBefore = await VaultForTrader.lastMinedBlock(pair);
        var cofiBalanceOfRouter1Before = await CoFi.balanceOf(ROUTER_1);
        await VaultForTrader.distributeReward(pair, ethAmount, erc20Amount, rewardTo, { from: ROUTER_1 });
        var lastMinedBlockAfter = await VaultForTrader.lastMinedBlock(pair);
        var cofiBalanceOfRouter1After = await CoFi.balanceOf(ROUTER_1);
        var cofiBalanceOfRouter1Diff = (new BN(cofiBalanceOfRouter1After)).sub(new BN(cofiBalanceOfRouter1Before));
        var lastMinedBlockDiff = (new BN(lastMinedBlockAfter)).sub(new BN(lastMinedBlockBefore));

        if (verbose) {
            console.log(`cofiBalanceOfRouter1Before: ${cofiBalanceOfRouter1Before}`);
            console.log(`cofiBalanceOfRouter1After: ${cofiBalanceOfRouter1After}`);
            console.log(`lastMinedBlockBefore: ${lastMinedBlockBefore}`);
            console.log(`lastMinedBlockAfter: ${lastMinedBlockAfter}`);
            console.log(`lastMinedBlockDiff: ${lastMinedBlockDiff}`);
            console.log(`cofiBalanceOfRouter1Diff: ${cofiBalanceOfRouter1Diff}`);
        }
        // Y_t = Y_{t - 1} + D_{t - 1} * n_t * (S_t + 1) - Z_t \\ 
        // Z_t = [Y_{t - 1} + D_{t - 1} * n_t * (S_t + 1)] * v_t
        var lastNeededETHAmount = res.neededETHAmount;
        var offset = lastMinedBlockDiff.add(new BN("1"));
        var totalAmount = (new BN(lastNeededETHAmount.toString())).mul(new BN(COFI_RATE.toString())).mul(offset).div(new BN(RATE_BASE.toString()));
        var expectedAmount = new BN("0");
        var totalAccruedAmount = totalAmount.sub(expectedAmount);

        var currentTotalAccruedAmount = await VaultForTrader.lastTotalAccruedAmount(pair);
        var currentNeededETHAmount = await VaultForTrader.lastNeededETHAmount(pair);
        if (verbose) {
            console.log(`offset: ${offset}`);
            console.log(`totalAmount: ${totalAmount}`);
            console.log(`totalAccruedAmount: ${totalAccruedAmount}`);
            console.log(`expectedAmount: ${expectedAmount}`);
            console.log(`currentTotalAccruedAmount: ${currentTotalAccruedAmount}`);
            console.log(`currentNeededETHAmount: ${currentNeededETHAmount}`);
        }
        expect(cofiBalanceOfRouter1Diff).to.bignumber.equal("0");
        expect(currentTotalAccruedAmount).to.bignumber.equal(totalAccruedAmount);
        lastNeededETHAmount = currentNeededETHAmount;
        
        // D_{t - 1} < D_t => v_t == 0
        reserve0 = web3.utils.toWei('100', 'ether');
        reserve1 = web3.utils.toWei('72000', 'ether');
        await XToken.update(reserve0, reserve1);

        lastMinedBlockBefore = await VaultForTrader.lastMinedBlock(pair);
        cofiBalanceOfRouter1Before = await CoFi.balanceOf(ROUTER_1);
        await VaultForTrader.distributeReward(pair, ethAmount, erc20Amount, rewardTo, { from: ROUTER_1 });
        lastMinedBlockAfter = await VaultForTrader.lastMinedBlock(pair);
        cofiBalanceOfRouter1After = await CoFi.balanceOf(ROUTER_1);
        cofiBalanceOfRouter1Diff = (new BN(cofiBalanceOfRouter1After)).sub(new BN(cofiBalanceOfRouter1Before));
        lastMinedBlockDiff = (new BN(lastMinedBlockAfter)).sub(new BN(lastMinedBlockBefore));

        if (verbose) {
            console.log(`cofiBalanceOfRouter1Before: ${cofiBalanceOfRouter1Before}`);
            console.log(`cofiBalanceOfRouter1After: ${cofiBalanceOfRouter1After}`);
            console.log(`lastMinedBlockBefore: ${lastMinedBlockBefore}`);
            console.log(`lastMinedBlockAfter: ${lastMinedBlockAfter}`);
            console.log(`lastMinedBlockDiff: ${lastMinedBlockDiff}`);
            console.log(`cofiBalanceOfRouter1Diff: ${cofiBalanceOfRouter1Diff}`);
        }
        offset = lastMinedBlockDiff.add(new BN("1"));
        totalAmount = totalAccruedAmount.add((new BN(lastNeededETHAmount.toString())).mul(new BN(COFI_RATE.toString())).mul(offset).div(new BN(RATE_BASE.toString())));
        expectedAmount = new BN("0");
        totalAccruedAmount = totalAmount.sub(expectedAmount);

        currentTotalAccruedAmount = await VaultForTrader.lastTotalAccruedAmount(pair);
        currentNeededETHAmount = await VaultForTrader.lastNeededETHAmount(pair);
        if (verbose) {
            console.log(`offset: ${offset}`);
            console.log(`totalAmount: ${totalAmount}`);
            console.log(`totalAccruedAmount: ${totalAccruedAmount}`);
            console.log(`expectedAmount: ${expectedAmount}`);
            console.log(`currentTotalAccruedAmount: ${currentTotalAccruedAmount}`);
            console.log(`currentNeededETHAmount: ${currentNeededETHAmount}`);
        }
        expect(cofiBalanceOfRouter1Diff).to.bignumber.equal("0");
        expect(currentTotalAccruedAmount).to.bignumber.equal(totalAccruedAmount);
        lastNeededETHAmount = currentNeededETHAmount;

        // D_{t - 1} > D_t => v_t == (D_{t-1} - D_t) / D_{t - 1}
        reserve0 = web3.utils.toWei('120', 'ether');
        reserve1 = web3.utils.toWei('72000', 'ether');
        await XToken.update(reserve0, reserve1);

        lastMinedBlockBefore = await VaultForTrader.lastMinedBlock(pair);
        cofiBalanceOfRouter1Before = await CoFi.balanceOf(ROUTER_1);
        await VaultForTrader.distributeReward(pair, ethAmount, erc20Amount, rewardTo, { from: ROUTER_1 });
        lastMinedBlockAfter = await VaultForTrader.lastMinedBlock(pair);
        cofiBalanceOfRouter1After = await CoFi.balanceOf(ROUTER_1);
        cofiBalanceOfRouter1Diff = (new BN(cofiBalanceOfRouter1After)).sub(new BN(cofiBalanceOfRouter1Before));
        lastMinedBlockDiff = (new BN(lastMinedBlockAfter)).sub(new BN(lastMinedBlockBefore));
        if (verbose) {
            console.log(`cofiBalanceOfRouter1Before: ${cofiBalanceOfRouter1Before}`);
            console.log(`cofiBalanceOfRouter1After: ${cofiBalanceOfRouter1After}`);
            console.log(`lastMinedBlockBefore: ${lastMinedBlockBefore}`);
            console.log(`lastMinedBlockAfter: ${lastMinedBlockAfter}`);
            console.log(`lastMinedBlockDiff: ${lastMinedBlockDiff}`);
            console.log(`cofiBalanceOfRouter1Diff: ${cofiBalanceOfRouter1Diff}`);
        }
        offset = lastMinedBlockDiff.add(new BN("1"));
        currentNeededETHAmount = await VaultForTrader.lastNeededETHAmount(pair);
        totalAmount = totalAccruedAmount.add((new BN(lastNeededETHAmount.toString())).mul(new BN(COFI_RATE.toString())).mul(offset).div(new BN(RATE_BASE.toString())));
        const miningRate = (new BN(lastNeededETHAmount.toString())).sub(new BN(currentNeededETHAmount.toString())).mul(new BN(RATE_BASE.toString())).div(new BN(lastNeededETHAmount.toString()));
        expectedAmount = totalAmount.mul(miningRate).div(new BN(RATE_BASE.toString()));
        totalAccruedAmount = totalAmount.sub(expectedAmount);

        currentTotalAccruedAmount = await VaultForTrader.lastTotalAccruedAmount(pair);
        if (verbose) {
            console.log(`offset: ${offset}`);
            console.log(`totalAmount: ${totalAmount}`);
            console.log(`miningRate: ${miningRate}`);
            console.log(`totalAccruedAmount: ${totalAccruedAmount}`);
            console.log(`expectedAmount: ${expectedAmount}`);
            console.log(`currentTotalAccruedAmount: ${currentTotalAccruedAmount}`);
            console.log(`currentNeededETHAmount: ${currentNeededETHAmount}`);
        }
        expect(currentTotalAccruedAmount).to.bignumber.equal(totalAccruedAmount);

        const expectedReward = (new BN(expectedAmount.toString())).mul(new BN("90")).div(new BN("100"));
        expect(cofiBalanceOfRouter1Diff).to.bignumber.equal(expectedReward);
    });

    it("should distributeReward correctly by ROUTER_1 when have another transaction from another pair", async () => {
        XToken2 = await TestXToken.new({ from: deployer });
        await XToken2.initialize(WETH.address, USDT.address, USDT_INIT_TOKEN0_AMOUNT, USDT_INIT_TOKEN1_AMOUNT);
        const pair = XToken2.address;
        const ethAmount = web3.utils.toWei('1', 'ether'); 
        const erc20Amount = web3.utils.toWei('500', 'ether');
        var reserve0 = web3.utils.toWei('80', 'ether');
        var reserve1 = web3.utils.toWei('56000', 'ether');
        await XToken2.update(reserve0, reserve1);

        var currentLastMinedBlock = await VaultForTrader.lastMinedBlock(pair);
        var currentNeededETHAmount = await VaultForTrader.lastNeededETHAmount(pair);
        var currentTotalAccruedAmount = await VaultForTrader.lastTotalAccruedAmount(pair);
        expect(currentLastMinedBlock).to.bignumber.equal("0");
        expect(currentNeededETHAmount).to.bignumber.equal("0");
        expect(currentTotalAccruedAmount).to.bignumber.equal("0");

        const rewardTo = ROUTER_1;
        var cofiBalanceOfRouter1Before = await CoFi.balanceOf(ROUTER_1);
        await VaultForTrader.distributeReward(pair, ethAmount, erc20Amount, rewardTo, { from: ROUTER_1 });
        var cofiBalanceOfRouter1After = await CoFi.balanceOf(ROUTER_1);
        var cofiBalanceOfRouter1Diff = (new BN(cofiBalanceOfRouter1After)).sub(new BN(cofiBalanceOfRouter1Before));        
        currentNeededETHAmount = await VaultForTrader.lastNeededETHAmount(pair);
        var lastNeededETHAmount = currentNeededETHAmount;
        if (verbose) {
            console.log(`cofiBalanceOfRouter1Before: ${cofiBalanceOfRouter1Before}`);
            console.log(`cofiBalanceOfRouter1After: ${cofiBalanceOfRouter1After}`);
            console.log(`cofiBalanceOfRouter1Diff: ${cofiBalanceOfRouter1Diff}`);
        }
        expect(cofiBalanceOfRouter1Diff).to.bignumber.equal("0");

        // D_{t - 1} > D_t => v_t == (D_{t-1} - D_t) / D_{t - 1}
        reserve0 = web3.utils.toWei('120', 'ether');
        reserve1 = web3.utils.toWei('72000', 'ether');
        await XToken2.update(reserve0, reserve1);
        var lastMinedBlockBefore = await VaultForTrader.lastMinedBlock(pair);
        var cofiBalanceOfRouter1Before = await CoFi.balanceOf(ROUTER_1);
        await VaultForTrader.distributeReward(pair, ethAmount, erc20Amount, rewardTo, { from: ROUTER_1 });
        var lastMinedBlockAfter = await VaultForTrader.lastMinedBlock(pair);
        var cofiBalanceOfRouter1After = await CoFi.balanceOf(ROUTER_1);
        var cofiBalanceOfRouter1Diff = (new BN(cofiBalanceOfRouter1After)).sub(new BN(cofiBalanceOfRouter1Before));
        var lastMinedBlockDiff = (new BN(lastMinedBlockAfter)).sub(new BN(lastMinedBlockBefore));
        if (verbose) {
            console.log(`cofiBalanceOfRouter1Before: ${cofiBalanceOfRouter1Before}`);
            console.log(`cofiBalanceOfRouter1After: ${cofiBalanceOfRouter1After}`);
            console.log(`lastMinedBlockBefore: ${lastMinedBlockBefore}`);
            console.log(`lastMinedBlockAfter: ${lastMinedBlockAfter}`);
            console.log(`lastMinedBlockDiff: ${lastMinedBlockDiff}`);
            console.log(`cofiBalanceOfRouter1Diff: ${cofiBalanceOfRouter1Diff}`);
        }
        var offset = lastMinedBlockDiff.add(new BN("1"));
        currentNeededETHAmount = await VaultForTrader.lastNeededETHAmount(pair);
        var totalAmount = (new BN(lastNeededETHAmount.toString())).mul(new BN(COFI_RATE.toString())).mul(offset).div(new BN(RATE_BASE.toString()));
        const miningRate = (new BN(lastNeededETHAmount.toString())).sub(new BN(currentNeededETHAmount.toString())).mul(new BN(RATE_BASE.toString())).div(new BN(lastNeededETHAmount.toString()));
        var expectedAmount = totalAmount.mul(miningRate).div(new BN(RATE_BASE.toString()));
        var totalAccruedAmount = totalAmount.sub(expectedAmount);

        currentTotalAccruedAmount = await VaultForTrader.lastTotalAccruedAmount(pair);
        if (verbose) {
            console.log(`offset: ${offset}`);
            console.log(`totalAmount: ${totalAmount}`);
            console.log(`miningRate: ${miningRate}`);
            console.log(`totalAccruedAmount: ${totalAccruedAmount}`);
            console.log(`expectedAmount: ${expectedAmount}`);
            console.log(`currentTotalAccruedAmount: ${currentTotalAccruedAmount}`);
            console.log(`currentNeededETHAmount: ${currentNeededETHAmount}`);
        }
        expect(currentTotalAccruedAmount).to.bignumber.equal(totalAccruedAmount);

        const expectedReward = (new BN(expectedAmount.toString())).mul(new BN("90")).div(new BN("100"));
        expect(cofiBalanceOfRouter1Diff).to.bignumber.equal(expectedReward);
    }); 

});