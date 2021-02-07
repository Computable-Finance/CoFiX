function printKInfoEvent(evtArgs0) {

    // event NewK(address token, int128 K, int128 sigma, uint256 T, uint256 ethAmount, uint256 erc20Amount, uint256 blockNum, uint256 tIdx, uint256 sigmaIdx, int128 K0);

    console.log(`queryOracle>evtArgs0> K: ${evtArgs0.K.toString()}, sigma: ${evtArgs0.sigma.toString()}, T: ${evtArgs0.T.toString()}, ethAmount: ${evtArgs0.ethAmount.toString()}, erc20Amount: ${evtArgs0.erc20Amount.toString()}, blockNum: ${evtArgs0.blockNum.toString()}`);
}

module.exports = {
    printKInfoEvent,
};
