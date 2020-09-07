const NEST3PriceOracleMock = artifacts.require("NEST3PriceOracleAutoUpdateConstMock");
const ERC20 = artifacts.require("ERC20");
const { BN } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-environment');
const Decimal = require('decimal.js');

const argv = require('yargs').argv;

module.exports = async function (callback) {

    try {
        var PriceOracle;
        var Token;
        var ethAmount;
        var tokenAmount;

        console.log(`argv> oracle=${argv.oracle}, token=${argv.token}, ethAmount=${argv.ethAmount}, tokenAmount=${argv.tokenAmount}`);

        if (argv.oracle === "" || argv.oracle === undefined) {
            PriceOracle = await NEST3PriceOracleMock.deployed();
        } else {
            PriceOracle = await NEST3PriceOracleMock.at(argv.oracle);
        }

        Token = await ERC20.at(argv.token);

        if (argv.ethAmount === "" || argv.ethAmount === undefined) {
            ethAmount = new BN("10000000000000000000");
        } else {
            ethAmount = new BN(argv.ethAmount);
        }
        if (argv.ethAmount === "" || argv.ethAmount === undefined) {
            tokenAmount = new BN("3255000000");
        } else {
            tokenAmount = new BN(argv.tokenAmount);
        }

        let symbol = await Token.symbol();
        console.log(`token symbol=${symbol}, address=${Token.address}, ethAmount=${ethAmount}, tokenAmount=${tokenAmount}`);

        await PriceOracle.feedPrice(Token.address, ethAmount, tokenAmount);

        // get price now from NEST3PriceOracleMock Contract
        let p = await PriceOracle.priceInfoMap(Token.address);
        let decimal = await Token.decimals();

        // p.erc20Amount.mul(new BN(web3.utils.toWei('1', 'ether'))).div(p.ethAmount).div((new BN('10')).pow(decimal)).toString()
        const ethBase = Decimal((new BN(web3.utils.toWei('1', 'ether'))).toString());
        const tokenDecimal = Decimal(((new BN('10')).pow(decimal)).toString());

        let price = Decimal(p.erc20Amount.toString()).mul(ethBase).div(Decimal(p.ethAmount.toString())).div(tokenDecimal);
        
        console.log(`price now> ethAmount=${p.ethAmount.toString()}, erc20Amount=${p.erc20Amount.toString()}, price=${price} ${symbol}/ETH`);

        callback();
    } catch (e) {
        callback(e);
    }
}