var USDT = artifacts.require("test/USDT");
var HBTC = artifacts.require("test/HBTC");
var NEST = artifacts.require("test/NEST");
var WETH9 = artifacts.require("test/WETH9");
var NestPriceOracle = artifacts.require("mock/NEST36PriceOracleAutoUpdateConstMock");
var CoFiXKTable = artifacts.require("CoFiXKTable");
var CoFiXFactory = artifacts.require("CoFiXFactory");
var CoFiXController = artifacts.require("CoFiXController04");
const CoFiXPair = artifacts.require("CoFiXPair");

module.exports = async function (deployer, network) {

    console.log(`truffle deploy CoFiXController04 to ${network} network`);

    const supportedNetwork = [ "mainnet", "mainnet-fork", "ropsten", "ropsten-fork"];

    if (!supportedNetwork.includes(network)) {
        console.log(`skip, only for ${supportedNetwork} network`);
        return;
    }

    if (network == "mainnet" || network == "mainnet-fork") {
        USDT = await USDT.at("0xdAC17F958D2ee523a2206206994597C13D831ec7");
        HBTC = await HBTC.at("0x0316EB71485b0Ab14103307bf65a021042c6d380");
        NEST = await NEST.at("0x04abEdA201850aC0124161F037Efd70c74ddC74C");
        WETH9 = await WETH9.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
        NestPriceOracle = await NestPriceOracle.at("0x3bf046c114385357838D9cAE9509C6fBBfE306d2"); // nest 3.5: NestQuery
        CoFiXKTable = await CoFiXKTable.at("0x75E360Be6248Bd46030C6818624a09403EF5eC21");
        CoFiXFactory = await CoFiXFactory.at("0x66C64ecC3A6014733325a8f2EBEE46B4CA3ED550");
    } else if (network == "ropsten" || network == "ropsten-fork") {
        USDT = await USDT.at("0x200506568C2980B4943B5EaA8713A5740eb2c98A");
        HBTC = await HBTC.at("0xA674f71ce49CE7F298aea2F23D918d114965eb40");
        NEST = await NEST.at("0xD287Bc43eCD3D892204aA3792165fe8728636E29");
        WETH9 = await WETH9.at("0x59b8881812Ac484Ab78b8fc7c10b2543e079a6C3");
        NestPriceOracle = await NestPriceOracle.at("0x406C82f4F116F4FAD75bb47A142C9B5Fb213133C");
        // NestPriceOracle = await NestPriceOracle.at("xxx");
        // await deployer.deploy(NestPriceOracle);
        // console.log(`feedPrice to new Nest Price Oarcle: ${NestPriceOracle.address}`);
        // const nestQuery = await NestPriceOracle.deployed();
        // // function feedPrice(address token, uint256 ethAmount, uint256 erc20Amount, uint128 avgPrice, int128 vola) external {
        // await nestQuery.feedPrice(USDT.address, "30000000000000000000", "39010500000", "1320675549", "7511686039347830");
        // await nestQuery.feedPrice(HBTC.address, "30000000000000000000", "1129440000000000000", "38071631665285588", "5441325017383007");
        // const pUSDT = await nestQuery.latestPrice(USDT.address);
        // const pHBTC = await nestQuery.latestPrice(HBTC.address);
        // console.log(`pUSDT: ${USDT.address}, ethAmount: ${pUSDT.ethAmount.toString()}, erc20Amount: ${pUSDT.tokenAmount.toString()}, avgPrice: ${pUSDT.avgPrice.toString()}, vola: ${pUSDT.vola.toString()}, bn: ${pUSDT.bn.toString()}`);
        // console.log(`pHBTC: ${USDT.address}, ethAmount: ${pHBTC.ethAmount.toString()}, erc20Amount: ${pHBTC.tokenAmount.toString()}, avgPrice: ${pHBTC.avgPrice.toString()}, vola: ${pHBTC.vola.toString()}, bn: ${pHBTC.bn.toString()}`);
        CoFiXKTable = await CoFiXKTable.at("0xe609B978635c7Bb8D22Ffc4Ec7f7a16615a3b1cA");
        CoFiXFactory = await CoFiXFactory.at("0x8E636BDB79752BFa2C41285535852bbBDd50b2ca");
    }

    // CoFiXController
    await deployer.deploy(CoFiXController, NestPriceOracle.address, NEST.address, CoFiXFactory.address, CoFiXKTable.address);

    let controller = await CoFiXController.deployed();

    // // test query oracle
    // let result = await controller.queryOracle(USDT.address, "0", USDT.address, { value: web3.utils.toWei('0.01', 'ether') });
    // console.log("queryOracle> receipt.gasUsed:", result.receipt.gasUsed);

    // set theta
    const theta = "200000";
    console.log(`setting theta for ${USDT.address}`);
    await controller.setTheta(USDT.address, theta);
    console.log(`setting theta for ${HBTC.address}`);
    await controller.setTheta(HBTC.address, theta);
    console.log(`setting theta for ${NEST.address}`);
    await controller.setTheta(NEST.address, theta);

    // set from multi sig gov for mainnet release
    // // set controller in factory
    if (network == "ropsten" || network == "ropsten-fork") {
        console.log(`setting controller of CoFiXFactory`);
        await CoFiXFactory.setController(CoFiXController.address);
    }

    console.log(`Contract Deployed Summary\n=========================`);
    console.log(`| CoFiXController04 | ${CoFiXController.address} |`);

    // check deploying results
    const pairCnt = await CoFiXFactory.allPairsLength();
    for (let i = 0; i < pairCnt; i++) {
        const pair = await CoFiXFactory.allPairs(i);
        // await controller.addCaller(pair);
        const allowed = await controller.callerAllowed(pair);
        const CPair = await CoFiXPair.at(pair);
        const token = await CPair.token1();
        const kInfo = await controller.getKInfo(token);
        console.log(`pair: ${pair}, allowed: ${allowed}, token: ${token}, k: ${kInfo.k}, theta: ${kInfo.theta.toString()}`);
    }

};