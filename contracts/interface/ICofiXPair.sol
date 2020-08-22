// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;
import './ICofiXERC20.sol';

interface ICofiXPair is ICofiXERC20 {

    struct OraclePrice {
        uint256 ethAmount;
        uint256 erc20Amount;
        uint256 blockNum;
        uint256 K;
    }
    
    // All pairs: {ETH <-> ERC20 Token}
    event Mint(address indexed sender, uint amount0, uint amount1);
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint amount0In,
        uint amount1In,
        uint amount0Out,
        uint amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    function MINIMUM_LIQUIDITY() external pure returns (uint);
    function factory() external view returns (address);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1);

    function mint(address to) external payable returns (uint liquidity, uint feeChange);
    function burn(address outToken, address to) external payable returns (uint amountOut, uint feeChange);
    function swapWithExact(address outToken, address to) external payable returns (uint amountIn, uint amountOut, uint feeChange);
    function swapForExact(address outToken, uint amountOutExact, address to) external payable returns (uint amountIn, uint amountOut, uint feeChange);
    function skim(address to) external;
    function sync() external;

    function initialize(address, address) external;
}
