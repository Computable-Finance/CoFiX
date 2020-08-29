const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time, balance } = require('@openzeppelin/test-helpers');
const { calcK, convert_from_fixed_point, convert_into_fixed_point, calcRelativeDiff } = require('../lib/calc');
const { printKInfoEvent } = require('../lib/print');

const ERC20 = artifacts.require("ERC20");
const CofiXController = artifacts.require("CofiXController");
const NEST3PriceOracleMock = artifacts.require("NEST3PriceOracleMock");
const NEST3PriceOracleConstMock = artifacts.require("NEST3PriceOracleConstMock");

const errorDelta = 10 ** -15;

contract('CofiXController', (accounts) => {

  const deployer = accounts[0];

  let Controller;
  let Oracle;
  let Token

  const alpha = 0.0047021;
  const beta_one = 13783.9757;
  const beta_two = 2.446 * 10 ** (-5);
  const theta = 0.002;
  const max_k = 0.1;
  const min_k = 0.005;
  const block_time = 14;

  before(async function () {
    Token = await ERC20.new("10000000000000000", "USDT Test Token", "USDT", 6);
    Oracle = await NEST3PriceOracleMock.new({ from: deployer });
    Controller = await CofiXController.new({ from: deployer });
    Controller.initialize(Oracle.address, { from: deployer });
  });

  it('should not be initialized again', async function () {
    await expectRevert(
      Controller.initialize(Oracle.address, { from: deployer }),
      "Contract instance has already been initialized"
    );
  });

  it("should have correct K coefficients", async () => {
    let ALPHA = await Controller.ALPHA({ from: deployer });
    let BETA_ONE = await Controller.BETA_ONE({ from: deployer });
    let BETA_TWO = await Controller.BETA_TWO({ from: deployer });
    let THETA = await Controller.THETA({ from: deployer });
    let MAX_K = await Controller.MAX_K({ from: deployer });
    let MIN_K = await Controller.MIN_K({ from: deployer });
    // console.log(`alpha:${ALPHA.toString()}}, beta_one:${BETA_ONE.toString()}, beta_two:${BETA_TWO.toString()}, theta:${THETA.toString()}`);
    expect(ALPHA).to.bignumber.equal((convert_into_fixed_point(alpha)));
    expect(BETA_ONE).to.bignumber.equal((convert_into_fixed_point(beta_one)));
    expect(BETA_TWO).to.bignumber.equal((convert_into_fixed_point(beta_two)));
    expect(THETA).to.bignumber.equal((convert_into_fixed_point(theta)));
    expect(MAX_K).to.bignumber.equal((convert_into_fixed_point(max_k)));
    expect(MIN_K).to.bignumber.equal((convert_into_fixed_point(min_k)));
  });

  describe('test queryOracle & k calculation', function () {
    let _msgValue;
    let constOracle;
    let tmpController;

    let ethAmount = new BN("10000000000000000000");
    let tokenAmount = new BN("3862600000");

    before(async function () {
      _msgValue = web3.utils.toWei('0.01', 'ether');
      constOracle = await NEST3PriceOracleConstMock.new({ from: deployer });
      tmpController = await CofiXController.new({ from: deployer });
      tmpController.initialize(constOracle.address, { from: deployer });
    });

    it('should calculate k correctly for constant price', async function () {
      for (let i = 0; i < 50; i++) {
        await time.advanceBlock();
      }
      await constOracle.feedPrice(Token.address, ethAmount, tokenAmount, { from: deployer });
      
      let result = await tmpController.queryOracle(Token.address, deployer, { from: deployer, value: _msgValue });
      console.log("queryOracle> receipt.gasUsed:", result.receipt.gasUsed);
      let evtArgs0 = result.receipt.logs[0].args;
      printKInfoEvent(evtArgs0);
      expect(evtArgs0.sigma).to.bignumber.equal(new BN(0)); // sigma should be zero because we returned constant price
      expect(evtArgs0.T).to.bignumber.equal(new BN(28)); // sigma should be zero because we returned constant price
      // k calculated from contract
      // evtArgs0.K.toNumber() / 
      // k for constant price, T = 28
      let kExpected = calcK(alpha, beta_one, beta_two, theta, evtArgs0.sigma.toNumber(), evtArgs0.T.toNumber());
      let kActual = convert_from_fixed_point(evtArgs0.K);
      // let error = Math.abs((kActual - kExpected) / kExpected);
      let error = calcRelativeDiff(kExpected, kActual);
      console.log(`kExpected: ${kExpected}, kActual:${kActual}, error:${error}`);
      assert.isAtMost(error.toNumber(), errorDelta);
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
  });


});
