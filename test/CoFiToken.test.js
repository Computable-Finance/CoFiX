const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiToken = artifacts.require("CoFiToken");

const verbose = process.env.VERBOSE;

contract('CoFiToken', (accounts) => {

    const owner = accounts[0];
    let deployer = owner;

    const receiver = accounts[1];

    const TotalSupplyOfCoFi = new BN("100000000000000000000000000"); // 1e8 * 1e18

    before(async () => {
        CoFi = await CoFiToken.new({ from: deployer });
    });

    it("test", async () => {
    });

    it("should have correct total supply", async () => {
        const totalSupply = await CoFi.totalSupply();
        expect(totalSupply).to.bignumber.equal(TotalSupplyOfCoFi);
    });

    it("should transfer correctly", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await CoFi.transfer(receiver, amount, {from: deployer});
        const balance = await CoFi.balanceOf(receiver);
        expect(balance).to.bignumber.equal(amount);
    });

    it("should revert if no enough balance", async () => {
        // await CoFi.transfer(TotalSupplyOfCoFi, amount, {from: deployer});
        await expectRevert(CoFi.transfer(receiver, TotalSupplyOfCoFi, {from: deployer}), "ERC20: transfer amount exceeds balance");
    });

    // standard openzeppelin token implementation, won't add more tests here
    
});