const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiXVaultForTrader = artifacts.require("CoFiXVaultForTrader");
const CoFiToken = artifacts.require("CoFiToken");

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

    before(async () => {
        CoFi = await CoFiToken.new({ from: deployer });
        VaultForLP = await CoFiXVaultForLP.new(CoFi.address, { from: deployer });
    });

    it("should revert if no governance add pool", async () => {
        await expectRevert(VaultForLP.addPool(pool1, {from: non_governance}), "CVaultForLP: !governance");
    });
});