const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time, send } = require('@openzeppelin/test-helpers');

const CoFiXVaultForLP = artifacts.require("CoFiXVaultForLP");
const CoFiToken = artifacts.require("CoFiToken");
const CoFiStakingRewards = artifacts.require("CoFiStakingRewards.sol");
const WETH9 = artifacts.require("WETH9");


const verbose = process.env.VERBOSE;

contract('CoFiStakingRewards', (accounts) => {
    const owner = accounts[0];
    let deployer = owner;

    const governance = deployer;

    const MINTER = governance;

    const CoFi_User1 = accounts[1];
    const CoFi_User2 = accounts[2];

    const DividendShare = 20;
    const DividendShareBase = 100;

    before(async () => {
        CoFi = await CoFiToken.new({ from: deployer });
        WETH = await WETH9.new();
        StakingRewards = await CoFiStakingRewards.new(WETH.address, CoFi.address, { from: deployer });
    });

    it("should have correct settings", async () => {
        const rewardToken = await StakingRewards.rewardsToken();
        const stakingToken = await StakingRewards.stakingToken();
        expect(rewardToken).to.equal(WETH.address);
        expect(stakingToken).to.equal(CoFi.address);
    });

    it("should add MINTER as minter of CoFi correctly", async () => {
        const receipt = await CoFi.addMinter(MINTER, {from: governance});
        expectEvent(receipt, "MinterAdded", {_minter: MINTER});
        const allowed = await CoFi.minters(MINTER);
        expect(allowed).equal(true);
    });

    it("should mint some CoFi to MINTER correctly", async () => {
        const amount = web3.utils.toWei('10000', 'ether');
        await CoFi.mint(MINTER, amount, {from: MINTER});
        const balance = await CoFi.balanceOf(MINTER);
        expect(balance).to.bignumber.equal(amount);
        const totalSupply = await CoFi.totalSupply();
        expect(totalSupply).to.bignumber.equal(amount);
    });

    it("should transfer some CoFi to CoFi_User1 correctly", async () => {
        const amount = web3.utils.toWei('10000', 'ether');
        await CoFi.transfer(CoFi_User1, amount, {from: MINTER});
        const balance = await CoFi.balanceOf(CoFi_User1);
        expect(balance).to.bignumber.equal(amount);
    });

    it("should transfer some WETH to StakingRewards pool for reward correctly", async () => {
        const amount = web3.utils.toWei('0.5', 'ether');
        await WETH.deposit({from: deployer, value: amount});
        const balance = await WETH.balanceOf(deployer);
        expect(balance).to.bignumber.equal(amount);
        // transfer to StakingRewards pool
        await WETH.transfer(StakingRewards.address, amount, {from: deployer});
        const rewardBalance = await WETH.balanceOf(StakingRewards.address);
        expect(rewardBalance).to.bignumber.equal(amount);
        const accrued = await StakingRewards.accrued();
        expect(accrued).to.bignumber.equal(amount);
    });

    it("should addETHReward to StakingRewards pool for reward correctly", async () => {
        const amount = web3.utils.toWei('0.5', 'ether');
        // await send.ether(deployer, StakingRewards.address, amount)
        await StakingRewards.addETHReward({value: amount});
        const rewardBalance = await WETH.balanceOf(StakingRewards.address);
        const totalAmount = (new BN(amount)).add(new BN(amount));
        expect(rewardBalance).to.bignumber.equal(totalAmount);
        const accrued = await StakingRewards.accrued();
        expect(accrued).to.bignumber.equal(totalAmount);
    });

    it("should stake correctly", async () => {
        const amount = web3.utils.toWei('5000', 'ether');
        // approve first
        await CoFi.approve(StakingRewards.address, amount, { from: CoFi_User1 });
        await StakingRewards.stake(amount, { from: CoFi_User1 });
        const balance = await StakingRewards.balanceOf(CoFi_User1);
        expect(balance).to.bignumber.equal(amount);
        const accrued = await StakingRewards.accrued();
        const expectedReward = web3.utils.toWei('1', 'ether');
        expect(accrued).to.bignumber.equal(expectedReward);
        const earned = await StakingRewards.earned(CoFi_User1);
        const expectedEarned = expectedReward*DividendShare/DividendShareBase;
        expect(earned).to.bignumber.equal(expectedEarned.toString());
    });

    it("should stake again correctly", async () => {
        const amount = web3.utils.toWei('5000', 'ether');
        // approve first
        await CoFi.approve(StakingRewards.address, amount, { from: CoFi_User1 });
        await StakingRewards.stake(amount, { from: CoFi_User1 });
        const balance = await StakingRewards.balanceOf(CoFi_User1);
        const totalAmount = (new BN(amount)).add(new BN(amount));
        expect(balance).to.bignumber.equal(totalAmount);
        const expectedReward = web3.utils.toWei('1', 'ether');
        const accrued = await StakingRewards.accrued(); // no new reward come in, so the accrued is zero
        expect(accrued).to.bignumber.equal("0");
        const earned = await StakingRewards.earned(CoFi_User1); // no new reward come in, so the earned remains
        const expectedEarned = expectedReward*DividendShare/DividendShareBase;
        expect(earned).to.bignumber.equal(expectedEarned.toString());
    });

    it("should exit (withdraw & getReward) correctly", async () => {
        // balance before
        const balanceOfCoFiBefore = await CoFi.balanceOf(CoFi_User1);
        const balanceOfETHBefore = await web3.eth.getBalance(CoFi_User1);
        if (verbose) {
            console.log(`before exit, balanceOfCoFiBefore: ${balanceOfCoFiBefore}`);
            console.log(`before exit,balanceOfETHBefore: ${balanceOfETHBefore}`);
        }
        await StakingRewards.exit({ from: CoFi_User1, gasPrice: "0" });
        // balance after
        const balanceOfCoFiAfter = await CoFi.balanceOf(CoFi_User1);
        const balanceOfETHAfter = await web3.eth.getBalance(CoFi_User1);
        if (verbose) {
            console.log(`after exit, balanceOfCoFiAfter: ${balanceOfCoFiAfter}`);
            console.log(`after exit, balanceOfETHAfter: ${balanceOfETHAfter}`);
        }
        const expectedReward = web3.utils.toWei('1', 'ether')*DividendShare/DividendShareBase;
        const expectedCoFiBalance = web3.utils.toWei('10000', 'ether');
        const coFiBalance = (new BN(balanceOfCoFiAfter)).sub(new BN(balanceOfCoFiBefore));
        const reward = (new BN(balanceOfETHAfter)).sub(new BN(balanceOfETHBefore));
        expect(expectedReward.toString()).to.bignumber.equal(reward);
        expect(expectedCoFiBalance).to.bignumber.equal(coFiBalance);
    });
    
    it("should withdrawSavingByGov correctly", async () => {
        const savingAmount = await StakingRewards.pendingSavingAmount();
        if (verbose) {
            console.log(`savingAmount: ${savingAmount}`);
        }
        const expectedSaveAmount = web3.utils.toWei('1', 'ether')*(1-DividendShare/DividendShareBase);
        expect(savingAmount).to.bignumber.equal(expectedSaveAmount.toString());

        await StakingRewards.withdrawSavingByGov(governance, savingAmount, { from: governance });
        const newSavingAmount = await StakingRewards.pendingSavingAmount();
        expect(newSavingAmount).to.bignumber.equal("0");
    });

    it("should have correct stats after above steps", async () => {
        const totalSupply = await StakingRewards.totalSupply();
        expect(totalSupply).to.bignumber.equal("0");

        const balance = await WETH.balanceOf(StakingRewards.address);
        expect(balance).to.bignumber.equal("0");

        const lastUpdateRewardsTokenBalance = await StakingRewards.lastUpdateRewardsTokenBalance();
        expect(lastUpdateRewardsTokenBalance).to.bignumber.equal("0");
    });

    it("should transfer some WETH to StakingRewards pool for reward correctly again", async () => {
        const amount = web3.utils.toWei('0.5', 'ether');
        await WETH.deposit({from: deployer, value: amount});
        const balance = await WETH.balanceOf(deployer);
        expect(balance).to.bignumber.equal(amount);
        // transfer to StakingRewards pool
        await WETH.transfer(StakingRewards.address, amount, {from: deployer});
        const rewardBalance = await WETH.balanceOf(StakingRewards.address);
        expect(rewardBalance).to.bignumber.equal(amount);
        const accrued = await StakingRewards.accrued();
        expect(accrued).to.bignumber.equal(amount);
    });

    it("should addETHReward to StakingRewards pool for reward correctly again", async () => {
        const amount = web3.utils.toWei('0.5', 'ether');
        // await send.ether(deployer, StakingRewards.address, amount)
        await StakingRewards.addETHReward({value: amount});
        const rewardBalance = await WETH.balanceOf(StakingRewards.address);
        const totalAmount = (new BN(amount)).add(new BN(amount));
        expect(rewardBalance).to.bignumber.equal(totalAmount);
        const accrued = await StakingRewards.accrued();
        expect(accrued).to.bignumber.equal(totalAmount);
    });

    it("should stake correctly after totalSupply back to zero", async () => {
        const amount = web3.utils.toWei('5000', 'ether');
        // approve first
        await CoFi.approve(StakingRewards.address, amount, { from: CoFi_User1 });
        await StakingRewards.stake(amount, { from: CoFi_User1 });
        const balance = await StakingRewards.balanceOf(CoFi_User1);
        expect(balance).to.bignumber.equal(amount);
        const accrued = await StakingRewards.accrued();
        const expectedReward = web3.utils.toWei('1', 'ether');
        expect(accrued).to.bignumber.equal(expectedReward);
        const earned = await StakingRewards.earned(CoFi_User1);
        const expectedEarned = expectedReward*DividendShare/DividendShareBase;
        expect(earned).to.bignumber.equal(expectedEarned.toString());
    });
});