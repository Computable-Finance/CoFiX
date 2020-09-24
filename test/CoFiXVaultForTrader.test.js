const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiXVaultForTrader = artifacts.require("CoFiXVaultForTrader");
const CoFiToken = artifacts.require("CoFiToken");

const { calcK, convert_from_fixed_point, convert_into_fixed_point, calcRelativeDiff } = require('../lib/calc');


const verbose = process.env.VERBOSE;

contract('CoFiXVaultForTrader', (accounts) => {
    const owner = accounts[0];
    let deployer = owner;

    const governance = deployer;
    const non_governance = accounts[1];


    const TotalSupplyOfCoFi = new BN("100000000000000000000000000"); // 1e8 * 1e18
    const HalfSupplyOfCoFi = TotalSupplyOfCoFi.div(new BN(2)); // or the init supply to CoFiXVaultForLP

    const RATE_BASE = web3.utils.toWei('1', 'ether');

    const DECAY_RATE = 80;
    const INIT_COFI_RATE = web3.utils.toWei('10', 'ether');

    const THETA_FEE_UNIT = web3.utils.toWei('0.01', 'ether');

    const ROUTER_1 = accounts[1];
    const ROUTER_2 = accounts[2];

    before(async () => {
        CoFi = await CoFiToken.new({ from: deployer });
        VaultForTrader = await CoFiXVaultForTrader.new(CoFi.address, { from: deployer });
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

    it("should have correct stats before anything", async () => {
        const cofi = await VaultForTrader.cofiToken();
        expect(CoFi.address).equal(cofi);

        const currentPeriod = await VaultForTrader.currentPeriod();
        expect(currentPeriod).to.bignumber.equal("0");

        const currentDecay = await VaultForTrader.currentDecay();
        const cDecay = convert_from_fixed_point(currentDecay);

        expect(cDecay.toString()).to.bignumber.equal("1");
        const currentCoFiRate = await VaultForTrader.currentCoFiRate();
        expect(INIT_COFI_RATE).to.bignumber.equal(currentCoFiRate);

        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const {cofiRate, stdAmount} = await VaultForTrader.stdMiningRateAndAmount(thetaFee);
        expect(cofiRate).to.bignumber.equal(currentCoFiRate);
        const expectedAmount = (new BN(thetaFee)).mul(new BN(currentCoFiRate)).div(new BN(THETA_FEE_UNIT));
        expect(expectedAmount).to.bignumber.equal(stdAmount);

    });

    it("should calcLambda correctly", async () => {
        const input = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 10, y: 1 }, { x: 300, y: 30 },
                { x: 300, y: 100 }, { x: 300, y: 900 }, { x: 300, y: 910 }, { x: 300, y: 3000 },
                { x: 300, y: 30001 }, { x: 0, y: 1 }];
        const expectedLambda = ["50", "50", "50", "50",
                             "75", "100", "125", "125",
                             "150", "150"];
        expect(input.length).equal(expectedLambda.length);
        for (let i = 0; i < input.length; i++) {
            const xy = input[i];
            const lambda = await VaultForTrader.calcLambda(xy.x, xy.y);
            if (verbose) {
                console.log(`x: ${xy.x}, y: ${xy.y}, index: ${i}, lambda: ${lambda}, expectedLambda: ${expectedLambda[i]}`);
            }
            expect(expectedLambda[i]).to.bignumber.equal(lambda);
        }
    });

    it("should have correct current stats before anything", async () => {

        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const actualMiningAmountAndDensity = await VaultForTrader.actualMiningAmountAndDensity(thetaFee, x, y);
        if (verbose) {
            console.log(`actualMiningAmount: ${actualMiningAmountAndDensity.amount}, density: ${actualMiningAmountAndDensity.density}`);
        }
        expect(actualMiningAmountAndDensity.amount).to.bignumber.equal(INIT_COFI_RATE);
        // // uint256 ms = singleLimitM.mul(s).div(S_BASE); 50000*1e18*24/1e8=1.2E16
        // // go into Q >= ms branch
        // // O_T.mul(ms).mul(Q.mul(2).sub(ms)).mul(lambda).div(Q).div(Q);
        // // O_T * m * s * (2Q - m*s) * lambda / Q / Q
        // // (10*1E18) * (1.2E16) * (2*(10*1E18) - 1.2E16) * 1 / (10*1e18) / (10*1e18) = 2.39856E16
        // const expectedActualAmount = (10*1E18) * (1.2E16) * (2*(10*1E18) - 1.2E16) * 1 / (10*1e18) / (10*1e18);
    });

    it("should revert if not set VaultForTrader as minter of CoFi", async () => {
        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const mineTo = ROUTER_1;
        await expectRevert(VaultForTrader.distributeReward(thetaFee, x, y, mineTo, { from: ROUTER_1 }), "CoFi: !minter");
    });

    it("should add VaultForTrader as minter of CoFi correctly", async () => {
        const receipt = await CoFi.addMinter(VaultForTrader.address, {from: governance});
        expectEvent(receipt, "MinterAdded", {_minter: VaultForTrader.address});
        const allowed = await CoFi.minters(VaultForTrader.address);
        expect(allowed).equal(true);
    });

    it("should revert if distributeReward by NON ROUTER_1", async () => {
        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const mineTo = ROUTER_2;
        await expectRevert(VaultForTrader.distributeReward(thetaFee, x, y, mineTo, { from: ROUTER_2 }), "CVaultForTrader: not allowed router");
    });

    it("should distributeReward correctly by ROUTER_1", async () => {
        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const mineTo = ROUTER_1;
        await VaultForTrader.distributeReward(thetaFee, x, y, mineTo, { from: ROUTER_1 });
        const cofiBalanceOfRouter1 = await CoFi.balanceOf(ROUTER_1);
        if (verbose) {
            console.log(`cofiBalanceOfRouter1: ${cofiBalanceOfRouter1}`);
        }
        const expectedReward = INIT_COFI_RATE;
        expect(cofiBalanceOfRouter1).to.bignumber.equal(expectedReward);
    });

    it("should distributeReward repeatedly and correctly by ROUTER_1", async () => {
        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const mineTo = ROUTER_1;
        
        for (let i = 0; i < 5; i++) { // for gas cost statistics
            const {cofiRate, stdAmount} = await VaultForTrader.stdMiningRateAndAmount(thetaFee);
            const density = await VaultForTrader.calcDensity(stdAmount);
            const actual = await VaultForTrader.actualMiningAmountAndDensity(thetaFee, x, y);
            await VaultForTrader.distributeReward(thetaFee, x, y, mineTo, { from: ROUTER_1 });
            const cofiBalanceOfRouter1 = await CoFi.balanceOf(ROUTER_1);
            const cofiBalanceOfVault = await CoFi.balanceOf(VaultForTrader.address);
            const densityDecayRatio = stdAmount/actual.amount;
            if (verbose) {
                console.log(`index: ${i}, cofiRate: ${cofiRate}, stdAmount: ${stdAmount}, density: ${density}, actualAmount: ${actual.amount}, cofiBalanceOfRouter1: ${cofiBalanceOfRouter1}, cofiBalanceOfVault: ${cofiBalanceOfVault}, density decay ratio: ${densityDecayRatio}`);
            }
            expect(densityDecayRatio.toString()).to.bignumber.equal("1");
        }
    });

    it("should distributeReward repeatedly and correctly by ROUTER_1 when thetaFee is 100 ether", async () => {
        const thetaFee = web3.utils.toWei('100', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const mineTo = ROUTER_1;
        
        for (let i = 0; i < 5; i++) { // for gas cost statistics
            const {cofiRate, stdAmount} = await VaultForTrader.stdMiningRateAndAmount(thetaFee);
            const density = await VaultForTrader.calcDensity(stdAmount);
            const actual = await VaultForTrader.actualMiningAmountAndDensity(thetaFee, x, y);
            await VaultForTrader.distributeReward(thetaFee, x, y, mineTo, { from: ROUTER_1 });
            const cofiBalanceOfRouter1 = await CoFi.balanceOf(ROUTER_1);
            const cofiBalanceOfVault = await CoFi.balanceOf(VaultForTrader.address);
            const densityDecayRatio = stdAmount/actual.amount;
            if (verbose) {
                console.log(`index: ${i}, cofiRate: ${cofiRate}, stdAmount: ${stdAmount}, density: ${density}, actualAmount: ${actual.amount}, cofiBalanceOfRouter1: ${cofiBalanceOfRouter1}, cofiBalanceOfVault: ${cofiBalanceOfVault}, density decay ratio: ${densityDecayRatio}`);
            }
            expect(densityDecayRatio.toString()).to.bignumber.equal("1");
        }
    });

    it("should distributeReward repeatedly and correctly by ROUTER_1 when thetaFee is large", async () => {
        const thetaFee = web3.utils.toWei('101', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const mineTo = ROUTER_1;
        
        for (let i = 0; i < 5; i++) { // for gas cost statistics
            const {cofiRate, stdAmount} = await VaultForTrader.stdMiningRateAndAmount(thetaFee);
            const density = await VaultForTrader.calcDensity(stdAmount);
            const actual = await VaultForTrader.actualMiningAmountAndDensity(thetaFee, x, y);
            await VaultForTrader.distributeReward(thetaFee, x, y, mineTo, { from: ROUTER_1 });
            const cofiBalanceOfRouter1 = await CoFi.balanceOf(ROUTER_1);
            const cofiBalanceOfVault = await CoFi.balanceOf(VaultForTrader.address);
            const densityDecayRatio = stdAmount/actual.amount;
            if (verbose) {
                console.log(`index: ${i}, cofiRate: ${cofiRate}, stdAmount: ${stdAmount}, density: ${density}, actualAmount: ${actual.amount}, cofiBalanceOfRouter1: ${cofiBalanceOfRouter1}, cofiBalanceOfVault: ${cofiBalanceOfVault}, density decay ratio: ${densityDecayRatio}`);
            }
            expect(densityDecayRatio.toString()).to.bignumber.above("1");
        }
    });

});