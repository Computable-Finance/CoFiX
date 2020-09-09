const Decimal = require('decimal.js');
const utils = require('web3-utils');
// const { web3 } = require('@openzeppelin/test-environment');

// function calcK(alpha, beta_one, beta_two, theta, sigma, T) {
//     return alpha + beta_one * (sigma * sigma) + beta_two * T; // no theta now;
// }

function calcK(K0, sigma, T) {
    return 0.5*K0; // no theta now;
}

function convert_from_fixed_point(fp) {
    return fp.toString() / (2 ** 64);
}

// convert into 64.64 bit fixed_point
function convert_into_fixed_point(coeff) {
    return utils.toBN("0x" + (coeff * 2 ** 64).toString(16).toUpperCase().split(".")[0]); // e.g. 0x19A5EE66A57B7.A, ignore every digis after the dot
}

function calcRelativeDiff(expected, actual) {
    if (expected == 0) {
        console.log("warn> expected:", expected)
        return Decimal(0);
    }
    return ((Decimal(expected).minus(Decimal(actual))).div(expected)).abs();
}

module.exports = {
    calcK,
    convert_from_fixed_point,
    convert_into_fixed_point,
    calcRelativeDiff,
};
