const NEST3PriceOracleMock = artifacts.require("NEST3PriceOracleMock");
const ERC20 = artifacts.require("ERC20");
const { BN } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-environment');

// const argv = require('yargs').argv;

module.exports = async function (callback) {
    try {
        // const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const PriceOracle = await NEST3PriceOracleMock.deployed();
        const USDT = await ERC20.deployed();

        // add enough prices in NEST3PriceOracleMock
        let ethAmount = new BN("10000000000000000000");
        let tokenAmount = new BN("3255000000");

        for (let i = 0; i < 5; i++) {
            console.log("send i:", i);
            await PriceOracle.addPriceToList(USDT.address, ethAmount, tokenAmount, "0");
            tokenAmount = tokenAmount.mul(new BN("100")).div(new BN("100")); // very stable price
        }
        let priceLen = await PriceOracle.getPriceLength(USDT.address);
        console.log("priceLen:", priceLen.toString(), ", tokenAmount:", tokenAmount.toString());

        // add more prices
        for (let i = 0; i < 50; i++) {
            console.log("send i:", i);
            await PriceOracle.addPriceToList(USDT.address, ethAmount, tokenAmount, "0");
            tokenAmount = tokenAmount.mul(new BN("101")).div(new BN("100")); // eth price rising
        }
        console.log("priceLen:", priceLen.toString(), ", tokenAmount:", tokenAmount.toString());

        // get price now from NEST3PriceOracleMock Contract
        let p = await PriceOracle.checkPriceNow(USDT.address);
        console.log("price now> ethAmount:", p.ethAmount.toString(), ", erc20Amount:", p.erc20Amount.toString(), p.erc20Amount.mul(new BN(web3.utils.toWei('1', 'ether'))).div(p.ethAmount).div(new BN('1000000')).toString(), "USDT/ETH");

        callback();
    } catch (e) {
        callback(e);
    }
}