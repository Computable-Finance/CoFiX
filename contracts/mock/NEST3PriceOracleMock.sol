// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;
// import "../interface/INest_3_OfferPrice.sol";

contract NEST3PriceOracleMock {
    
    // 10 Ether <=> 3,255 USDT
    // TODO: should use mapping for these variables
    uint256 public ethAmount_ = 10000000000000000000;
    uint256 public erc20Amount_ = 3255000000;
    uint256 public blockNumber_ = block.number;
    PriceInfo[] public priceInfoList_;

    struct PriceInfo {
        uint256 ethAmount;
        uint256 erc20Amount;
        uint256 blockNumber;
    }

    function updateAndCheckPriceNow(address tokenAddress)
        external payable
        returns(uint256 ethAmount, uint256 erc20Amount, uint256 blockNum)
    {
        require(msg.value > 0.001 ether, "insufficient oracle fee");
        msg.sender.transfer(msg.value - 0.001 ether); // return back
        return checkPriceNow(tokenAddress);
    }

    function updateAndCheckPriceList(address tokenAddress, uint256 num)
        external payable
        returns (uint256[] memory)
    {
        uint256 priceLength = priceInfoList_.length;
        require(priceLength >= num, "num too large");
        uint256 length = num*3;
        uint256 i = 0;
        uint256[] memory data = new uint256[](length);
        while (i < length) {
            uint _idx = priceLength - 1 - (i/3);
            data[i++] = priceInfoList_[_idx].ethAmount;
            data[i++] = priceInfoList_[_idx].erc20Amount;
            data[i++] = priceInfoList_[_idx].blockNumber;
        }
        return data;
    }

    function addPricesToList(
        address tokenAddress,
        uint256 _ethAmount,
        uint256 _erc20Amount,
        uint256 _ethStep,
        uint256 _ercStep,
        uint256 _blockStep,
        uint256 _cnt
    ) public {
        (uint256 ethAmount, uint256 erc20Amount, uint256 blockNum) = checkPriceNow(tokenAddress);
        for (uint256 i = 0; i < _cnt; i++) {
            addPriceToList(_ethAmount, _erc20Amount, blockNum);
            _ethAmount = _ethAmount * _ethStep / 100;
            _erc20Amount = _erc20Amount * _ercStep / 100;
            blockNum = blockNum + _blockStep;
        }
    }

    function checkPriceNow(address tokenAddress)
        public view
        returns (uint256 ethAmount, uint256 erc20Amount, uint256 blockNum)
    {
        uint256 _blockNumber = block.number;
        if (_blockNumber < blockNumber_) {
            _blockNumber = blockNumber_ + 1;
        }
        return (ethAmount_, erc20Amount_, _blockNumber);
    }

    function setPriceNow(address tokenAddress, uint256 _ethAmount, uint256 _erc20Amount) public {
        ethAmount_ = _ethAmount;
        blockNumber_ = _erc20Amount;
    }

    function addPriceToList(uint256 _ethAmount, uint256 _erc20Amount, uint256 _blockNumber) internal {
        priceInfoList_.push(PriceInfo({
            ethAmount: _ethAmount,
            erc20Amount: _erc20Amount,
            blockNumber: _blockNumber
        }));
    }
}