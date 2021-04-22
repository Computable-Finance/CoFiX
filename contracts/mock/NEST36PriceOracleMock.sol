// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NEST36PriceOracleMock {
    
    // 10 Ether <=> 3,255 USDT
    // uint256 public ethAmount_ = 10000000000000000000;
    // uint256 public erc20Amount_ = 3255000000;
    mapping(address => PriceInfo) public priceInfoMap;
    mapping(address => uint256) public addressEffect_; //  Effective time of address to call prices

    address public nestToken_;
    uint256 destructionAmount = 0 ether; //  Amount of NEST to destroy to call prices
    uint256 effectTime = 1 minutes; //  Waiting time to start calling prices

    struct PriceInfo {
        uint latestPriceBlockNumber;
        uint latestPriceValue;
        uint triggeredPriceBlockNumber;
        uint triggeredPriceValue;
        uint triggeredAvgPrice;
        uint triggeredSigmaSQ;
    }

    constructor(address nest) public {
        nestToken_ = nest;
    }

    // // Activate the price checking function
    // function activate(address defi) public { // should not be called for multiple times, or effect time would postpone
    //     IERC20(nestToken_).transferFrom(msg.sender, address(0), destructionAmount);
    //     addressEffect_[defi] = now + effectTime; // SHOULD ADD A BOOL TO FLAG ACTIVATED
    // }

    function latestPriceAndTriggeredPriceInfo(address token, address payback)
        external payable
        returns (
            uint latestPriceBlockNumber, 
            uint latestPriceValue,
            uint triggeredPriceBlockNumber,
            uint triggeredPriceValue,
            uint triggeredAvgPrice,
            uint triggeredSigmaSQ )
    {
        // require(checkUseNestPrice(msg.sender), "oracleMock: not activeted yet");
        require(msg.value >= 0.01 ether, "oracleMock: insufficient oracle fee");
        repayEth(payback, msg.value - 0.01 ether); // just use repayEth to simulate the real impl.
        return latestPrice(token);
    }

    function latestPrice(address token)
        public
        view
        returns (
            uint latestPriceBlockNumber, 
            uint latestPriceValue,
            uint triggeredPriceBlockNumber,
            uint triggeredPriceValue,
            uint triggeredAvgPrice,
            uint triggeredSigmaSQ )
    {
        return (priceInfoMap[token].latestPriceBlockNumber, priceInfoMap[token].latestPriceValue, priceInfoMap[token].triggeredPriceBlockNumber, priceInfoMap[token].triggeredPriceValue, priceInfoMap[token].triggeredAvgPrice, priceInfoMap[token].triggeredSigmaSQ);
    }

    function checkPriceNow(address token)
        public view
        returns (
            uint latestPriceBlockNumber, 
            uint latestPriceValue,
            uint triggeredPriceBlockNumber,
            uint triggeredPriceValue,
            uint triggeredAvgPrice,
            uint triggeredSigmaSQ )
    {
        // return the newest price
        latestPriceValue = priceInfoMap[token].latestPriceValue;
        triggeredPriceValue = priceInfoMap[token].triggeredPriceValue;
        triggeredAvgPrice = priceInfoMap[token].triggeredAvgPrice;
        triggeredSigmaSQ = priceInfoMap[token].triggeredSigmaSQ;
        latestPriceBlockNumber = priceInfoMap[token].latestPriceBlockNumber;
        triggeredPriceBlockNumber = priceInfoMap[token].triggeredPriceBlockNumber;
    }

    function feedPrice(address token, uint256 latestPriceValue, uint256 triggeredPrice, uint256 triggeredAvgPrice, uint256 triggeredSigmaSQ) external {
        priceInfoMap[token].latestPriceValue = latestPriceValue;
        priceInfoMap[token].triggeredPriceValue = triggeredPrice;
        priceInfoMap[token].triggeredAvgPrice = triggeredAvgPrice;
        priceInfoMap[token].triggeredSigmaSQ = triggeredSigmaSQ;
        priceInfoMap[token].latestPriceBlockNumber = block.number;
        priceInfoMap[token].triggeredPriceBlockNumber = block.number;
    }

    function make_payable(address x) internal pure returns (address payable) {
      return address(uint160(x));
    }

    // Transfer ETH
    function repayEth(address addr, uint256 amount) private {
        make_payable(addr).transfer(amount);
    }

    function checkUseNestPrice(address target) public view returns (bool) {
        if (addressEffect_[target] < now && addressEffect_[target] != 0) {
            return true;
        } else {
            return false;
        }
    }
}