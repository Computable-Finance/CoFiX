const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiXVaultForCNode = artifacts.require("CoFiXVaultForCNode");
const CoFiToken = artifacts.require("CoFiToken");
const CNodeStakingRewards = artifacts.require("CNodeStakingRewards.sol");
const CoFiXVaultForLP = artifacts.require("CoFiXVaultForLP");
// const TestXToken = artifacts.require("TestXToken");
const CoFiXNode = artifacts.require("CoFiXNode");
const CoFiXFactory = artifacts.require("CoFiXFactory");
const WETH9 = artifacts.require("WETH9");

const verbose = process.env.VERBOSE;

contract('CNodeStakingRewards', (accounts) => {
    const owner = accounts[0];
    let deployer = owner;

    const governance = deployer;

    const CN_HOLDER_1 = accounts[1];
    const CN_HOLDER_2 = accounts[2];

    const INIT_COFI_RATE = web3.utils.toWei('1', 'ether');

    const CNODE_TOTAL_SUPPLY = "100";

    before(async () => {
        WETH = await WETH9.new();
        CFactory = await CoFiXFactory.new(WETH.address, { from: deployer });
        CoFi = await CoFiToken.new({ from: deployer });
        VaultForCNode = await CoFiXVaultForCNode.new(CoFi.address, CFactory.address, { from: deployer });
        VaultForLP = await CoFiXVaultForLP.new(CoFi.address, CFactory.address, { from: deployer });
        await CFactory.setVaultForCNode(VaultForCNode.address);
        await CFactory.setVaultForLP(VaultForLP.address);
        CNode = await CoFiXNode.new({ from: deployer });
        StakingRewards = await CNodeStakingRewards.new(CoFi.address, CNode.address, CFactory.address, { from: deployer });
    });

    it("should have correct total supply", async () => {
        const totalSupply = await CNode.totalSupply();
        expect(totalSupply).to.bignumber.equal(CNODE_TOTAL_SUPPLY);
    });

    it("should have correct name and symbol", async () => {
        const name = await CNode.name();
        const symbol = await CNode.symbol();
        const decimal = await CNode.decimals();
        expect(name).equal("CoFiX Node");
        expect(symbol).equal("CN");
        expect(decimal).to.bignumber.equal("0");
    });


    it("should have correct balance", async () => {
        const balance = await CNode.balanceOf(deployer);
        expect(balance).to.bignumber.equal(CNODE_TOTAL_SUPPLY);
    });

    it("should add VaultForCNode as minter of CoFi correctly", async () => {
        const receipt = await CoFi.addMinter(VaultForCNode.address, {from: governance});
        expectEvent(receipt, "MinterAdded", {_minter: VaultForCNode.address});
        const allowed = await CoFi.minters(VaultForCNode.address);
        expect(allowed).equal(true);
    });

    it("should setCNodePool correctly", async () => {
        await VaultForCNode.setCNodePool(StakingRewards.address, {from: governance});
        const pool = await VaultForCNode.cnodePool();
        expect(pool).to.bignumber.equal(StakingRewards.address);
    });

    it("should have correct stats from starting", async () => {
        const rewardPerToken = await StakingRewards.rewardPerToken();
        expect(rewardPerToken).to.bignumber.equal("0");
        const totalSupply = await StakingRewards.totalSupply();
        expect(totalSupply).to.bignumber.equal("0");
        const rewardRate = await StakingRewards.rewardRate();
        expect(INIT_COFI_RATE).to.bignumber.equal(rewardRate);
    });

    it("should transfer some CNode to LP1 correctly", async () => {
        const amount = "1"; // decimal is zero
        await CNode.transfer(CN_HOLDER_1, amount);
        const balance = await CNode.balanceOf(CN_HOLDER_1);
        expect(balance).to.bignumber.equal(amount);
    });

    it("should revert if not approve before stake", async () => {
        const amount = "1";
        await expectRevert(StakingRewards.stake(amount), "TransferHelper: TRANSFER_FROM_FAILED");
    });

    it("should stake correctly", async () => {
        const amount = "1";
        await CNode.approve(StakingRewards.address, amount, {from: CN_HOLDER_1});
        await StakingRewards.stake(amount, {from: CN_HOLDER_1});
        // first one deposit in, totalSupply is zero before this stake, accrued should be zero
        // means no CoFi will be transferred into StakingRewards contract
        const balance = await CoFi.balanceOf(StakingRewards.address);
        expect(balance).to.bignumber.equal("0");
    });

    it("should have correct stats after stake", async () => {
        const amount = "1";
        const balanceInStake = await StakingRewards.balanceOf(CN_HOLDER_1);
        expect(balanceInStake).to.bignumber.equal(amount);
        const totalSupply = await StakingRewards.totalSupply();
        expect(totalSupply).to.bignumber.equal(amount);

        // calc accrued() & earned()
        let accrued = await StakingRewards.accrued();
        let earned = await StakingRewards.earned(CN_HOLDER_1);
        let rewardPerToken = await StakingRewards.rewardPerToken();
        expect(accrued).to.bignumber.equal("0");
        expect(earned).to.bignumber.equal("0");
        expect(rewardPerToken).to.bignumber.equal("0");

        // push the block
        await time.advanceBlock();
        accrued = await StakingRewards.accrued();
        earned = await StakingRewards.earned(CN_HOLDER_1);
        rewardPerToken = await StakingRewards.rewardPerToken();
        if (verbose) {
            console.log(`accrued: ${accrued}`);
            console.log(`earned: ${earned}`);
            console.log(`rewardPerToken: ${rewardPerToken}`);
        }
        let expectReward = new BN(INIT_COFI_RATE).mul(new BN(1));
        expect(accrued).to.bignumber.equal(expectReward);
        expect(earned).to.bignumber.equal(expectReward);
        const expectedRewardPerToken = expectReward.mul(new BN(web3.utils.toWei('1', 'ether')));
        expect(rewardPerToken).to.bignumber.equal(expectedRewardPerToken);
    });

    it("should exit (withdraw & getReward) correctly", async () => {
        // stats before exit
        let reward = await CoFi.balanceOf(CN_HOLDER_1);
        expect(reward).to.bignumber.equal("0");
        let balance = await CNode.balanceOf(CN_HOLDER_1);
        expect(balance).to.bignumber.equal("0");
        let poolBalance = await CoFi.balanceOf(StakingRewards.address);
        if (verbose) {
            console.log(`before exit, CoFi reward Of CN_HOLDER_1: ${reward}`);
            console.log(`before exit, CNode balance Of CN_HOLDER_1: ${balance}`);
            console.log(`before exit, CoFi balance Of pool: ${poolBalance}`);
        }
        // withdraw and getReward
        await StakingRewards.exit({from: CN_HOLDER_1});
        let expectedReward = new BN(INIT_COFI_RATE).mul(new BN(2)); // means reward in two blocks
        // stats after exit
        reward = await CoFi.balanceOf(CN_HOLDER_1);
        expect(expectedReward).to.bignumber.equal(reward);
        balance = await CNode.balanceOf(CN_HOLDER_1);
        expectedBalance = "1";
        expect(expectedBalance).to.bignumber.equal(balance);

        poolBalance = await CoFi.balanceOf(StakingRewards.address);
        expect(poolBalance).to.bignumber.equal("0");

        if (verbose) {
            console.log(`after exit, CoFi reward Of CN_HOLDER_1: ${reward}`);
            console.log(`after exit, CNode balance Of CN_HOLDER_1: ${balance}`);
            console.log(`after exit, CoFi balance Of pool: ${poolBalance}`);
        }
    });

    it("should stakeForOther (LP2) correctly", async () => {
        const amount = "1";
        await CNode.approve(StakingRewards.address, amount, {from: CN_HOLDER_1});
        await StakingRewards.stakeForOther(CN_HOLDER_2, amount, {from: CN_HOLDER_1});
    });

    it("should have correct stats after stakeForOther (CN_HOLDER_2)", async () => {
        const amount = "1";
        const balanceInStake = await StakingRewards.balanceOf(CN_HOLDER_2);
        expect(balanceInStake).to.bignumber.equal(amount);
        const totalSupply = await StakingRewards.totalSupply();
        expect(totalSupply).to.bignumber.equal(amount);

        const balanceInStakeForLP1 = await StakingRewards.balanceOf(CN_HOLDER_1);
        expect(balanceInStakeForLP1).to.bignumber.equal("0");

        // calc accrued() & earned()
        let accrued = await StakingRewards.accrued();
        let earned = await StakingRewards.earned(CN_HOLDER_2);
        let rewardPerToken = await StakingRewards.rewardPerToken();
        let userRewardPerTokenPaidForLP2 = await StakingRewards.userRewardPerTokenPaid(CN_HOLDER_2);
        expect(accrued).to.bignumber.equal("0");
        expect(earned).to.bignumber.equal("0");
        expect(rewardPerToken).to.bignumber.equal(userRewardPerTokenPaidForLP2);
        // push the block
        await time.advanceBlock();
        accrued = await StakingRewards.accrued();
        earned = await StakingRewards.earned(CN_HOLDER_2);
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
        const newRewardPerToken = (new BN(reward)).mul(new BN(web3.utils.toWei('1', 'ether')));
        const expectedRewardPerToken = (new BN(userRewardPerTokenPaidForLP2)).add(newRewardPerToken);
        expect(rewardPerToken).to.bignumber.equal(expectedRewardPerToken);
    });

    it("should exit (withdraw & getReward) correctly for LP2", async () => {
        // stats before exit
        let reward = await CoFi.balanceOf(CN_HOLDER_2);
        expect(reward).to.bignumber.equal("0");
        let balance = await CNode.balanceOf(CN_HOLDER_2);
        expect(balance).to.bignumber.equal("0");
        if (verbose) {
            console.log(`before exit, CoFi reward Of CN_HOLDER_2: ${reward}`);
            console.log(`before exit, CNode balance Of CN_HOLDER_2: ${balance}`);
        }
        // withdraw and getReward
        await StakingRewards.exit({from: CN_HOLDER_2});
        let expectedReward = new BN(INIT_COFI_RATE).mul(new BN(2)); // means reward in two blocks
        // stats after exit
        reward = await CoFi.balanceOf(CN_HOLDER_2);
        expect(expectedReward).to.bignumber.equal(reward);
        balance = await CNode.balanceOf(CN_HOLDER_2);
        expectedBalance = "1";
        expect(expectedBalance).to.bignumber.equal(balance);
        if (verbose) {
            console.log(`after exit, CoFi reward Of CN_HOLDER_2: ${reward}`);
            console.log(`after exit, CNode balance Of CN_HOLDER_2: ${balance}`);
        }
    });

});