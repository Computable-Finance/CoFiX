// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;
// import "../interface/INest_3_OfferPrice.sol";

contract NEST3PriceOracleConstMock {
    
    // 10 Ether <=> 3,255 USDT
    // TODO: should use mapping for these variables
    uint256 public ethAmount_ = 10000000000000000000;
    uint256 public erc20Amount_ = 3255000000;
    uint256 public lastUpdateBlock;

    function updateAndCheckPriceList(address token, uint256 num)
        external payable
        returns (uint256[] memory)
    {
        require(msg.value > 0.001 ether, "oracleMock: insufficient oracle fee");
        return checkPriceList(token, num);
    }

    function checkPriceList(address token, uint256 num)
        public
        view
        returns (uint256[] memory)
    {
        uint256 length = num*3;
        uint256 i = 0;
        uint256[] memory data = new uint256[](length);
        uint _idx;
        require(lastUpdateBlock > num, "oracleMock: blockNum too small");
        while (i < length) {
            _idx = (i/3);
            data[i++] = ethAmount_;
            data[i++] = erc20Amount_;
            data[i++] = lastUpdateBlock - 1 - _idx;
        }
        return data;
    }

    function feedPrice() external {
        lastUpdateBlock = block.number;
    }
}