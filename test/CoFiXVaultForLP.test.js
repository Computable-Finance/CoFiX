const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiXVaultForLP = artifacts.require("CoFiXVaultForLP");
const CoFiToken = artifacts.require("CoFiToken");
const CoFiXStakingRewards = artifacts.require("CoFiXStakingRewards.sol");
const CoFiXFactory = artifacts.require("CoFiXFactory");
const WETH9 = artifacts.require("WETH9");

const verbose = process.env.VERBOSE;

contract('CoFiXVaultForLP', (accounts) => {
    const owner = accounts[0];
    let deployer = owner;

    const GOVERNANCE = deployer;
    const NON_GOVERNANCE = accounts[1];

    const POOL_1 = accounts[1];
    const POOL_2 = accounts[2];

    // const TotalSupplyOfCoFi = new BN("100000000000000000000000000"); // 1e8 * 1e18
    // const HalfSupplyOfCoFi = TotalSupplyOfCoFi.div(new BN(2)); // or the init supply to CoFiXVaultForLP

    const RATE_BASE = web3.utils.toWei('1', 'ether');

    const DECAY_RATE = 80;
    const INIT_COFI_RATE = web3.utils.toWei('10', 'ether');

    before(async () => {
        WETH = await WETH9.new();
        CFactory = await CoFiXFactory.new(WETH.address, { from: deployer });
        CoFi = await CoFiToken.new({ from: deployer });
        VaultForLP = await CoFiXVaultForLP.new(CoFi.address, CFactory.address, { from: deployer });
    });

    it("should revert if no GOVERNANCE add pool", async () => {
        await expectRevert(VaultForLP.addPool(POOL_1, {from: NON_GOVERNANCE}), "CVaultForLP: !governance");
    });

    it("should revert if no GOVERNANCE addPoolForPair", async () => {
        await expectRevert(VaultForLP.addPoolForPair(POOL_1, {from: NON_GOVERNANCE}), "CVaultForLP: !governance");
    });

    it("should addPool correctly", async () => {
        await VaultForLP.addPool(POOL_1, {from: GOVERNANCE});
        const allowed = await VaultForLP.poolAllowed(POOL_1);
        expect(allowed).equal(true);
    });

    it("should revert if we add the same pool for twice", async () => {
        await expectRevert(VaultForLP.addPool(POOL_1, {from: GOVERNANCE}), "CVaultForLP: pool added");
    });

    it("should revert if we add the same pool for twice by addPoolForPair", async () => {
        await expectRevert(VaultForLP.addPoolForPair(POOL_1, {from: GOVERNANCE}), "CVaultForLP: pool added");
    });

    it("should revert if not pool allowed call distributeReward", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await expectRevert(VaultForLP.distributeReward(GOVERNANCE, amount, {from: GOVERNANCE}), "CVaultForLP: only pool allowed"); 
    });

    it("should revert if distributeReward when VaultForLP is not minter of CoFi", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await expectRevert(VaultForLP.distributeReward(POOL_1, amount, {from: POOL_1}), "CoFi: !minter"); 
    });

    it("should add VaultForLP as minter of CoFi correctly", async () => {
        const receipt = await CoFi.addMinter(VaultForLP.address, {from: GOVERNANCE});
        expectEvent(receipt, "MinterAdded", {_minter: VaultForLP.address});
        const allowed = await CoFi.minters(VaultForLP.address);
        expect(allowed).equal(true);
    });

    it("should distributeReward correctly when POOL_1 call", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await VaultForLP.distributeReward(POOL_1, amount, {from: POOL_1});
        const balanceOfVault = await CoFi.balanceOf(VaultForLP.address);
        const balanceOfPool1 = await CoFi.balanceOf(POOL_1);
        expect(balanceOfVault).to.bignumber.equal("0"); // balance of vault should be zero now because we mint tokens directly
        expect(balanceOfPool1).to.bignumber.equal(amount);
    });

    it("should distributeReward correctly even when amount equals to zero", async () => {
        const amount = web3.utils.toWei('0', 'ether');
        const { tx } = await VaultForLP.distributeReward(POOL_1, amount, {from: POOL_1});
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
        const currentPoolRate = await VaultForLP.currentPoolRate();
        expect(currentPoolRate).to.bignumber.equal(INIT_COFI_RATE); // only one pool now
        const poolRate = currentPoolRate.div(new BN(RATE_BASE));
        if (verbose) {
            console.log(`currentPoolRate: ${poolRate} CoFi per block`);
        } 
    });

    it("should have correct stats if we add another pool", async () => {
        // add POOL_2
        await VaultForLP.addPool(POOL_2, {from: GOVERNANCE});
        const allowed = await VaultForLP.poolAllowed(POOL_2);
        expect(allowed).equal(true);

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
        const currentPoolRate = await VaultForLP.currentPoolRate();
        expect(currentPoolRate).to.bignumber.equal((new BN(INIT_COFI_RATE)).div(new BN(2))); // two pools now
        const poolRate = currentPoolRate.div(new BN(RATE_BASE));
        if (verbose) {
            console.log(`currentPoolRate: ${poolRate} CoFi per block`);
        }
        // gas cost of currentPoolRate()
        const gasCost = await VaultForLP.currentPoolRate.estimateGas();
        if (verbose) {
            console.log(`gas cost of currentPoolRate interface: ${gasCost}`); // should sub 21000
        }
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
        if (newCurrentPeriod > 5) {
            periodIdx = 5;
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