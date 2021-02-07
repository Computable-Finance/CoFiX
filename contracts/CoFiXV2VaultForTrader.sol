// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/ICoFiXV2VaultForTrader.sol";
import "./interface/ICoFiToken.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interface/ICoFiXV2Factory.sol";
import "./interface/ICoFiXVaultForLP.sol";
import "./interface/ICoFiXStakingRewards.sol";
import "./interface/ICoFiXV2Pair.sol";

// Reward Pool Controller for Trader
// Trade to earn CoFi Token
contract CoFiXV2VaultForTrader is ICoFiXV2VaultForTrader, ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant RATE_BASE = 1e18;
    uint256 public constant LAMBDA_BASE = 100;
    uint256 public constant RECENT_RANGE = 300;

    uint256 public constant SHARE_BASE = 100;
    uint256 public constant SHARE_FOR_TRADER = 90;
    // uint256 public constant SHARE_FOR_LP = 10;
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
    uint256 public constant REWARD_MULTIPLE_BASE = 100;

    address public immutable cofiToken;
    address public immutable factory;

    // managed by governance
    address public governance;
    uint256 public EXPECT_YIELD_RATIO = 3; // r, 0.3
    uint256 public L_RATIO = 2; // l, 0.002
    uint256 public THETA = 2; // 0.002
    uint256 public cofiRate = 0.1*1e18; // nt 0.1

    uint256 public pendingRewardsForCNode;

    mapping(address => uint256) public pendingRewardsForLP; // pair address to pending rewards amount
    mapping (address => bool) public routerAllowed;

    mapping (address => uint128) public lastMinedBlock; // last block mined cofi token
    mapping (address => uint256) public lastNeededETHAmount; // last needed eth amount for adjustment 
    mapping (address => uint256) public lastTotalAccruedAmount;
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

    function setCofiRate(uint256 _cofiRate) external override onlyGovernance {
        cofiRate = _cofiRate;
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

    // calc v_t
    function calcMiningRate(address pair, uint256 neededETHAmount) public override view returns (uint256) {
        uint256 _lastNeededETHAmount = lastNeededETHAmount[pair];

        if (_lastNeededETHAmount > neededETHAmount) { // D_{t-1} > D_t 
            // \frac{D_{t-1} - D_t}{D_{t-1}}
            return _lastNeededETHAmount.sub(neededETHAmount).mul(RATE_BASE).div(_lastNeededETHAmount); // v_t
        } else { // D_{t-1} <= D_t
            return 0; // v_t
        }
    }

    // calc D_t :needed eth amount for adjusting kt to k0
    function calcNeededETHAmountForAdjustment(address pair, uint256 reserve0, uint256 reserve1, uint256 ethAmount, uint256 erc20Amount) public override view returns (uint256) {
        /*
        D_t = |\frac{E_t * k_0 - U_t}{k_0 + P_t}|\\\\
            = \frac{|E_t * \frac{initToken1Amount}{initToken0Amount} - U_t|}{\frac{initToken1Amount}{initToken0Amount} + \frac{erc20Amount}{ethAmount}}\\\\
            =  \frac{|E_t * initToken1Amount - U_t * initToken0Amount|}{initToken1Amount + \frac{erc20Amount * initToken0Amount}{ethAmount}}\\\\
            =  \frac{|E_t * initToken1Amount - U_t * initToken0Amount| * ethAmount}{initToken1Amount * ethAmount + erc20Amount * initToken0Amount}\\\\
        */
        
        {
            (uint256 initToken0Amount, uint256 initToken1Amount) = ICoFiXV2Pair(pair).getInitialAssetRatio();

            uint256 reserve0MulInitToken1Amount = reserve0.mul(initToken1Amount);
            uint256 reserve1MulInitToken0Amount = reserve1.mul(initToken0Amount);

            uint256 diff = calcDiff(reserve0MulInitToken1Amount, reserve1MulInitToken0Amount);
            uint256 diffMulEthAmount = diff.mul(ethAmount);

            uint256 initToken1AmountMulEthAmount = initToken1Amount.mul(ethAmount);
            uint256 erc20AmountMulInitToken0Amount = erc20Amount.mul(initToken0Amount);

            return diffMulEthAmount.div(initToken1AmountMulEthAmount.add(erc20AmountMulInitToken0Amount));
        }
    }

    function calcDiff(uint x, uint y) private pure returns (uint) {
        return x > y ? (x - y) : (y - x);
    }

    /*
    Y_t = Y_{t - 1} + D_{t - 1} * n_t * (S_t + 1) - Z_t  
    Z_t = [Y_{t - 1} + D_{t - 1} * n_t * (S_t + 1)] * v_t
    */
    function actualMiningAmount(
        address pair,
        uint256 reserve0,
        uint256 reserve1,
        uint256 ethAmount,
        uint256 erc20Amount 
    ) public override view returns (
        uint256 amount,
        uint256 totalAccruedAmount,
        uint256 neededETHAmount
    ) {
        uint256 totalAmount;
        {
            // Y_{t - 1} + D_{t - 1} * n_t * (S_t + 1)
            uint256 _lastTotalAccruedAmount = lastTotalAccruedAmount[pair]; // Y_{t - 1}
            uint256 _lastNeededETHAmount = lastNeededETHAmount[pair]; // D_{t - 1}
            uint256 _lastBlock = lastMinedBlock[pair];
            uint256 _offset = block.number.sub(_lastBlock); // s_t

            totalAmount = _lastTotalAccruedAmount.add(_lastNeededETHAmount.mul(cofiRate).mul(_offset.add(1)).div(RATE_BASE));
        }

        neededETHAmount = calcNeededETHAmountForAdjustment(pair, reserve0, reserve1, ethAmount, erc20Amount); // D_t
        uint256 miningRate = calcMiningRate(pair, neededETHAmount); // v_t
        
        // Z_t = [Y_{t - 1} + D_{t - 1} * n_t * (S_t + 1)] * v_t
        amount = totalAmount.mul(miningRate).div(RATE_BASE);
        // Y_t = Y_{t - 1} + D_{t - 1} * n_t * (S_t + 1) - Z_t  
        totalAccruedAmount = totalAmount.sub(amount);
    }

    function distributeReward(
        address pair,
        uint256 ethAmount,
        uint256 erc20Amount,
        address rewardTo
    ) external override nonReentrant {
        require(routerAllowed[msg.sender], "CVaultForTrader: not allowed router");  // caution: be careful when adding new router
        require(pair != address(0), "CVaultForTrader: invalid pair");
        require(rewardTo != address(0), "CVaultForTrader: invalid rewardTo");

        uint256 amount;
        {
            uint256 totalAccruedAmount;
            uint256 neededETHAmount;
            (uint256 reserve0, uint256 reserve1) = ICoFiXV2Pair(pair).getReserves();
            (amount, totalAccruedAmount, neededETHAmount) = actualMiningAmount(pair, reserve0, reserve1, ethAmount, erc20Amount);

            lastMinedBlock[pair] = uint128(block.number); // uint128 is enough for block.number
            lastTotalAccruedAmount[pair] = totalAccruedAmount;
            lastNeededETHAmount[pair] = neededETHAmount;
        }

        {
            uint256 amountForTrader = amount.mul(SHARE_FOR_TRADER).div(SHARE_BASE);
            // uint256 amountForLP = amount.mul(SHARE_FOR_LP).div(SHARE_BASE);
            uint256 amountForCNode = amount.mul(SHARE_FOR_CNODE).div(SHARE_BASE);

            ICoFiToken(cofiToken).mint(rewardTo, amountForTrader); // allows zero, send to receiver directly, reduce gas cost
            // pendingRewardsForLP[pair] = pendingRewardsForLP[pair].add(amountForLP); // possible key: token or pair, we use pair here
            pendingRewardsForCNode = pendingRewardsForCNode.add(amountForCNode);
        }
    }

    function clearPendingRewardOfCNode() external override nonReentrant {
        address vaultForCNode = ICoFiXV2Factory(factory).getVaultForCNode();
        require(msg.sender == vaultForCNode, "CVaultForTrader: only vaultForCNode"); // caution
        // uint256 pending = pendingRewardsForCNode;
        emit ClearPendingRewardOfCNode(pendingRewardsForCNode);
        pendingRewardsForCNode = 0; // take all, set to 0
        // ICoFiToken(cofiToken).mint(msg.sender, pending); // no need to mint from here, we can mint directly in valult
    }

    // vaultForLP should ensure passing the correct pair address
    function clearPendingRewardOfLP(address pair) external override nonReentrant {
        address vaultForLP = ICoFiXV2Factory(factory).getVaultForLP();
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

}
