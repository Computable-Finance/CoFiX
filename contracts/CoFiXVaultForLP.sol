// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/ICoFiXVaultForLP.sol";
import "./interface/ICoFiXStakingRewards.sol";
import "./interface/ICoFiToken.sol";

contract CoFiXVaultForLP is ICoFiXVaultForLP {

    using SafeMath for uint256;

    uint256 public constant RATE_BASE = 1e18;

    address public cofiToken;

    uint256 public genesisBlock; // TODO: make this constant to reduce gas cost

    // managed by governance
    address public governance;
    address public governanceVault;

    uint256 public initCoFiRate = 10*1e18; // yield per block
    uint256 public decayPeriod = 2400000; // yield decays for every 2,400,000 blocks
    uint256 public decayRate = 80;

    address[] public allPools;

    mapping (address => bool) public poolAllowed;

    mapping (address => address) public pairToStakingPool;

    event NewPoolAdded(address pool, uint256 index);

    constructor(address cofi) public {
        cofiToken = cofi;
        governance = msg.sender;
        governanceVault = msg.sender; // governance vault could be governance itself or a specific contract
        genesisBlock = block.number;
    }

    /* setters for protocol governance */
    function setGovernance(address _new) external override {
        require(msg.sender == governance, "CVaultForLP: !governance");
        governance = _new;
    }

    function setGovernanceVault(address _new) external override {
        require(msg.sender == governance, "CVaultForLP: !governance");
        governanceVault = _new;
    }

    function setInitCoFiRate(uint256 _new) external override {
        require(msg.sender == governance, "CVaultForLP: !governance");
        initCoFiRate = _new;
    }

    function setDecayPeriod(uint256 _new) external override {
        require(msg.sender == governance, "CVaultForLP: !governance");
        require(_new != 0, "CVaultForLP: wrong period setting");
        decayPeriod = _new;
    }

    function setDecayRate(uint256 _new) external override {
        require(msg.sender == governance, "CVaultForLP: !governance");
        decayRate = _new;
    }

    function addPool(address pool) external override {
        require(msg.sender == governance, "CVaultForLP: !governance");
        require(poolAllowed[pool] == false, "CVaultForLP: pool added");
        poolAllowed[pool] = true;
        allPools.push(pool);
        emit NewPoolAdded(pool, allPools.length); // TODO: refactor addPool
    }

    function addPoolForPair(address pool) external override {
        require(msg.sender == governance, "CVaultForLP: !governance");
        require(poolAllowed[pool] == false, "CVaultForLP: pool added");
        poolAllowed[pool] = true;
        allPools.push(pool);
        // set pair to reward pool map
        address pair = ICoFiXStakingRewards(pool).stakingToken();
        require(pairToStakingPool[pair] == address(0), "CVaultForLP: pair added");
        pairToStakingPool[pair] = pool; // staking token is CoFiXPair (XToken)
        emit NewPoolAdded(pool, allPools.length);
    }

    // // this function should never fail when pool contract calling it
    // function safeCoFiTransfer(uint256 amount) external override returns (uint256) {
    //     require(poolAllowed[msg.sender] == true, "CVaultForLP: only pool allowed");
    //     uint256 balance = IERC20(cofiToken).balanceOf(address(this));
    //     if (amount > balance) {
    //         amount = balance;
    //     }
    //     IERC20(cofiToken).transfer(msg.sender, amount); // allow zero amount
    //     return amount;
    // }
    
    function distributeReward(address to, uint256 amount) external override {
        require(poolAllowed[msg.sender] == true, "CVaultForLP: only pool allowed"); // caution: be careful when adding new pool
        ICoFiToken(cofiToken).mint(to, amount);
    }

    function currentPeriod() public override view returns (uint256) {
        return (block.number).sub(genesisBlock).div(decayPeriod);
    }

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
        uint256 len = allPools.length;
        if (len == 0) {
            return 0;
        }
        uint256 cofiRate = currentCoFiRate();
        poolRate = cofiRate.div(allPools.length);
        return poolRate;
    }

    function stakingPoolForPair(address pair) external override view returns (address pool) {
        return pairToStakingPool[pair];
    }

    function getGovernanceVault() external override view returns (address vault) {
        return governanceVault;
    }
}