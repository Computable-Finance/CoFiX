pragma solidity ^0.6.6;

import "./lib/SafeMath.sol";
import "./lib/ABDKMath64x64.sol";
import "./interface/INest_3_OfferPrice.sol";
import './lib/TransferHelpers.sol';


contract CofiXController {

    using SafeMath for uint256;
    
    event newK(address token, int128 K, int128 sigma, uint256 T, uint256 ethAmount, uint256 erc20Amount, uint256 blockNumber);

    struct NestPrice {
        uint256 price;
        uint256 blockNumber;
    }

    int128 constant public ALPHA = -0x47485E3DA2F8BC0; // (-0.017403*2**64).toString(16), -0.017403 as 64.64-bit fixed point
    int128 constant public BETA_ONE = 0x804A1A71DE69B0000000; // (32842.1033*2**64).toString(16), 32842.1033 as 64-bit fixed point
    int128 constant public BETA_TWO = 0x2B311FF75B04A; // (4.1191*10**(-5)*2**64).toString(16), 4.1191*10**(-5) as 64.64-bit fixed point
    uint256 constant public AONE = 1 ether;
    uint256 constant K_BASE = 100000;

    // TODO: setter for these variables
    uint256 public timespan_ = 14;
    int128 public MIN_K = 0x147AE147AE147B0; // (0.005*2**64).toString(16), 0.5% as 64.64-bit fixed point
    int128 public MAX_K = 0x1999999999999A00; // (0.1*2**64).toString(16),  10% 64.64-bit fixed point
    address public oracle;

    constructor(address _priceOracle) public {
        oracle = _priceOracle;
    }

    receive() external payable {}

    function queryOracle(address token, address payback) external payable returns (uint256, uint256, uint256, uint256) {
        uint256 _balanceBefore = address(this).balance;
        // TODO: cache K to reduce gas cost
        (int128 _variance, uint256 _T, uint256 _ethAmount, uint256 _erc20Amount, uint256 _blockNumber) = calcVariance(token);
        // int128 _volatility = ABDKMath64x64.sqrt(_variance);
        // int128 _sigma = ABDKMath64x64.div(_volatility, ABDKMath64x64.sqrt(ABDKMath64x64.fromUInt(timespan_)));
        int128 _sigma = ABDKMath64x64.sqrt(ABDKMath64x64.div(_variance, ABDKMath64x64.fromUInt(timespan_))); // combined into one sqrt
        // 𝐾 = α + β_1 * sigma^2  + β_2 * T
        int128 K = ABDKMath64x64.add(
                        ALPHA, 
                        ABDKMath64x64.add(
                            ABDKMath64x64.mul(BETA_ONE, ABDKMath64x64.pow(_sigma, 2)),
                            ABDKMath64x64.mul(BETA_TWO, ABDKMath64x64.fromUInt(_T))
                        )
                    );
        
        emit newK(token, K, _sigma, _T, _ethAmount, _erc20Amount, _blockNumber);
        if (K < MIN_K) {
            K = MIN_K;
        } else if (K > MAX_K) {
            revert("CofiXCtrl: K");
        }
        // TODO: payback param ununsed now
        // we could use this to pay the fee change and mining award token directly to reduce call cost
        // TransferHelper.safeTransferETH(payback, msg.value.sub(_balanceBefore.sub(address(this).balance)));
        TransferHelper.safeTransferETH(msg.sender, msg.value.sub(_balanceBefore.sub(address(this).balance)));
        uint256 _k = ABDKMath64x64.toUInt(ABDKMath64x64.mul(K, ABDKMath64x64.fromUInt(K_BASE)));
        return (_k, _ethAmount, _erc20Amount, _blockNumber);
    }

    function calcPrice(uint256 _ethAmount, uint256 _erc20Amount) internal pure returns (uint256) {
        return AONE.mul(_erc20Amount).div(_ethAmount);
    }

    // diff ratio could be negative
    // p2: P_{i}
    // p1: P_{i-1}
    // p0: P_{0}
    function calcDiffRatio(uint256 p2, uint256 p1, uint256 p0) internal pure returns (int128) {
        int128 _p2 = ABDKMath64x64.fromUInt(p2);
        int128 _p1 = ABDKMath64x64.fromUInt(p1);
        int128 _p0 = ABDKMath64x64.fromUInt(p0);
        return ABDKMath64x64.div(ABDKMath64x64.sub(_p2, _p1), _p0);
    }

    // p2: P_{i}
    // p1: P_{i-1}
    // p0: P_{0}
    // bn2: blocknum_{i}
    // bn1: blocknum_{i-1}
    function calcStdSeq(uint256 p2, uint256 p1, uint256 p0, uint256 bn2, uint256 bn1) internal pure returns (int128) {
        return ABDKMath64x64.div(
                calcDiffRatio(p2, p1, p0),
                ABDKMath64x64.sqrt(
                    ABDKMath64x64.fromUInt(bn2.sub(bn1)) // c must be larger than d
                )
            );
    }

    // TODO: oracle & token could be state varaibles
     // calc Variance, a.k.a. sigma squared
    function calcVariance(address token) internal returns (int128 _variance, uint256 _T, uint256 _ethAmount, uint256 _erc20Amount, uint256 _blockNumber) {

        // query raw price list from nest oracle (newest to oldest)
        uint256[] memory _rawPriceList = INest_3_OfferPrice(oracle).updateAndCheckPriceList{value: msg.value}(token, 50);
        require(_rawPriceList.length == 150, "CofiXCtrl: bad price len");
        // calc P a.k.a. price from the raw price data (ethAmount, erc20Amount, blockNumber)
        uint256[] memory _prices = new uint256[](50);
        for (uint256 i = 0; i < 50; i++) {
            // 0..50 (newest to oldest), so _prices[0] is p49 (latest price), _prices[49] is p0 (base price)
            _prices[i] = calcPrice(_rawPriceList[i*3], _rawPriceList[i*3+1]);
        }

        // calc x a.k.a. standardized sequence of differences (newest to oldest)
        int128[] memory _stdSeq = new int128[](49);
        for (uint256 i = 0; i < 49; i++) {
            _stdSeq[i] = calcStdSeq(_prices[i], _prices[i+1], _prices[49], _rawPriceList[i*3+2], _rawPriceList[(i+1)*3+2]);
        }

        // Option 1: calc variance of x
        int128 _sumSq; // sum of squares of x
        int128 _sum; // sum of x
        for (uint256 i = 0; i < 49; i++) {
            _sumSq = ABDKMath64x64.add(ABDKMath64x64.pow(_stdSeq[i], 2), _sumSq);
            _sum = ABDKMath64x64.add(_stdSeq[i], _sum);
        }
        _variance = ABDKMath64x64.sub(
            ABDKMath64x64.div(
                _sumSq,
                ABDKMath64x64.fromUInt(49)
            ),
            ABDKMath64x64.div(
                ABDKMath64x64.pow(_sum, 2),
                ABDKMath64x64.fromUInt(49*49)
            )
        );

        // // Option 2: calc mean value first and then calc variance
        // int128 _sum; // suppose each stdEarningRate should be small or we'll calc mean vlaue in another way. TODO: validate
        // for (uint256 i = 0; i < 49; i++) {
        //     _sum = ABDKMath64x64.add(_stdSeq[i], _sum);
        // }
        // int128 _mean = ABDKMath64x64.div(_sum, ABDKMath64x64.fromUInt(49));
        // int128 _tmp;
        // for (uint256 i = 0; i < 49; i++) {
        //     _tmp = ABDKMath64x64.sub(_stdSeq[i], _mean);
        //     _variance = ABDKMath64x64.add(_variance, ABDKMath64x64.pow(_tmp, 2));
        // }
        // _variance = ABDKMath64x64.div(_variance, ABDKMath64x64.fromUInt(49));
        
        _T = block.number.sub(_rawPriceList[2]).mul(timespan_);
        return (_variance, _T, _rawPriceList[0], _rawPriceList[1], _rawPriceList[2]);
    }

}