// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/TransferHelper.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interface/ICoFiXStakingRewards.sol";
import "./interface/ICoFiXVaultForLP.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/ICoFiStakingRewards.sol";
import "./interface/ICoFiXFactory.sol";

// Stake XToken to earn CoFi Token
contract CoFiXStakingRewards is ICoFiXStakingRewards, ReentrancyGuard {
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */

    address public override immutable rewardsToken; // CoFi
    address public override immutable stakingToken; // XToken or CNode

    address public immutable factory;

    uint256 public lastUpdateBlock;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _rewardsToken,
        address _stakingToken,
        address _factory
    ) public {
        rewardsToken = _rewardsToken;
        stakingToken = _stakingToken;
        require(ICoFiXFactory(_factory).getVaultForLP() != address(0), "VaultForLP not set yet"); // check
        factory = _factory;
        lastUpdateBlock = block.number;        
    }

    /* ========== VIEWS ========== */

    // replace cofixVault with rewardsVault, this could introduce more calls, but clear is more important 
    function rewardsVault() public virtual override view returns (address) {
        return ICoFiXFactory(factory).getVaultForLP();
    }

    function totalSupply() external override view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external override view returns (uint256) {
        return _balances[account];
    }

    function lastBlockRewardApplicable() public override view returns (uint256) {
        return block.number;
    }

    function rewardPerToken() public override view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                accrued().mul(1e18).div(_totalSupply)
            );
    }

    function _rewardPerTokenAndAccrued() internal view returns (uint256, uint256) {
        if (_totalSupply == 0) {
            // use the old rewardPerTokenStored, and accrued should be zero here
            // if not the new accrued amount will never be distributed to anyone
            return (rewardPerTokenStored, 0);
        }
        uint256 _accrued = accrued();
        uint256 _rewardPerToken = rewardPerTokenStored.add(
                _accrued.mul(1e18).div(_totalSupply)
            );
        return (_rewardPerToken, _accrued);
    }

    function rewardRate() public virtual override view returns (uint256) {
        return ICoFiXVaultForLP(rewardsVault()).currentPoolRate(address(this));
    }

    function accrued() public virtual override view returns (uint256) {
        // calc block rewards
        uint256 blockReward = lastBlockRewardApplicable().sub(lastUpdateBlock).mul(rewardRate());
        // query pair trading rewards
        uint256 tradingReward = ICoFiXVaultForLP(rewardsVault()).getPendingRewardOfLP(stakingToken);
        return blockReward.add(tradingReward);
    }

    function earned(address account) public override view returns (uint256) {
        return _balances[account].mul(rewardPerToken().sub(userRewardPerTokenPaid[account])).div(1e18).add(rewards[account]);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 amount) external override nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        TransferHelper.safeTransferFrom(stakingToken, msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function stakeForOther(address other, uint256 amount) external override nonReentrant updateReward(other) {
        require(amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply.add(amount);
        _balances[other] = _balances[other].add(amount);
        TransferHelper.safeTransferFrom(stakingToken, msg.sender, address(this), amount);
        emit StakedForOther(msg.sender, other, amount);
    }

    function withdraw(uint256 amount) public override nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        TransferHelper.safeTransfer(stakingToken, msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw() external override nonReentrant {
        uint256 amount = _balances[msg.sender];
        require(amount > 0, "Cannot withdraw 0");
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = 0;
        rewards[msg.sender] = 0;
        TransferHelper.safeTransfer(stakingToken, msg.sender, amount);
        emit EmergencyWithdraw(msg.sender, amount);
    }

    function getReward() public override nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            // TransferHelper.safeTransfer(rewardsToken, msg.sender, reward);
            uint256 transferred = _safeCoFiTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, transferred);
        }
    }

    // get CoFi rewards and staking into CoFiStakingRewards pool
    function getRewardAndStake() external override nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            address cofiStakingPool = ICoFiXVaultForLP(rewardsVault()).getCoFiStakingPool(); // also work for VaultForCNode
            require(cofiStakingPool != address(0), "cofiStakingPool not set");
            // approve to staking pool
            address _rewardsToken = rewardsToken;
            IERC20(_rewardsToken).approve(cofiStakingPool, reward);
            ICoFiStakingRewards(cofiStakingPool).stakeForOther(msg.sender, reward);
            IERC20(_rewardsToken).approve(cofiStakingPool, 0); // ensure
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external override {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    // add reward from trading pool or anyone else
    function addReward(uint256 amount) public override nonReentrant updateReward(address(0)) {
        // transfer from caller (router contract)
        TransferHelper.safeTransferFrom(rewardsToken, msg.sender, address(this), amount);
        // update rewardPerTokenStored
        rewardPerTokenStored = rewardPerTokenStored.add(amount.mul(1e18).div(_totalSupply));
        emit RewardAdded(msg.sender, amount);
    }

    // Safe CoFi transfer function, just in case if rounding error or ending of mining causes pool to not have enough CoFis.
    function _safeCoFiTransfer(address _to, uint256 _amount) internal returns (uint256) {
        uint256 cofiBal = IERC20(rewardsToken).balanceOf(address(this));
        if (_amount > cofiBal) {
            _amount = cofiBal;
        }
        TransferHelper.safeTransfer(rewardsToken, _to, _amount); // allow zero amount
        return _amount;
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) virtual {
        // rewardPerTokenStored = rewardPerToken();
        // uint256 newAccrued = accrued();
        (uint256 newRewardPerToken, uint256 newAccrued) = _rewardPerTokenAndAccrued();
        rewardPerTokenStored = newRewardPerToken;
        if (newAccrued > 0) {
            // distributeReward could fail if CoFiXVaultForLP is not minter of CoFi anymore
            // Should set reward rate to zero first, and then do a settlement of pool reward by call getReward
            ICoFiXVaultForLP(rewardsVault()).distributeReward(address(this), newAccrued);
        } 
        lastUpdateBlock = lastBlockRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(address sender, uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event StakedForOther(address indexed user, address indexed other, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
}