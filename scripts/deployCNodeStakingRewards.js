
const ERC20 = artifacts.require("TestERC20");
const { BN } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-environment');
const Decimal = require('decimal.js');
const { expect } = require('chai');
require('chai').should();

const CoFiToken = artifacts.require("CoFiToken");
const CoFiXNode = artifacts.require("CoFiXNode");
const CoFiXVaultForCNode = artifacts.require("CoFiXVaultForCNode");
const CoFiXFactory = artifacts.require("CoFiXFactory");
const CNodeStakingRewards = artifacts.require("CNodeStakingRewards.sol");


const argv = require('yargs').argv;

module.exports = async function (callback) {

    try {
        console.log(`argv> cofi=${argv.cofi}, cnode=${argv.cnode}, factory=${argv.factory}, addpool=${argv.addpool}`);

        CoFi = await CoFiToken.at(argv.cofi);
        CNode = await CoFiXNode.at(argv.cnode);
        CFactory = await CoFiXFactory.at(argv.factory);

        const vaultForCNode = await CFactory.getVaultForCNode();
        console.log("vaultForCNode:", vaultForCNode);

        VaultForCNode = await CoFiXVaultForCNode.at(vaultForCNode);

        StakingRewards = await CNodeStakingRewards.new(CoFi.address, CNode.address, CFactory.address);
    
        console.log("new CNodeStakingRewards deployed at:", StakingRewards.address);

        if (argv.addpool) {
            await VaultForCNode.setCNodePool(StakingRewards.address);
            const cnodePool = await VaultForCNode.cnodePool();
            console.log(`setCNodePool, StakingRewards.address: ${StakingRewards.address}, cnodePool: ${cnodePool}`);
        }

        callback();
    } catch (e) {
        callback(e);
    }
}