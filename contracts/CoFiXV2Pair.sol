// SPDX-License-Identifier: GPL-3.0-or-later
pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "./interface/ICoFiXV2Pair.sol";
import "./interface/ICoFiXV2Factory.sol";
import "./interface/ICoFiXV2Controller.sol";
import "./interface/IWETH.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CoFiXERC20.sol";
import "./lib/TransferHelper.sol";
import "./interface/ICoFiXV2DAO.sol";

// Pair contract for each trading pair, storing assets and handling settlement
// No owner or governance
contract CoFiXV2Pair is ICoFiXV2Pair, CoFiXERC20 {
    using SafeMath for uint;

    enum CoFiX_OP { QUERY, MINT, BURN, SWAP_WITH_EXACT, SWAP_FOR_EXACT } // operations in CoFiX

    uint public override constant MINIMUM_LIQUIDITY = 10**9; // it's negligible because we calc liquidity in ETH
    bytes4 private constant SELECTOR = bytes4(keccak256(bytes("transfer(address,uint256)")));

    uint256 constant public K_BASE = 1E8; // K
    uint256 constant public NAVPS_BASE = 1E18; // NAVPS (Net Asset Value Per Share), need accuracy
    uint256 constant public THETA_BASE = 1E8; // theta

    string public name;
    string public symbol;

    address public override immutable factory;
    address public override token0; // WETH token
    address public override token1; // any ERC20 token

    uint112 private reserve0;           // uses single storage slot, accessible via getReserves
    uint112 private reserve1;           // uses single storage slot, accessible via getReserves

    uint256 public initToken1Amount;
    uint256 public initToken0Amount;

    uint private unlocked = 1;

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

    modifier lock() {
        require(unlocked == 1, "CPair: LOCKED");
        unlocked = 0;
        _;
        unlocked = 1;
    }

    constructor() public {
        factory = msg.sender;
    }

    receive() external payable {}

    // called once by the factory at time of deployment
    function initialize(address _token0, address _token1, string memory _name, string memory _symbol, uint256 _initToken0Amount, uint256 _initToken1Amount) external override {
        require(msg.sender == factory, "CPair: FORBIDDEN"); // sufficient check
        token0 = _token0;
        token1 = _token1;
        name = _name;
        symbol = _symbol;
        initToken1Amount = _initToken1Amount;
        initToken0Amount = _initToken0Amount;
    }

    function getInitialAssetRatio() public override view returns (uint256 _initToken0Amount, uint256 _initToken1Amount) {
        _initToken1Amount = initToken1Amount;
        _initToken0Amount = initToken0Amount;
    }

    function getReserves() public override view returns (uint112 _reserve0, uint112 _reserve1) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
    }

    function _safeTransfer(address token, address to, uint value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(SELECTOR, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "CPair: TRANSFER_FAILED");
    }

    // update reserves
    function _update(uint balance0, uint balance1) private {
        require(balance0 <= uint112(-1) && balance1 <= uint112(-1), "CPair: OVERFLOW");
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        emit Sync(reserve0, reserve1);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function mint(address to, uint amountETH, uint amountToken) external payable override lock returns (uint liquidity, uint oracleFeeChange) {
        address _token0 = token0;                                // gas savings
        address _token1 = token1;                                // gas savings
        (uint112 _reserve0, uint112 _reserve1) = getReserves(); // gas savings
        uint balance0 = IERC20(_token0).balanceOf(address(this));
        uint balance1 = IERC20(_token1).balanceOf(address(this));
        uint amount0 = balance0.sub(_reserve0);
        uint amount1 = balance1.sub(_reserve1);

        require(amountETH <= amount0 && amountToken <= amount1, "CPair: illegal ammount");
        
        amount0 = amountETH;
        amount1 = amountToken;
        require(amount0.mul(initToken1Amount) == amount1.mul(initToken0Amount), "CPair: invalid asset ratio");
        
        uint256 _ethBalanceBefore = address(this).balance;
        { // scope for ethAmount/erc20Amount/blockNum to avoid stack too deep error
            bytes memory data = abi.encode(msg.sender, to, amount0, amount1);
            // query price
            OraclePrice memory _op;
            (_op.K, _op.ethAmount, _op.erc20Amount, _op.blockNum, _op.theta) = _queryOracle(_token1, CoFiX_OP.MINT, data);
            uint256 navps = calcNAVPerShare(_reserve0, _reserve1, _op.ethAmount, _op.erc20Amount);
            if (totalSupply == 0) {
                liquidity = calcLiquidity(amount0, navps).sub(MINIMUM_LIQUIDITY);
                _mint(address(0), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
            } else {
                liquidity = calcLiquidity(amount0, navps);
            }
        }
        oracleFeeChange = msg.value.sub(_ethBalanceBefore.sub(address(this).balance));

        require(liquidity > 0, "CPair: SHORT_LIQUIDITY_MINTED");
        _mint(to, liquidity);

        _update(balance0, balance1);
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);

        emit Mint(msg.sender, amount0, amount1);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function burn(address tokenTo, address ethTo) external payable override lock returns (uint amountTokenOut, uint amountEthOut, uint oracleFeeChange) {
        address _token0 = token0;                                // gas savings
        address _token1 = token1;                                // gas savings
        uint balance0 = IERC20(_token0).balanceOf(address(this));
        uint balance1 = IERC20(_token1).balanceOf(address(this));
        uint liquidity = balanceOf[address(this)];

        uint256 _ethBalanceBefore = address(this).balance;
        uint256 fee;
        {
            bytes memory data = abi.encode(msg.sender, liquidity);
            // query price
            OraclePrice memory _op;
            (_op.K, _op.ethAmount, _op.erc20Amount, _op.blockNum, _op.theta) = _queryOracle(_token1, CoFiX_OP.BURN, data);

            (amountTokenOut, amountEthOut, fee) = calcOutTokenAndETHForBurn(liquidity, _op); // navps calculated
        }
        oracleFeeChange = msg.value.sub(_ethBalanceBefore.sub(address(this).balance));

        require(amountTokenOut > 0 && amountEthOut > 0, "CPair: SHORT_LIQUIDITY_BURNED");

        _burn(address(this), liquidity);
        _safeTransfer(_token1, tokenTo, amountTokenOut);
        _safeTransfer(_token0, ethTo, amountEthOut);

        if (fee > 0) {
            if (ICoFiXV2Factory(factory).getTradeMiningStatus(_token1)) {
                // only transfer fee to protocol feeReceiver when trade mining is enabled for this trading pair
                _safeSendFeeForDAO(_token0, fee);
            } else {
                _safeSendFeeForLP(_token0, _token1, fee);
            }
        }

        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));

        _update(balance0, balance1);
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);

        emit Burn(msg.sender, _token0, amountEthOut, ethTo);
        emit Burn(msg.sender, _token1, amountTokenOut, tokenTo);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function swapWithExact(address outToken, address to)
        external
        payable override lock
        returns (uint amountIn, uint amountOut, uint oracleFeeChange, uint256[5] memory tradeInfo)
    {
        // tradeInfo[0]: thetaFee, tradeInfo[1]: ethAmount, tradeInfo[2]: erc20Amount
        address _token0 = token0;
        address _token1 = token1;
        uint256 balance0 = IERC20(_token0).balanceOf(address(this));
        uint256 balance1 = IERC20(_token1).balanceOf(address(this));

        // uint256 fee;
        { // scope for ethAmount/erc20Amount/blockNum to avoid stack too deep error
            uint256 _ethBalanceBefore = address(this).balance;
            (uint112 _reserve0, uint112 _reserve1) = getReserves(); // gas savings

            // calc amountIn
            if (outToken == _token1) {
                amountIn = balance0.sub(_reserve0);
            } else if (outToken == _token0) {
                amountIn = balance1.sub(_reserve1);
            } else {
                revert("CPair: wrong outToken");
            }
            require(amountIn > 0, "CPair: wrong amountIn");
            bytes memory data = abi.encode(msg.sender, outToken, to, amountIn);
            // query price
            OraclePrice memory _op;
            (_op.K, _op.ethAmount, _op.erc20Amount, _op.blockNum, _op.theta) = _queryOracle(_token1, CoFiX_OP.SWAP_WITH_EXACT, data);
            
            if (outToken == _token1) {
                (amountOut, tradeInfo[0]) = calcOutToken1(amountIn, _op);
            } else if (outToken == _token0) {
                (amountOut, tradeInfo[0]) = calcOutToken0(amountIn, _op);
            }
            oracleFeeChange = msg.value.sub(_ethBalanceBefore.sub(address(this).balance));
            tradeInfo[1] = _op.ethAmount;
            tradeInfo[2] = _op.erc20Amount;
        }
        
        require(to != _token0 && to != _token1, "CPair: INVALID_TO");

        _safeTransfer(outToken, to, amountOut); // optimistically transfer tokens
        if (tradeInfo[0] > 0) {
            if (ICoFiXV2Factory(factory).getTradeMiningStatus(_token1)) {
                // only transfer fee to protocol feeReceiver when trade mining is enabled for this trading pair
                _safeSendFeeForDAO(_token0, tradeInfo[0]);
            } else {
                _safeSendFeeForLP(_token0, _token1, tradeInfo[0]);
                tradeInfo[0] = 0; // so router won't go into the trade mining logic (reduce one more call gas cost)
            }
        }
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));

        _update(balance0, balance1);
        if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);

        emit Swap(msg.sender, amountIn, amountOut, outToken, to);
    }

    // this low-level function should be called from a contract which performs important safety checks
    // function swapForExact(address outToken, uint amountOutExact, address to)
    //     external
    //     payable override lock
    //     returns (uint amountIn, uint amountOut, uint oracleFeeChange, uint256[4] memory tradeInfo)
    // {
    //     // tradeInfo[0]: thetaFee, tradeInfo[1]: x, tradeInfo[2]: y, tradeInfo[3]: navps
    //     address _token0 = token0;
    //     address _token1 = token1;
    //     OraclePrice memory _op;

    //     // uint256 fee;

    //     { // scope for ethAmount/erc20Amount/blockNum to avoid stack too deep error
    //         uint256 _ethBalanceBefore = address(this).balance;
    //         bytes memory data = abi.encode(msg.sender, outToken, amountOutExact, to);
    //         // query price
    //         (_op.K, _op.ethAmount, _op.erc20Amount, _op.blockNum, _op.theta) = _queryOracle(_token1, CoFiX_OP.SWAP_FOR_EXACT, data);
    //         oracleFeeChange = msg.value.sub(_ethBalanceBefore.sub(address(this).balance));
    //     }

    //     { // calc and check amountIn, also outToken
    //         uint256 balance0 = IERC20(_token0).balanceOf(address(this));
    //         uint256 balance1 = IERC20(_token1).balanceOf(address(this));
    //         (uint112 _reserve0, uint112 _reserve1) = getReserves(); // gas savings
     
    //         if (outToken == _token1) {
    //             amountIn = balance0.sub(_reserve0);
    //             tradeInfo[1] = _reserve0; // swap token0 for token1 out
    //             tradeInfo[2] = uint256(_reserve1).mul(_op.ethAmount).div(_op.erc20Amount); // _reserve1 value as _reserve0
    //         } else if (outToken == _token0) {
    //             amountIn = balance1.sub(_reserve1);
    //             tradeInfo[1] = uint256(_reserve1).mul(_op.ethAmount).div(_op.erc20Amount); // _reserve1 value as _reserve0
    //             tradeInfo[2] = _reserve0; // swap token1 for token0 out
    //         } else {
    //             revert("CPair: wrong outToken");
    //         }
    //         require(amountIn > 0, "CPair: wrong amountIn");
    //         tradeInfo[3] = calcNAVPerShare(_reserve0, _reserve1, _op.ethAmount, _op.erc20Amount);
    //     }

    //     { // split with branch upbove to make code more clear
    //         uint _amountInNeeded;
    //         uint _amountInLeft;
    //         if (outToken == _token1) {
    //             (_amountInNeeded, tradeInfo[0]) = calcInNeededToken0(amountOutExact, _op);
    //             _amountInLeft = amountIn.sub(_amountInNeeded);
    //             if (_amountInLeft > 0) {
    //                 _safeTransfer(_token0, to, _amountInLeft); // send back the amount0 token change
    //             }
    //         } else if (outToken == _token0) {
    //             (_amountInNeeded, tradeInfo[0]) = calcInNeededToken1(amountOutExact, _op);
    //             _amountInLeft = amountIn.sub(_amountInNeeded);
    //             if (_amountInLeft > 0) {
    //                 _safeTransfer(_token1, to, _amountInLeft); // send back the amount1 token change
    //             }
    //         }
    //         require(_amountInNeeded <= amountIn, "CPair: insufficient amountIn");
    //         require(_amountInNeeded > 0, "CPair: wrong amountIn needed");
    //     }
        
    //     {
    //         require(to != _token0 && to != _token1, "CPair: INVALID_TO");

    //         amountOut = amountOutExact;
    //         _safeTransfer(outToken, to, amountOut); // optimistically transfer tokens
    //         if (tradeInfo[0] > 0) {
    //             if (ICoFiXFactory02(factory).getTradeMiningStatus(_token1)) {
    //                 // only transfer fee to protocol feeReceiver when trade mining is enabled for this trading pair
    //                 _safeSendFeeForCoFiHolder(_token0, tradeInfo[0]);
    //             } else {
    //                 _safeSendFeeForLP(_token0, _token1, tradeInfo[0]);
    //                 tradeInfo[0] = 0; // so router won't go into the trade mining logic (reduce one more call gas cost)
    //             }
    //         }
    //         uint256 balance0 = IERC20(_token0).balanceOf(address(this));
    //         uint256 balance1 = IERC20(_token1).balanceOf(address(this));

    //         _update(balance0, balance1);
    //         if (oracleFeeChange > 0) TransferHelper.safeTransferETH(msg.sender, oracleFeeChange);
    //     }

    //     emit Swap(msg.sender, amountIn, amountOut, outToken, to);
    // }

    // force balances to match reserves
    function skim(address to) external override lock {
        address _token0 = token0; // gas savings
        address _token1 = token1; // gas savings
        _safeTransfer(_token0, to, IERC20(_token0).balanceOf(address(this)).sub(reserve0));
        _safeTransfer(_token1, to, IERC20(_token1).balanceOf(address(this)).sub(reserve1));
    }

    // force reserves to match balances
    function sync() external override lock {
        _update(IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)));
    }

    // calc Net Asset Value Per Share for mint
    // use it in this contract, for optimized gas usage
    function calcNAVPerShareForMint(uint256 balance0, uint256 balance1, OraclePrice memory _op) public view returns (uint256 navps) {
        uint _totalSupply = totalSupply;
        if (_totalSupply == 0) {
            navps = NAVPS_BASE;
        } else {
            /*
            N_{p} &= (A_{u}/P_{s}^{'} + A_{e})/S \\\\
                  &= (A_{u}/(P * (1 - K)) + A_{e})/S \\\\
                  &= (\frac{A_{u}}{\frac{erc20Amount}{ethAmount} * \frac{(k_{BASE} - k)}{(k_{BASE})}} + A_{e})/S \\\\
                  &= (\frac{A_{u}*ethAmount*k_{BASE}}{erc20Amount*(k_{BASE} - k)}+ A_{e}) / S \\\\
                  &= (A_{u}*ethAmount*k_{BASE}+ A_{e}*erc20Amount*(k_{BASE} - k)) / S / (erc20Amount*(k_{BASE} - k)) \\\\
            N_{p} &= NAVPS_{BASE}*(A_{u}*ethAmount*k_{BASE}+ A_{e}*erc20Amount*(k_{BASE} - k)) / S / (erc20Amount*(k_{BASE} - k)) \\\\
            // navps = NAVPS_BASE * ( (balance1*_op.ethAmount*K_BASE) + (balance0*_op.erc20Amount*(K_BASE-_op.K)) ) / _totalSupply / _op.erc20Amount / (K_BASE-_op.K);
            */
            uint256 kbaseSubK = K_BASE.sub(_op.K);
            uint256 balance1MulEthKbase = balance1.mul(_op.ethAmount).mul(K_BASE);
            uint256 balance0MulErcKbsk = balance0.mul(_op.erc20Amount).mul(kbaseSubK);
            navps = NAVPS_BASE.mul( (balance1MulEthKbase).add(balance0MulErcKbsk) ).div(_totalSupply).div(_op.erc20Amount).div(kbaseSubK);
        }
    }

    // calc Net Asset Value Per Share for burn
    // use it in this contract, for optimized gas usage
    function calcNAVPerShareForBurn(uint256 balance0, uint256 balance1, OraclePrice memory _op) public view returns (uint256 navps) {
        uint _totalSupply = totalSupply;
        if (_totalSupply == 0) {
            navps = NAVPS_BASE;
        } else {
            /*
            N_{p}^{'} &= (A_{u}/P_{b}^{'} + A_{e})/S \\\\
                      &= (A_{u}/(P * (1 + K)) + A_{e})/S \\\\
                      &= (\frac{A_{u}}{\frac{erc20Amount}{ethAmount} * \frac{(k_{BASE} + k)}{(k_{BASE})}} + A_{e})/S \\\\
                      &= (\frac{A_{u}*ethAmount*k_{BASE}}{erc20Amount*(k_{BASE} + k)}+ A_{e}) / S \\\\
                      &= (A_{u}*ethAmount*k_{BASE}+ A_{e}*erc20Amount*(k_{BASE} + k)) / S / (erc20Amount*(k_{BASE} + k)) \\\\
            N_{p}^{'} &= NAVPS_{BASE}*(A_{u}*ethAmount*k_{BASE}+ A_{e}*erc20Amount*(k_{BASE} + k)) / S / (erc20Amount*(k_{BASE} + k)) \\\\
            // navps = NAVPS_BASE * ( (balance1*_op.ethAmount*K_BASE) + (balance0*_op.erc20Amount*(K_BASE+_op.K)) ) / _totalSupply / _op.erc20Amount / (K_BASE+_op.K);
            */
            uint256 kbaseAddK = K_BASE.add(_op.K);
            uint256 balance1MulEthKbase = balance1.mul(_op.ethAmount).mul(K_BASE);
            uint256 balance0MulErcKbsk = balance0.mul(_op.erc20Amount).mul(kbaseAddK);
            navps = NAVPS_BASE.mul( (balance1MulEthKbase).add(balance0MulErcKbsk) ).div(_totalSupply).div(_op.erc20Amount).div(kbaseAddK);
        }
    }

    // calc Net Asset Value Per Share (no K)
    // use it in this contract, for optimized gas usage
    function calcNAVPerShare(uint256 balance0, uint256 balance1, uint256 ethAmount, uint256 erc20Amount) public view returns (uint256 navps) {
        uint _totalSupply = totalSupply;
        if (_totalSupply == 0) {
            navps = NAVPS_BASE;
        } else {
            /*
            NV  = \frac{E_t + U_t/P_t}{(1 + \frac{k_0}{P_t})*F_t}\\\\
                = \frac{E_t + U_t * \frac{ethAmount}{erc20Amount}}{(1 + \frac{initToken1Amount}{initToken0Amount} * \frac{ethAmount}{erc20Amount})*F_t}\\\\
                = \frac{E_t * erc20Amount + U_t * ethAmount}{(erc20Amount + \frac{initToken1Amount * ethAmount}{initToken0Amount}) * F_t}\\\\
                = \frac{E_t * erc20Amount * initToken0Amount + U_t * ethAmount * initToken0Amount}{( erc20Amount * initToken0Amount + initToken1Amount * ethAmount) * F_t} \\\\
                = \frac{balance0 * erc20Amount * initToken0Amount + balance1 * ethAmount * initToken0Amount}{(erc20Amount * initToken0Amount + initToken1Amount * ethAmount) * totalSupply}
             */
            uint256 balance0MulErc20AmountMulInitToken0Amount = balance0.mul(erc20Amount).mul(initToken0Amount);
            uint256 balance1MulEthAmountMulInitToken0Amount = balance1.mul(ethAmount).mul(initToken0Amount);
            uint256 initToken1AmountMulEthAmount = initToken1Amount.mul(ethAmount);
            uint256 initToken0AmountMulErc20Amount = erc20Amount.mul(initToken0Amount);

            navps = (balance0MulErc20AmountMulInitToken0Amount.add(balance1MulEthAmountMulInitToken0Amount))
                        .div(_totalSupply).mul(NAVPS_BASE)
                        .div(initToken1AmountMulEthAmount.add(initToken0AmountMulErc20Amount));
        }
    }

    // use it in this contract, for optimized gas usage
    function calcLiquidity(uint256 amount0, uint256 navps) public pure returns (uint256 liquidity) {
        liquidity = amount0.mul(NAVPS_BASE).div(navps);
    }

    // get Net Asset Value Per Share for mint
    // only for read, could cost more gas if use it directly in contract
    function getNAVPerShareForMint(OraclePrice memory _op) public view returns (uint256 navps) {
        return calcNAVPerShare(reserve0, reserve1, _op.ethAmount, _op.erc20Amount);
    }

    // get Net Asset Value Per Share for burn
    // only for read, could cost more gas if use it directly in contract
    function getNAVPerShareForBurn(OraclePrice memory _op) external view returns (uint256 navps) {
        return calcNAVPerShare(reserve0, reserve1, _op.ethAmount, _op.erc20Amount);
    }

    // get Net Asset Value Per Share
    // only for read, could cost more gas if use it directly in contract
    function getNAVPerShare(uint256 ethAmount, uint256 erc20Amount) external override view returns (uint256 navps) {
        return calcNAVPerShare(reserve0, reserve1, ethAmount, erc20Amount);
    }

    // get estimated liquidity amount (it represents the amount of pool tokens will be minted if someone provide liquidity to the pool)
    // only for read, could cost more gas if use it directly in contract
    function getLiquidity(uint256 amount0, OraclePrice memory _op) external view returns (uint256 liquidity) {
        uint256 navps = getNAVPerShareForMint(_op);
        return calcLiquidity(amount0, navps);
    }

    function calcOutTokenAndETHForBurn(uint256 liquidity, OraclePrice memory _op) public view returns (uint256 amountTokenOut, uint256 amountEthOut, uint256 fee) {
        // amountEthOut = liquidity * navps * (THETA_BASE - theta) / THETA_BASE
        // amountTokenOut = liquidity * navps * (THETA_BASE - theta) * initToken1Amount / (initToken0Amount * THETA_BASE)
        uint256 navps;
        {
            navps = calcNAVPerShare(reserve0, reserve1, _op.ethAmount, _op.erc20Amount);
            uint256 amountEth = liquidity.mul(navps);

            uint256 amountEthOutLarge = amountEth.mul(THETA_BASE.sub(_op.theta));
            amountEthOut = amountEthOutLarge.div(NAVPS_BASE).div(THETA_BASE);
            amountTokenOut = amountEthOutLarge.mul(initToken1Amount).div(NAVPS_BASE).div(initToken0Amount).div(THETA_BASE);
            // amountTokenOut = amountEthOut.mul(initToken1Amount).div(initToken0Amount);
        }

        if (_op.theta != 0) {
            /*
            fee = liquidity * navps * (1 + \frac{k_0}{P_t}) * theta \\\\
                = \frac{liquidity * navps * (1 + \frac{initToken1Amount}{initToken0Amount} * \frac{ethAmount}{erc20Amount}) * theta}{NAVPS\_BASE * THETA\_BASE}\\\\
                = \frac{liquidity * navps * (initToken0Amount * erc20Amount + initToken1Amount * ethAmount) * theta}{initToken0Amount * erc20Amount * NAVPS\_BASE * THETA\_BASE}
             */
            {
                uint256 initToken1AmountMulEthAmount = initToken1Amount.mul(_op.ethAmount);
                uint256 erc20AmountMulInitToken0Amount = _op.erc20Amount.mul(initToken0Amount);
                fee = navps.mul(initToken1AmountMulEthAmount.add(erc20AmountMulInitToken0Amount)).div(erc20AmountMulInitToken0Amount).mul(liquidity).mul(_op.theta).div(THETA_BASE).div(NAVPS_BASE);
            }
        }

        // recalc amountOut when has no enough reserve0 or reserve1 to out in initAssetRatio
        {
            if (amountEthOut > reserve0) {
                // user first, out eth as much as possibile. And may leave over a few amounts of reserve1. 
                uint256 amountEthInsufficient = amountEthOut - reserve0;
                uint256 amountTokenEquivalent = amountEthInsufficient.mul(_op.erc20Amount).div(_op.ethAmount);
                amountTokenOut = amountTokenOut.add(amountTokenEquivalent);
                if (amountTokenOut > reserve1) {
                    amountTokenOut = reserve1;
                }
                amountEthOut = reserve0;

                // protocol first, eth was firstly used to pay fee. And when reserve0 is enough for fee, the reserves can clear as much as possible.
                // if (fee > reserve0) {
                //     fee = reserve0;
                // }
                // uint256 amountEthInsufficient = amountEthOut - (reserve0 - fee);
                // uint256 amountTokenEquivalent = amountEthInsufficient.mul(_op.erc20Amount).div(_op.ethAmount);
                // amountTokenOut = amountTokenOut.add(amountTokenEquivalent);
                // if (amountTokenOut > reserve1) {
                //     amountTokenOut = reserve1;
                // }
                // amountEthOut = reserve0 - fee;    
            } else if (amountTokenOut > reserve1) {
                uint256 amountTokenInsufficient = amountTokenOut - reserve1;
                uint256 amountEthEquivalent = amountTokenInsufficient.mul(_op.ethAmount).div(_op.erc20Amount);
                amountEthOut = amountEthOut.add(amountEthEquivalent);
                if (amountEthOut > reserve0) {
                    amountEthOut = reserve0;
                }
                amountTokenOut = reserve1;
            }
        }   
    }

    // get estimated amountOut for token0 (WETH) when swapWithExact
    function calcOutToken0(uint256 amountIn, OraclePrice memory _op) public pure returns (uint256 amountOut, uint256 fee) {
        /*
        x &= (a/P_{b}^{'})*\frac{THETA_{BASE} - \theta}{THETA_{BASE}} \\\\
          &= a / (\frac{erc20Amount}{ethAmount} * \frac{(k_{BASE} + k)}{(k_{BASE})}) * \frac{THETA_{BASE} - \theta}{THETA_{BASE}} \\\\
          &= \frac{a*ethAmount*k_{BASE}}{erc20Amount*(k_{BASE} + k)} * \frac{THETA_{BASE} - \theta}{THETA_{BASE}} \\\\
          &= \frac{a*ethAmount*k_{BASE}*(THETA_{BASE} - \theta)}{erc20Amount*(k_{BASE} + k)*THETA_{BASE}} \\\\
        // amountOut = amountIn * _op.ethAmount * K_BASE * (THETA_BASE - _op.theta) / _op.erc20Amount / (K_BASE + _op.K) / THETA_BASE;
        */
        amountOut = amountIn.mul(_op.ethAmount).mul(K_BASE).mul(THETA_BASE.sub(_op.theta)).div(_op.erc20Amount).div(K_BASE.add(_op.K)).div(THETA_BASE);
        if (_op.theta != 0) {
            // fee = amountIn * _op.ethAmount * K_BASE * (_op.theta) / _op.erc20Amount / (K_BASE + _op.K) / THETA_BASE;
            fee = amountIn.mul(_op.ethAmount).mul(K_BASE).mul(_op.theta).div(_op.erc20Amount).div(K_BASE.add(_op.K)).div(THETA_BASE);
        }
        return (amountOut, fee);
    }

    // get estimated amountOut for token1 (ERC20 token) when swapWithExact
    function calcOutToken1(uint256 amountIn, OraclePrice memory _op) public pure returns (uint256 amountOut, uint256 fee) {
        /*
        y &= b*P_{s}^{'}*\frac{THETA_{BASE} - \theta}{THETA_{BASE}} \\\\
          &= b * \frac{erc20Amount}{ethAmount} * \frac{(k_{BASE} - k)}{(k_{BASE})} * \frac{THETA_{BASE} - \theta}{THETA_{BASE}} \\\\
          &= \frac{b*erc20Amount*(k_{BASE} - k)*(THETA_{BASE} - \theta)}{ethAmount*k_{BASE}*THETA_{BASE}} \\\\
        // amountOut = amountIn * _op.erc20Amount * (K_BASE - _op.K) * (THETA_BASE - _op.theta) / _op.ethAmount / K_BASE / THETA_BASE;
        */
        amountOut = amountIn.mul(_op.erc20Amount).mul(K_BASE.sub(_op.K)).mul(THETA_BASE.sub(_op.theta)).div(_op.ethAmount).div(K_BASE).div(THETA_BASE);
        if (_op.theta != 0) {
            // fee = amountIn * _op.theta / THETA_BASE;
            fee = amountIn.mul(_op.theta).div(THETA_BASE);
        }
        return (amountOut, fee);
    }

    // get estimate amountInNeeded for token0 (WETH) when swapForExact
    function calcInNeededToken0(uint256 amountOut, OraclePrice memory _op) public pure returns (uint256 amountInNeeded, uint256 fee) {
        // inverse of calcOutToken1
        // amountOut = amountIn.mul(_op.erc20Amount).mul(K_BASE.sub(_op.K)).mul(THETA_BASE.sub(_op.theta)).div(_op.ethAmount).div(K_BASE).div(THETA_BASE);
        amountInNeeded = amountOut.mul(_op.ethAmount).mul(K_BASE).mul(THETA_BASE).div(_op.erc20Amount).div(K_BASE.sub(_op.K)).div(THETA_BASE.sub(_op.theta));
        if (_op.theta != 0) {
            // fee = amountIn * _op.theta / THETA_BASE;
            fee = amountInNeeded.mul(_op.theta).div(THETA_BASE);
        }
        return (amountInNeeded, fee);
    }

    // get estimate amountInNeeded for token1 (ERC20 token) when swapForExact
    function calcInNeededToken1(uint256 amountOut, OraclePrice memory _op) public pure returns (uint256 amountInNeeded, uint256 fee) {
        // inverse of calcOutToken0
        // amountOut = amountIn.mul(_op.ethAmount).mul(K_BASE).mul(THETA_BASE.sub(_op.theta)).div(_op.erc20Amount).div(K_BASE.add(_op.K)).div(THETA_BASE);
        amountInNeeded = amountOut.mul(_op.erc20Amount).mul(K_BASE.add(_op.K)).mul(THETA_BASE).div(_op.ethAmount).div(K_BASE).div(THETA_BASE.sub(_op.theta));
        if (_op.theta != 0) {
            // fee = amountIn * _op.ethAmount * K_BASE * (_op.theta) / _op.erc20Amount / (K_BASE + _op.K) / THETA_BASE;
            fee = amountInNeeded.mul(_op.ethAmount).mul(K_BASE).mul(_op.theta).div(_op.erc20Amount).div(K_BASE.add(_op.K)).div(THETA_BASE);
        }
        return (amountInNeeded, fee);
    }

    function _queryOracle(address token, CoFiX_OP op, bytes memory data) internal returns (uint256, uint256, uint256, uint256, uint256) {
        return ICoFiXV2Controller(ICoFiXV2Factory(factory).getController()).queryOracle{value: msg.value}(token, uint8(op), data);
    }

    function _safeSendFeeForDAO(address _token0, uint256 _fee) internal {
        address feeReceiver = ICoFiXV2Factory(factory).getFeeReceiver();
        if (feeReceiver == address(0)) {
            return; // if feeReceiver not set, theta fee keeps in pair pool
        }
        uint256 bal = IWETH(_token0).balanceOf(address(this));
        if (_fee > bal) {
            _fee = bal;
        }

        IWETH(_token0).withdraw(_fee);
        if (_fee > 0) TransferHelper.safeTransferETH(feeReceiver, _fee); // transfer fee to protocol dao for redeem Cofi
        // ICoFiXV2DAO(dao).addETHReward{value: _fee}(); 
    }

    // // Safe WETH transfer function, just in case not having enough WETH. CoFi holder will earn these fees.
    // function _safeSendFeeForCoFiHolder(address _token0, uint256 _fee) internal {
    //     address feeReceiver = ICoFiXV2Factory(factory).getFeeReceiver();
    //     if (feeReceiver == address(0)) {
    //         return; // if feeReceiver not set, theta fee keeps in pair pool
    //     }
    //     _safeSendFee(_token0, feeReceiver, _fee); // transfer fee to protocol fee reward pool for CoFi holders
    // }

    // Safe WETH transfer function, just in case not having enough WETH. LP will earn these fees.
    function _safeSendFeeForLP(address _token0, address _token1, uint256 _fee) internal {
        address feeVault = ICoFiXV2Factory(factory).getFeeVaultForLP(_token1);
        if (feeVault == address(0)) {
            return; // if fee vault not set, theta fee keeps in pair pool
        }
        _safeSendFee(_token0, feeVault, _fee); // transfer fee to protocol fee reward pool for LP
    }

    function _safeSendFee(address _token0, address _receiver, uint256 _fee) internal {
        uint256 wethBal = IERC20(_token0).balanceOf(address(this));
        if (_fee > wethBal) {
            _fee = wethBal;
        }
        if (_fee > 0) _safeTransfer(_token0, _receiver, _fee); 
    }
}
// 🦄 & CoFi Rocks
