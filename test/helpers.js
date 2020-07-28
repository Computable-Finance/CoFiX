const Web3 = require('web3');

const getWeb3 = () => {
    const myWeb3 = new Web3(web3.currentProvider);
    return myWeb3;
};

module.exports = {
    getWeb3,
};