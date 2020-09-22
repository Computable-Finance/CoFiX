// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NEST3PriceOracleMock {
    
    // 10 Ether <=> 3,255 USDT
    // uint256 public ethAmount_ = 10000000000000000000;
    // uint256 public erc20Amount_ = 3255000000;
    mapping(address => PriceInfo[]) public priceInfoList_;
    mapping(address => uint256) public addressEffect_; //  Effective time of address to call prices

    address public nestToken_;
    uint256 destructionAmount = 0 ether; //  Amount of NEST to destroy to call prices
    uint256 effectTime = 1 minutes; //  Waiting time to start calling prices

    struct PriceInfo {
        uint256 ethAmount;
        uint256 erc20Amount;
        uint256 blockNum;
    }

    constructor(address nest) public {
        nestToken_ = nest;
    }

    // Activate the price checking function
    function activation() public { // should not be called for multiple times, or effect time would postpone
        IERC20(nestToken_).transferFrom(msg.sender, address(0), destructionAmount);
        addressEffect_[msg.sender] = now + effectTime; // SHOULD ADD A BOOL TO FLAG ACTIVATED
    }

    function updateAndCheckPriceNow(address token)
        external payable
        returns(uint256 ethAmount, uint256 erc20Amount, uint256 blockNum)
    {
        require(checkUseNestPrice(msg.sender), "oracleMock: not activeted yet");
        require(priceInfoList_[token].length > 0, "oracleMock: no price available");
        // It's recommended to stop using .transfer() and .send() and instead use .call().
        // https://consensys.github.io/smart-contract-best-practices/recommendations/#dont-use-transfer-or-send
        require(msg.value >= 0.001 ether, "oracleMock: insufficient oracle fee");
        repayEth(msg.sender, msg.value - 0.001 ether); // just use repayEth to simulate the real impl.
        return checkPriceNow(token);
    }

    function updateAndCheckPriceList(address token, uint256 num)
        external payable
        returns (uint256[] memory)
    {
        require(checkUseNestPrice(msg.sender), "oracleMock: not activeted yet");
        require(msg.value >= 0.01 ether, "oracleMock: insufficient oracle fee");
        // msg.sender.transfer(msg.value - 0.01 ether); // return back
        // It's recommended to stop using .transfer() and .send() and instead use .call().
        // https://consensys.github.io/smart-contract-best-practices/recommendations/#dont-use-transfer-or-send
        repayEth(msg.sender, msg.value - 0.01 ether); // just use repayEth to simulate the real impl.
        return checkPriceList(token, num);
    }

    function checkPriceList(address token, uint256 num)
        public
        view
        returns (uint256[] memory)
    {
        uint256 priceLength = priceInfoList_[token].length;
        require(priceLength >= num, "oracleMock: num too large");
        uint256 length = num*3;
        uint256 i = 0;
        uint256[] memory data = new uint256[](length);
        uint _idx;
        while (i < length) {
            _idx = priceLength - 1 - (i/3);
            data[i++] = priceInfoList_[token][_idx].ethAmount;
            data[i++] = priceInfoList_[token][_idx].erc20Amount;
            data[i++] = priceInfoList_[token][_idx].blockNum;
        }
        return data;
    }

    // // add prices to list
    // function addPricesToList(
    //     address token,
    //     uint256 _ethAmount,
    //     uint256 _erc20Amount,
    //     uint256 _ethStep,
    //     uint256 _ercStep,
    //     uint256 _blockStep,
    //     uint256 _cnt
    // ) public {
    //     uint256 _blockNum = block.number;
    //     for (uint256 i = 0; i < _cnt; i++) {
    //         addPriceToList(token, _ethAmount, _erc20Amount, _blockNum);
    //         _ethAmount = _ethAmount * _ethStep / 100;
    //         _erc20Amount = _erc20Amount * _ercStep / 100;
    //         _blockNum = _blockNum + _blockStep;
    //     }
    // }

    function addPriceToList(address token, uint256 _ethAmount, uint256 _erc20Amount, uint256 _blockNum) public {
        (,, uint256 lastBlockNum) = checkPriceNow(token);
        if (_blockNum == 0) {
            _blockNum = block.number;
        }
        require(_blockNum > lastBlockNum, "oracleMock: wrong block number index");
        priceInfoList_[token].push(PriceInfo({
            ethAmount: _ethAmount,
            erc20Amount: _erc20Amount,
            blockNum: _blockNum
        }));
    }

    function checkPriceNow(address token)
        public view
        returns (uint256 ethAmount, uint256 erc20Amount, uint256 blockNum)
    {
        uint256 _len = priceInfoList_[token].length;
        if (_len == 0) {
            return (0, 0, 0);
        }
        // return the newest price
        ethAmount = priceInfoList_[token][_len - 1].ethAmount;
        erc20Amount = priceInfoList_[token][_len - 1].erc20Amount;
        blockNum = priceInfoList_[token][_len - 1].blockNum;
    }

    function getPriceLength(address token)
        public view
        returns (uint256)
    {
        return priceInfoList_[token].length;
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