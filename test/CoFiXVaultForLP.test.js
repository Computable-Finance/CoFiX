const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const CoFiXVaultForLP = artifacts.require("CoFiXVaultForLP");
const CoFiToken = artifacts.require("CoFiToken");
const CoFiXStakingRewards = artifacts.require("CoFiXStakingRewards.sol");

const verbose = process.env.VERBOSE;

contract('CoFiXVaultForLP', (accounts) => {
    const owner = accounts[0];
    let deployer = owner;

    const governance = deployer;
    const non_governance = accounts[1];

    const pool1 = accounts[1];
    const pool2 = accounts[2];

    const TotalSupplyOfCoFi = new BN("100000000000000000000000000"); // 1e8 * 1e18
    const HalfSupplyOfCoFi = TotalSupplyOfCoFi.div(new BN(2)); // or the init supply to CoFiXVaultForLP

    before(async () => {
        CoFi = await CoFiToken.new({ from: deployer });
        VaultForLP = await CoFiXVaultForLP.new(CoFi.address, { from: deployer });
    });

    it("test", async () => {
    });

    it("should revert if no governance add pool", async () => {
        await expectRevert(VaultForLP.addPool(pool1, {from: non_governance}), "CVaultForLP: !governance");
    });

    it("should addPool correctly", async () => {
        await VaultForLP.addPool(pool1, {from: governance});
        const allowed = await VaultForLP.poolAllowed(pool1);
        expect(allowed).equal(true);
    });

    it("should revert if we add the same pool for twice", async () => {
        await expectRevert(VaultForLP.addPool(pool1, {from: governance}), "CVaultForLP: pool added");
    });

    it("should revert if not pool allowed call transferCoFi", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await expectRevert(VaultForLP.transferCoFi(amount, {from: governance}), "CVaultForLP: only pool allowed"); 
    });

    it("should transferCoFi correctly even VaultForLP has no CoFi balance", async () => {
        const balance = await CoFi.balanceOf(VaultForLP.address);
        expect(balance).to.bignumber.equal("0");
        const amount = web3.utils.toWei('1000', 'ether');
        await VaultForLP.transferCoFi(amount, {from: pool1}); 
    });

    it("should transfer half totalSupply of CoFi to VaultForLP correctly", async () => {
        const amount = HalfSupplyOfCoFi;
        await CoFi.transfer(VaultForLP.address, amount, {from: deployer});
        const balance = await CoFi.balanceOf(VaultForLP.address);
        expect(balance).to.bignumber.equal(amount);
    });

    it("should transferCoFi correctly when VaultForLP has enough CoFi balance", async () => {
        const amount = web3.utils.toWei('1000', 'ether');
        await VaultForLP.transferCoFi(amount, {from: pool1});
        const balanceOfVault = await CoFi.balanceOf(VaultForLP.address);
        const balanceOfPool1 = await CoFi.balanceOf(pool1);
        expect(balanceOfVault).to.bignumber.equal(HalfSupplyOfCoFi.sub(new BN(amount)));
        expect(balanceOfPool1).to.bignumber.equal(amount);
    });

    it("should transferCoFi correctly even when amount equals to zero", async () => {
        const amount = web3.utils.toWei('0', 'ether');
        const { tx } = await VaultForLP.transferCoFi(amount, {from: pool1});
        await expectEvent.inTransaction(tx, CoFi, 'Transfer', { from: VaultForLP.address, to: pool1, value: "0" });
    });

    it("should transferCoFi correctly when amount is larger than CoFi balance of VaultForLP", async () => {
        const balanceOfVaultBefore = await CoFi.balanceOf(VaultForLP.address);
        const amount = balanceOfVaultBefore.add(new BN("1000000000000"));
        const balanceOfPool1Before = await CoFi.balanceOf(pool1);
        await VaultForLP.transferCoFi(amount, {from: pool1});
        const balanceOfPool1After = await CoFi.balanceOf(pool1);
        const balanceOfVaultAfter = await CoFi.balanceOf(VaultForLP.address);
        expect(balanceOfVaultAfter).to.bignumber.equal("0");
        const newBalance = (new BN(balanceOfPool1Before)).add(new BN(balanceOfVaultBefore));
        expect(balanceOfPool1After).to.bignumber.equal(newBalance);
    });
    
});