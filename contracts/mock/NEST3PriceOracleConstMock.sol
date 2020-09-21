// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;
// import "../interface/INest_3_OfferPrice.sol";

contract NEST3PriceOracleConstMock {
    
    mapping (address => PriceInfo) public priceInfoMap;

    struct PriceInfo {
        uint256 ethAmount;
        uint256 erc20Amount;
        uint256 lastUpdateBlock;
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

    function updateAndCheckPriceList(address token, uint256 num)
        external payable
        returns (uint256[] memory)
    {
        require(msg.value >= 0.01 ether, "oracleMock: insufficient oracle fee");
        repayEth(msg.sender, msg.value - 0.01 ether); // just use repayEth to simulate the real impl.
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
        require(priceInfoMap[token].lastUpdateBlock > num, "oracleMock: blockNum too small");
        while (i < length) {
            _idx = (i/3);
            data[i++] = priceInfoMap[token].ethAmount;
            data[i++] = priceInfoMap[token].erc20Amount;
            data[i++] = priceInfoMap[token].lastUpdateBlock - 1 - _idx;
        }
        return data;
    }

    function checkPriceNow(address token)
        public view
        returns (uint256 ethAmount, uint256 erc20Amount, uint256 blockNum)
    {
        ethAmount = priceInfoMap[token].ethAmount;
        erc20Amount = priceInfoMap[token].erc20Amount;
        blockNum = priceInfoMap[token].lastUpdateBlock - 1;
    }

    function feedPrice(address token, uint256 ethAmount, uint256 erc20Amount) external {
        priceInfoMap[token].ethAmount = ethAmount;
        priceInfoMap[token].erc20Amount = erc20Amount;
        priceInfoMap[token].lastUpdateBlock = block.number;
    }

    function make_payable(address x) internal pure returns (address payable) {
      return address(uint160(x));
    }

    // Transfer ETH
    function repayEth(address addr, uint256 amount) private {
        make_payable(addr).transfer(amount);
    }
}