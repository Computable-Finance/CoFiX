const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiXNode = artifacts.require("CoFiXNode");

const verbose = process.env.VERBOSE;

contract('CoFiXNode', (accounts) => {

    const owner = accounts[0];
    let deployer = owner;
    const ALICE = owner;
    const BOB = accounts[5];


    const TOTAL_SUPPLY = "100";

    before(async () => {
        CN = await CoFiXNode.new({ from: deployer });
    });

    it("should have correct total supply", async () => {
        const totalSupply = await CN.totalSupply();
        expect(totalSupply).to.bignumber.equal(TOTAL_SUPPLY);
    });

    it("should have correct name and symbol", async () => {
        const name = await CN.name();
        const symbol = await CN.symbol();
        const decimal = await CN.decimals();
        expect(name).equal("CoFiX Node");
        expect(symbol).equal("CN");
        expect(decimal).to.bignumber.equal("0");
    });

    it("should transfer from ALICE to BOB correctly", async () => {
        const amount = "50";
        await CN.transfer(BOB, amount, {from: ALICE});
        const balanceOfBob = await CN.balanceOf(BOB);
        expect(balanceOfBob).to.bignumber.equal(amount);
        const balanceOfAlice = await CN.balanceOf(ALICE);
        expect(balanceOfAlice).to.bignumber.equal(amount); // totalSupply - amount, 100 - 50
    });

    it("should revert if no enough balance", async () => {
        const amount = "51";
        await expectRevert(CN.transfer(ALICE, amount, {from: BOB}), "ERC20: transfer amount exceeds balance");
    });

    // standard openzeppelin token implementation, won't add more tests here
});