// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/ABDKMath64x64.sol";
import "./interface/INest_3_OfferPrice.sol";
import "./interface/ICoFiXKTable.sol";
import "./lib/TransferHelper.sol";
import "./interface/ICoFiXController.sol";

// Controller contract to call NEST Oracle for prices, managed by governance
// Governance role of this contract should be the `Timelock` contract, which is further managed by a multisig contract
contract CoFiXController is ICoFiXController {

    using SafeMath for uint256;
    
    uint256 constant public AONE = 1 ether;
    uint256 constant public K_BASE = 1E8;
    uint256 constant internal TIMESTAMP_MODULUS = 2**32;
    int128 constant internal SIGMA_STEP = 0x346DC5D638865; // (0.00005*2**64).toString(16), 0.00005 as 64.64-bit fixed point
    int128 constant internal ZERO_POINT_FIVE = 0x8000000000000000; // (0.5*2**64).toString(16)
    uint256 constant internal K_EXPECTED_VALUE = 0.0025*1E8;

    mapping(address => uint32[3]) internal KInfoMap; // gas saving, index [0] is k vlaue, index [1] is updatedAt, index [2] is theta
    mapping(address => bool) public callerAllowed;

    // managed by governance
    address public governance;
    address public oracle;
    address public nestToken;
    address public factory;
    address public kTable;
    uint256 public timespan = 14;
    uint256 public kRefreshInterval = 5 minutes;
    uint256 public DESTRUCTION_AMOUNT = 0 ether; // from nest oracle
    int128 public MAX_K0 = 0xCCCCCCCCCCCCD00; // (0.05*2**64).toString(16)
    int128 public GAMMA = 0x8000000000000000; // (0.5*2**64).toString(16)

    modifier onlyGovernance() {
        require(msg.sender == governance, "CoFiXCtrl: !governance");
        _;
    }

    constructor(address _priceOracle, address _nest, address _factory, address _kTable) public {
        governance = msg.sender;
        oracle = _priceOracle;
        nestToken = _nest;
        factory = _factory;
        kTable = _kTable;
    }

    receive() external payable {}

    /* setters for protocol governance */
    function setGovernance(address _new) external onlyGovernance {
        governance = _new;
        emit NewGovernance(_new);
    }

    function setOracle(address _priceOracle) external onlyGovernance {
        oracle = _priceOracle;
        emit NewOracle(_priceOracle);
    }

    function setKTable(address _kTable) external onlyGovernance {
        kTable = _kTable;
        emit NewKTable(_kTable);
    }    

    function setTimespan(uint256 _timeSpan) external onlyGovernance {
        timespan = _timeSpan;
        emit NewTimespan(_timeSpan);
    }

    function setKRefreshInterval(uint256 _interval) external onlyGovernance {
        kRefreshInterval = _interval;
        emit NewKRefreshInterval(_interval);
    }

    function setOracleDestructionAmount(uint256 _amount) external onlyGovernance {
        DESTRUCTION_AMOUNT = _amount;
    }

    function setKLimit(int128 maxK0) external onlyGovernance {
        MAX_K0 = maxK0;
        emit NewKLimit(maxK0);
    }

    function setGamma(int128 _gamma) external onlyGovernance {
        GAMMA = _gamma;
        emit NewGamma(_gamma);
    }
    
    function setTheta(address token, uint32 theta) external onlyGovernance {
        KInfoMap[token][2] = theta;
        emit NewTheta(token, theta);
    }

    // Activate on NEST Oracle, should not be called twice for the same nest oracle
    function activate() external onlyGovernance {
        // address token, address from, address to, uint value
        TransferHelper.safeTransferFrom(nestToken, msg.sender, address(this), DESTRUCTION_AMOUNT);
        // address token, address to, uint value
        TransferHelper.safeApprove(nestToken, oracle, DESTRUCTION_AMOUNT);
        INest_3_OfferPrice(oracle).activation(); // nest.transferFrom will be called
        TransferHelper.safeApprove(nestToken, oracle, 0); // ensure safety
    }

    function addCaller(address caller) external override {
        require(msg.sender == factory || msg.sender == governance, "CoFiXCtrl: only factory or gov");
        callerAllowed[caller] = true;
    }

    // Calc variance of price and K in CoFiX is very expensive
    // We use expected value of K based on statistical calculations here to save gas
    // In the future, NEST could provide the variance of price directly. We can adopt it then.
    // We can make use of `data` bytes in the future
    function queryOracle(address token, bytes memory /*data*/) external override payable returns (uint256 _k, uint256, uint256, uint256, uint256) {
        require(callerAllowed[msg.sender], "CoFiXCtrl: caller not allowed");
        return getLatestPrice(token);
    }

    // // We can make use of `data` bytes in the future
    // function queryOracle(address token, bytes memory /*data*/) external override payable returns (uint256 _k, uint256, uint256, uint256, uint256) {
    //     require(callerAllowed[msg.sender], "CoFiXCtrl: caller not allowed");

    //     uint256 _now = block.timestamp % TIMESTAMP_MODULUS; // 2106

    //     {
    //         uint256 _lastUpdate = KInfoMap[token][1];
    //         if (_now >= _lastUpdate && _now.sub(_lastUpdate) <= kRefreshInterval) { // lastUpdate (2105) | 2106 | now (1)
    //             return getLatestPrice(token);
    //         }
    //     }

    //     uint256 _balanceBefore = address(this).balance;
    //     // int128 K0; // K0AndK[0]
    //     // int128 K; // K0AndK[1]
    //     int128[2] memory K0AndK;
    //     // OraclePrice memory _op;
    //     uint256[7] memory _op;

    //     int128 _variance;
    //     // (_variance, _op.T, _op.ethAmount, _op.erc20Amount, _op.blockNum) = calcVariance(token);
    //     (_variance, _op[0], _op[1], _op[2], _op[3]) = calcVariance(token);

    //     {
    //         // int128 _volatility = ABDKMath64x64.sqrt(_variance);
    //         // int128 _sigma = ABDKMath64x64.div(_volatility, ABDKMath64x64.sqrt(ABDKMath64x64.fromUInt(timespan)));
    //         int128 _sigma = ABDKMath64x64.sqrt(ABDKMath64x64.div(_variance, ABDKMath64x64.fromUInt(timespan))); // combined into one sqrt

    //         // tIdx is _op[4]
    //         // sigmaIdx is _op[5]
    //         _op[4] = (_op[0].add(5)).div(10); // rounding to the nearest
    //         _op[5] = ABDKMath64x64.toUInt(
    //                     ABDKMath64x64.add(
    //                         ABDKMath64x64.div(_sigma, SIGMA_STEP), // _sigma / 0.0001, e.g. (0.00098/0.0001)=9.799 => 9
    //                         ZERO_POINT_FIVE // e.g. (0.00098/0.0001)+0.5=10.299 => 10
    //                     )
    //                 );
    //         if (_op[5] > 0) {
    //             _op[5] = _op[5].sub(1);
    //         }

    //         // getK0(uint256 tIdx, uint256 sigmaIdx)
    //         // K0 is K0AndK[0]
    //         K0AndK[0] = ICoFiXKTable(kTable).getK0(
    //             _op[4], 
    //             _op[5]
    //         );

    //         // K = gamma * K0
    //         K0AndK[1] = ABDKMath64x64.mul(GAMMA, K0AndK[0]);

    //         emit NewK(token, K0AndK[1], _sigma, _op[0], _op[1], _op[2], _op[3], _op[4], _op[5], K0AndK[0]);
    //     }

    //     require(K0AndK[0] <= MAX_K0, "CoFiXCtrl: K0");

    //     {
    //         // we could decode data in the future to pay the fee change and mining award token directly to reduce call cost
    //         // TransferHelper.safeTransferETH(payback, msg.value.sub(_balanceBefore.sub(address(this).balance)));
    //         uint256 oracleFeeChange = msg.value.sub(_balanceBefore.sub(address(this).balance));
    //         if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    //         _k = ABDKMath64x64.toUInt(ABDKMath64x64.mul(K0AndK[1], ABDKMath64x64.fromUInt(K_BASE)));
    //         _op[6] = KInfoMap[token][2]; // theta
    //         KInfoMap[token][0] = uint32(_k); // k < MAX_K << uint32(-1)
    //         KInfoMap[token][1] = uint32(_now); // 2106
    //         return (_k, _op[1], _op[2], _op[3], _op[6]);
    //     }
    // }

    // function getKInfo(address token) external view returns (uint32 k, uint32 updatedAt, uint32 theta) {
    //     k = KInfoMap[token][0];
    //     updatedAt = KInfoMap[token][1];
    //     theta = KInfoMap[token][2];
    // }

    function getKInfo(address token) external view returns (uint32 k, uint32 updatedAt, uint32 theta) {
        k = uint32(K_EXPECTED_VALUE);
        updatedAt = uint32(block.timestamp);
        theta = KInfoMap[token][2];
    }

    function getLatestPrice(address token) internal returns (uint256 _k, uint256 _ethAmount, uint256 _erc20Amount, uint256 _blockNum, uint256 _theta) {
        uint256 _balanceBefore = address(this).balance;
        uint256[] memory _rawPriceList = INest_3_OfferPrice(oracle).updateAndCheckPriceList{value: msg.value}(token, 1);
        require(_rawPriceList.length == 3, "CoFiXCtrl: bad price len");
        // validate T
        uint256 _T = block.number.sub(_rawPriceList[2]).mul(timespan);
        require(_T < 900, "CoFiXCtrl: oralce price outdated");
        uint256 oracleFeeChange = msg.value.sub(_balanceBefore.sub(address(this).balance));
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
        return (K_EXPECTED_VALUE, _rawPriceList[0], _rawPriceList[1], _rawPriceList[2], KInfoMap[token][2]);
    }

    // calc Variance, a.k.a. sigma squared
    function calcVariance(address token) internal returns (
        int128 _variance,
        uint256 _T,
        uint256 _ethAmount,
        uint256 _erc20Amount,
        uint256 _blockNum
    ) // keep these variables to make return values more clear
    {

        // query raw price list from nest oracle (newest to oldest)
        uint256[] memory _rawPriceList = INest_3_OfferPrice(oracle).updateAndCheckPriceList{value: msg.value}(token, 50);
        require(_rawPriceList.length == 150, "CoFiXCtrl: bad price len");
        // calc P a.k.a. price from the raw price data (ethAmount, erc20Amount, blockNum)
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
        // Option 2: calc mean value first and then calc variance
        // Use option 1 for gas saving
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
        
        _T = block.number.sub(_rawPriceList[2]).mul(timespan);
        return (_variance, _T, _rawPriceList[0], _rawPriceList[1], _rawPriceList[2]);
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
}