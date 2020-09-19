
const ERC20 = artifacts.require("TestERC20");
const { BN } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-environment');
const Decimal = require('decimal.js');

const CoFiToken = artifacts.require("CoFiToken");
const TestXToken = artifacts.require("TestXToken");
const CoFiXVaultForLP = artifacts.require("CoFiXVaultForLP");
const CoFiXStakingRewards = artifacts.require("CoFiXStakingRewards.sol");


const argv = require('yargs').argv;

module.exports = async function (callback) {

    try {
        console.log(`argv> cofi=${argv.cofi}, xtoken=${argv.xtoken}, vault=${argv.vault}, addpool=${argv.addpool}`);

        CoFi = await CoFiToken.at(argv.cofi);
        XToken = await TestXToken.at(argv.xtoken);
        VaultForLP = await CoFiXVaultForLP.at(argv.vault);

        StakingRewards = await CoFiXStakingRewards.new(CoFi.address, XToken.address, VaultForLP.address);
    
        console.log("new CoFiXStakingRewards deployed at:", StakingRewards.address);

        const rewardPerToken = await StakingRewards.rewardPerToken();
        const totalSupply = await StakingRewards.totalSupply();
        const rewardRate = await StakingRewards.rewardRate();
        const balance = await CoFi.balanceOf(VaultForLP.address);

        console.log(`rewardPerToken: ${rewardPerToken}, totalSupply: ${totalSupply}, rewardRate: ${rewardRate}, vault balance: ${balance}`);

        if (argv.addpool) {
            await VaultForLP.addPool(StakingRewards.address);
            const allowed = await VaultForLP.poolAllowed(StakingRewards.address);
            const balanceOfVault = await CoFi.balanceOf(VaultForLP.address);
            console.log(`addPool, StakingRewards.address: ${StakingRewards.address}, allowed: ${allowed}, vault CoFi balance: ${balanceOfVault}`);
        }

        callback();
    } catch (e) {
        callback(e);
    }
}