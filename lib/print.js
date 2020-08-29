function printKInfoEvent(evtArgs0) {
    console.log(`queryOracle>evtArgs0> K: ${evtArgs0.K.toString()}, sigma: ${evtArgs0.sigma.toString()}, T: ${evtArgs0.T.toString()}, ethAmount: ${evtArgs0.ethAmount.toString()}, erc20Amount: ${evtArgs0.erc20Amount.toString()}`);
}

module.exports = {
    printKInfoEvent,
};
