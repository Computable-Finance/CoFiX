// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/ICoFiXVaultForTrader.sol";
import "./interface/ICoFiToken.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interface/ICoFiXFactory.sol";
import "./interface/ICoFiXVaultForLP.sol";
import "./interface/ICoFiXStakingRewards.sol";
import "./interface/ICoFiXPair.sol";

// Reward Pool Controller for Trader
// Trade to earn CoFi Token
contract CoFiXVaultForTrader is ICoFiXVaultForTrader, ReentrancyGuard {
    using SafeMath for uint256;

    struct CoFiRateCache {
        uint128 cofiRate;
        uint128 updatedBlock;
    }

    uint256 public constant RATE_BASE = 1e18;
    uint256 public constant LAMBDA_BASE = 100;
    uint256 public constant RECENT_RANGE = 300;

    uint256 public constant SHARE_BASE = 100;
    uint256 public constant SHARE_FOR_TRADER = 80;
    uint256 public constant SHARE_FOR_LP = 10;
    uint256 public constant SHARE_FOR_CNODE = 10;

    uint256 constant public NAVPS_BASE = 1E18; // NAVPS (Net Asset Value Per Share), need accuracy

    // make all of these constant, so we can reduce gas cost for swap features
    uint256 public constant COFI_DECAY_PERIOD = 2400000; // LP pool yield decays for every 2,400,000 blocks
    uint256 public constant THETA_FEE_UINIT = 1 ether;
    // we may have different theta for different pairs in the future, but just use the constant here for gas reason
    uint256 public constant SINGLE_LIMIT_K = 100*1e18*1/1000; // K= L*theta, 100 ether * theta, theta is 0.0001, means thetaFee 0.1 ether
    uint256 public constant COFI_RATE_UPDATE_INTERVAL = 1000;

    address public cofiToken;
    address public factory;

    uint256 public genesisBlock; // TODO: make this constant to reduce gas cost

    // managed by governance
    address public governance;

    uint256 public pendingRewardsForCNode;

    mapping (address => CoFiRateCache) internal cofiRateCache;
    mapping(address => uint256) public pendingRewardsForLP; // pair address to pending rewards amount
    mapping (address => bool) public routerAllowed;

    uint128 public lastMinedBlock; // last block mined cofi token
    uint128 public lastDensity; // last mining density, see currentDensity()

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

    function calcCoFiRate(uint256 bt, uint256 xt, uint256 np, uint256 q) public override pure returns (uint256 at) {
        /*
        at = (bt/q)*2400000/(xt*np*0.3)
        - at is CoFi yield per unit
        - bt is the current CoFi rate of the specific XToken staking rewards pool
        - xt is totalSupply of the specific XToken
        - np is Net Asset Value Per Share for the specific XToken
        - q is the total count of the XToken staking rewards pools
        e.g. 10/1 * 2400000 / (20000 * 1 * 0.3) = 4000
        take decimal into account: 10*1e18 / 1 * 2400000 /( 20000*1e18 * 1e18/1e18 * 0.3 ) * 1e18 = 4000 * 1e18
        */
        uint256 tvl = xt.mul(np).div(NAVPS_BASE); // total locked value represent in ETH
        if (tvl < 20000 ether) {
            tvl = 20000 ether; // minimum total locked value requirement
        }
        uint256 numerator = bt.mul(COFI_DECAY_PERIOD).mul(1e18).mul(10);
        if (q == 0) {
            q = 1; // or swap could fail
        }
        at = numerator.div(3).div(tvl).div(q);
    }

    // np need price, must be a param passing in
    function currentCoFiRate(address pair, uint256 np) public override view returns (uint256) {
        // get np from router
        // get bt from CoFiXVaultForLP: cofiRateForLP
        // get q from CoFiXVaultForLP: poolCnt
        // get xt from XToken.totalSupply: totalSupply
        uint256 updatedBlock = cofiRateCache[pair].updatedBlock;
        if (block.number.sub(updatedBlock) < COFI_RATE_UPDATE_INTERVAL && updatedBlock != 0) {
            return cofiRateCache[pair].cofiRate;
        } 
        address vaultForLP = ICoFiXFactory(factory).getVaultForLP(); // TODO: handle zero
        uint256 cofiRateForLP = ICoFiXVaultForLP(vaultForLP).currentCoFiRate();
        uint256 poolCnt = ICoFiXVaultForLP(vaultForLP).getEnabledPoolCnt();
        uint256 totalSupply = ICoFiXPair(pair).totalSupply();
        return calcCoFiRate(cofiRateForLP, totalSupply, np, poolCnt);
    }

    function currentThreshold(uint256 cofiRate) public override view returns (uint256) {
        return SINGLE_LIMIT_K.mul(cofiRate).div(THETA_FEE_UINIT);
    }

    function stdMiningRateAndAmount(
        address pair,
        uint256 np,
        uint256 thetaFee
    ) public override view returns (
        uint256 cofiRate,
        uint256 stdAmount
    ) {
        // thetaFee / THETA_FEE_UINIT * currentCoFiRate
        cofiRate = currentCoFiRate(pair, np);
        stdAmount = thetaFee.mul(cofiRate).div(THETA_FEE_UINIT);
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

    function actualMiningAmountAndDensity(
        address pair,
        uint256 thetaFee,
        uint256 x,
        uint256 y,
        uint256 np
    ) public override view returns (
        uint256 amount,
        uint256 density,
        uint256 cofiRate
    ) {
        uint256 stdAmount;
        (cofiRate, stdAmount) = stdMiningRateAndAmount(pair, np, thetaFee);
        density = calcDensity(stdAmount); // ft
        uint256 lambda = calcLambda(x, y);
        uint256 th = currentThreshold(cofiRate); // threshold of mining rewards amount, k*at
        if (density <= th) {
            // ft<=k, yt*at * lambda, yt is thetaFee, at is cofiRate
            return (stdAmount.mul(lambda).div(LAMBDA_BASE), density, cofiRate);
        }
        // ft>=k: yt*at * k*at * (2ft - k*at) * lambda / (ft*ft), yt*at is stdAmount, k*at is threshold
        uint256 numerator = stdAmount.mul(th).mul(density.mul(2).sub(th)).mul(lambda);
        return (numerator.div(density).div(density).div(LAMBDA_BASE), density, cofiRate);
    }

    function distributeReward(
        address pair,
        uint256 thetaFee,
        uint256 x,
        uint256 y,
        uint256 np,
        address rewardTo
    ) external override nonReentrant {
        require(routerAllowed[msg.sender] == true, "CVaultForTrader: not allowed router");  // caution: be careful when adding new router

        uint256 amount;
        {
            uint256 density;
            uint256 cofiRate;
            (amount, density, cofiRate) = actualMiningAmountAndDensity(pair, thetaFee, x, y, np);

            // gas saving, distributeReward is used in router::swap
            require(density < 2**128, "CVaultForTrader: density overflow");
            lastDensity = uint128(density); // safe convert from uint256 to uint128
            lastMinedBlock = uint128(block.number); // uint128 is enough for block.number
        
            uint128 updatedBlock = cofiRateCache[pair].updatedBlock; // sigh, one more sload here
            if (block.number.sub(updatedBlock) >= COFI_RATE_UPDATE_INTERVAL || updatedBlock == 0) {
                cofiRateCache[pair].updatedBlock = uint128(block.number); // enough for block number
                cofiRateCache[pair].cofiRate = uint128(cofiRate); // almost impossible to overflow
            }
        }

        // TODO: think about add a mint role check, to ensure this call never fail?
        {
            uint256 amountForTrader = amount.mul(SHARE_FOR_TRADER).div(SHARE_BASE);
            uint256 amountForLP = amount.mul(SHARE_FOR_LP).div(SHARE_BASE);
            uint256 amountForCNode = amount.mul(SHARE_FOR_CNODE).div(SHARE_BASE);

            ICoFiToken(cofiToken).mint(rewardTo, amountForTrader); // allows zero, send to receiver directly, reduce gas cost
            pendingRewardsForLP[pair] = pendingRewardsForLP[pair].add(amountForLP); // possible key: token or pair, we use pair here
            pendingRewardsForCNode = pendingRewardsForCNode.add(amountForCNode);
        }

    }

    function clearPendingRewardOfCNode() external override nonReentrant {
        address vaultForCNode = ICoFiXFactory(factory).getVaultForCNode();
        require(msg.sender == vaultForCNode, "CVaultForTrader: only vaultForCNode"); // caution
        // uint256 pending = pendingRewardsForCNode;
        emit ClearPendingRewardOfCNode(pendingRewardsForCNode);
        pendingRewardsForCNode = 0; // take all, set to 0
        // ICoFiToken(cofiToken).mint(msg.sender, pending); // no need to mint from here, we can mint directly in valult
    }

    // vaultForLP should ensure passing the correct pair address
    function clearPendingRewardOfLP(address pair) external override nonReentrant {
        address vaultForLP = ICoFiXFactory(factory).getVaultForLP();
        require(msg.sender == vaultForLP, "CVaultForTrader: only vaultForLP"); // caution 
        emit ClearPendingRewardOfLP(pendingRewardsForLP[pair]);
        pendingRewardsForLP[pair] = 0; // take all, set to 0
        // ICoFiToken(cofiToken).mint(to, pending); // no need to mint from here, we can mint directly in valult
    }

    function getPendingRewardOfCNode() external override view returns (uint256) {
        return pendingRewardsForCNode;
    }

    function getPendingRewardOfLP(address pair) external override view returns (uint256) {
        return pendingRewardsForLP[pair];
    }

    function getCoFiRateCache(address pair) external override view returns (uint256 cofiRate, uint256 updatedBlock) {
        return (cofiRateCache[pair].cofiRate, cofiRateCache[pair].updatedBlock);
    }

}