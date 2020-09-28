
const ERC20 = artifacts.require("TestERC20");
const { BN } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-environment');
const Decimal = require('decimal.js');

const CoFiToken = artifacts.require("CoFiToken");
const TestXToken = artifacts.require("TestXToken");

const CoFiXStakingRewards = artifacts.require("CoFiXStakingRewards.sol");
const CoFiXVaultForLP = artifacts.require("CoFiXVaultForLP");

const argv = require('yargs').argv;

module.exports = async function (callback) {

    try {
        console.log(`argv> cofi=${argv.cofi}, xtoken=${argv.xtoken}, vault=${argv.vault}, pool=${argv.pool}`);

        CoFi = await CoFiToken.at(argv.cofi);
        XToken = await TestXToken.at(argv.xtoken);
        VaultForLP = await CoFiXVaultForLP.at(argv.vault);
        StakingRewards = await CoFiXStakingRewards.at(argv.pool);

        const rewardPerToken = await StakingRewards.rewardPerToken();
        const totalSupply = await StakingRewards.totalSupply();
        const rewardRate = await StakingRewards.rewardRate();

        console.log(`StakingRewards stats: rewardPerToken: ${rewardPerToken}, totalSupply: ${totalSupply}, rewardRate: ${rewardRate}`);

        await VaultForLP.addPool(StakingRewards.address);
        const poolInfo = await VaultForLP.getPoolInfo(StakingRewards.address);
        const balanceOfVault = await CoFi.balanceOf(VaultForLP.address);
        console.log(`addPool, StakingRewards.address: ${StakingRewards.address}, state: ${poolInfo.state}, weight: ${poolInfo.weight}, vault CoFi balance: ${balanceOfVault}`);

        callback();
    } catch (e) {
        callback(e);
    }
}