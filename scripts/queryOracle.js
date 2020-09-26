const NEST3PriceOracleMock = artifacts.require("mock/NEST3PriceOracleMock");
const ERC20 = artifacts.require("TestERC20");
const { BN } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-environment');
const CoFiXController = artifacts.require("CoFiXController");
const CoFiXPair = artifacts.require("CoFiXPair");
const Decimal = require('decimal.js');
const { printKInfoEvent } = require('../lib/print');


const argv = require('yargs').argv;

module.exports = async function (callback) {
    try {
        var PriceOracle;
        var Token;
        var Pair;
        var CoFiXCtrl;

        console.log(`argv> oracle=${argv.oracle}, token=${argv.token}, account=${argv.account}, pair=${argv.pair}, controller=${argv.controller}`);

        if (argv.oracle === "" || argv.oracle === undefined) {
            PriceOracle = await NEST3PriceOracleMock.deployed();
        } else {
            PriceOracle = await NEST3PriceOracleMock.at(argv.oracle);
        }

        Token = await ERC20.at(argv.token);

        // if (argv.pair === "" || argv.token === undefined) {
        //     Pair = await CoFiXPair.deployed();
        // } else {
        //     Pair = await CoFiXPair.at(argv.pair);
        // }
        if (argv.pair) {
            Pair = await CoFiXPair.at(argv.pair);
        }

        if (argv.controller === "" || argv.controller === undefined) {
            CoFiXCtrl = await CoFiXController.deployed();
        } else {
            CoFiXCtrl = await CoFiXController.at(argv.controller);
        }

        // getPriceLength
        let priceLen = await PriceOracle.getPriceLength(Token.address);
        console.log(`getPriceLength=${priceLen.toString()}`);

        let symbol = await Token.symbol();
        console.log(`token symbol=${symbol}, address=${Token.address}, getPriceLength=${priceLen.toString()}`);

        // get price now from NEST3PriceOracleMock Contract
        let p = await PriceOracle.checkPriceNow(Token.address);
        let decimal = await Token.decimals();

        // p.erc20Amount.mul(new BN(web3.utils.toWei('1', 'ether'))).div(p.ethAmount).div((new BN('10')).pow(decimal)).toString()
        const ethBase = Decimal((new BN(web3.utils.toWei('1', 'ether'))).toString());
        const tokenDecimal = Decimal(((new BN('10')).pow(decimal)).toString());

        let price = Decimal(p.erc20Amount.toString()).mul(ethBase).div(Decimal(p.ethAmount.toString())).div(tokenDecimal);
        
        console.log(`price now> ethAmount=${p.ethAmount.toString()}, erc20Amount=${p.erc20Amount.toString()}, price=${price} ${symbol}/ETH`);

        // get K_BASE from CoFiXController contract
        let k_base = await CoFiXCtrl.K_BASE(); // 100000

        // queryOracle
        const _msgValue = web3.utils.toWei('0.01', 'ether');
        let result = await CoFiXCtrl.queryOracle(Token.address, "0", argv.account, { value: _msgValue });
        console.log("receipt.gasUsed:", result.receipt.gasUsed); // 494562
        let evtArgs0 = result.receipt.logs[0].args;
        printKInfoEvent(evtArgs0);
        // console.log("evtArgs0> K:", evtArgs0.K.toString(), ", sigma:", evtArgs0.sigma.toString(), ", T:", evtArgs0.T.toString(), ", ethAmount:", evtArgs0.ethAmount.toString(), ", erc20Amount:", evtArgs0.erc20Amount.toString())

        // getKInfo
        let kInfo = await CoFiXCtrl.getKInfo(Token.address);
        console.log(`kInfo> raw k: ${kInfo.k.toString()}, k meaning: ${kInfo.k.toString() / k_base.toString()}, updatedAt: ${kInfo.updatedAt.toString()}, update date: ${(new Date(kInfo.updatedAt*1000)).toUTCString()}`);
        if (argv.pair) {
            // get NAVPS_BASE from CoFiXPair contract
            let navps_base = await Pair.NAVPS_BASE();
            let oraclePrice = [p.ethAmount, p.erc20Amount, new BN("0"), kInfo.k];
            let navps = await Pair.getNAVPerShareForMint(oraclePrice);
            console.log(`pair=${Pair.address}, net asset value per share, raw=${navps.toNumber()}, meaning=${navps.toNumber() / navps_base.toNumber()}`);
        }
        callback();
    } catch (e) {
        callback(e);
    }
}