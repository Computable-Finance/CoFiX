const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time, balance } = require('@openzeppelin/test-helpers');
const { calcK, convert_from_fixed_point, convert_into_fixed_point, calcRelativeDiff } = require('../lib/calc');
const { printKInfoEvent } = require('../lib/print');

const ERC20 = artifacts.require("ERC20");
const CofiXController = artifacts.require("CofiXController");
const NEST3PriceOracleMock = artifacts.require("NEST3PriceOracleMock");
const NEST3PriceOracleConstMock = artifacts.require("NEST3PriceOracleConstMock");
const TestUSDT = artifacts.require("test/USDT");
const TestNEST = artifacts.require("test/NEST");
const CofiXFactory = artifacts.require("CofiXFactory");

const errorDelta = 10 ** -15;

contract('CofiXController', (accounts) => {

  const deployer = accounts[0];
  const callerNotAllowed = accounts[1];

  let CofiXCtrl;
  let Oracle;
  let Token

  const alpha = 0.0047021;
  const beta_one = 13783.9757;
  const beta_two = 2.446 * 10 ** (-5);
  const theta = 0.002;
  const max_k = 0.1;
  const min_k = 0.005;
  const block_time = 14;

  const DESTRUCTION_AMOUNT = web3.utils.toWei('10000', 'ether');

  before(async function () {
    Token = await TestUSDT.new();
    NEST = await TestNEST.new()
    CFactory = await CofiXFactory.deployed(); // no need to deploy a new one here
    Oracle = await NEST3PriceOracleMock.new(NEST.address, { from: deployer });
    CofiXCtrl = await CofiXController.new(Oracle.address, NEST.address, CFactory.address, { from: deployer });
    // Controller.initialize(Oracle.address, { from: deployer });
  });

  // it('should not be initialized again', async function () {
  //   await expectRevert(
  //     Controller.initialize(Oracle.address, { from: deployer }),
  //     "Contract instance has already been initialized"
  //   );
  // });

  it("should have correct K coefficients", async () => {
    let ALPHA = await CofiXCtrl.ALPHA({ from: deployer });
    let BETA_ONE = await CofiXCtrl.BETA_ONE({ from: deployer });
    let BETA_TWO = await CofiXCtrl.BETA_TWO({ from: deployer });
    let THETA = await CofiXCtrl.THETA({ from: deployer });
    let MAX_K = await CofiXCtrl.MAX_K({ from: deployer });
    let MIN_K = await CofiXCtrl.MIN_K({ from: deployer });
    // console.log(`alpha:${ALPHA.toString()}}, beta_one:${BETA_ONE.toString()}, beta_two:${BETA_TWO.toString()}, theta:${THETA.toString()}`);
    expect(ALPHA).to.bignumber.equal((convert_into_fixed_point(alpha)));
    expect(BETA_ONE).to.bignumber.equal((convert_into_fixed_point(beta_one)));
    expect(BETA_TWO).to.bignumber.equal((convert_into_fixed_point(beta_two)));
    expect(THETA).to.bignumber.equal((convert_into_fixed_point(theta)));
    expect(MAX_K).to.bignumber.equal((convert_into_fixed_point(max_k)));
    expect(MIN_K).to.bignumber.equal((convert_into_fixed_point(min_k)));
  });

  describe('activate', function() {
    let _msgValue = web3.utils.toWei('0.01', 'ether');

    it("should revert if not activated", async () => {
      // add caller
      await CofiXCtrl.addCaller(deployer, { from: deployer });
      await expectRevert(CofiXCtrl.queryOracle(Token.address, deployer, { from: deployer, value: _msgValue }), "oracleMock: not activeted yet");
    });

    it("should activate nest oracle correctly", async () => {
      await NEST.approve(CofiXCtrl.address, DESTRUCTION_AMOUNT);
      await CofiXCtrl.activate();
      await time.increase(time.duration.minutes(1)); // increase time to make activation be effective
    });

    it("should not activate again", async () => {
      await NEST.approve(CofiXCtrl.address, DESTRUCTION_AMOUNT);
      await expectRevert(CofiXCtrl.activate(), 'CofiXCtrl: activated');
    });
  });

  describe('queryOracle', function() {
    let _msgValue = web3.utils.toWei('0.01', 'ether');

    it("should revert if not price available", async () => {
      await expectRevert(CofiXCtrl.queryOracle(Token.address, deployer, { from: deployer, value: _msgValue }), "oracleMock: num too large");
    });

    it("should revert if no enough oracle fee provided", async () => {
      await expectRevert(CofiXCtrl.queryOracle(Token.address, deployer, { from: deployer, value: web3.utils.toWei('0.009', 'ether') }), "oracleMock: insufficient oracle fee");
    });
  });

  describe('test queryOracle & k calculation', function () {
    let _msgValue;
    let constOracle;
    let tmpController;

    let ethAmount = new BN("10000000000000000000");
    let tokenAmount = new BN("3862600000");

    before(async function () {
      _msgValue = web3.utils.toWei('0.01', 'ether');
      tmpCFactory = await CofiXFactory.deployed();
      constOracle = await NEST3PriceOracleConstMock.new(NEST.address, { from: deployer });
      tmpController = await CofiXController.new(constOracle.address, NEST.address, tmpCFactory.address, { from: deployer });
      // tmpController.initialize(constOracle.address, { from: deployer });
    });

    it('should calculate k correctly for constant price', async function () {
      for (let i = 0; i < 50; i++) {
        await time.advanceBlock();
      }
      await constOracle.feedPrice(Token.address, ethAmount, tokenAmount, { from: deployer });
      
      // add caller
      await tmpController.addCaller(deployer, { from: deployer });

      let result = await tmpController.queryOracle(Token.address, deployer, { from: deployer, value: _msgValue });
      console.log("queryOracle> receipt.gasUsed:", result.receipt.gasUsed);
      let evtArgs0 = result.receipt.logs[0].args;
      printKInfoEvent(evtArgs0);
      expect(evtArgs0.sigma).to.bignumber.equal(new BN(0)); // sigma should be zero because we returned constant price
      expect(evtArgs0.T).to.bignumber.equal(new BN(42)); // sigma should be zero because we returned constant price
      // k calculated from contract
      // evtArgs0.K.toNumber() / 
      // k for constant price, T = 28
      let kExpected = calcK(alpha, beta_one, beta_two, theta, evtArgs0.sigma.toNumber(), evtArgs0.T.toNumber());
      let kActual = convert_from_fixed_point(evtArgs0.K);
      // let error = Math.abs((kActual - kExpected) / kExpected);
      let error = calcRelativeDiff(kExpected, kActual);
      console.log(`kExpected: ${kExpected}, kActual:${kActual}, error:${error}`);
      assert.isAtMost(error.toNumber(), errorDelta);

      // should revert if no enough oracle fee

    });

    it("should revert if no new price feeded for a specific time", async () => {
      await constOracle.feedPrice(Token.address, ethAmount, tokenAmount, { from: deployer });
      // k = alpha + beta_one * sigma^2 + beta_two*T
      // (max_k - (alpha))/beta_two
      let max_interval_block = (max_k - (alpha))/beta_two/block_time;
      console.log(`max_interval_block=${max_interval_block}`)
      for (let i = 0; i < max_interval_block-3; i++) {
        await time.advanceBlock();
      }
      let result = await tmpController.queryOracle(Token.address, deployer, { from: deployer, value: _msgValue });
      console.log("queryOracle> receipt.gasUsed:", result.receipt.gasUsed);
      let evtArgs0 = result.receipt.logs[0].args;
      printKInfoEvent(evtArgs0);
      await expectRevert(tmpController.queryOracle(Token.address, deployer, { from: deployer, value: _msgValue }), "CofiXCtrl: K");
    });

    it("should revert if someone not allowed calling queryOracle", async () => {
      await constOracle.feedPrice(Token.address, ethAmount, tokenAmount, { from: deployer });
      await expectRevert(tmpController.queryOracle(Token.address, deployer, { from: callerNotAllowed, value: _msgValue }), "CofiXCtrl: caller not allowed");
    });
  });

  const oldGovernance = deployer;
  const newGovernance = accounts[2];

  describe('setGovernance', function () {
    it("should setGovernance correctly", async () => {
      await CofiXCtrl.setGovernance(newGovernance, { from: oldGovernance });
      let newG = await CofiXCtrl.governance();
      expect(newG).to.equal(newGovernance);
    });

    it("should revert if oldGovernance call setGovernance", async () => {
      await expectRevert(CofiXCtrl.setGovernance(oldGovernance, { from: oldGovernance }), "CFactory: !governance");
    });

    it("should setGovernance correctly by newGovernance", async () => {
      await CofiXCtrl.setGovernance(newGovernance, { from: newGovernance });
      let newG = await CofiXCtrl.governance();
      expect(newG).to.equal(newGovernance);
    });

    it("should addCaller correctly by newGovernance", async () => {
      await CofiXCtrl.addCaller(newGovernance, { from: newGovernance });
    });

    it("should revert if oldGovernance call addCaller", async () => {
      await expectRevert(CofiXCtrl.addCaller(oldGovernance, { from: oldGovernance }), "CofiXCtrl: only factory");
    });
  });

});
