// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;
// import "../interface/INest_3_OfferPrice.sol";

contract NEST3PriceOracleMock {
    
    // 10 Ether <=> 3,255 USDT
    // TODO: should use mapping for these variables
    // uint256 public ethAmount_ = 10000000000000000000;
    // uint256 public erc20Amount_ = 3255000000;
    mapping(address => PriceInfo[]) public priceInfoList_;

    struct PriceInfo {
        uint256 ethAmount;
        uint256 erc20Amount;
        uint256 blockNumber;
    }

    function updateAndCheckPriceNow(address token)
        external payable
        returns(uint256 ethAmount, uint256 erc20Amount, uint256 blockNum)
    {
        require(msg.value > 0.001 ether, "insufficient oracle fee");
        msg.sender.transfer(msg.value - 0.001 ether); // return back
        return checkPriceNow(token);
    }

    function updateAndCheckPriceList(address token, uint256 num)
        external payable
        returns (uint256[] memory)
    {
        uint256 priceLength = priceInfoList_[token].length;
        require(priceLength >= num, "num too large");
        uint256 length = num*3;
        uint256 i = 0;
        uint256[] memory data = new uint256[](length);
        while (i < length) {
            uint _idx = priceLength - 1 - (i/3);
            data[i++] = priceInfoList_[token][_idx].ethAmount;
            data[i++] = priceInfoList_[token][_idx].erc20Amount;
            data[i++] = priceInfoList_[token][_idx].blockNumber;
        }
        return data;
    }

    // add prices to list
    function addPricesToList(
        address token,
        uint256 _ethAmount,
        uint256 _erc20Amount,
        uint256 _ethStep,
        uint256 _ercStep,
        uint256 _blockStep,
        uint256 _cnt
    ) public {
        uint256 _blockNum = block.number;
        for (uint256 i = 0; i < _cnt; i++) {
            addPriceToList(token, _ethAmount, _erc20Amount, _blockNum);
            _ethAmount = _ethAmount * _ethStep / 100;
            _erc20Amount = _erc20Amount * _ercStep / 100;
            _blockNum = _blockNum + _blockStep;
        }
    }

    function addPriceToList(address token, uint256 _ethAmount, uint256 _erc20Amount, uint256 _blockNum) public {
        (,, uint256 lastBlockNum) = checkPriceNow(token);
        if (_blockNum == 0) {
            _blockNum = block.number;
        }
        require(_blockNum > lastBlockNum, "wrong block number index");
        priceInfoList_[token].push(PriceInfo({
            ethAmount: _ethAmount,
            erc20Amount: _erc20Amount,
            blockNumber: _blockNum
        }));
    }

    function checkPriceNow(address token)
        public view
        returns (uint256 ethAmount, uint256 erc20Amount, uint256 blockNum)
    {
        uint256 _len = priceInfoList_[token].length;
        require(_len > 0, "no price available");
        // return the newest price
        ethAmount = priceInfoList_[token][_len - 1].ethAmount;
        erc20Amount = priceInfoList_[token][_len - 1].erc20Amount;
        blockNum = priceInfoList_[token][_len - 1].blockNumber;
    }
}