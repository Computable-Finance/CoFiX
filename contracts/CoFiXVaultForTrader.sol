// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CoFiXVaultForTrader {
    using SafeMath for uint256;

    uint256 public constant RATE_BASE = 1e18;
    uint256 public constant LAMBDA_BASE = 100;

    address public cofiToken;

    uint256 public genesisBlock; // TODO: make this constant to reduce gas cost

    // managed by governance
    address public governance;

    uint256 public initCoFiRate = 10*1e18; // yield per block
    uint256 public cofiDecayPeriod = 7200; // yield decays for every 2,400,000 blocks
    int128 public cofiDecayRate = 0xFFBE76C8B4395800; // (0.999*2**64).toString(16), 0.999 as 64.64-bit fixed point

    uint256 public thetaFeeUnit = 0.01 ether;

    uint256 public initS = 1;
    uint256 public sDecayOffset = 100000*1e18;
    int128 public sDecayRate = 0xF851EB851EB85000;  // (0.97*2**64).toString(16), 0.97 as 64.64-bit fixed point

    uint256 public singleLimitM = 50000*1e18;

    constructor() public {
        governance = msg.sender;
        genesisBlock = block.number;
    }

    function currentPeriod() public view returns (uint256) {
        return (block.number).sub(genesisBlock).div(cofiDecayPeriod);
        // TODO: prevent index too large
    }

    function currentDecay() public view returns (int128) {
        uint256 periodIdx = currentPeriod();
        return ABDKMath64x64.pow(cofiDecayRate, periodIdx); // TODO: prevent index too large
    }

    function currentCoFiRate() public view returns (uint256) {
        // initCoFiRate * ((cofiDecayRate)^((block.number-genesisBlock)/cofiDecayPeriod))
        int128 decayRatio = ABDKMath64x64.mul(
            currentDecay(), // 0~1
            ABDKMath64x64.fromUInt(RATE_BASE)
        ); // TODO: verify decayRatio var is small 
        return uint256(ABDKMath64x64.toUInt(decayRatio)).mul(initCoFiRate).div(RATE_BASE); // TODO: if we want mul not overflow revert, should limit initCoFiRate
    }

    function stdMiningAmount(uint256 thetaFee) public view returns (uint256) {
        // thetaFee / thetaFeeUnit * currentCoFiRate
        return thetaFee.mul(currentCoFiRate()).div(thetaFeeUnit);
    }

    function last300Blocks() public view returns (uint256) {

    }

    function calcLambda(uint256 x, uint256 y) public pure returns (uint256) {
        // (0.1 0.33 3 10) => (10 33 300 1000)
        uint256 ratio = x.mul(100).div(y);
        if (ratio >= 1000) { // x/y >= 10, lambda = 0.5
            return 50;
        } else if (ratio >= 300) { // 3 <= x/y < 10, lambda = 0.75
            return 75;
        } else if (ratio >= 33) { // 0.33 <= x/y < 3, lambda = 1
            return 100;
        } else if (ratio >= 10) { // 0.1 <= x/y < 0.33, lambda = 1.25
            return 125;
        } else { // x/y < 0.1, lambda = 1.5
            return 150;
        }
    }


    function currentS() public view returns (uint256) {
        // initS * ( sDecayRate^(distributed/sDecayOffset) ), distributed = totalBalance - currentBalance
    }

    function actualMiningAmount(uint256 thetaFee, uint256 x, uint256 y) public view returns (uint256) {
        uint256 O_T = stdMiningAmount(thetaFee);
        uint256 O_300 = last300Blocks();
        uint256 Q = O_T.add(O_300);
        uint256 s = currentS();
        uint256 ms = singleLimitM.mul(s);
        uint256 lambda = calcLambda(x, y);
        if (Q <= ms) {
            return O_T.mul(lambda).div(LAMBDA_BASE);
        } else {
            // O_T * ms * (2Q - ms) * lambda / (Q * Q)
            return O_T.mul(ms).mul(Q.mul(2).sub(ms)).mul(lambda).div(Q).div(Q);
        }
    }
}