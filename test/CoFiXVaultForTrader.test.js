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

        const initialSupply = await VaultForTrader.INIT_SUPPLY();
        expect(initialSupply).to.bignumber.equal(HalfSupplyOfCoFi);

        const currentPeriod = await VaultForTrader.currentPeriod();
        expect(currentPeriod).to.bignumber.equal("0");

        const currentDecay = await VaultForTrader.currentDecay();
        const cDecay = convert_from_fixed_point(currentDecay);

        expect(cDecay.toString()).to.bignumber.equal("1");
        const currentCoFiRate = await VaultForTrader.currentCoFiRate();
        expect(INIT_COFI_RATE).to.bignumber.equal(currentCoFiRate);

        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const stdMiningAmount = await VaultForTrader.stdMiningAmount(thetaFee);
        const expectedAmount = (new BN(thetaFee)).mul(new BN(currentCoFiRate)).div(new BN(THETA_FEE_UNIT));
        expect(expectedAmount).to.bignumber.equal(stdMiningAmount);

        const recentYield = await VaultForTrader.recentYield();
        expect(recentYield).to.bignumber.equal("0");
        if (verbose) {
            console.log(`recentYield: ${recentYield}`);
        }
    });

    it("should calcLambda correctly", async () => {
        // let x = 0;
        // let y = 0;
        // let lamda = await VaultForTrader.calcLambda(x, y);
        // expect(lamda).to.bignumber.equal("50");

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
        const currentCoFiLeft = await VaultForTrader.currentCoFiLeft();
        const currentCoFiMined = await VaultForTrader.currentCoFiMined();
        const currentS = await VaultForTrader.currentS();
        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const actualMiningAmount = await VaultForTrader.actualMiningAmount(thetaFee, x, y);
        if (verbose) {
            console.log(`currentCoFiLeft: ${currentCoFiLeft}, currentCoFiMined: ${currentCoFiMined}, currentS: ${currentS}, actualMiningAmount: ${actualMiningAmount}`);
        }
        expect(currentCoFiLeft).to.bignumber.equal("0");
        expect(currentCoFiMined).to.bignumber.equal(HalfSupplyOfCoFi);
        expect(currentS).to.bignumber.equal("24");
        // uint256 ms = singleLimitM.mul(s).div(S_BASE); 50000*1e18*24/1e8=1.2E16
        // go into Q >= ms branch
        // O_T.mul(ms).mul(Q.mul(2).sub(ms)).mul(lambda).div(Q).div(Q);
        // O_T * m * s * (2Q - m*s) * lambda / Q / Q
        // (10*1E18) * (1.2E16) * (2*(10*1E18) - 1.2E16) * 1 / (10*1e18) / (10*1e18) = 2.39856E16
        const expectedActualAmount = (10*1E18) * (1.2E16) * (2*(10*1E18) - 1.2E16) * 1 / (10*1e18) / (10*1e18);
        expect(actualMiningAmount).to.bignumber.equal(expectedActualAmount.toString());
    });

    it("should have correct current stats after sending in enough CoFi", async () => {
        await CoFi.transfer(VaultForTrader.address, HalfSupplyOfCoFi, {from: deployer});
        const balance = await CoFi.balanceOf(VaultForTrader.address);
        expect(balance).to.bignumber.equal(HalfSupplyOfCoFi);
        const currentCoFiLeft = await VaultForTrader.currentCoFiLeft();
        const currentCoFiMined = await VaultForTrader.currentCoFiMined();
        const currentS = await VaultForTrader.currentS();
        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const actualMiningAmount = await VaultForTrader.actualMiningAmount(thetaFee, x, y);
        if (verbose) {
            console.log(`currentCoFiLeft: ${currentCoFiLeft}, currentCoFiMined: ${currentCoFiMined}, currentS: ${currentS}, actualMiningAmount: ${actualMiningAmount}`);
        }
        expect(currentCoFiLeft).to.bignumber.equal(HalfSupplyOfCoFi);
        expect(currentCoFiMined).to.bignumber.equal("0");
        expect(currentS).to.bignumber.equal((1e8).toString()); // 1 * 1e8
        expect(actualMiningAmount).to.bignumber.equal(INIT_COFI_RATE);
    });

    it("should revert if distributeTradingReward by NON ROUTER_1", async () => {
        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const mineTo = ROUTER_2;
        await expectRevert(VaultForTrader.distributeTradingReward(thetaFee, x, y, mineTo, { from: ROUTER_2 }), "CVaultForTrader: not allowed router");
    });

    it("should distributeTradingReward correctly by ROUTER_1", async () => {
        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const mineTo = ROUTER_1;
        await VaultForTrader.distributeTradingReward(thetaFee, x, y, mineTo, { from: ROUTER_1 });
        const cofiBalanceOfRouter1 = await CoFi.balanceOf(ROUTER_1);
        const cofiBalanceOfVault = await CoFi.balanceOf(VaultForTrader.address);
        if (verbose) {
            console.log(`cofiBalanceOfRouter1: ${cofiBalanceOfRouter1}, cofiBalanceOfVault: ${cofiBalanceOfVault}`);
        }
        const expectedReward = INIT_COFI_RATE;
        expect(cofiBalanceOfRouter1).to.bignumber.equal(expectedReward);
        expect(cofiBalanceOfVault).to.bignumber.equal((new BN(HalfSupplyOfCoFi)).sub(new BN(cofiBalanceOfRouter1)));
    });

    it("should distributeTradingReward repeatedly and correctly by ROUTER_1", async () => {
        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const mineTo = ROUTER_1;
        
        for (let i = 0; i < 5; i++) {
            await VaultForTrader.distributeTradingReward(thetaFee, x, y, mineTo, { from: ROUTER_1 });
            const cofiBalanceOfRouter1 = await CoFi.balanceOf(ROUTER_1);
            const cofiBalanceOfVault = await CoFi.balanceOf(VaultForTrader.address);
            if (verbose) {
                console.log(`index: ${i}, cofiBalanceOfRouter1: ${cofiBalanceOfRouter1}, cofiBalanceOfVault: ${cofiBalanceOfVault}`);
            }
        }
    });

});