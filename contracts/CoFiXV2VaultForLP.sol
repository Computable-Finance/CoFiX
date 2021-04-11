// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/ICoFiXVaultForLP.sol";
import "./interface/ICoFiXStakingRewards.sol";
import "./interface/ICoFiToken.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interface/ICoFiXV2Factory.sol";
import "./interface/ICoFiXV2VaultForTrader.sol";

// Reward Pool Controller for Liquidity Provider
contract CoFiXV2VaultForLP is ICoFiXVaultForLP, ReentrancyGuard {

    using SafeMath for uint256;

    uint256 public constant RATE_BASE = 1e18;
    uint256 public constant WEIGHT_BASE = 100;

    address public immutable cofiToken;
    address public immutable factory;

    uint256 public genesisBlock;

    // managed by governance
    address public governance;

    uint256 public initCoFiRate = 4.5*1e18; // yield per block  5*1e18 - 5*1e18/10
    uint256 public decayPeriod = 2400000; // yield decays for every 2,400,000 blocks
    uint256 public decayRate = 80;

    address[] public allPools; // add every pool addr to record, make it easier to track

    uint256 public enabledCnt;

    struct PoolInfo {
        POOL_STATE state;
        uint256 weight;
    }

    mapping (address => PoolInfo) public poolInfo; // pool -> poolInfo

    mapping (address => address) public pairToStakingPool; // pair -> staking pool

    modifier onlyGovernance() {
        require(msg.sender == governance, "CVaultForLP: !governance");
        _;
    }

    constructor(address cofi, address _factory) public {
        cofiToken = cofi;
        factory = _factory;
        governance = msg.sender;
        genesisBlock = block.number; // set v1 genesisBlock to genesisBlock later
    }

    // this is for mainnet
    function setGenesisBlock() external {
        genesisBlock = 11040688; // follow v1 
    }

    /* setters for protocol governance */
    function setGovernance(address _new) external override onlyGovernance {
        governance = _new;
    }

    function setInitCoFiRate(uint256 _new) external override onlyGovernance {
        initCoFiRate = _new;
    }

    function setDecayPeriod(uint256 _new) external override onlyGovernance {
        require(_new != 0, "CVaultForLP: wrong period setting");
        decayPeriod = _new;
    }

    function setDecayRate(uint256 _new) external override onlyGovernance {
        decayRate = _new;
    }

    function addPool(address pool) external override onlyGovernance {
        require(poolInfo[pool].state == POOL_STATE.INVALID, "CVaultForLP: pool added"); // INVALID -> ENABLED
        require(pool != address(0), "CVaultForTrader: invalid pool");
        poolInfo[pool].state = POOL_STATE.ENABLED;
        // default rate is zero, to ensure safety
        enabledCnt = enabledCnt.add(1);
        // set pair to reward pool map
        address pair = ICoFiXStakingRewards(pool).stakingToken();
        require(pairToStakingPool[pair] == address(0), "CVaultForLP: pair added");
        pairToStakingPool[pair] = pool; // staking token is CoFiXPair (XToken)
        allPools.push(pool); // add once never delete, using for track
        emit NewPoolAdded(pool, allPools.length);
    }

    function enablePool(address pool) external override onlyGovernance {
        require(poolInfo[pool].state == POOL_STATE.DISABLED, "CVaultForLP: pool not disabled"); // DISABLED -> ENABLED
        require(pool != address(0), "CVaultForTrader: invalid pool");
        poolInfo[pool].state = POOL_STATE.ENABLED;
        enabledCnt = enabledCnt.add(1);
        // set pair to reward pool map
        address pair = ICoFiXStakingRewards(pool).stakingToken();
        require(pairToStakingPool[pair] == address(0), "CVaultForLP: pair added");
        pairToStakingPool[pair] = pool; // staking token is CoFiXPair (XToken)
        emit PoolEnabled(pool);
    }

    function disablePool(address pool) external override onlyGovernance {
        require(poolInfo[pool].state == POOL_STATE.ENABLED, "CVaultForLP: pool not enabled"); // ENABLED -> DISABLED
        require(pool != address(0), "CVaultForTrader: invalid pool");
        poolInfo[pool].state = POOL_STATE.DISABLED;
        poolInfo[pool].weight = 0; // set pool weight to zero;
        enabledCnt = enabledCnt.sub(1);
        address pair = ICoFiXStakingRewards(pool).stakingToken();
        pairToStakingPool[pair] = address(0); // set pair mapping to zero
        emit PoolDisabled(pool);
    }

    function setPoolWeight(address pool, uint256 weight) public override onlyGovernance {
        require(weight <= WEIGHT_BASE, "CVaultForLP: invalid weight");
        require(pool != address(0), "CVaultForTrader: invalid pool");
        require(poolInfo[pool].state == POOL_STATE.ENABLED, "CVaultForLP: pool not enabled"); // only set weight if pool is enabled
        poolInfo[pool].weight = weight;
    }

    function batchSetPoolWeight(address[] memory pools, uint256[] memory weights) external override onlyGovernance {
        uint256 cnt = pools.length;
        require(cnt == weights.length, "CVaultForLP: mismatch len");
        for (uint256 i = 0; i < cnt; i++) {
            require(pools[i] != address(0), "CVaultForTrader: invalid pool");
            require(weights[i] <= WEIGHT_BASE, "CVaultForLP: invalid weight");
            require(poolInfo[pools[i]].state == POOL_STATE.ENABLED, "CVaultForLP: pool not enabled"); // only set weight if pool is enabled
            poolInfo[pools[i]].weight = weights[i];
        }
        // governance should ensure total weights equal to WEIGHT_BASE
    }
    
    function getPendingRewardOfLP(address pair) external override view returns (uint256) {
        POOL_STATE poolState = poolInfo[msg.sender].state;
        if (poolState == POOL_STATE.INVALID || poolState == POOL_STATE.DISABLED) {
            return 0; // if pool is disabled, it can't mint by call distributeReward, so don't count on any reward for it
        }
        // if poolState is enabled, then go on
        address vaultForTrader = ICoFiXV2Factory(factory).getVaultForTrader();
        if (vaultForTrader == address(0)) {
            return 0; // vaultForTrader is not set yet
        }
        uint256 pending = ICoFiXV2VaultForTrader(vaultForTrader).getPendingRewardOfLP(pair);
        return pending;
    }

    function distributeReward(address to, uint256 amount) external override nonReentrant {
        POOL_STATE poolState = poolInfo[msg.sender].state;
        require(poolState != POOL_STATE.INVALID, "CVaultForLP: only pool valid");
        if (poolState == POOL_STATE.DISABLED) {
            return; // make sure tx would revert because user still want to withdraw and getReward
        }
        require(to != address(0), "CVaultForTrader: invalid to");
        // if poolState is enabled, then go on. caution: be careful when adding new pool
        address vaultForTrader = ICoFiXV2Factory(factory).getVaultForTrader();
        if (vaultForTrader != address(0)) { // if equal, means vaultForTrader is not set yet
            address pair = ICoFiXStakingRewards(msg.sender).stakingToken();
            require(pair != address(0), "CVaultForTrader: invalid pair");
            uint256 pending = ICoFiXV2VaultForTrader(vaultForTrader).getPendingRewardOfLP(pair);
            if (pending > 0) {
                ICoFiXV2VaultForTrader(vaultForTrader).clearPendingRewardOfLP(pair);
            }
        }
        ICoFiToken(cofiToken).mint(to, amount); // allows zero
    }

    function currentPeriod() public override view returns (uint256) {
        return (block.number).sub(genesisBlock).div(decayPeriod);
    }

    function currentCoFiRate() public override view returns (uint256) {
        uint256 periodIdx = currentPeriod();
        if (periodIdx > 4) {
            periodIdx = 4; // after 5 years, the rate keep constant
        }
        uint256 cofiRate = initCoFiRate;
        uint256 _decayRate = decayRate;
        for (uint256 i = 0; i < periodIdx; i++) {
            cofiRate = cofiRate.mul(_decayRate).div(100);
        }
        return cofiRate;
    }

    function currentPoolRate(address pool) public override view returns (uint256 poolRate) {
        uint256 cnt = enabledCnt;
        if (cnt == 0) {
            return 0;
        }
        uint256 cofiRate = currentCoFiRate();
        uint256 weight = poolInfo[pool].weight;
        poolRate = cofiRate.mul(weight).div(WEIGHT_BASE);
        return poolRate;
    }

    function currentPoolRateByPair(address pair) external override view returns (uint256 poolRate) {
        address pool = pairToStakingPool[pair];
        poolRate = currentPoolRate(pool);
        return poolRate;
    }

    function stakingPoolForPair(address pair) external override view returns (address pool) {
        return pairToStakingPool[pair];
    }

    function getPoolInfo(address pool) public override view returns (POOL_STATE state, uint256 weight) {
        state = poolInfo[pool].state;
        weight = poolInfo[pool].weight;
        return (state, weight);
    }

    function getPoolInfoByPair(address pair) external override view returns (POOL_STATE state, uint256 weight) {
        address pool = pairToStakingPool[pair];
        return getPoolInfo(pool);
    }

    // pools in enabled state
    function getEnabledPoolCnt() external override view returns (uint256) {
        return enabledCnt;
    }

    function getCoFiStakingPool() external override view returns (address pool) {
        return ICoFiXV2Factory(factory).getFeeReceiver();
    }

}