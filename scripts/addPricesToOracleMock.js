const NEST3PriceOracleMock = artifacts.require("NEST3PriceOracleMock");
const ERC20 = artifacts.require("TestERC20");
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
        var txCnt;

        console.log(`argv> oracle=${argv.oracle}, token=${argv.token}, ethAmount=${argv.ethAmount}, tokenAmount=${argv.tokenAmount}, txCnt=${argv.txCnt}`);

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
        if (argv.txCnt === "" || argv.txCnt === undefined) {
            txCnt = 1;
        } else {
            txCnt = argv.txCnt;
        }

        console.log(`starting ethAmount=${ethAmount}, tokenAmount=${tokenAmount}`)

        let priceLen = await PriceOracle.getPriceLength(Token.address);
        let symbol = await Token.symbol();
        console.log(`token symbol=${symbol}, address=${Token.address}, getPriceLength=${priceLen.toString()}`);

        // add prices in NEST3PriceOracleMock
        for (let i = 0; i < txCnt; i++) {
            const volatility = getRandomArbitrary(990, 1010);
            tokenAmount = tokenAmount.mul(new BN(volatility)).div(new BN("1000"));
            console.log(`send tx, progress=${i+1}/${txCnt}, volatility=${volatility}, ethAmount=${ethAmount}, tokenAmount=${tokenAmount}`);
            await PriceOracle.addPriceToList(Token.address, ethAmount, tokenAmount, "0");
        }
        console.log("priceLen:", priceLen.toString(), ", now tokenAmount:", tokenAmount.toString());

        // get price now from NEST3PriceOracleMock Contract
        let p = await PriceOracle.checkPriceNow(Token.address);
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

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
  }