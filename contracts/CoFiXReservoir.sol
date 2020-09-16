// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/ICoFiXReservoir.sol";

contract CoFiXReservoir is ICoFiXReservoir {

    using SafeMath for uint256;

    address public cofiToken;

    uint256 public constant RATE_BASE = 1e18;

    uint256 public genesisBlock; // TODO: make this constant to reduce gas cost

    // managed by governance
    address public governance;

    uint256 public initCoFiRate = 10*1e18; // yield per block
    uint256 public decayPeriod = 2400000; // yield decays for every 2,400,000 blocks
    uint256 public decayRate = 80; // (0.8*2**64).toString(16), 0.8 as 64.64-bit fixed point

    // int128 public decayRateFP = 0xCCCCCCCCCCCCD000; // (0.8*2**64).toString(16), 0.8 as 64.64-bit fixed point

    address[] public allPools;

    mapping (address => bool) public cofiPools;
    // mapping (address => uint256) public cofiPoolSpeeds; // yield per block for each pool (CoFiXStakingRewards pool)

    event NewPoolAdded(address pool, uint256 index);

    constructor() public {
        governance = msg.sender;
        genesisBlock = block.number;
    }

    /* setters for protocol governance */
    function setGovernance(address _new) external override {
        require(msg.sender == governance, "CReservoir: !governance");
        governance = _new;
    }

    function setInitCoFiRate(uint256 _new) external override {
        require(msg.sender == governance, "CReservoir: !governance");
        initCoFiRate = _new;
    }

    function setDecayPeriod(uint256 _new) external override {
        require(msg.sender == governance, "CReservoir: !governance");
        require(_new != 0, "CReservoir: wrong period setting");
        decayPeriod = _new;
    }

    function setDecayRate(uint256 _new) external override {
        require(msg.sender == governance, "CReservoir: !governance");
        decayRate = _new;
    }

    function addPool(address pool) external override {
        require(msg.sender == governance, "CReservoir: !governance");
        require(cofiPools[pool] == false, "CReservoir: pool added");
        cofiPools[pool] = true;
        allPools.push(pool);
        emit NewPoolAdded(pool, allPools.length);
    }

    // this function should never fail when pool contract calling it
    function transferCoFi(uint256 amount) external override returns (uint256) {
        // TODO: not sure if we could let governance exec this, so we can support other distribute methods in the future
        require(cofiPools[msg.sender] == true, "CReservoir: only pool allowed");
        uint256 balance = IERC20(cofiToken).balanceOf(address(this));
        if (amount > balance) {
            amount = balance;
        }
        IERC20(cofiToken).transfer(msg.sender, amount); // allow zero amount
        return amount;
    }    

    function currentPeriod() public override view returns (uint256) {
        return (block.number).sub(genesisBlock).div(decayPeriod);
        // TODO: prevent index too large
    }

    // function currentDecay() public view returns (int128) {
    //     uint256 periodIdx = currentPeriod();
    //     return ABDKMath64x64.pow(decayRateFP, periodIdx); // TODO: prevent index too large
    // }

    // no need to calc by pow and float point
    // function currentCoFiRateByPow() public view returns (uint256) {
    //     // initCoFiRate * ((decayRate)^((block.number-genesisBlock)/decayPeriod))
    //     int128 decayRatio = ABDKMath64x64.mul(
    //         currentDecay(), // 0~1
    //         ABDKMath64x64.fromUInt(RATE_BASE)
    //     ); // TODO: verify decayRatio var is small 
    //     return uint256(ABDKMath64x64.toUInt(decayRatio)).mul(initCoFiRate).div(RATE_BASE); // TODO: if we want mul not overflow revert, should limit initCoFiRate
    // }

    function currentCoFiRate() public override view returns (uint256) {
        uint256 periodIdx = currentPeriod();
        if (periodIdx > 5) {
            periodIdx = 5;
        }
        uint256 cofiRate = initCoFiRate;
        uint256 _decayRate = decayRate;
        for (uint256 i = 0; i < periodIdx; i++) {
            cofiRate = cofiRate.mul(_decayRate).div(100);
        }
        return cofiRate;
    }

    function currentPoolRate() external override view returns (uint256 poolRate) {
        uint256 cofiRate = currentCoFiRate();
        poolRate = cofiRate.div(allPools.length);
        return poolRate;
    }
}