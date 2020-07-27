// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

import './interface/IAGroupFactory.sol';
import './lib/TransferHelpers.sol';
import './interface/IAGroupRouter.sol';
import './lib/SafeMath.sol';
import './interface/IERC20.sol';
import './interface/IWETH.sol';
import './interface/IAGroupPair.sol';

contract AGroupRouter is IAGroupRouter {
    using SafeMath for uint;

    address public immutable override factory;
    address public immutable override WETH;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'AGroupV1Router: EXPIRED');
        _;
    }

    constructor(address _factory, address _WETH) public {
        factory = _factory;
        WETH = _WETH;
    }

    receive() external payable {
        assert(msg.sender == WETH); // only accept ETH via fallback from the WETH contract
    }

    // calculates the CREATE2 address for a pair without making any external calls
    function pairFor(address _factory, address token) internal pure returns (address pair) {
        pair = address(uint(keccak256(abi.encodePacked(
                hex'ff',
                _factory,
                keccak256(abi.encodePacked(token)),
                hex'96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f' // init code hash
            )))); // TODO: calc the real init code hash
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
        if (IAGroupFactory(factory).getPair(token) == address(0)) {
            IAGroupFactory(factory).createPair(token);
        }
        require(msg.value > amountETH, "insufficient msg.value");
        uint256 _oracleFee = msg.value.sub(amountETH);
        address pair = pairFor(factory, token);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountToken);
        IWETH(WETH).deposit{value: amountETH}();
        assert(IWETH(WETH).transfer(pair, amountETH));
        uint256 feeChange;
        (liquidity, feeChange) = IAGroupPair(pair).mint{value: _oracleFee}(to);
        require(liquidity >= liquidityMin, "less liquidity than expected");
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
        require(msg.value > 0, "insufficient msg.value");
        address pair = pairFor(factory, token);
        IAGroupPair(pair).transferFrom(msg.sender, pair, liquidity); // send liquidity to pair
        uint feeChange; 
        (amountToken, feeChange) = IAGroupPair(pair).burn{value: msg.value}(token, to);
        require(amountToken >= amountTokenMin, "got less than expected");
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
        require(msg.value > 0, "insufficient msg.value");
        address pair = pairFor(factory, token);
        IAGroupPair(pair).transferFrom(msg.sender, pair, liquidity); // send liquidity to pair
        uint feeChange; 
        (amountETH, feeChange) = IAGroupPair(pair).burn{value: msg.value}(WETH, address(this));
        require(amountETH >= amountETHMin, "got less than expected");
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
        require(msg.value > amountIn, "insufficient msg.value");
        IWETH(WETH).deposit{value: amountIn}();
        address pair = pairFor(factory, token);
        assert(IWETH(WETH).transfer(pair, amountIn));
        uint feeChange; 
        (_amountIn, _amountOut, feeChange) = IAGroupPair(pair).swapWithExact{value: msg.value.sub(amountIn)}(token, to);
        require(_amountOut >= amountOutMin, "got less than expected");
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
        require(msg.value > 0, "insufficient msg.value");
        address pair = pairFor(factory, token);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountIn);
        uint feeChange; 
        (_amountIn, _amountOut, feeChange) = IAGroupPair(pair).swapWithExact{value: msg.value}(token, address(this));
        require(_amountOut >= amountOutMin, "got less than expected");
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
        require(msg.value > amountInMax, "insufficient msg.value");
        IWETH(WETH).deposit{value: amountInMax}();
        address pair = pairFor(factory, token);
        assert(IWETH(WETH).transfer(pair, amountInMax));
        uint feeChange; 
        (_amountIn, _amountOut, feeChange) = IAGroupPair(pair).swapForExact{value: msg.value.sub(amountInMax)}(token, amountOut, to); // TODO: handle two *amountOut
        require(_amountIn <= amountInMax, "spend more than expected");
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
        require(msg.value > 0, "insufficient msg.value");
        address pair = pairFor(factory, token);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountInMax);
        uint feeChange; 
        (_amountIn, _amountOut, feeChange) = IAGroupPair(pair).swapForExact{value: msg.value}(token, amountOut, address(this));  // TODO: handle two *amountOut
        require(_amountIn <= amountInMax, "got less than expected");
        IWETH(WETH).withdraw(_amountOut);
        TransferHelper.safeTransferETH(to, amountOut.add(feeChange));
    }
}
