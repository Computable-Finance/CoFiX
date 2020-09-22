// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/ICoFiXVaultForTrader.sol";

contract CoFiXVaultForTrader is ICoFiXVaultForTrader {
    using SafeMath for uint256;

    uint256 public constant RATE_BASE = 1e18;
    uint256 public constant LAMBDA_BASE = 100;
    uint256 public constant S_BASE = 1e8;
    uint256 public constant INIT_SUPPLY = 50_000_000*1e18;

    address public cofiToken;

    uint256 public genesisBlock; // TODO: make this constant to reduce gas cost

    // managed by governance
    address public governance;

    uint256 public initCoFiRate = 10*1e18; // yield per block
    uint256 public cofiDecayPeriod = 7200; // yield decays for every 2,400,000 blocks
    int128 public cofiDecayRate = 0xFFBE76C8B4395800; // (0.999*2**64).toString(16), 0.999 as 64.64-bit fixed point

    uint256 public thetaFeeUnit = 0.01 ether;

    uint256 public initS = 1e8; // 1 * S_BASE
    uint256 public sDecayOffset = 100000*1e18;
    int128 public sDecayRate = 0xF851EB851EB85000;  // (0.97*2**64).toString(16), 0.97 as 64.64-bit fixed point

    uint256 public singleLimitM = 50000*1e18;

    uint256 public constant RECENT_RANGE = 300;

    struct CoFiMiningInfo {
        uint256 minedSnapshot; // cofi mined snapshot, mined = INIT_SUPPLY - currentBalanceOf(this)
        uint256 preMinedAt; // block number
    }

    mapping (address => bool) public routerAllowed;

    mapping (uint256 => CoFiMiningInfo) public minedBlockRecords;

    uint256 public lastMinedBlock; // last block mined cofi token

    constructor() public {
        governance = msg.sender;
        genesisBlock = block.number;
    }

    function allowRouter(address router) external override {
        require(msg.sender == governance, "CVaultForTrader: !governance");
        require(routerAllowed[router] == false, "CVaultForTrader: router allowed");
        routerAllowed[router] = true;
        emit RouterAllowed(router);
    }

    function disallowRouter(address router) external override {
        require(msg.sender == governance, "CVaultForTrader: !governance");
        require(routerAllowed[router] == true, "CVaultForTrader: router disallowed");
        routerAllowed[router] = false;
        emit RouterDisallowed(router);
    }

    function _addDistributeRecord() internal {
        uint256 _previous = lastMinedBlock;
        if (block.number != _previous) {
            minedBlockRecords[block.number].preMinedAt = _previous;
            lastMinedBlock = block.number;
            minedBlockRecords[block.number].minedSnapshot = INIT_SUPPLY.sub(currentCoFiLeft()); // only set once, it's the mined snapshot before the distribution of this block
        }
    }

    function currentPeriod() public override view returns (uint256) {
        return (block.number).sub(genesisBlock).div(cofiDecayPeriod);
        // TODO: prevent index too large
    }

    function currentDecay() public override view returns (int128) {
        uint256 periodIdx = currentPeriod();
        return ABDKMath64x64.pow(cofiDecayRate, periodIdx); // TODO: prevent index too large
    }

    function currentCoFiRate() public override view returns (uint256) {
        // initCoFiRate * ((cofiDecayRate)^((block.number-genesisBlock)/cofiDecayPeriod))
        int128 decayRatio = ABDKMath64x64.mul(
            currentDecay(), // 0~1
            ABDKMath64x64.fromUInt(RATE_BASE)
        ); // TODO: verify decayRatio var is small 
        return uint256(ABDKMath64x64.toUInt(decayRatio)).mul(initCoFiRate).div(RATE_BASE); // TODO: if we want mul not overflow revert, should limit initCoFiRate
    }

    function stdMiningAmount(uint256 thetaFee) public override view returns (uint256) {
        // thetaFee / thetaFeeUnit * currentCoFiRate
        return thetaFee.mul(currentCoFiRate()).div(thetaFeeUnit);
    }

    function recentYield() public override view returns (uint256) {
        uint256 _last = lastMinedBlock;
        if (_last == 0) {
            return 0;
        }
        uint256 _offset = block.number.sub(_last);
        if (_offset > RECENT_RANGE) {
            return currentCoFiMined().sub(minedBlockRecords[_last].minedSnapshot);
        }
        uint256 _save;
        while (_last > 0 && _offset < RECENT_RANGE) {
            _save = _last;
            _last = minedBlockRecords[_last].preMinedAt;
            _offset = block.number.sub(_last);
        }
        // means _last is 0, but _save (the last _last) is not, _save is the oldest block recently (we do not have enough blocks)
        if (_last == 0) {
            return currentCoFiMined().sub(minedBlockRecords[_save].minedSnapshot);
        }
        // means find the oldest block recently
        return currentCoFiMined().sub(minedBlockRecords[_last].minedSnapshot);
    }

    // struct CoFiMiningRecord {
    //     uint256 blockNumber; // cofi mined at which block
    //     uint256 minedSnapshot; // cofi mined snapshot, mined = INIT_SUPPLY - currentBalanceOf(this)
    // }

    // CoFiMiningRecord[] public minedBlockList; // store the block numbers cofi got mined

    // // the yield of cofi during the last 300 blocks 
    // function recentBYield() public view returns (uint256) {
    //     uint256 len = minedBlockList.length;
    //     if (len > RECENT_RANGE) {
    //         uint256 stopIdx = len.sub(RECENT_RANGE);
    //         for (uint256 i = len.sub(1); i >= stopIdx; i--) {
    //             uint256 bn = minedBlockList[i].blockNumber;
    //             if (bn.sub(block.number) >= RECENT_RANGE) {
    //                 return currentCoFiMined().sub(minedBlockList[i].minedSnapshot);
    //             }
    //         }
    //     } else if (len == 0) {
    //         return 0;
    //     } else {
    //         return currentCoFiMined().sub(minedBlockList[0].minedSnapshot); // calc how many mined during the offset
    //     }
    // }

    function calcLambda(uint256 x, uint256 y) public override pure returns (uint256) {
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

    function currentCoFiLeft() public override view returns (uint256) {
        return IERC20(cofiToken).balanceOf(address(this));
    }

    function currentCoFiMined() public override view returns (uint256) {
        return INIT_SUPPLY.sub(currentCoFiLeft());
    }

    function currentS() public override view returns (uint256) {
        // initS * ( sDecayRate^(distributed/sDecayOffset) ), distributed = INIT_SUPPLY - currentBalance
        uint256 distributed = INIT_SUPPLY.sub(IERC20(cofiToken).balanceOf(address(this)));
        uint256 power = distributed.div(sDecayOffset);
        int128 decay = ABDKMath64x64.pow(sDecayRate, power);
        int128 s = ABDKMath64x64.mul(
            ABDKMath64x64.fromUInt(initS), // 1e8*2**64
            decay // (0~1)*2**64
        );
        return ABDKMath64x64.toUInt(s); // 1e8 * (0.97)^n
    }

    function actualMiningAmount(uint256 thetaFee, uint256 x, uint256 y) public override view returns (uint256) {
        uint256 O_T = stdMiningAmount(thetaFee);
        // uint256 O_recent = recentBYield();
        uint256 O_recent = recentYield();
        uint256 Q = O_T.add(O_recent);
        uint256 s = currentS(); // with S_BASE
        uint256 ms = singleLimitM.mul(s).div(S_BASE); // TODO: verify precision here
        uint256 lambda = calcLambda(x, y);
        if (Q <= ms) {
            return O_T.mul(lambda).div(LAMBDA_BASE);
        } else {
            // O_T * ms * (2Q - ms) * lambda / (Q * Q)
            return O_T.mul(ms).mul(Q.mul(2).sub(ms)).mul(lambda).div(Q).div(Q);
        }
    }

    function distributeTradingReward(uint256 thetaFee, uint256 x, uint256 y, address mineTo) public override {
        require(routerAllowed[msg.sender] == true, "CVaultForTrader: not allowed router");
        uint256 balance = IERC20(cofiToken).balanceOf(address(this));
        if (balance == 0) {
            return; // no need to calc minng amount
        }
        uint256 amount = actualMiningAmount(thetaFee, x, y);
        if (amount > balance) {
            amount = balance;
        }
        _addDistributeRecord(); // TODO: verify, save minedSnapshot before transfer 
        _transferCoFi(amount, mineTo); // send to receiver directly, reduce gas cost
    }

    function _transferCoFi(uint256 amount, address to) internal returns (uint256) {
        IERC20(cofiToken).transfer(to, amount); // allows zero amount
        return amount;
    }

}