const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiXVaultForLP = artifacts.require("CoFiXV2VaultForLP");
const CoFiToken = artifacts.require("CoFiToken");
const TestCoFiXStakingRewards = artifacts.require("TestCoFiXStakingRewards.sol");
const CoFiXFactory = artifacts.require("CoFiXV2Factory");
const WETH9 = artifacts.require("WETH9");
const TestXToken = artifacts.require("TestXToken");

const verbose = process.env.VERBOSE;

contract('CoFiXV2VaultForLP', (accounts) => {
    const owner = accounts[0];
    let deployer = owner;

    const GOVERNANCE = deployer;
    const NON_GOVERNANCE = accounts[1];

    // const POOL_1 = accounts[1];
    // const POOL_2 = accounts[2];

    // enum POOL_STATE {INVALID, ENABLED, DISABLED}
    const POOL_STATE_INVALID = "0";
    const POOL_STATE_ENABLED = "1";
    const POOL_STATE_DISABLED = "2";

    let POOL_1;
    let POOL_2;

    // const TotalSupplyOfCoFi = new BN("100000000000000000000000000"); // 1e8 * 1e18
    // const HalfSupplyOfCoFi = TotalSupplyOfCoFi.div(new BN(2)); // or the init supply to CoFiXVaultForLP

    const RATE_BASE = web3.utils.toWei('1', 'ether');

    const DECAY_RATE = 80;
    const INIT_COFI_RATE = web3.utils.toWei('4.5', 'ether');

    before(async () => {
        WETH = await WETH9.new();
        CFactory = await CoFiXFactory.new(WETH.address, { from: deployer });
        CoFi = await CoFiToken.new({ from: deployer });
        VaultForLP = await CoFiXVaultForLP.new(CoFi.address, CFactory.address, { from: deployer });
        await CFactory.setVaultForLP(VaultForLP.address);
        XToken = await TestXToken.new({ from: deployer });
        XToken2 = await TestXToken.new({ from: deployer });
        StakingRewards = await TestCoFiXStakingRewards.new(CoFi.address, XToken.address, CFactory.address, { from: deployer });
        StakingRewards2 = await TestCoFiXStakingRewards.new(CoFi.address, XToken2.address, CFactory.address, { from: deployer });
        POOL_1 = StakingRewards.address;
        POOL_2 = StakingRewards2.address;
    });

    it("should revert if no GOVERNANCE add pool", async () => {
        await expectRevert(VaultForLP.addPool(POOL_1, {from: NON_GOVERNANCE}), "CVaultForLP: !governance");
    });

    it("should revert if no GOVERNANCE enablePool", async () => {
        await expectRevert(VaultForLP.enablePool(POOL_1, {from: NON_GOVERNANCE}), "CVaultForLP: !governance");
    });

    it("should revert if no GOVERNANCE disablePool", async () => {
        await expectRevert(VaultForLP.disablePool(POOL_1, {from: NON_GOVERNANCE}), "CVaultForLP: !governance");
    });

    it("should addPool correctly", async () => {
        await VaultForLP.addPool(POOL_1, {from: GOVERNANCE});
        const poolInfo = await VaultForLP.getPoolInfo(POOL_1);
        expect(poolInfo.state).to.bignumber.equal(POOL_STATE_ENABLED);
        expect(poolInfo.weight).to.bignumber.equal("0");
    });

    it("should revert if we add the same pool for twice", async () => {
        await expectRevert(VaultForLP.addPool(POOL_1, {from: GOVERNANCE}), "CVaultForLP: pool added");
    });

    it("should revert if we add the another pool with same pair (XToken)", async () => {
        const stakingPool = await TestCoFiXStakingRewards.new(CoFi.address, XToken.address, CFactory.address, { from: deployer });
        await expectRevert(VaultForLP.addPool(stakingPool.address, {from: GOVERNANCE}), "CVaultForLP: pair added");
    });

    it("should revert if we add the same pool for twice by addPool", async () => {
        await expectRevert(VaultForLP.addPool(POOL_1, {from: GOVERNANCE}), "CVaultForLP: pool added");
    });

    it("should revert if add invalid pool", async () => {
        await expectRevert.unspecified(VaultForLP.addPool(GOVERNANCE, {from: GOVERNANCE}));
    });

    it("should disablePool correctly", async () => {
        await VaultForLP.disablePool(POOL_1);
        const poolInfo = await VaultForLP.getPoolInfo(POOL_1);
        expect(poolInfo.state).to.bignumber.equal(POOL_STATE_DISABLED);
        expect(poolInfo.weight).to.bignumber.equal("0");
        const stakingPoolForPair = await VaultForLP.stakingPoolForPair(XToken.address);
        expect(stakingPoolForPair).equal(constants.ZERO_ADDRESS);
        await expectRevert(VaultForLP.disablePool(POOL_1), "CVaultForLP: pool not enabled");
    });

    it("should enablePool correctly", async () => {
        await VaultForLP.enablePool(POOL_1);
        const poolInfo = await VaultForLP.getPoolInfo(POOL_1);
        expect(poolInfo.state).to.bignumber.equal(POOL_STATE_ENABLED);
        expect(poolInfo.weight).to.bignumber.equal("0");
        const stakingPoolForPair = await VaultForLP.stakingPoolForPair(XToken.address);
        expect(stakingPoolForPair).equal(POOL_1);
        await expectRevert(VaultForLP.enablePool(POOL_1), "CVaultForLP: pool not disabled");
    });

    it("should revert if not pool allowed call distributeReward", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await expectRevert(StakingRewards2.distributeReward(amount, {from: GOVERNANCE}), "CVaultForLP: only pool valid"); 
    });

    it("should revert if distributeReward when VaultForLP is not minter of CoFi", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await expectRevert(StakingRewards.distributeReward(amount, {from: GOVERNANCE}), "CoFi: !minter"); 
    });

    it("should add VaultForLP as minter of CoFi correctly", async () => {
        const receipt = await CoFi.addMinter(VaultForLP.address, {from: GOVERNANCE});
        expectEvent(receipt, "MinterAdded", {_minter: VaultForLP.address});
        const allowed = await CoFi.minters(VaultForLP.address);
        expect(allowed).equal(true);
    });

    it("should distributeReward correctly when POOL_1 call", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await StakingRewards.distributeReward(amount, {from: GOVERNANCE});
        const balanceOfVault = await CoFi.balanceOf(VaultForLP.address);
        const balanceOfPool1 = await CoFi.balanceOf(POOL_1);
        expect(balanceOfVault).to.bignumber.equal("0"); // balance of vault should be zero now because we mint tokens directly
        expect(balanceOfPool1).to.bignumber.equal(amount);
    });

    it("should distributeReward correctly even when amount equals to zero", async () => {
        const amount = web3.utils.toWei('0', 'ether');
        const { tx } = await StakingRewards.distributeReward(amount, {from: GOVERNANCE});
        await expectEvent.inTransaction(tx, CoFi, 'Transfer', { from: constants.ZERO_ADDRESS, to: POOL_1, value: "0" });
    });
    
    it("should have correct stats", async () => {
        const decayRate = await VaultForLP.decayRate();
        expect(decayRate).to.bignumber.equal(DECAY_RATE.toString());
        const currentPeriod = await VaultForLP.currentPeriod();
        expect(currentPeriod).to.bignumber.equal("0");
        const currentCoFiRate = await VaultForLP.currentCoFiRate();
        expect(currentCoFiRate).to.bignumber.equal(INIT_COFI_RATE);
        const rateBase = await VaultForLP.RATE_BASE();
        expect(rateBase).to.bignumber.equal(RATE_BASE);
        const cofiRate = currentCoFiRate.div(new BN(RATE_BASE));
        if (verbose) {
            console.log(`currentCoFiRate: ${cofiRate} CoFi per block`);
        }
        const currentPoolRate = await VaultForLP.currentPoolRate(POOL_1);
        expect(currentPoolRate).to.bignumber.equal("0"); // only one pool now, but not set weight
        const poolRate = currentPoolRate.div(new BN(RATE_BASE));
        if (verbose) {
            console.log(`currentPoolRate: ${poolRate} CoFi per block`);
        } 
    });

    it("should setWeight correctly", async () => {
        const weight = "100";
        await VaultForLP.setPoolWeight(POOL_1, weight);
        const poolInfo = await VaultForLP.getPoolInfo(POOL_1);
        expect(poolInfo.weight).to.bignumber.equal(weight);
    });

    it("should revert if non_governance setWeight", async () => {
        const weight = "100";
        await expectRevert(VaultForLP.setPoolWeight(POOL_1, weight, {from: NON_GOVERNANCE}), "CVaultForLP: !governance");
    });

    it("should have correct pool rate after setWeight", async () => {
        const currentPoolRate = await VaultForLP.currentPoolRate(POOL_1);
        expect(currentPoolRate).to.bignumber.equal(INIT_COFI_RATE); // only one pool now, but not set weight
        const poolRate = currentPoolRate.div(new BN(RATE_BASE));
        if (verbose) {
            console.log(`currentPoolRate: ${poolRate} CoFi per block`);
        }
    });

    it("should have correct stats if we add another pool", async () => {
        // add POOL_2
        await VaultForLP.addPool(POOL_2, {from: GOVERNANCE});
        const poolInfo = await VaultForLP.getPoolInfo(POOL_2);
        expect(poolInfo.state).to.bignumber.equal(POOL_STATE_ENABLED);
        expect(poolInfo.weight).to.bignumber.equal("0");
    
        // should keeps
        const currentPeriod = await VaultForLP.currentPeriod();
        expect(currentPeriod).to.bignumber.equal("0");
        const currentCoFiRate = await VaultForLP.currentCoFiRate();
        expect(currentCoFiRate).to.bignumber.equal(INIT_COFI_RATE);
        const rateBase = await VaultForLP.RATE_BASE();
        expect(rateBase).to.bignumber.equal(RATE_BASE);
        const cofiRate = currentCoFiRate.div(new BN(RATE_BASE));
        if (verbose) {
            console.log(`currentCoFiRate: ${cofiRate} CoFi per block`);
        }
        const currentPoolRate = await VaultForLP.currentPoolRate(POOL_2);
        expect(currentPoolRate).to.bignumber.equal("0"); // two pools now, but not set weight for pool2 yet
        const poolRate = currentPoolRate.div(new BN(RATE_BASE));
        if (verbose) {
            console.log(`currentPoolRate: ${poolRate} CoFi per block`);
        }
        // gas cost of currentPoolRate()
        const gasCost = await VaultForLP.currentPoolRate.estimateGas(POOL_2);
        if (verbose) {
            console.log(`gas cost of currentPoolRate interface: ${gasCost}`); // should sub 21000
        }
    });

    it("should batchSetPoolWeight correctly", async () => {
        const pools = [POOL_1, POOL_2];
        const weights = ["50", "50"];
        await VaultForLP.batchSetPoolWeight(pools, weights);
        const poolInfo1 = await VaultForLP.getPoolInfo(pools[0]);
        expect(poolInfo1.weight).to.bignumber.equal(weights[0]);
        const poolInfo2 = await VaultForLP.getPoolInfo(pools[1]);
        expect(poolInfo2.weight).to.bignumber.equal(weights[1]);
    });

    it("should have correct pool rate after batchSetPoolWeight", async () => {
        const pools = [POOL_1, POOL_2];
        const weights = ["50", "50"];
        for (let i = 0; i < pools.length; i++) {
            const pool = pools[i];
            const currentPoolRate = await VaultForLP.currentPoolRate(pool);
            const expectedPoolRate = INIT_COFI_RATE*weights[i]/100;
            expect(currentPoolRate).to.bignumber.equal(expectedPoolRate.toString()); // only one pool now, but not set weight
            const poolRate = currentPoolRate.div(new BN(RATE_BASE));
            if (verbose) {
                console.log(`index: ${i}, currentPoolRate: ${poolRate} CoFi per block`);
            }            
        }
    });

    it("should revert if non_governance try to batchSetPoolWeight", async () => {
        const pools = [POOL_1, POOL_2];
        const weights = ["50", "50"];
        await expectRevert(VaultForLP.batchSetPoolWeight(pools, weights, {from: NON_GOVERNANCE}), "CVaultForLP: !governance");
    });

    it("should have correct stats if we change decayPeriod", async () => {
        const currentPeriod = await VaultForLP.currentPeriod();
        expect(currentPeriod).to.bignumber.equal("0");

        const decayPeriod = "5";
        await VaultForLP.setDecayPeriod(decayPeriod);
        const currentDecayPeriod = await VaultForLP.decayPeriod();
        expect(currentDecayPeriod).to.bignumber.equal(decayPeriod);

        const genesisBlock = await VaultForLP.genesisBlock();
        const latestBlock = await time.latestBlock();
        const newCurrentPeriod = await VaultForLP.currentPeriod();
        const expectPeriod = Math.floor((latestBlock - genesisBlock) / decayPeriod);
        expect(expectPeriod.toString()).to.bignumber.equal(newCurrentPeriod);
        if (verbose) {
            console.log(`genesisBlock: ${genesisBlock}`);
            console.log(`latestBlock: ${latestBlock}`);
            console.log(`expectPeriod: ${expectPeriod}, newCurrentPeriod: ${newCurrentPeriod}`);
        }

        // decay rate
        const currentCoFiRate = await VaultForLP.currentCoFiRate();
        let expectCofiRate = new BN(INIT_COFI_RATE);
        const decayRate = new BN(DECAY_RATE.toString());
        let periodIdx = newCurrentPeriod;
        if (newCurrentPeriod > 4) {
            periodIdx = 4;
        }
        for (let i = 0; i < periodIdx; i++) {
            expectCofiRate = expectCofiRate.mul(decayRate).div(new BN(100));
        }
        expect(expectCofiRate).to.bignumber.equal(currentCoFiRate);
        if (verbose) {
            console.log(`expectCofiRate: ${expectCofiRate}, currentCoFiRate: ${currentCoFiRate}`);
        }      
    });

    it("should have correct stats if we change push period over five", async () => {
        for (let i = 0; i < 5*4; i++) {
            await time.advanceBlock();
        }
        const decayPeriod = "5";
        const genesisBlock = await VaultForLP.genesisBlock();
        const latestBlock = await time.latestBlock();
        const newCurrentPeriod = await VaultForLP.currentPeriod();
        const expectPeriod = Math.floor((latestBlock - genesisBlock) / decayPeriod);
        expect(expectPeriod.toString()).to.bignumber.equal(newCurrentPeriod);
        if (verbose) {
            console.log(`genesisBlock: ${genesisBlock}`);
            console.log(`latestBlock: ${latestBlock}`);
            console.log(`expectPeriod: ${expectPeriod}, newCurrentPeriod: ${newCurrentPeriod}`);
        }

        // decay rate
        const currentCoFiRate = await VaultForLP.currentCoFiRate();
        let expectCofiRate = new BN(INIT_COFI_RATE);
        const decayRate = new BN(DECAY_RATE.toString());
        let periodIdx = newCurrentPeriod;
        if (newCurrentPeriod > 4) {
            periodIdx = 4;
        }
        for (let i = 0; i < periodIdx; i++) {
            expectCofiRate = expectCofiRate.mul(decayRate).div(new BN(100));
        }
        expect(expectCofiRate).to.bignumber.equal(currentCoFiRate);
        if (verbose) {
            console.log(`expectCofiRate: ${expectCofiRate}, currentCoFiRate: ${currentCoFiRate}`);
        }      
    });

});