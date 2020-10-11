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

    uint256 public constant NAVPS_BASE = 1E18; // NAVPS (Net Asset Value Per Share), need accuracy

    // make all of these constant, so we can reduce gas cost for swap features
    uint256 public constant COFI_DECAY_PERIOD = 2400000; // LP pool yield decays for every 2,400,000 blocks
    uint256 public constant THETA_FEE_UINIT = 1 ether;
    uint256 public constant L_LIMIT = 100 ether;
    uint256 public constant COFI_RATE_UPDATE_INTERVAL = 1000;

    uint256 public constant EXPECT_YIELD_BASE = 10;
    uint256 public constant L_BASE = 1000;
    uint256 public constant THETA_BASE = 1000;

    address public immutable cofiToken;
    address public immutable factory;

    // managed by governance
    address public governance;
    uint256 public EXPECT_YIELD_RATIO = 3; // r, 0.3
    uint256 public L_RATIO = 2; // l, 0.002
    uint256 public THETA = 2; // 0.002

    uint256 public pendingRewardsForCNode;

    mapping (address => CoFiRateCache) internal cofiRateCache;
    mapping(address => uint256) public pendingRewardsForLP; // pair address to pending rewards amount
    mapping (address => bool) public routerAllowed;

    uint128 public lastMinedBlock; // last block mined cofi token
    uint128 public lastDensity; // last mining density, see currentDensity()

    modifier onlyGovernance() {
        require(msg.sender == governance, "CVaultForTrader: !governance");
        _;
    }

    constructor(address cofi, address _factory) public {
        cofiToken = cofi;
        factory = _factory;
        governance = msg.sender;
    }

    /* setters for protocol governance */
    function setGovernance(address _new) external override onlyGovernance {
        governance = _new;
    }

    function setExpectedYieldRatio(uint256 r) external override onlyGovernance {
        EXPECT_YIELD_RATIO = r;
    }

    function setLRatio(uint256 lRatio) external override onlyGovernance {
        L_RATIO = lRatio;
    }

    function setTheta(uint256 theta) external override onlyGovernance {
        THETA = theta;
    }

    function allowRouter(address router) external override onlyGovernance {
        require(!routerAllowed[router], "CVaultForTrader: router allowed");
        routerAllowed[router] = true;
        emit RouterAllowed(router);
    }

    function disallowRouter(address router) external override onlyGovernance {
        require(routerAllowed[router], "CVaultForTrader: router disallowed");
        routerAllowed[router] = false;
        emit RouterDisallowed(router);
    }

    function calcCoFiRate(uint256 bt_phi, uint256 xt, uint256 np) public override view returns (uint256 at) {
        /*
        at = (bt*phi)*2400000/(xt*np*0.3)
        - at is CoFi yield per unit
        - bt is the current CoFi rate of the specific XToken staking rewards pool
        - xt is totalSupply of the specific XToken
        - np is Net Asset Value Per Share for the specific XToken
        - phi is the weight of the specific XToken staking rewards pool (x of 100)
        - bt_phi is bt*phi, pool CoFi rate
        e.g. (10*100/100) * 2400000 / (20000 * 1 * 0.3) = 4000
        take decimal into account: (10*1e18 * 100/100) * 2400000 /( 20000*1e18 * 1e18/1e18 * 0.3 ) * 1e18 = 4000 * 1e18
        */
        uint256 tvl = xt.mul(np).div(NAVPS_BASE); // total locked value represent in ETH
        if (tvl < 20000 ether) {
            tvl = 20000 ether; // minimum total locked value requirement
        }
        uint256 numerator = bt_phi.mul(COFI_DECAY_PERIOD).mul(1e18).mul(EXPECT_YIELD_BASE);
        at = numerator.div(EXPECT_YIELD_RATIO).div(tvl);
    }

    // np need price, must be a param passing in
    function currentCoFiRate(address pair, uint256 np) public override view returns (uint256) {
        // get np from router
        // get bt*phi from CoFiXVaultForLP: poolRate
        // get q from CoFiXVaultForLP: poolCnt
        // get xt from XToken.totalSupply: totalSupply
        uint256 updatedBlock = cofiRateCache[pair].updatedBlock;
        if (block.number.sub(updatedBlock) < COFI_RATE_UPDATE_INTERVAL && updatedBlock != 0) {
            return cofiRateCache[pair].cofiRate;
        } 
        address vaultForLP = ICoFiXFactory(factory).getVaultForLP();
        require(vaultForLP != address(0), "CVaultForTrader: vaultForLP not set");
        uint256 poolRate = ICoFiXVaultForLP(vaultForLP).currentPoolRateByPair(pair);
        uint256 totalSupply = ICoFiXPair(pair).totalSupply();
        return calcCoFiRate(poolRate, totalSupply, np);
    }

    // th = L * theta * at
    function currentThreshold(address pair, uint256 np, uint256 cofiRate) public override view returns (uint256) {
        // L = xt * np * (2/1000)
        // - xt is totalSupply of the specific XToken
        // - np is Net Asset Value Per Share for the specific XToken
        // could use cache here but would need one more sload
        uint256 totalSupply = ICoFiXPair(pair).totalSupply(); // nt, introduce one more call here
        uint256 L = totalSupply.mul(np).mul(L_RATIO).div(L_BASE).div(NAVPS_BASE); // L = xt*np*(2/1000)
        // L*theta*at is (L * theta * cofiRate), theta is 0.002, mul(2).div(1000)
        // we may have different theta for different pairs in the future, but just use the constant here for gas reason
        if (L < L_LIMIT) { // minimum L
            L = L_LIMIT; // 100 ether * 0.002 = 0.2 ether 
        }
        return L.mul(cofiRate).mul(THETA).div(THETA_BASE).div(THETA_FEE_UINIT);
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
        } else if (ratio >= 10) { // 0.1 <= x/y < 0.33, lambda = 1.33
            return 133;
        } else { // x/y < 0.1, lambda = 2.0
            return 200;
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
        uint256 th = currentThreshold(pair, np, cofiRate); // threshold of mining rewards amount, L*theta*at
        if (density <= th) {
            // ft<=k, yt*at * lambda, yt is thetaFee, at is cofiRate
            return (stdAmount.mul(lambda).div(LAMBDA_BASE), density, cofiRate);
        }
        // ft>=k: yt*at * L*theta*at * (2ft - L*theta*at) * lambda / (ft*ft), yt*at is stdAmount, L*theta*at is threshold
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
        require(routerAllowed[msg.sender], "CVaultForTrader: not allowed router");  // caution: be careful when adding new router
        require(pair != address(0), "CVaultForTrader: invalid pair");
        require(rewardTo != address(0), "CVaultForTrader: invalid rewardTo");

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