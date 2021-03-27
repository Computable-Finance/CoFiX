
const ERC20 = artifacts.require("TestERC20");
const { BN } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-environment');
const Decimal = require('decimal.js');
const { expect } = require('chai');
require('chai').should();

const CoFiToken = artifacts.require("CoFiToken");
const CoFiXPair = artifacts.require("CoFiXV2Pair");
const CoFiXVaultForLP = artifacts.require("CoFiXV2VaultForLP");
const CoFiXFactory = artifacts.require("CoFiXV2Factory");
const CoFiXStakingRewards = artifacts.require("CoFiXV2StakingRewards.sol");


const argv = require('yargs').argv;

module.exports = async function (callback) {

    try {
        console.log(`argv> cofi=${argv.cofi}, xtoken=${argv.xtoken}, factory=${argv.factory}, addpool=${argv.addpool}`);

        CoFi = await CoFiToken.at(argv.cofi);
        XToken = await CoFiXPair.at(argv.xtoken);
        CFactory = await CoFiXFactory.at(argv.factory);

        const factory = await XToken.factory();
        console.log(`factory: ${factory}, CFactory.address: ${CFactory.address}`)
        expect(factory).equal(CFactory.address); // verify

        const vaultForLP = await CFactory.getVaultForLP();
        console.log("vaultForLP:", vaultForLP);

        VaultForLP = await CoFiXVaultForLP.at(vaultForLP);

        StakingRewards = await CoFiXStakingRewards.new(CoFi.address, XToken.address, CFactory.address);
    
        console.log("new CoFiXStakingRewards deployed at:", StakingRewards.address);

        const rewardPerToken = await StakingRewards.rewardPerToken();
        const totalSupply = await StakingRewards.totalSupply();
        const rewardRate = await StakingRewards.rewardRate();
        const balance = await CoFi.balanceOf(VaultForLP.address);

        console.log(`rewardPerToken: ${rewardPerToken}, totalSupply: ${totalSupply}, rewardRate: ${rewardRate}, vault balance: ${balance}`);

        if (argv.addpool) {
            await VaultForLP.addPool(StakingRewards.address);
            const poolInfo = await VaultForLP.getPoolInfo(StakingRewards.address);
            const balanceOfVault = await CoFi.balanceOf(VaultForLP.address);
            console.log(`addPool, StakingRewards.address: ${StakingRewards.address}, state: ${poolInfo.state}, weight: ${poolInfo.weight}, vault CoFi balance: ${balanceOfVault}`);
        }

        callback();
    } catch (e) {
        callback(e);
    }
}