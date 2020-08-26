const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const CofiXController = artifacts.require("CofiXController");
const NEST3PriceOracleMock = artifacts.require("NEST3PriceOracleMock");

contract('CofiXController', function () {
    beforeEach(async function () {
      // Deploy a new Box contract for each test
      this.oracle = await NEST3PriceOracleMock.new();
      this.controller = await CofiXController.new();
      this.controller.initialize(this.oracle.address);
    });
   
    it('should not be initialized again', async function () {
        await expectRevert(
            this.controller.initialize(this.oracle.address),
            "Contract instance has already been initialized"
        );
    });
  });