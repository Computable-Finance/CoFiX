// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/TransferHelper.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interface/ICoFiToken.sol";
import "./interface/ICoFiXV2Factory.sol";
import "./interface/ICoFiXV2Controller.sol";
import "./interface/ICoFiXV2DAO.sol";

contract CoFiXV2DAO is ICoFiXV2DAO, ReentrancyGuard {

    using SafeMath for uint256;

    /* ========== STATE ============== */

    uint8 public flag; 

    uint32  public startedBlock;
    uint32  public lastCollectingBlock;
    uint32 public lastBlock;
    uint128 public redeemedAmount;
    uint128 public quotaAmount;

    uint8 constant DAO_FLAG_UNINITIALIZED    = 0;
    uint8 constant DAO_FLAG_INITIALIZED      = 1;
    uint8 constant DAO_FLAG_ACTIVE           = 2;
    uint8 constant DAO_FLAG_NO_STAKING       = 3;
    uint8 constant DAO_FLAG_PAUSED           = 4;
    uint8 constant DAO_FLAG_SHUTDOWN         = 127;

    /* ========== PARAMETERS ============== */

    uint256 constant DAO_REPURCHASE_PRICE_DEVIATION = 5;  // price deviation < 5% 
    uint256 constant _oracleFee = 0.01 ether;


    /* ========== ADDRESSES ============== */

    address public cofiToken;

    address public factory;

    address public governance;

    /* ========== CONSTRUCTOR ========== */

    receive() external payable {
    }

    constructor(address _cofiToken, address _factory) public {
        cofiToken = _cofiToken;
        factory = _factory;
        governance = msg.sender;
        flag = DAO_FLAG_INITIALIZED;
    }

    /* ========== MODIFIERS ========== */

    modifier onlyGovernance() 
    {
        require(msg.sender == governance, "CDAO: not governance");
        _;
    }

    modifier whenActive() 
    {
        require(flag == DAO_FLAG_ACTIVE, "CDAO: not active");
        _;
    }

    /* ========== GOVERNANCE ========== */

    function setGovernance(address _new) external override onlyGovernance {
        governance = _new;
    }

    function start() override external onlyGovernance
    {  
        require(flag == DAO_FLAG_INITIALIZED, "CDAO: not initialized");

        startedBlock = uint32(block.number);
        flag = DAO_FLAG_ACTIVE;
        emit FlagSet(address(msg.sender), uint256(DAO_FLAG_ACTIVE));
    }

    function pause() external onlyGovernance
    {
        flag = DAO_FLAG_PAUSED;
        emit FlagSet(address(msg.sender), uint256(DAO_FLAG_PAUSED));
    }

    function resume() external onlyGovernance
    {
        flag = DAO_FLAG_ACTIVE;
        emit FlagSet(address(msg.sender), uint256(DAO_FLAG_ACTIVE));
    }

    function totalETHRewards()
        external view returns (uint256) 
    {
       return address(this).balance;
    }

    function migrateTo(address _newDAO) external onlyGovernance
    {
        require(flag == DAO_FLAG_PAUSED, "CDAO: not paused");
        
        if(address(this).balance > 0) {
            TransferHelper.safeTransferETH(_newDAO, address(this).balance);
        }
        // ICoFiXV2DAO(_newDAO).addETHReward{value: address(this).balance}();

        uint256 _cofiTokenAmount = ICoFiToken(cofiToken).balanceOf(address(this));
        if (_cofiTokenAmount > 0) {
            ICoFiToken(cofiToken).transfer(_newDAO, _cofiTokenAmount);
        }
    }

    function burnCofi(uint256 amount) external onlyGovernance {
        require(amount > 0, "CDAO: illegal amount");

        uint256 _cofiTokenAmount = ICoFiToken(cofiToken).balanceOf(address(this));

        require(_cofiTokenAmount >= amount, "CDAO: insufficient cofi");

        ICoFiToken(cofiToken).transfer(address(0x1), amount);
        emit CoFiBurn(address(msg.sender), amount);
    }

    /* ========== MAIN ========== */

    function addETHReward() 
        override
        external
        payable
    { }

    function redeem(uint256 amount) 
        external payable nonReentrant whenActive
    {
        require(address(this).balance > 0, "CDAO: insufficient balance");
        require (msg.value == _oracleFee, "CDAO: !oracleFee");

        // check the repurchasing quota
        uint256 quota = quotaOf();

        uint256 price;
        {
            // check if the price is steady
            (uint256 ethAmount, uint256 tokenAmount, uint256 avg, ) = ICoFiXV2Controller(ICoFiXV2Factory(factory).getController())
                    .getLatestPriceAndAvgVola{value: msg.value}(cofiToken);
            price = tokenAmount.mul(1e18).div(ethAmount);

            uint256 diff = price > avg ? (price - avg) : (avg - price);
            bool isDeviated = (diff.mul(100) < avg.mul(DAO_REPURCHASE_PRICE_DEVIATION))? false : true;
            require(isDeviated == false, "CDAO: price deviation"); // validate
        }

        // check if there is sufficient quota for repurchase
        require (amount <= quota, "CDAO: insufficient quota");
        require (amount.mul(1e18) <= address(this).balance.mul(price), "CDAO: insufficient balance2");

        redeemedAmount = uint128(amount.add(redeemedAmount));
        quotaAmount = uint128(quota.sub(amount));
        lastBlock = uint32(block.number);

        uint256 amountEthOut = amount.mul(1e18).div(price);

        // transactions
        ICoFiToken(cofiToken).transferFrom(address(msg.sender), address(this), amount);
        TransferHelper.safeTransferETH(msg.sender, amountEthOut);
    }

    function _quota() internal view returns (uint256 quota) 
    {
        uint256 n = 50;
        uint256 intv = (lastBlock == 0) ? 
            (block.number).sub(startedBlock) : (block.number).sub(uint256(lastBlock));
        uint256 _acc = (n * intv > 15_000) ? 15_000 : (n * intv);

        // check if total amounts overflow
        uint256 total = _acc.mul(1e18).add(quotaAmount);
        if (total > uint256(15_000).mul(1e18)){
            quota = uint256(15_000).mul(1e18);
        } else{
            quota = total;
        }
    }

    /* ========== VIEWS ========== */

    function quotaOf() public view returns (uint256 quota) 
    {
        return _quota();
    }

}