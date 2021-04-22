// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;
// import "../interface/INest_3_OfferPrice.sol";

contract NEST36PriceOracleConstMock {
    
    mapping (address => PriceInfo) public priceInfoMap;

    struct PriceInfo {
        uint latestPriceBlockNumber;
        uint latestPriceValue;
        uint triggeredPriceBlockNumber;
        uint triggeredPriceValue;
        uint triggeredAvgPrice;
        uint triggeredSigmaSQ;
    }

    // NEST Price Oracle
    // https://etherscan.io/address/0x7722891Ee45aD38AE05bDA8349bA4CF23cFd270F#readContract

    // USDT 0xdAC17F958D2ee523a2206206994597C13D831ec7
    // 10 Ether <=> 3,862.6 USDT, (386.26 USDT/ETH)
    // uint256 public ethAmount = 10000000000000000000;
    // uint256 public erc20Amount = 3862600000;

    // HBTC 0x0316EB71485b0Ab14103307bf65a021042c6d380
    // 10 Ether <=> 0.33988 HBTC (0.033988 HBTC/ETH)
    // uint256 public ethAmount = 10000000000000000000;
    // uint256 public erc20Amount = 339880000000000000;

    // 11,364.6 USDT/BTC

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
}