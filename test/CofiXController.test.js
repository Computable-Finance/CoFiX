const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const CofiXController = artifacts.require("CofiXController");
const NEST3PriceOracleMock = artifacts.require("NEST3PriceOracleMock");

contract('CofiXController', (accounts) => {

    const deployer = accounts[0];

    let controller;

    before(async function () {
      this.oracle = await NEST3PriceOracleMock.new({from: deployer});
      controller = await CofiXController.new({from: deployer});
      controller.initialize(this.oracle.address, {from: deployer});
    });
   
    it('should not be initialized again', async function () {
        await expectRevert(
            controller.initialize(this.oracle.address, {from: deployer}),
            "Contract instance has already been initialized"
        );
    });

    it("should have correct K coefficients", async () => {
      let ALPHA = await controller.ALPHA({from: deployer});
      let BETA_ONE = await controller.BETA_ONE({from: deployer});
      let BETA_TWO = await controller.BETA_TWO({from: deployer});
      let THETA = await controller.THETA({from: deployer});
      // console.log(`alpha:${ALPHA.toString()}}, beta_one:${BETA_ONE.toString()}, beta_two:${BETA_TWO.toString()}, theta:${THETA.toString()}`);
      const alpha = 0.0047021;
      const beta_one = 13783.9757;
      const beta_two = 2.446*10**(-5);
      const theta = 0.002;
      // convert into 64.64 bit fixed_point
      function convert(coeff)  {
        return web3.utils.toBN("0x" + (coeff*2**64).toString(16).toUpperCase().split(".")[0]); // e.g. 0x19A5EE66A57B7.A, ignore every digis after the dot
      }
      expect(ALPHA).to.bignumber.equal((convert(alpha)));
      expect(BETA_ONE).to.bignumber.equal((convert(beta_one)));
      expect(BETA_TWO).to.bignumber.equal((convert(beta_two)));
      expect(THETA).to.bignumber.equal((convert(theta)));
    });
  });