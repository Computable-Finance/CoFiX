// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

interface INest_3_OfferPrice {
    function transfer(address to, uint value) external returns (bool);

    /**
    * @dev Update and check the latest price
    * @param tokenAddress Token address
    * @return ethAmount ETH amount
    * @return erc20Amount Erc20 amount
    * @return blockNum Price block
    */
    function updateAndCheckPriceNow(address tokenAddress) external payable returns(uint256 ethAmount, uint256 erc20Amount, uint256 blockNum);

    /**
    * @dev Update and check the effective price list
    * @param tokenAddress Token address
    * @param num Number of prices to check
    * @return uint256[] price list
    */
    function updateAndCheckPriceList(address tokenAddress, uint256 num) external payable returns (uint256[] memory);

    // Activate the price checking function
    function activation() external;

    // Check the minimum ETH cost of obtaining the price
    function checkPriceCostLeast(address tokenAddress) external view returns(uint256);

    // Check the maximum ETH cost of obtaining the price
    function checkPriceCostMost(address tokenAddress) external view returns(uint256);

    // Check the cost of a single price data
    function checkPriceCostSingle(address tokenAddress) external view returns(uint256);

    // Check whether the price-checking functions can be called
    function checkUseNestPrice(address target) external view returns (bool);

    // Check whether the address is in the blocklist
    function checkBlocklist(address add) external view returns(bool);

    // Check the amount of NEST to destroy to call prices
    function checkDestructionAmount() external view returns(uint256);

    // Check the waiting time to start calling prices
    function checkEffectTime() external view returns (uint256);
}