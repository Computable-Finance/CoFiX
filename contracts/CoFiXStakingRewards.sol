// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/TransferHelper.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interface/ICoFiXStakingRewards.sol";
import "./interface/ICoFiXVaultForLP.sol";

contract CoFiXStakingRewards is ICoFiXStakingRewards, ReentrancyGuard {
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */

    address public rewardsToken;
    address public stakingToken;
    address public cofixVaultForLP;
    // uint256 public rewardRate = 0;
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
        address _cofixVaultForLP
    ) public {
        rewardsToken = _rewardsToken;
        stakingToken = _stakingToken;
        cofixVaultForLP = _cofixVaultForLP;
        lastUpdateBlock = block.number;        
    }

    /* ========== VIEWS ========== */

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
                accrued().mul(1e18).div(_totalSupply) // TODO: 90%
            );
    }

    function _rewardPerTokenAndAccrued() internal view returns (uint256, uint256) {
        if (_totalSupply == 0) {
            return (rewardPerTokenStored, 0); // TODO: think about totalSupply = 0 situation
        }
        uint256 _accrued = accrued();
        uint256 _rewardPerToken = rewardPerTokenStored.add(
                _accrued.mul(1e18).div(_totalSupply) // TODO: 90%
            );
        return (_rewardPerToken, _accrued);
    }

    function rewardRate() public view returns (uint256) {
        return ICoFiXVaultForLP(cofixVaultForLP).currentPoolRate();
    }

    function accrued() public override view returns (uint256) {
        return lastBlockRewardApplicable().sub(lastUpdateBlock).mul(rewardRate()); // TODO: handle the last mining issue
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

    // add reward from trading pool or anyone else
    function addReward(uint256 amount) public override nonReentrant updateReward(address(0)) {
        // transfer from caller (router contract)
        TransferHelper.safeTransferFrom(rewardsToken, msg.sender, address(this), amount);
        // update rewardPerTokenStored
        rewardPerTokenStored = rewardPerTokenStored.add(amount.mul(1e18).div(_totalSupply)); // TODO: confirm 1e18 is enough for amount
        emit RewardAdded(msg.sender, amount);
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        // rewardPerTokenStored = rewardPerToken();
        // uint256 newAccrued = accrued();
        (uint256 newRewardPerToken, uint256 newAccrued) = _rewardPerTokenAndAccrued();
        rewardPerTokenStored = newRewardPerToken;
        if (newAccrued > 0) {
            // TODO: transfer from CoFiXVaultForLP
            // TODO: must never fail
            uint256 received = ICoFiXVaultForLP(cofixVaultForLP).transferCoFi(newAccrued);
            if (received > 0) {
                // TODO: transfer 10% out
            }
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
    event RewardPaid(address indexed user, uint256 reward);
}