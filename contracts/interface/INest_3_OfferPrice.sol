// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

interface INest_3_OfferPrice {
    function transfer(address to, uint value) external returns (bool);

    /**
    * @dev 更新并查看最新价格
    * @param tokenAddress token地址
    * @return ethAmount eth数量
    * @return erc20Amount erc20数量
    * @return blockNum 价格区块
    */
    function updateAndCheckPriceNow(address tokenAddress) external payable returns(uint256 ethAmount, uint256 erc20Amount, uint256 blockNum);

    /**
    * @dev 更新并查看生效价格列表
    * @param tokenAddress token地址
    * @param num 查询条数
    * @return uint256[] 价格列表
    */
    function updateAndCheckPriceList(address tokenAddress, uint256 num) external payable returns (uint256[] memory);

    // 激活使用价格合约
    function activation() external;

    // 查看获取价格eth最少费用
    function checkPriceCostLeast(address tokenAddress) external view returns(uint256);

    // 查看获取价格eth最多费用
    function checkPriceCostMost(address tokenAddress) external view returns(uint256);

    // 查看价格eth单条数据费用
    function checkPriceCostSingle(address tokenAddress) external view returns(uint256);

    // 查看是否可以调用价格
    function checkUseNestPrice(address target) external view returns (bool);

    // 查看地址是否在黑名单
    function checkBlocklist(address add) external view returns(bool);

    // 查看调用价格销毁 nest数量
    function checkDestructionAmount() external view returns(uint256);

    // 查看可以调用价格等待时间
    function checkEffectTime() external view returns (uint256);
}