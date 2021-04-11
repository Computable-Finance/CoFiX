// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/ICoFiXVaultForCNode.sol";
import "./interface/ICoFiXStakingRewards.sol";
import "./interface/ICoFiToken.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interface/ICoFiXV2Factory.sol";
import "./interface/ICoFiXV2VaultForTrader.sol";

// Reward Pool Controller for CNode
contract CoFiXV2VaultForCNode is ICoFiXVaultForCNode, ReentrancyGuard {

    using SafeMath for uint256;

    uint256 public constant RATE_BASE = 1e18;

    address public immutable cofiToken;
    address public immutable factory;

    uint256 public genesisBlock;

    // managed by governance
    address public governance;
    address public cnodePool;

    uint256 public initCoFiRate = 0.5*1e18; // yield per block, 5*1e18/10
    uint256 public decayPeriod = 2400000; // yield decays for every 2,400,000 blocks
    uint256 public decayRate = 80;

    constructor(address cofi, address _factory) public {
        cofiToken = cofi;
        factory = _factory;
        governance = msg.sender;
        genesisBlock = block.number; // set v1 genesisBlock to  genesisBlock later
    }

    // this is for mainnet
    function setGenesisBlock() external {
        genesisBlock = 11040688; // follow v1 
    }

    /* setters for protocol governance */
    function setGovernance(address _new) external override {
        require(msg.sender == governance, "CVaultForCNode: !governance");
        governance = _new;
    }

    function setCNodePool(address _new) external override {
        require(msg.sender == governance, "CVaultForCNode: !governance");
        cnodePool = _new;
        emit NewCNodePool(_new);
    }

    function setInitCoFiRate(uint256 _new) external override {
        require(msg.sender == governance, "CVaultForCNode: !governance");
        initCoFiRate = _new;
    }

    function setDecayPeriod(uint256 _new) external override {
        require(msg.sender == governance, "CVaultForCNode: !governance");
        require(_new != 0, "CVaultForCNode: wrong period setting");
        decayPeriod = _new;
    }

    function setDecayRate(uint256 _new) external override {
        require(msg.sender == governance, "CVaultForCNode: !governance");
        decayRate = _new;
    }

    function getPendingRewardOfCNode() external override view returns (uint256) {
        address vaultForTrader = ICoFiXV2Factory(factory).getVaultForTrader();
        if (vaultForTrader == address(0)) {
            return 0; // vaultForTrader is not set yet
        }
        uint256 pending = ICoFiXV2VaultForTrader(vaultForTrader).getPendingRewardOfCNode();
        return pending;
    }

    function distributeReward(address to, uint256 amount) external override nonReentrant {
        require(msg.sender == cnodePool, "CVaultForCNode: only pool allowed"); // caution: be careful when adding new pool
        address vaultForTrader = ICoFiXV2Factory(factory).getVaultForTrader();
        if (vaultForTrader != address(0)) { // if equal, means vaultForTrader is not set yet
            uint256 pending = ICoFiXV2VaultForTrader(vaultForTrader).getPendingRewardOfCNode();
            if (pending > 0) {
                ICoFiXV2VaultForTrader(vaultForTrader).clearPendingRewardOfCNode();
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

    function getCoFiStakingPool() external override view returns (address pool) {
        return ICoFiXV2Factory(factory).getFeeReceiver();
    }

}