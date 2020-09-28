// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/TransferHelper.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interface/ICoFiStakingRewards.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/IWETH.sol";

// Stake CoFi to earn ETH
contract CoFiStakingRewards is ICoFiStakingRewards, ReentrancyGuard {
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */

    address public override rewardsToken; // WETH, received from CoFiXPair, to reduce gas cost for each swap
    address public override stakingToken; // CoFi

    address public governance;
    uint256 public dividendShare = 50; // 50% to CoFi holders as dividend, 50% to saving for buying back

    uint256 public pendingSavingAmount;

    uint256 public lastUpdateRewardsTokenBalance; // must refresh after each WETH balance change
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _rewardsToken,
        address _stakingToken
    ) public {
        rewardsToken = _rewardsToken;
        stakingToken = _stakingToken;
        governance = msg.sender;
    }

    receive() external payable {}

    /* ========== VIEWS ========== */

    function totalSupply() external override view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external override view returns (uint256) {
        return _balances[account];
    }

    function rewardPerToken() public override view returns (uint256) {
        if (_totalSupply == 0) {
            // use the old rewardPerTokenStored
            // if not, the new accrued amount will never be distributed to anyone
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                accrued().mul(1e18).mul(dividendShare).div(_totalSupply).div(100)
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
                _accrued.mul(1e18).mul(dividendShare).div(_totalSupply).div(100) // 50% of accrued to CoFi holders as dividend
            );
        return (_rewardPerToken, _accrued);
    }

    function accrued() public override view returns (uint256) {
        // balance increment of WETH between the last update and now
        uint256 newest = IWETH(rewardsToken).balanceOf(address(this));
        return newest.sub(lastUpdateRewardsTokenBalance); // lastest must be larger than lastUpdate
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
        // be careful: caller should approve to zero after usage
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
    function emergencyWithdraw() public override nonReentrant {
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
            // WETH balance decreased after this
            uint256 transferred = _safeWETHTransfer(msg.sender, reward);
            // must refresh WETH balance record after updating WETH balance
            // or lastUpdateRewardsTokenBalance could be less than the newest WETH balance in the next update
            lastUpdateRewardsTokenBalance = IWETH(rewardsToken).balanceOf(address(this));
            emit RewardPaid(msg.sender, transferred);
        }
    }

    function addETHReward() external payable override { // no need to update reward here
        IWETH(rewardsToken).deposit{value: msg.value}(); // support for sending ETH for rewards
    }

    function exit() external override {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    function setGovernance(address _new) external {
        require(msg.sender == governance, "CoFiStaking: !governance");
        governance = _new;
    }

    function setDividendShare(uint256 share) external {
        require(msg.sender == governance, "CoFiStaking: !governance");
        require(share <= 100, "CoFiStaking: invalid share setting");
        dividendShare = share;
    }

    function withdrawSavingByGov(address _to, uint256 _amount) external nonReentrant {
        require(msg.sender == governance, "CoFiStaking: !governance");
        pendingSavingAmount = pendingSavingAmount.sub(_amount);
        IWETH(rewardsToken).withdraw(_amount);
        TransferHelper.safeTransferETH(_to, _amount);
        // must refresh WETH balance record after updating WETH balance
        // or lastUpdateRewardsTokenBalance could be less than the newest WETH balance in the next update
        lastUpdateRewardsTokenBalance = IWETH(rewardsToken).balanceOf(address(this));
        emit SavingWithdrawn(_to, _amount);
    }

    // Safe WETH transfer function, just in case if rounding error or ending of mining causes pool to not have enough WETHs.
    function _safeWETHTransfer(address _to, uint256 _amount) internal returns (uint256) {
        uint256 bal = IWETH(rewardsToken).balanceOf(address(this));
        if (_amount > bal) {
            _amount = bal;
        }
        // convert WETH to ETH, and send to `_to`
        IWETH(rewardsToken).withdraw(_amount);
        TransferHelper.safeTransferETH(_to, _amount);
        return _amount;
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        (uint256 _rewardPerToken, uint256 _accrued) = _rewardPerTokenAndAccrued();
        rewardPerTokenStored = _rewardPerToken;
        if (_accrued > 0) {
            uint256 newSaving = _accrued.sub(_accrued.mul(dividendShare).div(100)); // left 50%
            pendingSavingAmount = pendingSavingAmount.add(newSaving);
        }
        // means it's the first update
        // add this check to ensure the WETH transferred in before the first user stake in, could be distributed in the next update
        if (_totalSupply != 0) { // we can use _accrued here too
            lastUpdateRewardsTokenBalance = IWETH(rewardsToken).balanceOf(address(this));
        }
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
    event SavingWithdrawn(address indexed to, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
}