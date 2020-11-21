// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/ABDKMath64x64.sol";
import "./interface/INest_3_OfferPrice.sol";
import "./interface/ICoFiXKTable.sol";
import "./lib/TransferHelper.sol";
import "./interface/ICoFiXController.sol";
import "./interface/INest_3_VoteFactory.sol";
import "./interface/ICoFiXPair.sol";
import "./interface/ICoFiXFactory.sol";

// Controller contract to call NEST Oracle for prices, managed by governance
// Governance role of this contract should be the `Timelock` contract, which is further managed by a multisig contract
contract CoFiXControllerV2 is ICoFiXController {  // ctrl-v2: change contract name to avoid truffle complaint

    using SafeMath for uint256;

    enum CoFiX_OP { QUERY, MINT, BURN, SWAP_WITH_EXACT, SWAP_FOR_EXACT } // operations in CoFiX

    uint256 constant public AONE = 1 ether;
    uint256 constant public K_BASE = 1E8;
    uint256 constant public NAVPS_BASE = 1E18; // NAVPS (Net Asset Value Per Share), need accuracy
    uint256 internal T = 600; // ctrl-v2: V1 (900) -> V2 (600)
    uint256 internal K_EXPECTED_VALUE = 0.005*1E8; // ctrl-v2: V1 (0.0025) -> V2 (0.005)
    // impact cost params
    uint256 constant internal C_BUYIN_ALPHA = 25700000000000; // α=2.570e-05*1e18
    uint256 constant internal C_BUYIN_BETA = 854200000000; // β=8.542e-07*1e18
    uint256 constant internal C_SELLOUT_ALPHA = 117100000000000; // α=-1.171e-04*1e18
    uint256 constant internal C_SELLOUT_BETA = 838600000000; // β=8.386e-07*1e18

    mapping(address => uint32[3]) internal KInfoMap; // gas saving, index [0] is k vlaue, index [1] is updatedAt, index [2] is theta
    mapping(address => bool) public callerAllowed;

    INest_3_VoteFactory public immutable voteFactory;

    // managed by governance
    address public governance;
    address public immutable nestToken;
    address public immutable factory;
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

    constructor(address _voteFactory, address _nest, address _factory, address _kTable) public {
        governance = msg.sender;
        voteFactory = INest_3_VoteFactory(address(_voteFactory));
        nestToken = _nest;
        factory = _factory;
        kTable = _kTable;

        // add previous pair as caller
        ICoFiXFactory cFactory = ICoFiXFactory(_factory);
        uint256 pairCnt = cFactory.allPairsLength();
        for (uint256 i = 0; i < pairCnt; i++) {
            address pair = cFactory.allPairs(i);
            callerAllowed[pair] = true;
        }
    }

    receive() external payable {}

    /* setters for protocol governance */
    function setGovernance(address _new) external onlyGovernance {
        governance = _new;
        emit NewGovernance(_new);
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

    function setTLimit(uint256 _T) external onlyGovernance { // ctrl-v2: new setter for T
        T = _T;
    }

    function setK(address token, uint32 k) external onlyGovernance { // ctrl-v2: new setter for K, adjustable by governance
        K_EXPECTED_VALUE = uint256(k);
        emit NewK(token, k); // new event for setting K
    }

    function setTheta(address token, uint32 theta) external onlyGovernance {
        KInfoMap[token][2] = theta;
        emit NewTheta(token, theta);
    }

    // Activate on NEST Oracle, should not be called twice for the same nest oracle
    function activate() external onlyGovernance {
        // address token, address from, address to, uint value
        TransferHelper.safeTransferFrom(nestToken, msg.sender, address(this), DESTRUCTION_AMOUNT);
        address oracle = voteFactory.checkAddress("nest.v3.offerPrice");
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
    // In the near future, NEST could provide the variance of price directly. We will adopt it then.
    // We can make use of `data` bytes in the future
    function queryOracle(address token, uint8 op, bytes memory data) external override payable returns (uint256 _k, uint256 _ethAmount, uint256 _erc20Amount, uint256 _blockNum, uint256 _theta) {
        require(callerAllowed[msg.sender], "CoFiXCtrl: caller not allowed");
        (_ethAmount, _erc20Amount, _blockNum) = getLatestPrice(token);
        CoFiX_OP cop = CoFiX_OP(op);
        uint256 impactCost;
        if (cop == CoFiX_OP.SWAP_WITH_EXACT) {
            impactCost = calcImpactCostFor_SWAP_WITH_EXACT(token, data, _ethAmount, _erc20Amount);
        } else if (cop == CoFiX_OP.SWAP_FOR_EXACT) {
            revert("disabled experimental feature!"); // ctrl-v2: disable swapForExact function
         } else if (cop == CoFiX_OP.BURN) {
            impactCost = calcImpactCostFor_BURN(token, data, _ethAmount, _erc20Amount);
        }
        _k = K_EXPECTED_VALUE.add(impactCost); // ctrl-v2: adjustable K + impactCost is the final K
        _theta = KInfoMap[token][2];
        return (_k, _ethAmount, _erc20Amount, _blockNum, _theta);
    }

    function calcImpactCostFor_BURN(address token, bytes memory data, uint256 ethAmount, uint256 erc20Amount) public view returns (uint256 impactCost) {
        // bytes memory data = abi.encode(msg.sender, outToken, to, liquidity);
        (, address outToken, , uint256 liquidity) = abi.decode(data, (address, address, address, uint256));
        // calc real vol by liquidity * np
        uint256 navps = ICoFiXPair(msg.sender).getNAVPerShare(ethAmount, erc20Amount); // pair call controller, msg.sender is pair
        uint256 vol = liquidity.mul(navps).div(NAVPS_BASE);
        if (outToken != token) {
            // buy in ETH, outToken is ETH
            return impactCostForBuyInETH(vol);
        }
        // sell out liquidity, outToken is token, take this as sell out ETH and get token
        return impactCostForSellOutETH(vol);
    }

    function calcImpactCostFor_SWAP_WITH_EXACT(address token, bytes memory data, uint256 ethAmount, uint256 erc20Amount) public pure returns (uint256 impactCost) {
        (, address outToken, , uint256 amountIn) = abi.decode(data, (address, address, address, uint256));
        if (outToken != token) {
            // buy in ETH, outToken is ETH, amountIn is token
            // convert to amountIn in ETH
            uint256 vol = uint256(amountIn).mul(ethAmount).div(erc20Amount);
            return impactCostForBuyInETH(vol);
        }
        // sell out ETH, amountIn is ETH
        return impactCostForSellOutETH(amountIn);
    }

    function calcImpactCostFor_SWAP_FOR_EXACT(address token, bytes memory data, uint256 ethAmount, uint256 erc20Amount) public pure returns (uint256 impactCost) {
        (, address outToken, uint256 amountOutExact,) = abi.decode(data, (address, address, uint256, address));
        if (outToken != token) {
            // buy in ETH, outToken is ETH, amountOutExact is ETH
            return impactCostForBuyInETH(amountOutExact);
        }
        // sell out ETH, amountIn is ETH, amountOutExact is token
        // convert to amountOutExact in ETH
        uint256 vol = uint256(amountOutExact).mul(ethAmount).div(erc20Amount);
        return impactCostForSellOutETH(vol);
    }

    // impact cost
    // - C = 0, if VOL < 500
    // - C = α + β * VOL, if VOL >= 500

    // α=2.570e-05，β=8.542e-07
    function impactCostForBuyInETH(uint256 vol) public pure returns (uint256 impactCost) {
        if (vol < 500 ether) {
            return 0;
        }
        // return C_BUYIN_ALPHA.add(C_BUYIN_BETA.mul(vol).div(1e18)).mul(1e8).div(1e18);
        return C_BUYIN_ALPHA.add(C_BUYIN_BETA.mul(vol).div(1e18)).div(1e10); // combine mul div
    }

    // α=-1.171e-04，β=8.386e-07
    function impactCostForSellOutETH(uint256 vol) public pure returns (uint256 impactCost) {
        if (vol < 500 ether) {
            return 0;
        }
        // return (C_SELLOUT_BETA.mul(vol).div(1e18)).sub(C_SELLOUT_ALPHA).mul(1e8).div(1e18);
        return (C_SELLOUT_BETA.mul(vol).div(1e18)).sub(C_SELLOUT_ALPHA).div(1e10); // combine mul div
    }

    function getKInfo(address token) external view returns (uint32 k, uint32 updatedAt, uint32 theta) {
        k = uint32(K_EXPECTED_VALUE); // ctrl-v2: load from storage instead of constant value
        updatedAt = uint32(block.timestamp);
        theta = KInfoMap[token][2];
    }

    function getLatestPrice(address token) internal returns (uint256 _ethAmount, uint256 _erc20Amount, uint256 _blockNum) {
        uint256 _balanceBefore = address(this).balance;
        address oracle = voteFactory.checkAddress("nest.v3.offerPrice");
        uint256[] memory _rawPriceList = INest_3_OfferPrice(oracle).updateAndCheckPriceList{value: msg.value}(token, 1);
        require(_rawPriceList.length == 3, "CoFiXCtrl: bad price len");
        // validate T
        uint256 _T = block.number.sub(_rawPriceList[2]).mul(timespan);
        require(_T < T, "CoFiXCtrl: oralce price outdated"); // ctrl-v2: adjustable T
        uint256 oracleFeeChange = msg.value.sub(_balanceBefore.sub(address(this).balance));
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
        return (_rawPriceList[0], _rawPriceList[1], _rawPriceList[2]);
        // return (K_EXPECTED_VALUE, _rawPriceList[0], _rawPriceList[1], _rawPriceList[2], KInfoMap[token][2]);
    }
    
    // ctrl-v2: remove unused code bellow according to PeckShield's advice
}