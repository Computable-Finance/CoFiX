// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

import './interface/ICofiXFactory.sol';
import './lib/TransferHelpers.sol';
import './interface/ICofiXRouter.sol';
import './lib/SafeMath.sol';
import './interface/IERC20.sol';
import './interface/IWETH.sol';
import './interface/ICofiXPair.sol';

contract CofiXRouter is ICofiXRouter {
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

    receive() external payable {
        // assert(msg.sender == WETH); // only accept ETH via fallback from the WETH contract
        // TODO: strict limit
    }

    // calculates the CREATE2 address for a pair without making any external calls
    function pairFor(address _factory, address token) internal view returns (address pair) {
        // pair = address(uint(keccak256(abi.encodePacked(
        //         hex'ff',
        //         _factory,
        //         keccak256(abi.encodePacked(token)),
        //         hex'fb0c5470b7fbfce7f512b5035b5c35707fd5c7bd43c8d81959891b0296030118' // init code hash
        //     )))); // TODO: calc the real init code hash
        return ICofiXFactory(_factory).getPair(token);
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
        if (ICofiXFactory(factory).getPair(token) == address(0)) {
            address _pair = ICofiXFactory(factory).createPair(token);
            require(_pair == pairFor(factory, token), "CRouter: wrong pair address");
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
        uint256 feeChange;
        (liquidity, feeChange) = ICofiXPair(pair).mint{value: _oracleFee}(to);
        require(liquidity >= liquidityMin, "CRouter: less liquidity than expected");
        // refund eth, if any
        if (feeChange > 0) TransferHelper.safeTransferETH(msg.sender, feeChange);
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
        ICofiXPair(pair).transferFrom(msg.sender, pair, liquidity); // send liquidity to pair
        uint feeChange; 
        (amountToken, feeChange) = ICofiXPair(pair).burn{value: msg.value}(token, to);
        require(amountToken >= amountTokenMin, "CRouter: got less than expected");
        if (feeChange > 0) TransferHelper.safeTransferETH(msg.sender, feeChange);
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
        ICofiXPair(pair).transferFrom(msg.sender, pair, liquidity); // send liquidity to pair
        uint feeChange; 
        (amountETH, feeChange) = ICofiXPair(pair).burn{value: msg.value}(WETH, address(this));
        require(amountETH >= amountETHMin, "CRouter: got less than expected");
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH.add(feeChange));
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
        uint feeChange; 
        (_amountIn, _amountOut, feeChange) = ICofiXPair(pair).swapWithExact{value: msg.value.sub(amountIn)}(token, to);
        require(_amountOut >= amountOutMin, "CRouter: got less than expected");
        if (feeChange > 0) TransferHelper.safeTransferETH(msg.sender, feeChange);
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
        uint feeChange; 
        (_amountIn, _amountOut, feeChange) = ICofiXPair(pair).swapWithExact{value: msg.value}(WETH, address(this));
        require(_amountOut >= amountOutMin, "CRouter: got less than expected");
        IWETH(WETH).withdraw(_amountOut);
        TransferHelper.safeTransferETH(to, _amountOut.add(feeChange));
    }

    // msg.value = amountInMax + oracle fee
    function swapETHForExactTokens(
        address token,
        uint amountInMax,
        uint amountOut,
        address to,
        uint deadline
    ) external override payable ensure(deadline) returns (uint _amountIn, uint _amountOut)
    {
        require(msg.value > amountInMax, "CRouter: insufficient msg.value");
        IWETH(WETH).deposit{value: amountInMax}();
        address pair = pairFor(factory, token);
        assert(IWETH(WETH).transfer(pair, amountInMax));
        uint feeChange; 
        (_amountIn, _amountOut, feeChange) = ICofiXPair(pair).swapForExact{value: msg.value.sub(amountInMax)}(token, amountOut, to); // TODO: handle two *amountOut
        require(_amountIn <= amountInMax, "CRouter: spend more than expected");
        if (feeChange > 0) TransferHelper.safeTransferETH(msg.sender, feeChange);
    }

    // msg.value = oracle fee
    function swapTokensForExactETH(
        address token,
        uint amountInMax,
        uint amountOut,
        address to,
        uint deadline
    ) external override payable ensure(deadline) returns (uint _amountIn, uint _amountOut)
    {
        require(msg.value > 0, "CRouter: insufficient msg.value");
        address pair = pairFor(factory, token);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountInMax);
        uint feeChange; 
        (_amountIn, _amountOut, feeChange) = ICofiXPair(pair).swapForExact{value: msg.value}(WETH, amountOut, address(this));  // TODO: handle two *amountOut
        require(_amountIn <= amountInMax, "CRouter: got less than expected");
        IWETH(WETH).withdraw(_amountOut);
        TransferHelper.safeTransferETH(to, amountOut.add(feeChange));
    }
}
