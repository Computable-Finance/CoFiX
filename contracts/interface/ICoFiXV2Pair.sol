// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;
import './ICoFiXERC20.sol';

interface ICoFiXV2Pair is ICoFiXERC20 {

    struct OraclePrice {
        uint256 ethAmount;
        uint256 erc20Amount;
        uint256 blockNum;
        uint256 K;
        uint256 theta;
    }

    // All pairs: {ETH <-> ERC20 Token}
    event Mint(address indexed sender, uint amount0, uint amount1);
    event Burn(address indexed sender, address outToken, uint outAmount, address indexed to);
    event Swap(
        address indexed sender,
        uint amountIn,
        uint amountOut,
        address outToken,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    function MINIMUM_LIQUIDITY() external pure returns (uint);
    function factory() external view returns (address);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1);

    function mint(address to, uint amountETH, uint amountToken) external payable returns (uint liquidity, uint oracleFeeChange);
    function burn(address tokenTo, address ethTo) external payable returns (uint amountTokenOut, uint amountETHOut, uint oracleFeeChange);
    function swapWithExact(address outToken, address to) external payable returns (uint amountIn, uint amountOut, uint oracleFeeChange, uint256[5] memory tradeInfo);
    // function swapForExact(address outToken, uint amountOutExact, address to) external payable returns (uint amountIn, uint amountOut, uint oracleFeeChange, uint256[4] memory tradeInfo);
    function skim(address to) external;
    function sync() external;

    function initialize(address, address, string memory, string memory, uint256, uint256) external;

    /// @dev get Net Asset Value Per Share
    /// @param  ethAmount ETH side of Oracle price {ETH <-> ERC20 Token}
    /// @param  erc20Amount Token side of Oracle price {ETH <-> ERC20 Token}
    /// @return navps The Net Asset Value Per Share (liquidity) represents
    function getNAVPerShare(uint256 ethAmount, uint256 erc20Amount) external view returns (uint256 navps);

    /// @dev get initial asset ratio
    /// @return _initToken0Amount Token0(ETH) side of initial asset ratio {ETH <-> ERC20 Token}
    /// @return _initToken1Amount Token1(ERC20) side of initial asset ratio {ETH <-> ERC20 Token}
    function getInitialAssetRatio() external view returns (uint256 _initToken0Amount, uint256 _initToken1Amount);
}
