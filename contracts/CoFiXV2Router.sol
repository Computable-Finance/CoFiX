// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "./interface/ICoFiXV2Factory.sol";
import "./lib/TransferHelper.sol";
import "./lib/UniswapV2Library.sol";
import "./interface/ICoFiXV2Router.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/IWETH.sol";
import "./interface/ICoFiXV2Pair.sol";
import "./interface/ICoFiXVaultForLP.sol";
import "./interface/ICoFiXStakingRewards.sol";
import "./interface/ICoFiXV2VaultForTrader.sol";


// Router contract to interact with each CoFiXPair, no owner or governance
contract CoFiXV2Router is ICoFiXV2Router {
    using SafeMath for uint;

    address public immutable override factory;
    address public immutable uniFactory;
    address public immutable override WETH;

    uint256 internal constant NEST_ORACLE_FEE = 0.01 ether;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'CRouter: EXPIRED');
        _;
    }

    constructor(address _factory, address _uniFactory, address _WETH) public {
        factory = _factory;
        uniFactory = _uniFactory;
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
        return ICoFiXV2Factory(_factory).getPair(token);
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
        (liquidity, oracleFeeChange) = ICoFiXV2Pair(pair).mint{value: _oracleFee}(to, amountETH, amountToken);
        require(liquidity >= liquidityMin, "CRouter: less liquidity than expected");
        // refund oracle fee to msg.sender, if any
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    }

    // msg.value = amountETH + oracle fee
    function addLiquidityAndStake(
        address token,
        uint amountETH,
        uint amountToken,
        uint liquidityMin,
        address to,
        uint deadline
    ) external override payable ensure(deadline) returns (uint liquidity)
    {
        // must create a pair before using this function
        require(msg.value > amountETH, "CRouter: insufficient msg.value");
        uint256 _oracleFee = msg.value.sub(amountETH);
        address pair = pairFor(factory, token);
        require(pair != address(0), "CRouter: invalid pair");
        if (amountToken > 0 ) { // support for tokens which do not allow to transfer zero values
            TransferHelper.safeTransferFrom(token, msg.sender, pair, amountToken);
        }
        if (amountETH > 0) {
            IWETH(WETH).deposit{value: amountETH}();
            assert(IWETH(WETH).transfer(pair, amountETH));
        }
        uint256 oracleFeeChange;
        (liquidity, oracleFeeChange) = ICoFiXV2Pair(pair).mint{value: _oracleFee}(address(this), amountETH, amountToken);
        require(liquidity >= liquidityMin, "CRouter: less liquidity than expected");

        // find the staking rewards pool contract for the liquidity token (pair)
        address pool = ICoFiXVaultForLP(ICoFiXV2Factory(factory).getVaultForLP()).stakingPoolForPair(pair);
        require(pool != address(0), "CRouter: invalid staking pool");
        // approve to staking pool
        ICoFiXV2Pair(pair).approve(pool, liquidity);
        ICoFiXStakingRewards(pool).stakeForOther(to, liquidity);
        ICoFiXV2Pair(pair).approve(pool, 0); // ensure
        // refund oracle fee to msg.sender, if any
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    }

    // msg.value = oracle fee
    function removeLiquidityGetTokenAndETH(
        address token,
        uint liquidity,
        uint amountETHMin,
        address to,
        uint deadline
    ) external override payable ensure(deadline) returns (uint amountToken, uint amountETH) 
    {
        require(msg.value > 0, "CRouter: insufficient msg.value");
        
        address pair = pairFor(factory, token);
        ICoFiXV2Pair(pair).transferFrom(msg.sender, pair, liquidity);

        uint oracleFeeChange; 
        (amountToken, amountETH, oracleFeeChange) = ICoFiXV2Pair(pair).burn{value: msg.value}(to, address(this));

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
        address rewardTo,
        uint deadline
    ) external override payable ensure(deadline) returns (uint _amountIn, uint _amountOut)
    {
        require(msg.value > amountIn, "CRouter: insufficient msg.value");
        IWETH(WETH).deposit{value: amountIn}();
        address pair = pairFor(factory, token);
        assert(IWETH(WETH).transfer(pair, amountIn));
        uint oracleFeeChange; 
        uint256[5] memory tradeInfo;
        (_amountIn, _amountOut, oracleFeeChange, tradeInfo) = ICoFiXV2Pair(pair).swapWithExact{
            value: msg.value.sub(amountIn)}(token, to);
        require(_amountOut >= amountOutMin, "CRouter: got less than expected");

        // distribute trading rewards - CoFi!
        address vaultForTrader = ICoFiXV2Factory(factory).getVaultForTrader();
        if (tradeInfo[0] > 0 && rewardTo != address(0) && vaultForTrader != address(0)) {
            ICoFiXV2VaultForTrader(vaultForTrader).distributeReward(pair, tradeInfo[1], tradeInfo[2], rewardTo);
        }

        // refund oracle fee to msg.sender, if any
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    }

    // msg.value = oracle fee
    function swapExactTokensForTokens(
        address tokenIn,
        address tokenOut,
        uint amountIn,
        uint amountOutMin,
        address to,
        address rewardTo,
        uint deadline
    ) external override payable ensure(deadline) returns (uint _amountIn, uint _amountOut) {

        require(msg.value > 0, "CRouter: insufficient msg.value");
        address[2] memory pairs; // [pairIn, pairOut]

        // swapExactTokensForETH
        pairs[0] = pairFor(factory, tokenIn);
        TransferHelper.safeTransferFrom(tokenIn, msg.sender, pairs[0], amountIn);
        uint oracleFeeChange;
        uint256[5] memory tradeInfo;
        (_amountIn, _amountOut, oracleFeeChange, tradeInfo) = ICoFiXV2Pair(pairs[0]).swapWithExact{value: msg.value}(WETH, address(this));

        // distribute trading rewards - CoFi!
        address vaultForTrader = ICoFiXV2Factory(factory).getVaultForTrader();
        if (tradeInfo[0] > 0 && rewardTo != address(0) && vaultForTrader != address(0)) {
            ICoFiXV2VaultForTrader(vaultForTrader).distributeReward(pairs[0], tradeInfo[1], tradeInfo[2], rewardTo);
        }

        // swapExactETHForTokens
        pairs[1] = pairFor(factory, tokenOut);
        assert(IWETH(WETH).transfer(pairs[1], _amountOut)); // swap with all amountOut in last swap
        (, _amountOut, oracleFeeChange, tradeInfo) = ICoFiXV2Pair(pairs[1]).swapWithExact{value: oracleFeeChange}(tokenOut, to);
        require(_amountOut >= amountOutMin, "CRouter: got less than expected");

        // distribute trading rewards - CoFi!
        if (tradeInfo[0] > 0 && rewardTo != address(0) && vaultForTrader != address(0)) {
            ICoFiXV2VaultForTrader(vaultForTrader).distributeReward(pairs[1], tradeInfo[1], tradeInfo[2], rewardTo);
        }

        // refund oracle fee to msg.sender, if any
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    }

    // msg.value = oracle fee
    function swapExactTokensForETH(
        address token,
        uint amountIn,
        uint amountOutMin,
        address to,
        address rewardTo,
        uint deadline
    ) external override payable ensure(deadline) returns (uint _amountIn, uint _amountOut)
    {
        require(msg.value > 0, "CRouter: insufficient msg.value");
        address pair = pairFor(factory, token);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountIn);
        uint oracleFeeChange; 
        uint256[5] memory tradeInfo;
        (_amountIn, _amountOut, oracleFeeChange, tradeInfo) = ICoFiXV2Pair(pair).swapWithExact{value: msg.value}(WETH, address(this));
        require(_amountOut >= amountOutMin, "CRouter: got less than expected");
        IWETH(WETH).withdraw(_amountOut);
        TransferHelper.safeTransferETH(to, _amountOut);

        // distribute trading rewards - CoFi!
        address vaultForTrader = ICoFiXV2Factory(factory).getVaultForTrader();
        if (tradeInfo[0] > 0 && rewardTo != address(0) && vaultForTrader != address(0)) {
            ICoFiXV2VaultForTrader(vaultForTrader).distributeReward(pair, tradeInfo[1], tradeInfo[2], rewardTo);
        }

        // refund oracle fee to msg.sender, if any
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    }

    function hybridSwapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        DEX_TYPE[] calldata dexes,
        address to,
        address rewardTo,
        uint deadline
    ) external override payable ensure(deadline) returns (uint[] memory amounts) {
        // fast check
        require(path.length >= 2, "CRouter: invalid path");
        require(dexes.length == path.length - 1, "CRouter: invalid dexes");
        _checkOracleFee(dexes, msg.value);

        // send amountIn to the first pair
        TransferHelper.safeTransferFrom(
            path[0], msg.sender,  getPairForDEX(path[0], path[1], dexes[0]), amountIn
        );

        // exec hybridSwap
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        _hybridSwap(path, dexes, amounts, to, rewardTo);

        // check amountOutMin in the last
        require(amounts[amounts.length - 1] >= amountOutMin, "CRouter: insufficient output amount ");
    }

    function hybridSwapExactETHForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        DEX_TYPE[] calldata dexes,
        address to,
        address rewardTo,
        uint deadline
    ) external override payable ensure(deadline) returns (uint[] memory amounts) {
        // fast check
        require(path.length >= 2 && path[0] == WETH, "CRouter: invalid path");
        require(dexes.length == path.length - 1, "CRouter: invalid dexes");
        _checkOracleFee(dexes, msg.value.sub(amountIn)); // would revert if msg.value is less than amountIn

        // convert ETH and send amountIn to the first pair
        IWETH(WETH).deposit{value: amountIn}();
        assert(IWETH(WETH).transfer(getPairForDEX(path[0], path[1], dexes[0]), amountIn));

        // exec hybridSwap
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        _hybridSwap(path, dexes, amounts, to, rewardTo);

        // check amountOutMin in the last
        require(amounts[amounts.length - 1] >= amountOutMin, "CRouter: insufficient output amount ");
    }

    function hybridSwapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        DEX_TYPE[] calldata dexes,
        address to,
        address rewardTo,
        uint deadline
    ) external override payable ensure(deadline) returns (uint[] memory amounts) {
        // fast check
        require(path.length >= 2 && path[path.length - 1] == WETH, "CRouter: invalid path");
        require(dexes.length == path.length - 1, "CRouter: invalid dexes");
        _checkOracleFee(dexes, msg.value);

        // send amountIn to the first pair
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, getPairForDEX(path[0], path[1], dexes[0]), amountIn
        );

        // exec hybridSwap
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        _hybridSwap(path, dexes, amounts, address(this), rewardTo);

        // check amountOutMin in the last
        require(amounts[amounts.length - 1] >= amountOutMin, "CRouter: insufficient output amount ");

        // convert WETH
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    }


    function _checkOracleFee(DEX_TYPE[] memory dexes, uint256 oracleFee) internal pure {
        uint cofixCnt;
        for (uint i; i < dexes.length; i++) {
            if (dexes[i] == DEX_TYPE.COFIX) {
                cofixCnt++;
            }
        }
        // strict check here
        // to simplify the verify logic for oracle fee and prevent user from locking oracle fee by mistake
        // if NEST_ORACLE_FEE value changed, this router would not work as expected
        // TODO: refund the oracle fee?
        require(oracleFee == NEST_ORACLE_FEE.mul(cofixCnt), "CRouter: wrong oracle fee");
    }

    function _hybridSwap(address[] memory path, DEX_TYPE[] memory dexes, uint[] memory amounts, address _to, address rewardTo) internal {
        for (uint i; i < path.length - 1; i++) {
            if (dexes[i] == DEX_TYPE.COFIX) {
                _swapOnCoFiX(i, path, dexes, amounts, _to, rewardTo);
            } else if (dexes[i] == DEX_TYPE.UNISWAP) {
                _swapOnUniswap(i, path, dexes, amounts, _to);
            } else {
                revert("CRouter: unknown dex");
            }
        }
    }

    function _swapOnUniswap(uint i, address[] memory path, DEX_TYPE[] memory dexes, uint[] memory amounts, address _to) internal {
        address pair = getPairForDEX(path[i], path[i + 1], DEX_TYPE.UNISWAP);

        (address token0,) = UniswapV2Library.sortTokens(path[i], path[i + 1]);
        {
            (uint reserveIn, uint reserveOut) = UniswapV2Library.getReserves(uniFactory, path[i], path[i + 1]);
            amounts[i + 1] = UniswapV2Library.getAmountOut(amounts[i], reserveIn, reserveOut);
        }
        uint amountOut = amounts[i + 1];
        (uint amount0Out, uint amount1Out) = path[i] == token0 ? (uint(0), amountOut) : (amountOut, uint(0));

        address to;
        {
            if (i < path.length - 2) {
                to = getPairForDEX(path[i + 1], path[i + 2], dexes[i + 1]);
            } else {
                to = _to;
            }
        }

        IUniswapV2Pair(pair).swap(
            amount0Out, amount1Out, to, new bytes(0)
        );
    }
    
    function _swapOnCoFiX(uint i, address[] memory path, DEX_TYPE[] memory dexes, uint[] memory amounts, address _to, address rewardTo) internal {
            address pair = getPairForDEX(path[i], path[i + 1], DEX_TYPE.COFIX);
            address to;
            if (i < path.length - 2) {
                to = getPairForDEX(path[i + 1], path[i + 2], dexes[i + 1]);
            } else {
                to = _to;
            }
            // TODO: dynamic oracle fee
            {
                uint256[5] memory tradeInfo;
                (,amounts[i+1],,tradeInfo) = ICoFiXV2Pair(pair).swapWithExact{value: NEST_ORACLE_FEE}(path[i + 1], to);

                // distribute trading rewards - CoFi!
                address vaultForTrader = ICoFiXV2Factory(factory).getVaultForTrader();
                if (tradeInfo[0] > 0 && rewardTo != address(0) && vaultForTrader != address(0)) {
                    ICoFiXV2VaultForTrader(vaultForTrader).distributeReward(pair, tradeInfo[1], tradeInfo[2], rewardTo);
                }
            }
    } 

    function isCoFiXNativeSupported(address input, address output) public view returns (bool supported, address pair) {
        // NO WETH included
        if (input != WETH && output != WETH)
            return (false, pair);
        if (input != WETH) {
            pair = pairFor(factory, input);
        } else if (output != WETH) {
            pair = pairFor(factory, output);
        }
        // if tokenIn & tokenOut are both WETH, then the pair is zero
        if (pair != address(0)) // TODO: add check for reserves
            supported = true;
        return (supported, pair);
    }

    function getPairForDEX(address input, address output, DEX_TYPE dex) public view returns (address pair) {
        if (dex == DEX_TYPE.COFIX) {
            bool supported;
            (supported, pair) = isCoFiXNativeSupported(input, output);
            if (!supported) {
                revert("CRouter: not available on CoFiX");
            }
        } else if (dex == DEX_TYPE.UNISWAP) {
            pair = UniswapV2Library.pairFor(uniFactory, input, output);
        } else {
            revert("CRouter: unknown dex");
        }
    }

    // TODO: not used currently
    function hybridPair(address input, address output) public view returns (bool useCoFiX, address pair) {
        (useCoFiX, pair) = isCoFiXNativeSupported(input, output);
        if (useCoFiX) {
            return (useCoFiX, pair);
        }
        return (false, UniswapV2Library.pairFor(uniFactory, input, output));
    }
}
