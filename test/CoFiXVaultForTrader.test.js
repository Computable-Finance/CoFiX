const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiXVaultForLP = artifacts.require("CoFiXVaultForLP");
const CoFiXVaultForTrader = artifacts.require("CoFiXVaultForTrader");
const TestCoFiXStakingRewards = artifacts.require("TestCoFiXStakingRewards.sol");
const CoFiToken = artifacts.require("CoFiToken");
const TestXToken = artifacts.require("TestXToken");
const CoFiXFactory = artifacts.require("CoFiXFactory");
const WETH9 = artifacts.require("WETH9");

const { calcK, convert_from_fixed_point, convert_into_fixed_point, calcRelativeDiff } = require('../lib/calc');

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const verbose = process.env.VERBOSE;

contract('CoFiXVaultForTrader', (accounts) => {
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

    const DECAY_RATE = 80;
    const INIT_COFI_RATE = web3.utils.toWei('9', 'ether');

    const DEFAULT_COFI_RATE = web3.utils.toWei('3600', 'ether');

    const THETA_FEE_UNIT = web3.utils.toWei('1', 'ether');

    const ROUTER_1 = accounts[1];
    const ROUTER_2 = accounts[2];

    // const PAIR = accounts[3];

    before(async () => {
        WETH = await WETH9.new();
        CFactory = await CoFiXFactory.new(WETH.address, { from: deployer });
        CoFi = await CoFiToken.new({ from: deployer });
        VaultForLP = await CoFiXVaultForLP.new(CoFi.address, CFactory.address, { from: deployer });
        await CFactory.setVaultForLP(VaultForLP.address);
        VaultForTrader = await CoFiXVaultForTrader.new(CoFi.address, CFactory.address, { from: deployer });
        XToken = await TestXToken.new({ from: deployer });
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

    // it("should revert if not set vaultForLP", async () => {
    //     const pair = XToken.address;
    //     const navps = web3.utils.toWei('1', 'ether'); // means navps = 1, NAVPS_BASE = 1e18
    //     await expectRevert.unspecified(VaultForTrader.currentCoFiRate(pair, navps));
    // });

    // it("should set vaultForLP correctly", async () => {
    //     await CFactory.setVaultForLP(VaultForLP.address);
    //     const vaultForLP = await CFactory.getVaultForLP();
    //     expect(vaultForLP).equal(VaultForLP.address);
    // });

    it("should addPool correctly", async () => {
        await VaultForLP.addPool(POOL_1, {from: governance});
        const poolInfo = await VaultForLP.getPoolInfo(POOL_1);
        expect(poolInfo.state).to.bignumber.equal(POOL_STATE_ENABLED);
        expect(poolInfo.weight).to.bignumber.equal("0");
    });

    it("should have correct stats before anything", async () => {
        const cofi = await VaultForTrader.cofiToken();
        expect(CoFi.address).equal(cofi);

        
        const pair = XToken.address;
        const navps = web3.utils.toWei('1', 'ether'); // means navps = 1, NAVPS_BASE = 1e18
        const currentCoFiRate = await VaultForTrader.currentCoFiRate(pair, navps);

        expect("0").to.bignumber.equal(currentCoFiRate); // pool rate is zero

        const thetaFee = web3.utils.toWei('1', 'ether');
        const {cofiRate, stdAmount} = await VaultForTrader.stdMiningRateAndAmount(pair, navps, thetaFee);
        expect(cofiRate).to.bignumber.equal(currentCoFiRate);
        const expectedAmount = (new BN(thetaFee)).mul(new BN(currentCoFiRate)).div(new BN(THETA_FEE_UNIT));
        expect(expectedAmount).to.bignumber.equal(stdAmount);
    });

    it("should calcLambda correctly", async () => {
        // 0.25 0.5 1 2 4
        // old: 50, 75, 100, 133, 200
        // new: 25, 50, 100, 200, 400
        const input = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 10, y: 1 }, { x: 300, y: 30 },
                { x: 300, y: 100 }, { x: 300, y: 900 }, { x: 300, y: 910 }, { x: 300, y: 3000 },
                { x: 300, y: 30001 }, { x: 0, y: 1 }];
        const expectedLambda = ["25", "25", "25", "25",
                             "50", "100", "200", "200",
                             "400", "400"];
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

    it("should calcCoFiRate correctly", async () => {
        // at = (bt/q)*2400000/(xt*np*0.3)
        // - at is CoFi yield per unit
        // - bt is the current CoFi rate of the specific XToken staking rewards pool
        // - xt is totalSupply of the specific XToken
        // - np is Net Asset Value Per Share for the specific XToken
        // - q is the total count of the XToken staking rewards pools
        // const bt = web3.utils.toWei('10', 'ether');
        // const xt = web3.utils.toWei('10000', 'ether');
        // const np = web3.utils.toWei('1', 'ether');
        // const q = 1;

        // const input = [
        //     {bt: web3.utils.toWei('10', 'ether'), xt: web3.utils.toWei('10000', 'ether'), np: web3.utils.toWei('1', 'ether'), q: 1},
        //     {bt: web3.utils.toWei('10', 'ether'), xt: web3.utils.toWei('10000', 'ether'), np: web3.utils.toWei('1', 'ether'), q: 0},
        //     {bt: web3.utils.toWei('10', 'ether'), xt: web3.utils.toWei('20000', 'ether'), np: web3.utils.toWei('1', 'ether'), q: 1},
        //     {bt: web3.utils.toWei('10', 'ether'), xt: web3.utils.toWei('40000', 'ether'), np: web3.utils.toWei('1', 'ether'), q: 1},
        //     {bt: web3.utils.toWei('5', 'ether'), xt: web3.utils.toWei('10000', 'ether'), np: web3.utils.toWei('1', 'ether'), q: 0}
        // ]

        const input = [
            {bt_phi: web3.utils.toWei('10', 'ether'), xt: web3.utils.toWei('10000', 'ether'), np: web3.utils.toWei('1', 'ether')},
            {bt_phi: web3.utils.toWei('9', 'ether'), xt: web3.utils.toWei('20000', 'ether'), np: web3.utils.toWei('1', 'ether')},
            {bt_phi: web3.utils.toWei('10', 'ether'), xt: web3.utils.toWei('40000', 'ether'), np: web3.utils.toWei('1', 'ether')},
            {bt_phi: web3.utils.toWei('5', 'ether'), xt: web3.utils.toWei('10000', 'ether'), np: web3.utils.toWei('1', 'ether')}
        ]

        const expectedCoFiRate = [
            web3.utils.toWei('4000', 'ether'),
            web3.utils.toWei('3600', 'ether'),
            web3.utils.toWei('2000', 'ether'),
            web3.utils.toWei('2000', 'ether')
        ]
        expect(input.length).equal(expectedCoFiRate.length);
        for (let i = 0; i < input.length; i++) {
            const param = input[i];
            const cofiRate = await VaultForTrader.calcCoFiRate(param.bt_phi, param.xt, param.np);
            if (verbose) {
                console.log(`bt_phi: ${param.bt_phi}, xt: ${param.xt}, np: ${param.np}, index: ${i}, cofiRate: ${cofiRate}, expectedCoFiRate: ${expectedCoFiRate[i]}`);
            }
            expect(expectedCoFiRate[i]).to.bignumber.equal(cofiRate);
        }
    });

    it("should calc currentThreshold correctly for different XToken", async () => {
        
        // function currentThreshold(address pair, uint256 np, uint256 cofiRate)
        // th = L * theta * at
        // L = xt * np / 1000
        // - xt is totalSupply of the specific XToken
        // - np is Net Asset Value Per Share for the specific XToken
        const pair1 = XToken.address; // totalSupply is zero

        const XToken2 = await TestXToken.new({ from: deployer });
        await XToken2.mint(deployer, web3.utils.toWei('50000', 'ether'), { from: deployer });
        const pair2 = XToken2.address;

        const XToken3 = await TestXToken.new({ from: deployer });
        await XToken3.mint(deployer, web3.utils.toWei('200000', 'ether'), { from: deployer });
        const pair3 = XToken3.address;

        const input = [
            {pair: pair1, np: web3.utils.toWei('1', 'ether'), cofiRate: web3.utils.toWei('3600', 'ether')}, // 9/1 * 2400000 / (20000 * 1 * 0.3) = 3600
            {pair: pair2, np: web3.utils.toWei('1', 'ether'), cofiRate: web3.utils.toWei('3600', 'ether')}, // 9/1 * 2400000 / (20000 * 1 * 0.3) = 3600
            {pair: pair3, np: web3.utils.toWei('1', 'ether'), cofiRate: web3.utils.toWei('3600', 'ether')}, // 9/1 * 2400000 / (20000 * 1 * 0.3) = 3600
            {pair: pair2, np: web3.utils.toWei('2', 'ether'), cofiRate: web3.utils.toWei('3600', 'ether')}, // 9/1 * 2400000 / (20000 * 1 * 0.3) = 3600
        ]
        const expectedTH = [
            web3.utils.toWei('720', 'ether'), // 100*1e18*0.002*3600*1e18/1e18=720ether
            web3.utils.toWei('720', 'ether'), // 50000ether*2/1000=100ether
            web3.utils.toWei('2880', 'ether'), // 200000*1e18*2/1000*0.002*3600*1e18/1e18
            web3.utils.toWei('1440', 'ether') // np=2
        ]
        expect(input.length).equal(expectedTH.length);
        for (let i = 0; i < input.length; i++) {
            const param = input[i];
            const threshold = await VaultForTrader.currentThreshold(param.pair, param.np, param.cofiRate);
            if (verbose) {
                console.log(`pair: ${param.pair}, np: ${param.np}, cofiRate: ${param.cofiRate}, threshold: ${threshold}, expectedTH: ${expectedTH[i]}`);
            }
            expect(expectedTH[i]).to.bignumber.equal(threshold);
        }
    });

    it("should setWeight correctly", async () => {
        const weight = "100";
        await VaultForLP.setPoolWeight(POOL_1, weight);
        const poolInfo = await VaultForLP.getPoolInfo(POOL_1);
        expect(poolInfo.weight).to.bignumber.equal(weight);
    });

    it("should have correct current stats before anything", async () => {
        const pair = XToken.address;
        const navps = web3.utils.toWei('1', 'ether'); // means navps = 1, NAVPS_BASE = 1e18
        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const actualMiningAmountAndDensity = await VaultForTrader.actualMiningAmountAndDensity(pair, thetaFee, x, y, navps);
        if (verbose) {
            console.log(`actualMiningAmount: ${actualMiningAmountAndDensity.amount}, density: ${actualMiningAmountAndDensity.density}`);
        }
        const expectedAmount = DEFAULT_COFI_RATE*thetaFee/THETA_FEE_UNIT; // 4000 * 0.01 = 40
        expect(actualMiningAmountAndDensity.amount).to.bignumber.equal(expectedAmount.toString());
        // // uint256 ms = singleLimitM.mul(s).div(S_BASE); 50000*1e18*24/1e8=1.2E16
        // // go into Q >= ms branch
        // // O_T.mul(ms).mul(Q.mul(2).sub(ms)).mul(lambda).div(Q).div(Q);
        // // O_T * m * s * (2Q - m*s) * lambda / Q / Q
        // // (10*1E18) * (1.2E16) * (2*(10*1E18) - 1.2E16) * 1 / (10*1e18) / (10*1e18) = 2.39856E16
        // const expectedActualAmount = (10*1E18) * (1.2E16) * (2*(10*1E18) - 1.2E16) * 1 / (10*1e18) / (10*1e18);
    });

    it("should revert if not set VaultForTrader as minter of CoFi", async () => {
        const thetaFee = web3.utils.toWei('1', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const navps = web3.utils.toWei('1', 'ether'); // means navps = 1, NAVPS_BASE = 1e18
        const rewardTo = ROUTER_1;
        // address pair,
        // uint256 thetaFee,
        // uint256 x,
        // uint256 y,
        // uint256 np,
        // address rewardTo
        await expectRevert(VaultForTrader.distributeReward(PAIR, thetaFee, x, y, navps, rewardTo, { from: ROUTER_1 }), "CoFi: !minter");
    });

    it("should add VaultForTrader as minter of CoFi correctly", async () => {
        const receipt = await CoFi.addMinter(VaultForTrader.address, {from: governance});
        expectEvent(receipt, "MinterAdded", {_minter: VaultForTrader.address});
        const allowed = await CoFi.minters(VaultForTrader.address);
        expect(allowed).equal(true);
    });

    it("should revert if distributeReward by NON ROUTER_1", async () => {
        const thetaFee = web3.utils.toWei('1', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const navps = web3.utils.toWei('1', 'ether'); // means navps = 1, NAVPS_BASE = 1e18
        const rewardTo = ROUTER_2;
        await expectRevert(VaultForTrader.distributeReward(PAIR, thetaFee, x, y, navps, rewardTo, { from: ROUTER_2 }), "CVaultForTrader: not allowed router");
    });

    it("should distributeReward correctly by ROUTER_1", async () => {
        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const navps = web3.utils.toWei('1', 'ether'); // means navps = 1, NAVPS_BASE = 1e18
        const rewardTo = ROUTER_1;

        const actualMiningAmountAndDensity = await VaultForTrader.actualMiningAmountAndDensity(PAIR, thetaFee, x, y, navps);
        if (verbose) {
            console.log(`actualMiningAmount: ${actualMiningAmountAndDensity.amount}, density: ${actualMiningAmountAndDensity.density}`);
        }

        await VaultForTrader.distributeReward(PAIR, thetaFee, x, y, navps, rewardTo, { from: ROUTER_1 });
        const cofiBalanceOfRouter1 = await CoFi.balanceOf(ROUTER_1);
        if (verbose) {
            console.log(`cofiBalanceOfRouter1: ${cofiBalanceOfRouter1}`);
        }
        const expectedAmount = DEFAULT_COFI_RATE*thetaFee/THETA_FEE_UNIT;
        const expectedReward = (new BN(expectedAmount.toString())).mul(new BN("80")).div(new BN("100"));
        expect(cofiBalanceOfRouter1).to.bignumber.equal(expectedReward);
    });

    it("should distributeReward repeatedly and correctly by ROUTER_1", async () => {
        const thetaFee = web3.utils.toWei('0.01', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const rewardTo = ROUTER_1;
        const navps = web3.utils.toWei('1', 'ether'); // means navps = 1, NAVPS_BASE = 1e18
        
        for (let i = 0; i < 5; i++) { // for gas cost statistics
            const {cofiRate, stdAmount} = await VaultForTrader.stdMiningRateAndAmount(PAIR, navps, thetaFee);
            const density = await VaultForTrader.calcDensity(stdAmount);
            const actual = await VaultForTrader.actualMiningAmountAndDensity(PAIR, thetaFee, x, y, navps);
            await VaultForTrader.distributeReward(PAIR, thetaFee, x, y, navps, rewardTo, { from: ROUTER_1 });
            const cofiBalanceOfRouter1 = await CoFi.balanceOf(ROUTER_1);
            const cofiBalanceOfVault = await CoFi.balanceOf(VaultForTrader.address);
            const densityDecayRatio = stdAmount/actual.amount;
            if (verbose) {
                console.log(`index: ${i}, cofiRate: ${cofiRate}, stdAmount: ${stdAmount}, density: ${density}, actualAmount: ${actual.amount}, cofiBalanceOfRouter1: ${cofiBalanceOfRouter1}, cofiBalanceOfVault: ${cofiBalanceOfVault}, density decay ratio: ${densityDecayRatio}`);
            }
            expect(densityDecayRatio.toString()).to.bignumber.equal("1");
        }
    });

    it("should distributeReward repeatedly and correctly by ROUTER_1 when thetaFee is 0.2 ether", async () => {
        const thetaFee = web3.utils.toWei('0.2', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const rewardTo = ROUTER_1;
        const navps = web3.utils.toWei('1', 'ether'); // means navps = 1, NAVPS_BASE = 1e18
        
        for (let i = 0; i < 5; i++) { // for gas cost statistics
            const {cofiRate, stdAmount} = await VaultForTrader.stdMiningRateAndAmount(PAIR, navps, thetaFee);
            const density = await VaultForTrader.calcDensity(stdAmount);
            const actual = await VaultForTrader.actualMiningAmountAndDensity(PAIR, thetaFee, x, y, navps);
            await VaultForTrader.distributeReward(PAIR, thetaFee, x, y, navps, rewardTo, { from: ROUTER_1 });
            const cofiBalanceOfRouter1 = await CoFi.balanceOf(ROUTER_1);
            const cofiBalanceOfVault = await CoFi.balanceOf(VaultForTrader.address);
            const densityDecayRatio = stdAmount/actual.amount;
            if (verbose) {
                console.log(`index: ${i}, cofiRate: ${cofiRate}, stdAmount: ${stdAmount}, density: ${density}, actualAmount: ${actual.amount}, cofiBalanceOfRouter1: ${cofiBalanceOfRouter1}, cofiBalanceOfVault: ${cofiBalanceOfVault}, density decay ratio: ${densityDecayRatio}`);
            }
            expect(densityDecayRatio.toString()).to.bignumber.above("1");
        }
    });

    it("should distributeReward repeatedly and correctly by ROUTER_1 when thetaFee is large", async () => {
        const thetaFee = web3.utils.toWei('100', 'ether');
        const x = web3.utils.toWei('10000', 'ether');
        const y = web3.utils.toWei('10000', 'ether');
        const rewardTo = ROUTER_1;
        const navps = web3.utils.toWei('1', 'ether'); // means navps = 1, NAVPS_BASE = 1e18
        
        for (let i = 0; i < 5; i++) { // for gas cost statistics
            const {cofiRate, stdAmount} = await VaultForTrader.stdMiningRateAndAmount(PAIR, navps, thetaFee);
            const density = await VaultForTrader.calcDensity(stdAmount);
            const actual = await VaultForTrader.actualMiningAmountAndDensity(PAIR, thetaFee, x, y, navps);
            await VaultForTrader.distributeReward(PAIR, thetaFee, x, y, navps, rewardTo, { from: ROUTER_1 });
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