const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiXVaultForCNode = artifacts.require("CoFiXV2VaultForCNode");
const CoFiToken = artifacts.require("CoFiToken");
const CoFiXStakingRewards = artifacts.require("CoFiXV2StakingRewards.sol");
const CoFiXFactory = artifacts.require("CoFiXV2Factory");
const WETH9 = artifacts.require("WETH9");

const verbose = process.env.VERBOSE;

contract('CoFiXV2VaultForCNode', (accounts) => {
    const owner = accounts[0];
    let deployer = owner;

    const GOVERNANCE = deployer;
    const NON_GOVERNANCE = accounts[1];

    const POOL_1 = accounts[1];
    const POOL_2 = accounts[2];

    // const TotalSupplyOfCoFi = new BN("100000000000000000000000000"); // 1e8 * 1e18
    // const HalfSupplyOfCoFi = TotalSupplyOfCoFi.div(new BN(2)); // or the init supply to CoFiXVaultForCNode

    const RATE_BASE = web3.utils.toWei('1', 'ether');

    const DECAY_RATE = 80;
    const INIT_COFI_RATE = web3.utils.toWei('0.5', 'ether');

    before(async () => {
        WETH = await WETH9.new();
        CFactory = await CoFiXFactory.new(WETH.address, { from: deployer });
        CoFi = await CoFiToken.new({ from: deployer });
        VaultForCNode = await CoFiXVaultForCNode.new(CoFi.address, CFactory.address, { from: deployer });
    });

    it("should setCNodePool correctly", async () => {
        await VaultForCNode.setCNodePool(POOL_1, {from: GOVERNANCE});
        const cnodePool = await VaultForCNode.cnodePool();
        expect(cnodePool).equal(POOL_1);
    });

    it("should revert if NON_GOVERNANCE setCNodePool", async () => {
        await expectRevert(VaultForCNode.setCNodePool(POOL_1, {from: NON_GOVERNANCE}), "CVaultForCNode: !governance");
    });

    it("should revert if not pool allowed call distributeReward", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await expectRevert(VaultForCNode.distributeReward(GOVERNANCE, amount, {from: GOVERNANCE}), "CVaultForCNode: only pool allowed"); 
    });

    it("should revert if distributeReward when VaultForCNode is not minter of CoFi", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await expectRevert(VaultForCNode.distributeReward(POOL_1, amount, {from: POOL_1}), "CoFi: !minter"); 
    });

    it("should add VaultForCNode as minter of CoFi correctly", async () => {
        const receipt = await CoFi.addMinter(VaultForCNode.address, {from: GOVERNANCE});
        expectEvent(receipt, "MinterAdded", {_minter: VaultForCNode.address});
        const allowed = await CoFi.minters(VaultForCNode.address);
        expect(allowed).equal(true);
    });

    it("should distributeReward correctly when POOL_1 call", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await VaultForCNode.distributeReward(POOL_1, amount, {from: POOL_1});
        const balanceOfVault = await CoFi.balanceOf(VaultForCNode.address);
        const balanceOfPool1 = await CoFi.balanceOf(POOL_1);
        expect(balanceOfVault).to.bignumber.equal("0"); // balance of vault should be zero now because we mint tokens directly
        expect(balanceOfPool1).to.bignumber.equal(amount);
    });

    it("should distributeReward correctly even when amount equals to zero", async () => {
        const amount = web3.utils.toWei('0', 'ether');
        const { tx } = await VaultForCNode.distributeReward(POOL_1, amount, {from: POOL_1});
        await expectEvent.inTransaction(tx, CoFi, 'Transfer', { from: constants.ZERO_ADDRESS, to: POOL_1, value: "0" });
    });
    
    it("should have correct stats", async () => {
        const decayRate = await VaultForCNode.decayRate();
        expect(decayRate).to.bignumber.equal(DECAY_RATE.toString());
        const currentPeriod = await VaultForCNode.currentPeriod();
        expect(currentPeriod).to.bignumber.equal("0");
        const currentCoFiRate = await VaultForCNode.currentCoFiRate();
        expect(currentCoFiRate).to.bignumber.equal(INIT_COFI_RATE);
        const rateBase = await VaultForCNode.RATE_BASE();
        expect(rateBase).to.bignumber.equal(RATE_BASE);
        const cofiRate = currentCoFiRate.div(new BN(RATE_BASE));
        if (verbose) {
            console.log(`currentCoFiRate: ${cofiRate} CoFi per block`);
        }
    });

    it("should have correct stats if we change decayPeriod", async () => {
        const currentPeriod = await VaultForCNode.currentPeriod();
        expect(currentPeriod).to.bignumber.equal("0");

        const decayPeriod = "5";
        await VaultForCNode.setDecayPeriod(decayPeriod);
        const currentDecayPeriod = await VaultForCNode.decayPeriod();
        expect(currentDecayPeriod).to.bignumber.equal(decayPeriod);

        const genesisBlock = await VaultForCNode.genesisBlock();
        const latestBlock = await time.latestBlock();
        const newCurrentPeriod = await VaultForCNode.currentPeriod();
        const expectPeriod = Math.floor((latestBlock - genesisBlock) / decayPeriod);
        expect(expectPeriod.toString()).to.bignumber.equal(newCurrentPeriod);
        if (verbose) {
            console.log(`genesisBlock: ${genesisBlock}`);
            console.log(`latestBlock: ${latestBlock}`);
            console.log(`expectPeriod: ${expectPeriod}, newCurrentPeriod: ${newCurrentPeriod}`);
        }

        // decay rate
        const currentCoFiRate = await VaultForCNode.currentCoFiRate();
        let expectCofiRate = new BN(INIT_COFI_RATE);
        const decayRate = new BN(DECAY_RATE.toString());
        for (let i = 0; i < newCurrentPeriod; i++) {
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
        const genesisBlock = await VaultForCNode.genesisBlock();
        const latestBlock = await time.latestBlock();
        const newCurrentPeriod = await VaultForCNode.currentPeriod();
        const expectPeriod = Math.floor((latestBlock - genesisBlock) / decayPeriod);
        expect(expectPeriod.toString()).to.bignumber.equal(newCurrentPeriod);
        if (verbose) {
            console.log(`genesisBlock: ${genesisBlock}`);
            console.log(`latestBlock: ${latestBlock}`);
            console.log(`expectPeriod: ${expectPeriod}, newCurrentPeriod: ${newCurrentPeriod}`);
        }

        // decay rate
        const currentCoFiRate = await VaultForCNode.currentCoFiRate();
        let expectCofiRate = new BN(INIT_COFI_RATE);
        const decayRate = new BN(DECAY_RATE.toString());
        let periodIdx = newCurrentPeriod;
        if (newCurrentPeriod > 4) {
            periodIdx = 4;
        }
        for (let i = 0; i < periodIdx; i++) {
            expectCofiRate = expectCofiRate.mul(decayRate).div(new BN(100));
        }
        if (verbose) {
            console.log(`expectCofiRate: ${expectCofiRate}, currentCoFiRate: ${currentCoFiRate}`);
        }
        expect(expectCofiRate).to.bignumber.equal(currentCoFiRate);
    });

});