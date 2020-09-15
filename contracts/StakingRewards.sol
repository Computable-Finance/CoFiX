// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

import "./lib/SafeMath.sol";
import "./lib/TransferHelper.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interface/IStakingRewards.sol";

contract StakingRewards is IStakingRewards, ReentrancyGuard {
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */

    address public rewardsToken;
    address public stakingToken;
    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration = 7 days;
    // uint256 public lastUpdateTime;
    uint256 public lastUpdateBlock;
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
        lastUpdateBlock = block.number;
        
        periodFinish = block.number.add(rewardsDuration);
    }

    /* ========== VIEWS ========== */

    function totalSupply() external override view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external override view returns (uint256) {
        return _balances[account];
    }

    // function lastTimeRewardApplicable() public override view returns (uint256) {
    //     return Math.min(block.timestamp, periodFinish);
    // }

    function lastBlockRewardApplicable() public override view returns (uint256) {
        return block.number;
    }

    function rewardPerToken() public override view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                // lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e18).div(_totalSupply)
                lastBlockRewardApplicable().sub(lastUpdateBlock).mul(rewardRate).mul(1e18).div(_totalSupply)
            );
    }

    function earned(address account) public override view returns (uint256) {
        return _balances[account].mul(rewardPerToken().sub(userRewardPerTokenPaid[account])).div(1e18).add(rewards[account]);
    }

    function getRewardForDuration() external override view returns (uint256) {
        return rewardRate.mul(rewardsDuration);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 amount) external override nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        TransferHelper.safeTransferFrom(stakingToken, msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public override nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        TransferHelper.safeTransfer(stakingToken, msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public override nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            TransferHelper.safeTransfer(rewardsToken, msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external override {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        // lastUpdateTime = lastTimeRewardApplicable();
        lastUpdateBlock = lastBlockRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);
}