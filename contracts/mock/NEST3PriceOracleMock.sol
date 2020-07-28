// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;
// import "../interface/INest_3_OfferPrice.sol";

contract NEST3PriceOracleMock {
    function updateAndCheckPriceNow(address tokenAddress)
        external payable
        returns(uint256 ethAmount, uint256 erc20Amount, uint256 blockNum)
    {
        require(msg.value > 0.001 ether, "insufficient oracle fee");
        msg.sender.transfer(msg.value - 0.001 ether); // return back
        return checkPriceNow(tokenAddress);
    }

    function checkPriceNow(address tokenAddress)
        public view
        returns (uint256 ethAmount, uint256 erc20Amount, uint256 blockNum)
    {
        // 10 Ether <=> 3,255 USDT
        return (10000000000000000000, 3255000000, block.number);
    }
}