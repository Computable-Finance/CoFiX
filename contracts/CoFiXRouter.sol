// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

import './interface/ICoFiXFactory.sol';
import './lib/TransferHelpers.sol';
import './interface/ICoFiXRouter.sol';
import './lib/SafeMath.sol';
import './interface/IERC20.sol';
import './interface/IWETH.sol';
import './interface/ICoFiXPair.sol';

contract CoFiXRouter is ICoFiXRouter {
    using SafeMath for uint;

    address public immutable override factory;
    address public immutable override WETH;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'CRouter: EXPIRED');
        _;
    }

    constructor(address _factory, address _WETH) public {
        factory = _factory;
        WETH = _WETH;
    }

    receive() external payable {}

    // calculates the CREATE2 address for a pair without making any external calls
    function pairFor(address _factory, address token) internal view returns (address pair) {
        // pair = address(uint(keccak256(abi.encodePacked(
        //         hex'ff',
        //         _factory,
        //         keccak256(abi.encodePacked(token)),
        //         hex'fb0c5470b7fbfce7f512b5035b5c35707fd5c7bd43c8d81959891b0296030118' // init code hash
        //     )))); // calc the real init code hash, not suitable for us now, could use this in the future
        return ICoFiXFactory(_factory).getPair(token);
    }

    // msg.value = amountETH + oracle fee
    function addLiquidity(
        address token,
        uint amountETH,
        uint amountToken,
        uint liquidityMin,
        address to,
        uint deadline
    ) external override payable ensure(deadline) returns (uint liquidity)
    {
        // create the pair if it doesn't exist yet
        if (ICoFiXFactory(factory).getPair(token) == address(0)) {
            ICoFiXFactory(factory).createPair(token);
        }
        require(msg.value > amountETH, "CRouter: insufficient msg.value");
        uint256 _oracleFee = msg.value.sub(amountETH);
        address pair = pairFor(factory, token);
        if (amountToken > 0 ) { // support for tokens which do not allow to transfer zero values
            TransferHelper.safeTransferFrom(token, msg.sender, pair, amountToken);
        }
        if (amountETH > 0) {
            IWETH(WETH).deposit{value: amountETH}();
            assert(IWETH(WETH).transfer(pair, amountETH));
        }
        uint256 oracleFeeChange;
        (liquidity, oracleFeeChange) = ICoFiXPair(pair).mint{value: _oracleFee}(to);
        require(liquidity >= liquidityMin, "CRouter: less liquidity than expected");
        // refund oracle fee to msg.sender, if any
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    }

    // msg.value = oracle fee
    function removeLiquidityGetToken(
        address token,
        uint liquidity,
        uint amountTokenMin,
        address to,
        uint deadline
    ) external override payable ensure(deadline) returns (uint amountToken)
    {
        require(msg.value > 0, "CRouter: insufficient msg.value");
        address pair = pairFor(factory, token);
        ICoFiXPair(pair).transferFrom(msg.sender, pair, liquidity); // send liquidity to pair
        uint oracleFeeChange; 
        (amountToken, oracleFeeChange) = ICoFiXPair(pair).burn{value: msg.value}(token, to);
        require(amountToken >= amountTokenMin, "CRouter: got less than expected");
        // refund oracle fee to msg.sender, if any
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    }

    // msg.value = oracle fee
    function removeLiquidityGetETH(
        address token,
        uint liquidity,
        uint amountETHMin,
        address to,
        uint deadline
    ) external override payable ensure(deadline) returns (uint amountETH)
    {
        require(msg.value > 0, "CRouter: insufficient msg.value");
        address pair = pairFor(factory, token);
        ICoFiXPair(pair).transferFrom(msg.sender, pair, liquidity); // send liquidity to pair
        uint oracleFeeChange; 
        (amountETH, oracleFeeChange) = ICoFiXPair(pair).burn{value: msg.value}(WETH, address(this));
        require(amountETH >= amountETHMin, "CRouter: got less than expected");
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
        // refund oracle fee to msg.sender, if any
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    }

    // msg.value = amountIn + oracle fee
    function swapExactETHForTokens(
        address token,
        uint amountIn,
        uint amountOutMin,
        address to,
        uint deadline
    ) external override payable ensure(deadline) returns (uint _amountIn, uint _amountOut)
    {
        require(msg.value > amountIn, "CRouter: insufficient msg.value");
        IWETH(WETH).deposit{value: amountIn}();
        address pair = pairFor(factory, token);
        assert(IWETH(WETH).transfer(pair, amountIn));
        uint oracleFeeChange; 
        (_amountIn, _amountOut, oracleFeeChange) = ICoFiXPair(pair).swapWithExact{
            value: msg.value.sub(amountIn)}(token, to);
        require(_amountOut >= amountOutMin, "CRouter: got less than expected");
        // refund oracle fee to msg.sender, if any
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    }

    function swapExactTokensForTokens(
        address tokenIn,
        address tokenOut,
        uint amountIn,
        uint amountOutMin,
        address to,
        uint deadline
    ) external payable ensure(deadline) returns (uint _amountIn, uint _amountOut) {
        // swapExactTokensForETH
        require(msg.value > 0, "CRouter: insufficient msg.value");
        address pairIn = pairFor(factory, tokenIn);
        TransferHelper.safeTransferFrom(tokenIn, msg.sender, pairIn, amountIn);
        uint oracleFeeChange; 
        (_amountIn, _amountOut, oracleFeeChange) = ICoFiXPair(pairIn).swapWithExact{value: msg.value}(WETH, address(this));

        // swapExactETHForTokens
        address pairOut = pairFor(factory, tokenOut);
        assert(IWETH(WETH).transfer(pairOut, _amountOut)); // swap with all amountOut in last swap
        (, _amountOut, oracleFeeChange) = ICoFiXPair(pairOut).swapWithExact{value: oracleFeeChange}(tokenOut, to);
        require(_amountOut >= amountOutMin, "CRouter: got less than expected");
        // refund oracle fee to msg.sender, if any
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    }

    // msg.value = oracle fee
    function swapExactTokensForETH(
        address token,
        uint amountIn,
        uint amountOutMin,
        address to,
        uint deadline
    ) external override payable ensure(deadline) returns (uint _amountIn, uint _amountOut)
    {
        require(msg.value > 0, "CRouter: insufficient msg.value");
        address pair = pairFor(factory, token);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountIn);
        uint oracleFeeChange; 
        (_amountIn, _amountOut, oracleFeeChange) = ICoFiXPair(pair).swapWithExact{value: msg.value}(WETH, address(this));
        require(_amountOut >= amountOutMin, "CRouter: got less than expected");
        IWETH(WETH).withdraw(_amountOut);
        TransferHelper.safeTransferETH(to, _amountOut);
        // refund oracle fee to msg.sender, if any
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    }

    // msg.value = amountInMax + oracle fee
    function swapETHForExactTokens(
        address token,
        uint amountInMax,
        uint amountOutExact,
        address to,
        uint deadline
    ) external override payable ensure(deadline) returns (uint _amountIn, uint _amountOut)
    {
        require(msg.value > amountInMax, "CRouter: insufficient msg.value");
        IWETH(WETH).deposit{value: amountInMax}();
        address pair = pairFor(factory, token);
        assert(IWETH(WETH).transfer(pair, amountInMax));
        uint oracleFeeChange; 
        (_amountIn, _amountOut, oracleFeeChange) = ICoFiXPair(pair).swapForExact{
            value: msg.value.sub(amountInMax) }(token, amountOutExact, to); // TODO: handle two *amountOut
        require(_amountIn <= amountInMax, "CRouter: spend more than expected");
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    }

    // msg.value = oracle fee
    function swapTokensForExactETH(
        address token,
        uint amountInMax,
        uint amountOutExact,
        address to,
        uint deadline
    ) external override payable ensure(deadline) returns (uint _amountIn, uint _amountOut)
    {
        require(msg.value > 0, "CRouter: insufficient msg.value");
        address pair = pairFor(factory, token);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountInMax);
        uint oracleFeeChange; 
        (_amountIn, _amountOut, oracleFeeChange) = ICoFiXPair(pair).swapForExact{
            value: msg.value}(WETH, amountOutExact, address(this));  // TODO: handle two *amountOut
        require(_amountIn <= amountInMax, "CRouter: got less than expected");
        IWETH(WETH).withdraw(_amountOut);
        TransferHelper.safeTransferETH(to, amountOutExact);
        // refund oracle fee to msg.sender, if any
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    }
}
