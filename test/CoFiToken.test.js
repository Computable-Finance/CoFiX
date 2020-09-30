const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiToken = artifacts.require("CoFiToken");

const verbose = process.env.VERBOSE;

contract('CoFiToken', (accounts) => {

    const owner = accounts[0];
    let deployer = owner;
    const GOVERNANCE = deployer;
    const NON_GOVERNANCE = accounts[1];
    const MINTER_1 = accounts[2];
    const MINTER_2 = accounts[3];

    const ALICE = accounts[4];
    const BOB = accounts[5];

    // const TotalSupplyOfCoFi = new BN("100000000000000000000000000"); // 1e8 * 1e18

    const INIT_TOTAL_SUPPLY = new BN("0");

    before(async () => {
        CoFi = await CoFiToken.new({ from: deployer });
    });

    it("should have correct total supply", async () => {
        const totalSupply = await CoFi.totalSupply();
        expect(totalSupply).to.bignumber.equal(INIT_TOTAL_SUPPLY);
    });

    it("should have correct name and symbol", async () => {
        const name = await CoFi.name();
        const symbol = await CoFi.symbol();
        expect(name).equal("CoFi Token");
        expect(symbol).equal("CoFi");
    });

    it("should have correct governance", async () => {
        const governance = await CoFi.governance();
        expect(governance).equal(GOVERNANCE);
    });

    it("should add minter correctly by governance", async () => {
        let allowed = await CoFi.minters(MINTER_1);
        expect(allowed).equal(false);
        const receipt = await CoFi.addMinter(MINTER_1, {from: GOVERNANCE});
        expectEvent(receipt, "MinterAdded", {_minter: MINTER_1});
        allowed = await CoFi.minters(MINTER_1);
        expect(allowed).equal(true);
    });

    it("should revert if NON_GOVERNANCE add minter", async () => {
        await expectRevert(CoFi.addMinter(MINTER_1, {from: NON_GOVERNANCE}), "CoFi: !governance");
    });

    it("should remove minter correctly", async () => {
        let allowed = await CoFi.minters(MINTER_2);
        expect(allowed).equal(false);
        await CoFi.addMinter(MINTER_2, {from: GOVERNANCE});
        allowed = await CoFi.minters(MINTER_2);
        expect(allowed).equal(true);
        const receipt = await CoFi.removeMinter(MINTER_2, {from: GOVERNANCE});
        expectEvent(receipt, "MinterRemoved", {_minter: MINTER_2});
        allowed = await CoFi.minters(MINTER_2);
        expect(allowed).equal(false);
    });

    it("should revert if NON_GOVERNANCE remove minter", async () => {
        await expectRevert(CoFi.removeMinter(MINTER_1, {from: NON_GOVERNANCE}), "CoFi: !governance");
    });

    it("should mint correctly by MINTER_1", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await CoFi.mint(ALICE, amount, {from: MINTER_1});
        const balance = await CoFi.balanceOf(ALICE);
        expect(balance).to.bignumber.equal(amount);
        const totalSupply = await CoFi.totalSupply();
        expect(totalSupply).to.bignumber.equal(amount);
    });

    it("should revert if mint by NON MINTER", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await expectRevert(CoFi.mint(ALICE, amount, {from: MINTER_2}), "CoFi: !minter");
        await expectRevert(CoFi.mint(ALICE, amount, {from: GOVERNANCE}), "CoFi: !minter");
    });

    it("should transfer from ALICE to BOB correctly", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await CoFi.transfer(BOB, amount, {from: ALICE});
        const balanceOfBob = await CoFi.balanceOf(BOB);
        expect(balanceOfBob).to.bignumber.equal(amount);
        const balanceOfAlice = await CoFi.balanceOf(ALICE);
        expect(balanceOfAlice).to.bignumber.equal("0");
    });

    it("should revert if no enough balance", async () => {
        const amount = web3.utils.toWei('1001', 'ether');
        await expectRevert(CoFi.transfer(ALICE, amount, {from: BOB}), "ERC20: transfer amount exceeds balance");
    });

    // standard openzeppelin token implementation, won't add more tests here
    // standard compound/yam/sushi governance delegate implementation, won't add more tests here
});