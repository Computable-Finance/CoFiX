// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/ICoFiXVaultForTrader.sol";
import "./interface/ICoFiToken.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interface/ICoFiXFactory.sol";


contract CoFiXVaultForTrader is ICoFiXVaultForTrader, ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant RATE_BASE = 1e18;
    uint256 public constant LAMBDA_BASE = 100;
    uint256 public constant RECENT_RANGE = 300;

    uint256 public constant SHARE_BASE = 100;
    uint256 public constant SHARE_FOR_TRADER = 80;
    uint256 public constant SHARE_FOR_LP = 10;
    uint256 public constant SHARE_FOR_CNODE = 10;

    address public cofiToken;
    address public factory;

    uint256 public genesisBlock; // TODO: make this constant to reduce gas cost

    // managed by governance
    address public governance;

    uint256 public initCoFiRate = 10*1e18; // yield per unit
    uint256 public cofiDecayPeriod = 2400000; // yield decays for every 2,400,000 blocks
    int128 public cofiDecayRate = 0xCCCCCCCCCCCCD000; // (0.8*2**64).toString(16), 0.8 as 64.64-bit fixed point

    uint256 public thetaFeeUnit = 0.01 ether;

    uint256 public singleLimitK = 100*1e18;

    uint256 public pendingRewardsForCNode;

    mapping(address => uint256) public pendingRewardsForLP; // pair address to pending rewards amount
    mapping (address => bool) public routerAllowed;

    // TODO: Combine to reduce write gas cost
    uint256 public lastMinedBlock; // last block mined cofi token
    uint256 public lastDensity; // last mining density, see currentDensity()

    constructor(address cofi, address _factory) public {
        cofiToken = cofi;
        factory = _factory;
        governance = msg.sender;
        genesisBlock = block.number;
    }

    /* setters for protocol governance */
    function setGovernance(address _new) external override {
        require(msg.sender == governance, "CVaultForTrader: !governance");
        governance = _new;
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

    function currentPeriod() public override view returns (uint256) {
        return (block.number).sub(genesisBlock).div(cofiDecayPeriod);
        // TODO: prevent index too large
    }

    function currentDecay() public override view returns (int128) {
        uint256 periodIdx = currentPeriod();
        // TODO: max value for periodIdx
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

    function currentThreshold(uint256 cofiRate) public override view returns (uint256) {
        return singleLimitK.mul(cofiRate).div(thetaFeeUnit);
    }

    function stdMiningRateAndAmount(uint256 thetaFee) public override view returns (uint256 cofiRate, uint256 stdAmount) {
        // thetaFee / thetaFeeUnit * currentCoFiRate
        cofiRate = currentCoFiRate();
        stdAmount = thetaFee.mul(cofiRate).div(thetaFeeUnit);
        return (cofiRate, stdAmount);
    }

    // s >= 300: f_t = yt * at, (yt * at is stdMiningAmount)
    // s < 300: f_t = f_{t-1} * (300 - s) / 300 + yt * at
    function calcDensity(uint256 _stdAmount) public override view returns (uint256) {
        uint256 _last = lastMinedBlock;
        uint256 _offset = block.number.sub(_last);
        if (_offset >= RECENT_RANGE) {
            return _stdAmount;
        } else {
            uint256 _lastDensity = lastDensity;
            return _lastDensity.mul(RECENT_RANGE.sub(_offset)).div(RECENT_RANGE).add(_stdAmount);
        }
    }

    function calcLambda(uint256 x, uint256 y) public override pure returns (uint256) {
        // (0.1 0.33 3 10) => (10 33 300 1000)
        uint256 ratio;
        if (y == 0) {
            ratio = 1000;
        } else {
            ratio = x.mul(LAMBDA_BASE).div(y);
        }
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

    function actualMiningAmountAndDensity(uint256 thetaFee, uint256 x, uint256 y) public override view returns (uint256 amount, uint256 density) {
        (uint256 cofiRate, uint256 stdAmount) = stdMiningRateAndAmount(thetaFee);
        density = calcDensity(stdAmount); // f
        uint256 lambda = calcLambda(x, y);
        uint256 th = currentThreshold(cofiRate); // threshold of mining rewards amount, k*at
        // TODO: confirm, we don't include density here?
        if (stdAmount <= th) { // we can use thetaFee vs singleLimitK here too, but just use memory results for gas saving
            // yt<=k, yt*at * lambda, yt is thetaFee, at is cofiRate
            return (stdAmount.mul(lambda).div(LAMBDA_BASE), density);
        }
        // yt>=k: yt*at * k*at * (2ft - k*at) * lambda / (ft*ft), yt*at is stdAmount, k*at is threshold
        uint256 numerator = stdAmount.mul(th).mul(density.mul(2).sub(th)).mul(lambda);
        return (numerator.div(density).div(density).div(LAMBDA_BASE), density);
    }

    function distributeReward(address pair, uint256 thetaFee, uint256 x, uint256 y, address mineTo) external override nonReentrant {
        require(routerAllowed[msg.sender] == true, "CVaultForTrader: not allowed router");  // caution: be careful when adding new router

        (uint256 amount, uint256 density) = actualMiningAmountAndDensity(thetaFee, x, y);

        // TODO: update lastDensity & lastUpdateBlock
        lastDensity = density;
        lastMinedBlock = block.number; // TODO: only write when not equal

        // TODO: think about add a mint role check, to ensure this call never fail?
        uint256 amountForTrader = amount.mul(SHARE_FOR_TRADER).div(SHARE_BASE);
        uint256 amountForLP = amount.mul(SHARE_FOR_LP).div(SHARE_BASE);
        uint256 amountForCNode = amount.mul(SHARE_FOR_CNODE).div(SHARE_BASE);

        ICoFiToken(cofiToken).mint(mineTo, amountForTrader); // allows zero, send to receiver directly, reduce gas cost
        pendingRewardsForLP[pair] = pendingRewardsForLP[pair].add(amountForLP); // possible key: token or pair, we use pair here
        pendingRewardsForCNode = pendingRewardsForCNode.add(amountForCNode);
    }

    function clearPendingRewardOfCNode() external override nonReentrant {
        address vaultForCNode = ICoFiXFactory(factory).getVaultForCNode();
        require(msg.sender == vaultForCNode, "CVaultForTrader: only vaultForCNode"); // caution
        // uint256 pending = pendingRewardsForCNode;
        pendingRewardsForCNode = 0; // take all, set to 0
        // ICoFiToken(cofiToken).mint(msg.sender, pending); // no need to mint from here, we can mint directly in valult
    }

    // vaultForLP should ensure passing the correct pair address
    function clearPendingRewardOfLP(address pair) external override nonReentrant {
        address vaultForLP = ICoFiXFactory(factory).getVaultForLP();
        require(msg.sender == vaultForLP, "CVaultForTrader: only vaultForLP"); // caution 
        pendingRewardsForLP[pair] = 0; // take all, set to 0
        // ICoFiToken(cofiToken).mint(to, pending); // no need to mint from here, we can mint directly in valult
    }

    function getPendingRewardsOfCNode() external override view returns (uint256) {
        return pendingRewardsForCNode;
    }

    function getPendingRewardOfLP(address pair) external override view returns (uint256) {
        return pendingRewardsForLP[pair];
    }

}