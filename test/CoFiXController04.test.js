const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time, balance } = require('@openzeppelin/test-helpers');
const { calcK, convert_from_fixed_point, convert_into_fixed_point, calcRelativeDiff } = require('../lib/calc');
const { printKInfoEvent } = require('../lib/print');

const ERC20 = artifacts.require("TestERC20");
const CoFiXController = artifacts.require("CoFiXController04");
const NESTPriceOracleMock = artifacts.require("mock/NEST36PriceOracleMock");
const NESTPriceOracleConstMock = artifacts.require("NEST36PriceOracleConstMock");
const TestUSDT = artifacts.require("test/USDT");
const TestNEST = artifacts.require("test/NEST");
const CoFiXFactory = artifacts.require("CoFiXFactory");
const CoFiXKTable = artifacts.require("CoFiXKTable");
const WETH9 = artifacts.require("WETH9");
const verbose = process.env.VERBOSE;

const errorDelta = 10 ** -15;
const ERROR_DELTA_FOR_IMPACT_COST = 10 ** -5;

contract('CoFiXController04', (accounts) => {

  const deployer = accounts[0];
  const callerNotAllowed = accounts[1];
  const oldGovernance = deployer;
  const newGovernance = accounts[2];

  let CoFiXCtrl;
  let Oracle;
  let Token

  const alpha = 0.0047021;
  const beta_one = 13783.9757;
  const beta_two = 2.446 * 10 ** (-5);
  const theta = 0.002;
  const max_k = 0.1;
  const min_k = 0.005;
  const max_k0 = 0.05;
  const block_time = 14;
  const usdt_cgamma = 1;
  const nest_cgamma = 20;
  // const vola = new BN("10393072026373223");
  const vola = new BN("592390136");

  const DESTRUCTION_AMOUNT = web3.utils.toWei('0', 'ether');

  before(async function () {
    Token = await TestUSDT.new();
    NEST = await TestNEST.new();
    WETH = await WETH9.new();
    CFactory = await CoFiXFactory.new(WETH.address, { from: deployer });
    // CFactory = await CoFiXFactory.deployed(); // no need to deploy a new one here
    Oracle = await NESTPriceOracleMock.new(NEST.address, { from: deployer });
    KTable = await CoFiXKTable.new({ from: deployer });
    CoFiXCtrl = await CoFiXController.new(Oracle.address, NEST.address, CFactory.address, KTable.address, { from: deployer });
  });

  describe('activate', function () {
    let _msgValue = web3.utils.toWei('0.01', 'ether');

    it("should revert if not activated", async () => {
      // add caller
      await CoFiXCtrl.addCaller(deployer, { from: deployer });
      // await expectRevert(CoFiXCtrl.queryOracle(Token.address, "0", deployer, { from: deployer, value: _msgValue }), "oracleMock: not activeted yet");
    });

    // it("should activate nest oracle correctly", async () => {
    //   await NEST.approve(CoFiXCtrl.address, DESTRUCTION_AMOUNT);
    //   await Oracle.activate(CoFiXCtrl.address);
    //   await time.increase(time.duration.minutes(1)); // increase time to make activation be effective
    // });

    // it("should activate again correctly by governance", async () => {
    //   await NEST.approve(CoFiXCtrl.address, DESTRUCTION_AMOUNT);
    //   await Oracle.activate(CoFiXCtrl.address);
    //   await time.increase(time.duration.minutes(1)); // increase time to make activation be effective
    // });
  });

  describe('test queryOracle & k calculation', function () {
    let _msgValue;
    let constOracle;
    let tmpController;

    let ethAmount = new BN("10000000000000000000");
    let tokenPrice = new BN("386260000");
    let avg = new BN("396260000");

    before(async function () {
      _msgValue = web3.utils.toWei('0.01', 'ether');
      // tmpCFactory = await CoFiXFactory.deployed();
      let WETH = await WETH9.new();
      tmpCFactory = await CoFiXFactory.new(WETH.address, { from: deployer });
      constOracle = await NESTPriceOracleConstMock.new(NEST.address, { from: deployer });
      tmpController = await CoFiXController.new(constOracle.address, NEST.address, tmpCFactory.address, KTable.address, { from: deployer });
      // tmpController.initialize(constOracle.address, { from: deployer });
    });

    it('should calculate k correctly for constant price', async function () {
      for (let i = 0; i < 50; i++) {
        await time.advanceBlock();
      }
      await constOracle.feedPrice(Token.address, tokenPrice, tokenPrice, avg, vola,  { from: deployer });

      // add caller
      await tmpController.addCaller(deployer, { from: deployer });

      let result = await tmpController.queryOracle(Token.address, "0", deployer, { from: deployer, value: _msgValue });
      console.log("queryOracle> receipt.gasUsed:", result.receipt.gasUsed);

      let kInfo = await tmpController.getKInfo(Token.address);
      console.log(kInfo.k.toString());
      // let evtArgs0 = result.receipt.logs[0].args;
      // printKInfoEvent(evtArgs0);
      // expect(evtArgs0.sigma).to.bignumber.equal(new BN(0)); // sigma should be zero because we returned constant price
      // expect(evtArgs0.T).to.bignumber.equal(new BN(42)); // sigma should be zero because we returned constant price
      // k calculated from contract
      // evtArgs0.K.toNumber() / 
      // k for constant price, T = 28
      // let kExpected = calcK(alpha, beta_one, beta_two, theta, evtArgs0.sigma.toNumber(), evtArgs0.T.toNumber());
      // disable because we use constant k now
      // let kExpected = calcK(convert_from_fixed_point(evtArgs0.K0), evtArgs0.sigma.toNumber(), evtArgs0.T.toNumber());
      // let kActual = convert_from_fixed_point(evtArgs0.K);
      // // let error = Math.abs((kActual - kExpected) / kExpected);
      // let error = calcRelativeDiff(kExpected, kActual);
      // console.log(`kExpected: ${kExpected}, kActual:${kActual}, error:${error}`);
      // assert.isAtMost(error.toNumber(), errorDelta);

      // should revert if no enough oracle fee

    });

    it("should revert if no new price feeded for a specific time", async () => {
      await constOracle.feedPrice(Token.address, tokenPrice, tokenPrice, avg, vola, { from: deployer });
      // k = alpha + beta_one * sigma^2 + beta_two*T
      // (max_k - (alpha))/beta_two
      // let max_interval_block = (max_k - (alpha))/beta_two/block_time;
      let max_interval_block = 600 / block_time;
      console.log(`max_interval_block=${max_interval_block}`)
      for (let i = 0; i < max_interval_block - 3; i++) {
        await time.advanceBlock();
      }
      let result = await tmpController.queryOracle(Token.address, "0", deployer, { from: deployer, value: _msgValue });
      console.log("queryOracle> receipt.gasUsed:", result.receipt.gasUsed);
      let kInfo = await tmpController.getKInfo(Token.address);
      console.log(kInfo.k);
      if (result.receipt.logs[0]) {
        let evtArgs0 = result.receipt.logs[0].args;
        printKInfoEvent(evtArgs0);
      }

      await time.increase(time.duration.minutes(5)); // increase time to make activation be effective
      // await expectRevert(tmpController.queryOracle(Token.address, deployer, { from: deployer, value: _msgValue }), "CoFiXCtrl: K");
      await expectRevert.unspecified(tmpController.queryOracle(Token.address, "0", deployer, { from: deployer, value: _msgValue }));
    });

    it("should revert if someone not allowed calling queryOracle", async () => {
      await constOracle.feedPrice(Token.address, tokenPrice, tokenPrice, avg, vola, { from: deployer });
      await expectRevert(tmpController.queryOracle(Token.address, "0", deployer, { from: callerNotAllowed, value: _msgValue }), "CoFiXCtrl: caller not allowed");
    });
  });


  describe('setGovernance', function () {
    it("should setGovernance correctly", async () => {
      await CoFiXCtrl.setGovernance(newGovernance, { from: oldGovernance });
      let newG = await CoFiXCtrl.governance();
      expect(newG).to.equal(newGovernance);
    });

    it("should revert if oldGovernance call setGovernance", async () => {
      await expectRevert(CoFiXCtrl.setGovernance(oldGovernance, { from: oldGovernance }), "CoFiXCtrl: !governance");
    });

    it("should setGovernance correctly by newGovernance", async () => {
      await CoFiXCtrl.setGovernance(newGovernance, { from: newGovernance });
      let newG = await CoFiXCtrl.governance();
      expect(newG).to.equal(newGovernance);
    });

    it("should addCaller correctly by newGovernance", async () => {
      await CoFiXCtrl.addCaller(newGovernance, { from: newGovernance });
    });

    it("should revert if oldGovernance call addCaller", async () => {
      await expectRevert(CoFiXCtrl.addCaller(oldGovernance, { from: oldGovernance }), "CoFiXCtrl: only factory");
    });
  });

  describe('impact cost', function () {

    it("should impactCostForBuyInETH correctly for vol < 500 Ether", async () => {
      const vol = web3.utils.toWei('499', 'ether');
      const impactCost = await CoFiXCtrl.impactCostForBuyInETH(vol);
      expect(impactCost).to.bignumber.equal("0");
    });

    it("should impactCostForSellOutETH correctly for vol < 500 Ether", async () => {
      const vol = web3.utils.toWei('499', 'ether');
      const impactCost = await CoFiXCtrl.impactCostForSellOutETH(vol);
      expect(impactCost).to.bignumber.equal("0");
    });

    function impactCostForBuyInETH(volAmount) {
      const alpha = 2.570e-05;
      const beta = 8.542e-07;
      const expectedImpactCost = alpha + beta * volAmount;
      return expectedImpactCost;
    }

    function impactCostForSellOutETH(volAmount) {
      const alpha = -1.171e-04;
      const beta = 8.386e-07;
      const expectedImpactCost = alpha + beta * volAmount;
      return expectedImpactCost;
    }    

    it("should impactCostForBuyInETH correctly for vol = 500 Ether", async () => {
      const volAmount = "500";
      const vol = web3.utils.toWei('500', 'ether');
      const impactCost = await CoFiXCtrl.impactCostForBuyInETH(vol);
      const expectedImpactCost = impactCostForBuyInETH(volAmount);
      const actualImpactCost = impactCost/1e8;
      const error = calcRelativeDiff(expectedImpactCost.toString(), actualImpactCost.toString());
      if (verbose) {
        console.log(`volAmount: ${volAmount} Ether, expectedImpactCost: ${expectedImpactCost}, actualImpactCost: ${actualImpactCost}, error:${error}`);
      }
      assert.isAtMost(error.toNumber(), ERROR_DELTA_FOR_IMPACT_COST);
    });

    it("should impactCostForBuyInETH correctly for vol = 501 Ether", async () => {
      const volAmount = "501";
      const vol = web3.utils.toWei('501', 'ether');
      const impactCost = await CoFiXCtrl.impactCostForBuyInETH(vol);
      const expectedImpactCost = impactCostForBuyInETH(volAmount);
      const actualImpactCost = impactCost/1e8;
      const error = calcRelativeDiff(expectedImpactCost.toString(), actualImpactCost.toString());
      if (verbose) {
        console.log(`volAmount: ${volAmount} Ether, expectedImpactCost: ${expectedImpactCost}, actualImpactCost: ${actualImpactCost}, error:${error}`);
      }
      assert.isAtMost(error.toNumber(), ERROR_DELTA_FOR_IMPACT_COST);
    });

    it("should impactCostForBuyInETH correctly for vol = 5000 Ether", async () => {
      const volAmount = "5000";
      const vol = web3.utils.toWei('5000', 'ether');
      const impactCost = await CoFiXCtrl.impactCostForBuyInETH(vol);
      const expectedImpactCost = impactCostForBuyInETH(volAmount);
      const actualImpactCost = impactCost/1e8;
      const error = calcRelativeDiff(expectedImpactCost.toString(), actualImpactCost.toString());
      if (verbose) {
        console.log(`volAmount: ${volAmount} Ether, expectedImpactCost: ${expectedImpactCost}, actualImpactCost: ${actualImpactCost}, error:${error}`);
      }
      assert.isAtMost(error.toNumber(), ERROR_DELTA_FOR_IMPACT_COST);
    });

    it("should impactCostForSellOutETH correctly for vol = 500 Ether", async () => {
      const volAmount = "500";
      const vol = web3.utils.toWei('500', 'ether');
      const impactCost = await CoFiXCtrl.impactCostForSellOutETH(vol);
      const expectedImpactCost = impactCostForSellOutETH(volAmount);
      const actualImpactCost = impactCost/1e8;
      const error = calcRelativeDiff(expectedImpactCost.toString(), actualImpactCost.toString());
      if (verbose) {
        console.log(`volAmount: ${volAmount} Ether, expectedImpactCost: ${expectedImpactCost}, actualImpactCost: ${actualImpactCost}, error:${error}`);
      }
      assert.isAtMost(error.toNumber(), ERROR_DELTA_FOR_IMPACT_COST);
    });

    it("should impactCostForSellOutETH correctly for vol = 5000 Ether", async () => {
      const volAmount = "5000";
      const vol = web3.utils.toWei('5000', 'ether');
      const impactCost = await CoFiXCtrl.impactCostForSellOutETH(vol);
      const expectedImpactCost = impactCostForSellOutETH(volAmount);
      const actualImpactCost = impactCost/1e8;
      const error = calcRelativeDiff(expectedImpactCost.toString(), actualImpactCost.toString());
      if (verbose) {
        console.log(`volAmount: ${volAmount} Ether, expectedImpactCost: ${expectedImpactCost}, actualImpactCost: ${actualImpactCost}, error:${error}`);
      }
      assert.isAtMost(error.toNumber(), ERROR_DELTA_FOR_IMPACT_COST);
    });

  });

  // move to the end to avoid unknown errors in coverage test
  describe('queryOracle', function () {
    let _msgValue = web3.utils.toWei('0.01', 'ether');

    // it("should revert if not price available", async () => {
      // await expectRevert(CoFiXCtrl.queryOracle(Token.address, "0", deployer, { from: deployer, value: _msgValue }), "oracleMock: num too large");
    // });

    it("should revert if no enough oracle fee provided", async () => {
      await expectRevert(CoFiXCtrl.queryOracle(Token.address, "0", deployer, { from: deployer, value: web3.utils.toWei('0.009', 'ether') }), "oracleMock: insufficient oracle fee");
    });
  });

  const the_governance = deployer;
  const non_governance = accounts[3];

  describe('many setters', function () {
    let tmpCtrl;
    before(async function () {
      let WETH = await WETH9.new();
      let tmpCFactory = await CoFiXFactory.new(WETH.address, { from: deployer });
      let constOracle = await NESTPriceOracleConstMock.new(NEST.address, { from: deployer });
      tmpCtrl = await CoFiXController.new(constOracle.address, NEST.address, tmpCFactory.address, KTable.address, { from: deployer });
    });


    // setTimespan(uint256 _timeSpan)
    it("should setTimespan correctly", async () => {
      const newTimespan = new BN(10);
      await tmpCtrl.setTimespan(10, { from: the_governance });
      const timeSpan = await tmpCtrl.timespan();
      expect(timeSpan).to.bignumber.equal(newTimespan);
      await expectRevert(tmpCtrl.setTimespan(10, { from: non_governance }), "CoFiXCtrl: !governance");
    });

    // setKRefreshInterval(uint256 _interval)
    it("should setKRefreshInterval correctly", async () => {
      const interval = new BN(100);
      await tmpCtrl.setKRefreshInterval(interval, { from: the_governance });
      const newInterval = await tmpCtrl.kRefreshInterval();
      expect(newInterval).to.bignumber.equal(interval);
      await expectRevert(tmpCtrl.setKRefreshInterval(interval, { from: non_governance }), "CoFiXCtrl: !governance");
    });

    // setOracleDestructionAmount(uint256 _amount)
    it("should setOracleDestructionAmount correctly", async () => {
      const amount = new BN(100);
      await tmpCtrl.setOracleDestructionAmount(amount, { from: the_governance });
      const newAmount = await tmpCtrl.DESTRUCTION_AMOUNT();
      expect(newAmount).to.bignumber.equal(amount);
      await expectRevert(tmpCtrl.setOracleDestructionAmount(amount, { from: non_governance }), "CoFiXCtrl: !governance");
    });

    // setTheta(address token, uint32 theta)
    it("should setTheta correctly", async () => {
      const token = constants.ZERO_ADDRESS;
      const theta = new BN(100);
      await tmpCtrl.setTheta(token, theta, { from: the_governance });
      const kInfo = await tmpCtrl.getKInfo(token);
      expect(kInfo.theta).to.bignumber.equal(theta);
      await expectRevert(tmpCtrl.setTheta(token, theta, { from: non_governance }), "CoFiXCtrl: !governance");
    });

  });
});
