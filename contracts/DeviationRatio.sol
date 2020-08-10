pragma solidity ^0.6.6;

import "./lib/SafeMath.sol";
import "./lib/ABDKMath64x64.sol";

contract DeviationRatio {

    using SafeMath for uint256;
    // TODO: call updateAndCheckPriceList, get uint256[] array, handle it

    struct NestPrice {
        uint256 priceRatio;
        uint256 blockNumber;
        int128 stdEarningRate; // TODO: if calc cost could be small, then we could not store this field
    }

    int128 constant public COEFF1 = 0x6223E425AEE6300000; // (98.1402*2**64).toString(16), 98.1402 as 64.64-bit fixed point
    int128 constant public COEFF2 = 0x296619A93836E; // (3.9481*10**(-5)*2**64).toString(16), 3.9481*10**(-5) as 64.64-bit fixed point
    uint256 constant public AONE = 1 ether;

    NestPrice[] public nestPriceList;


    function addPriceToList(uint256 _ethAmount, uint256 _erc20Amount, uint256 _blockNumber) public {
        uint256 _priceRatio = calcPriceRatio(_ethAmount, _erc20Amount);

        uint256 _len = nestPriceList.length;

        int128 _stdEarningRate; // TODO: stdEarningRate of the first one, default value
        if (_len > 0) {
            _stdEarningRate = calcStdEarningRate(
                _priceRatio,
                nestPriceList[_len-1].priceRatio,
                _blockNumber,
                nestPriceList[_len-1].blockNumber
            );
        }

        nestPriceList.push(NestPrice({
            priceRatio: _priceRatio,
            blockNumber: _blockNumber,
            stdEarningRate: _stdEarningRate
        }));
    }

    function calcPriceRatio(uint256 _ethAmount, uint256 _erc20Amount) public pure returns (uint256) {
        return AONE.mul(_erc20Amount).div(_ethAmount);
    }

    // earningRate & stdEarningRate could be negative
    // a: nestPriceList[i].price_ratio
    // b: nestPriceList[i-1].price_ratio
    function calcEarningRate(uint256 a, uint256 b) public pure returns (int128) {
        int128 _a = ABDKMath64x64.fromUInt(a);
        int128 _b = ABDKMath64x64.fromUInt(b); // nestPriceList[i-1].price_ratio
        return ABDKMath64x64.div(ABDKMath64x64.sub(_a, _b), _b);
    }

    // a: nestPriceList[i].price_ratio
    // b: nestPriceList[i-1].price_ratio
    // c: nestPriceList[i].block_number
    // d: nestPriceList[i-1].block_number
    function calcStdEarningRate(uint256 a, uint256 b, uint256 c, uint256 d) public pure returns (int128) {
        return ABDKMath64x64.div(calcEarningRate(a, b), ABDKMath64x64.fromUInt(c.sub(d))); // c must be larger than d
    }

    function calcSigma() public view returns (int128) { // standard deviation, a.k.a. sigma
        uint256 _len = nestPriceList.length;
        // TODO: minimum length
        uint256 _cnt = 50;
        if (_len < _cnt) {
            _cnt = _len;
        }

        // calc mean value
        int128[] memory _stdEarningRates = new int128[](_cnt); // save sload gas cost
        int128 _sum; // suppose each stdEarningRate should be small or we'll calc mean vlaue in another way. TODO: validate
        for (uint256 i = _cnt; i > 0; i--) {
            _stdEarningRates[_cnt.sub(i)] = nestPriceList[_len.sub(i)].stdEarningRate; // 49-49, 49-1, 0-0, 50-50, 50-1
            _sum = ABDKMath64x64.add(_stdEarningRates[_cnt.sub(i)], _sum);
        }
        int128 _mean = ABDKMath64x64.div(_sum, ABDKMath64x64.fromUInt(_cnt));

        int128 _tmp;
        int128 _variance;
        for (uint256 i = _cnt; i > 0; i--) {
            _tmp = ABDKMath64x64.sub(_stdEarningRates[_cnt.sub(i)], _mean);
            _variance = ABDKMath64x64.add(_variance, ABDKMath64x64.pow(_tmp, 2));
        }
        // volatility in doc
        _variance = ABDKMath64x64.div(_variance, ABDKMath64x64.fromUInt(_cnt)); // _cnt > 1 TODO: why sub 1 here, Bessel's Correction?

        // variance -> standard deviation
        return ABDKMath64x64.sqrt(_variance); // sample standard deviation or standard deviation here?
    }

    function calcK(uint256 T) public view returns (int128) {
        int128 _sigma = calcSigma();
        int128 K = ABDKMath64x64.add(ABDKMath64x64.mul(COEFF1, _sigma), ABDKMath64x64.mul(COEFF2, ABDKMath64x64.fromUInt(T)));
        return K;
    }
}