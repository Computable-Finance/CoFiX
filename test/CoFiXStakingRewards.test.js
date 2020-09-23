const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiXVaultForLP = artifacts.require("CoFiXVaultForLP");
const CoFiToken = artifacts.require("CoFiToken");
const CoFiXStakingRewards = artifacts.require("CoFiXStakingRewards.sol");
const TestXToken = artifacts.require("TestXToken");


const verbose = process.env.VERBOSE;

contract('CoFiXStakingRewards', (accounts) => {
    const owner = accounts[0];
    let deployer = owner;

    const governance = deployer;

    const LP_1 = accounts[1];
    const LP_2 = accounts[2];

    const INIT_COFI_RATE = web3.utils.toWei('10', 'ether');

    before(async () => {
        CoFi = await CoFiToken.new({ from: deployer });
        VaultForLP = await CoFiXVaultForLP.new(CoFi.address, { from: deployer });
        XToken = await TestXToken.new({ from: deployer });
        StakingRewards = await CoFiXStakingRewards.new(CoFi.address, XToken.address, VaultForLP.address, { from: deployer });
    });

    it("should add VaultForLP as minter of CoFi correctly", async () => {
        const receipt = await CoFi.addMinter(VaultForLP.address, {from: governance});
        expectEvent(receipt, "MinterAdded", {_minter: VaultForLP.address});
        const allowed = await CoFi.minters(VaultForLP.address);
        expect(allowed).equal(true);
    });

    it("should addPool correctly", async () => {
        await VaultForLP.addPool(StakingRewards.address, {from: governance});
        const allowed = await VaultForLP.poolAllowed(StakingRewards.address);
        expect(allowed).equal(true);
    });

    it("should have correct stats from starting", async () => {
        const rewardPerToken = await StakingRewards.rewardPerToken();
        expect(rewardPerToken).to.bignumber.equal("0");
        const totalSupply = await StakingRewards.totalSupply();
        expect(totalSupply).to.bignumber.equal("0");
        const rewardRate = await StakingRewards.rewardRate();
        expect(INIT_COFI_RATE).to.bignumber.equal(rewardRate);
    });

    it("should transfer some XToken to LP1 correctly", async () => {
        const amount = web3.utils.toWei('1', 'ether');
        await XToken.transfer(LP_1, amount);
        const balance = await XToken.balanceOf(LP_1);
        expect(balance).to.bignumber.equal(amount);
    });

    it("should revert if not approve before stake", async () => {
        const amount = web3.utils.toWei('1', 'ether');
        await expectRevert(StakingRewards.stake(amount), "TransferHelper: TRANSFER_FROM_FAILED");
    });

    it("should stake correctly", async () => {
        const amount = web3.utils.toWei('1', 'ether');
        await XToken.approve(StakingRewards.address, amount, {from: LP_1});
        await StakingRewards.stake(amount, {from: LP_1});
        // first one deposit in, totalSupply is zero before this stake, accrued should be zero
        // means no CoFi will be transferred into StakingRewards contract
        const balance = await CoFi.balanceOf(StakingRewards.address);
        expect(balance).to.bignumber.equal("0");
    });

    it("should have correct stats after stake", async () => {
        const amount = web3.utils.toWei('1', 'ether');
        const balanceInStake = await StakingRewards.balanceOf(LP_1);
        expect(balanceInStake).to.bignumber.equal(amount);
        const totalSupply = await StakingRewards.totalSupply();
        expect(totalSupply).to.bignumber.equal(amount);

        // calc accrued() & earned()
        let accrued = await StakingRewards.accrued();
        let earned = await StakingRewards.earned(LP_1);
        let rewardPerToken = await StakingRewards.rewardPerToken();
        expect(accrued).to.bignumber.equal("0");
        expect(earned).to.bignumber.equal("0");
        expect(rewardPerToken).to.bignumber.equal("0");

        // push the block
        await time.advanceBlock();
        accrued = await StakingRewards.accrued();
        earned = await StakingRewards.earned(LP_1);
        rewardPerToken = await StakingRewards.rewardPerToken();
        if (verbose) {
            console.log(`accrued: ${accrued}`);
            console.log(`earned: ${earned}`);
            console.log(`rewardPerToken: ${rewardPerToken}`);
        }
        let expectReward = new BN(INIT_COFI_RATE).mul(new BN(1));
        expect(accrued).to.bignumber.equal(expectReward);
        expect(earned).to.bignumber.equal(expectReward);
        expect(rewardPerToken).to.bignumber.equal(expectReward);
    });

    it("should exit (withdraw & getReward) correctly", async () => {
        // stats before exit
        let reward = await CoFi.balanceOf(LP_1);
        expect(reward).to.bignumber.equal("0");
        let balance = await XToken.balanceOf(LP_1);
        expect(balance).to.bignumber.equal("0");
        let poolBalance = await CoFi.balanceOf(StakingRewards.address);
        if (verbose) {
            console.log(`before exit, CoFi reward Of LP_1: ${reward}`);
            console.log(`before exit, XToken balance Of LP_1: ${balance}`);
            console.log(`before exit, CoFi balance Of pool: ${poolBalance}`);
        }
        // withdraw and getReward
        await StakingRewards.exit({from: LP_1});
        let expectedReward = new BN(INIT_COFI_RATE).mul(new BN(2)); // means reward in two blocks
        // stats after exit
        reward = await CoFi.balanceOf(LP_1);
        expect(expectedReward).to.bignumber.equal(reward);
        balance = await XToken.balanceOf(LP_1);
        expectedBalance = web3.utils.toWei('1', 'ether');
        expect(expectedBalance).to.bignumber.equal(balance);

        poolBalance = await CoFi.balanceOf(StakingRewards.address);
        expect(poolBalance).to.bignumber.equal("0");

        if (verbose) {
            console.log(`after exit, CoFi reward Of LP_1: ${reward}`);
            console.log(`after exit, XToken balance Of LP_1: ${balance}`);
            console.log(`after exit, CoFi balance Of pool: ${poolBalance}`);
        }
    });

    it("should stakeForOther (LP2) correctly", async () => {
        const amount = web3.utils.toWei('1', 'ether');
        await XToken.approve(StakingRewards.address, amount, {from: LP_1});
        await StakingRewards.stakeForOther(LP_2, amount, {from: LP_1});
    });

    it("should have correct stats after stakeForOther (LP_2)", async () => {
        const amount = web3.utils.toWei('1', 'ether');
        const balanceInStake = await StakingRewards.balanceOf(LP_2);
        expect(balanceInStake).to.bignumber.equal(amount);
        const totalSupply = await StakingRewards.totalSupply();
        expect(totalSupply).to.bignumber.equal(amount);

        const balanceInStakeForLP1 = await StakingRewards.balanceOf(LP_1);
        expect(balanceInStakeForLP1).to.bignumber.equal("0");

        // calc accrued() & earned()
        let accrued = await StakingRewards.accrued();
        let earned = await StakingRewards.earned(LP_2);
        let rewardPerToken = await StakingRewards.rewardPerToken();
        let userRewardPerTokenPaidForLP2 = await StakingRewards.userRewardPerTokenPaid(LP_2);
        expect(accrued).to.bignumber.equal("0");
        expect(earned).to.bignumber.equal("0");
        expect(rewardPerToken).to.bignumber.equal(userRewardPerTokenPaidForLP2);
        // push the block
        await time.advanceBlock();
        accrued = await StakingRewards.accrued();
        earned = await StakingRewards.earned(LP_2);
        rewardPerToken = await StakingRewards.rewardPerToken();
        if (verbose) {
            console.log(`accrued: ${accrued}`);
            console.log(`earned: ${earned}`);
            console.log(`rewardPerToken: ${rewardPerToken}`);
            console.log(`userRewardPerTokenPaidForLP2: ${userRewardPerTokenPaidForLP2}`);
        }
        let reward = new BN(INIT_COFI_RATE).mul(new BN(1));
        expect(accrued).to.bignumber.equal(reward);
        expect(earned).to.bignumber.equal(reward);
        const expectedRewardPerToken = (new BN(userRewardPerTokenPaidForLP2)).add(new BN(reward));
        expect(rewardPerToken).to.bignumber.equal(expectedRewardPerToken);
    });

    it("should exit (withdraw & getReward) correctly for LP2", async () => {
        // stats before exit
        let reward = await CoFi.balanceOf(LP_2);
        expect(reward).to.bignumber.equal("0");
        let balance = await XToken.balanceOf(LP_2);
        expect(balance).to.bignumber.equal("0");
        if (verbose) {
            console.log(`before exit, CoFi reward Of LP_2: ${reward}`);
            console.log(`before exit, XToken balance Of LP_2: ${balance}`);
        }
        // withdraw and getReward
        await StakingRewards.exit({from: LP_2});
        let expectedReward = new BN(INIT_COFI_RATE).mul(new BN(2)); // means reward in two blocks
        // stats after exit
        reward = await CoFi.balanceOf(LP_2);
        expect(expectedReward).to.bignumber.equal(reward);
        balance = await XToken.balanceOf(LP_2);
        expectedBalance = web3.utils.toWei('1', 'ether');
        expect(expectedBalance).to.bignumber.equal(balance);
        if (verbose) {
            console.log(`after exit, CoFi reward Of LP_2: ${reward}`);
            console.log(`after exit, XToken balance Of LP_2: ${balance}`);
        }
    });

    // addPoolForPair, keep this test at the end so we don't need to change the tests before
    it("should revert if add two pool with the same pair (XToken)", async () => {
        const StakingRewards2 = await CoFiXStakingRewards.new(CoFi.address, XToken.address, VaultForLP.address, { from: deployer });
        await VaultForLP.addPoolForPair(StakingRewards2.address, {from: governance});
        const stakingPool = await VaultForLP.stakingPoolForPair(XToken.address);
        expect(stakingPool).equal(StakingRewards2.address);
    });

    it("should revert if add two pool with the same pair (XToken)", async () => {
        const StakingRewards3 = await CoFiXStakingRewards.new(CoFi.address, XToken.address, VaultForLP.address, { from: deployer });
        await expectRevert(VaultForLP.addPoolForPair(StakingRewards3.address, {from: governance}), "CVaultForLP: pair added");
    });
});