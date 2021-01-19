var WETH9 = artifacts.require("test/WETH9");
var CoFiXFactory = artifacts.require("CoFiXFactory");
const CoFiXRouter = artifacts.require("CoFiXRouter02");
var CoFiXVaultForTrader = artifacts.require("CoFiXVaultForTrader");


// truffle migrate -f 4 -to 4 --network ropsten
module.exports = async function (deployer, network) {

    console.log(`truffle deploy CoFiXRouter02 to ${network} network`);

    const supportedNetwork = [ "mainnet", "mainnet-fork", "ropsten", "ropsten-fork"];

    if (!supportedNetwork.includes(network)) {
        console.log(`skip, only for ${supportedNetwork} network`);
        return;
    }

    if (network == "mainnet" || network == "mainnet-fork") {
        WETH9 = await WETH9.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
        CoFiXFactory = await CoFiXFactory.at("0x66C64ecC3A6014733325a8f2EBEE46B4CA3ED550");
        // https://uniswap.org/docs/v2/smart-contracts/factory/
        UniswapFactory = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
    } else if (network == "ropsten" || network == "ropsten-fork") {
        WETH9 = await WETH9.at("0x59b8881812Ac484Ab78b8fc7c10b2543e079a6C3");
        CoFiXFactory = await CoFiXFactory.at("0x8E636BDB79752BFa2C41285535852bbBDd50b2ca");
        UniswapFactory = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
        CoFiXVaultForTrader = await CoFiXVaultForTrader.at("0xe901e7f88a377D01028aE947cFA3192b3c5f7587");
    }

    // CoFiXRouter
    await deployer.deploy(CoFiXRouter, CoFiXFactory.address, UniswapFactory, WETH9.address);

    console.log("CoFiXRouter02 deployed successfully, address is", CoFiXRouter.address);

    if (network == "ropsten" || network == "ropsten-fork") {
        // allowRouter
        console.log(`start allowRouter`);
        await CoFiXVaultForTrader.allowRouter(CoFiXRouter.address);
        console.log("allowRouter successfully for CoFiXRouter02");
    }
};