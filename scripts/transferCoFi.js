
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
        console.log(`argv> cofi=${argv.cofi}, vault=${argv.vault}, transfer=${argv.transfer}, amount=${argv.amount}`);

        CoFi = await CoFiToken.at(argv.cofi);
        VaultForLP = await CoFiXVaultForLP.at(argv.vault);

        let amount = "50000000000000000000000000"; // 50,000,000 * 1e18

        if (argv.amount) {
            amount = argv.amount
        }

        if (argv.transfer) {
            console.log("exec transfer, amount:",amount);
            await CoFi.transfer(VaultForLP.address, amount);
        }

        const balanceOfVault = await CoFi.balanceOf(VaultForLP.address);
        console.log(`vault CoFi balance: ${balanceOfVault}`);

        callback();
    } catch (e) {
        callback(e);
    }
}