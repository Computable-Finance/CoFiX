// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NEST35PriceOracleMock {
    
    // 10 Ether <=> 3,255 USDT
    // uint256 public ethAmount_ = 10000000000000000000;
    // uint256 public erc20Amount_ = 3255000000;
    mapping(address => PriceInfo) public priceInfoMap;
    mapping(address => uint256) public addressEffect_; //  Effective time of address to call prices

    address public nestToken_;
    uint256 destructionAmount = 0 ether; //  Amount of NEST to destroy to call prices
    uint256 effectTime = 1 minutes; //  Waiting time to start calling prices

    struct PriceInfo {
        uint256 ethAmount;
        uint256 erc20Amount;
        uint128 avgPrice;
        int128 vola;
        uint256 lastUpdateBlock;
    }

    constructor(address nest) public {
        nestToken_ = nest;
    }

    // Activate the price checking function
    function activate(address defi) public { // should not be called for multiple times, or effect time would postpone
        IERC20(nestToken_).transferFrom(msg.sender, address(0), destructionAmount);
        addressEffect_[defi] = now + effectTime; // SHOULD ADD A BOOL TO FLAG ACTIVATED
    }

    function queryPriceAvgVola(address token, address payback)
        external payable
        returns (uint256 ethAmount, uint256 tokenAmount, uint128 avgPrice, int128 vola, uint256 bn)
    {
        require(checkUseNestPrice(msg.sender), "oracleMock: not activeted yet");
        require(msg.value >= 0.01 ether, "oracleMock: insufficient oracle fee");
        repayEth(payback, msg.value - 0.01 ether); // just use repayEth to simulate the real impl.
        return latestPrice(token);
    }

    function latestPrice(address token)
        public
        view
        returns (uint256 ethAmount, uint256 tokenAmount, uint128 avgPrice, int128 vola, uint256 bn)
    {
        return (priceInfoMap[token].ethAmount, priceInfoMap[token].erc20Amount, priceInfoMap[token].avgPrice, priceInfoMap[token].vola, priceInfoMap[token].lastUpdateBlock);
    }

    function checkPriceNow(address token)
        public view
        returns (uint256 ethAmount, uint256 erc20Amount, uint128 avgPrice, int128 vola, uint256 blockNum)
    {
        // return the newest price
        ethAmount = priceInfoMap[token].ethAmount;
        erc20Amount = priceInfoMap[token].erc20Amount;
        avgPrice = priceInfoMap[token].avgPrice;
        vola = priceInfoMap[token].vola;
        blockNum = priceInfoMap[token].lastUpdateBlock;
    }

    function feedPrice(address token, uint256 ethAmount, uint256 erc20Amount, uint128 avgPrice, int128 vola) external {
        priceInfoMap[token].ethAmount = ethAmount;
        priceInfoMap[token].erc20Amount = erc20Amount;
        priceInfoMap[token].avgPrice = avgPrice;
        priceInfoMap[token].vola = vola;
        priceInfoMap[token].lastUpdateBlock = block.number;
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