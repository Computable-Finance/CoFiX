// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import './interface/ICofiXPair.sol';
import './CofiXERC20.sol';
import './lib/Math.sol';
import './interface/IERC20.sol';
import './interface/ICofiXFactory.sol';
import './interface/ICofiXController.sol';
import './lib/TransferHelpers.sol';
import "./lib/ABDKMath64x64.sol";


contract CofiXPair is ICofiXPair, CofiXERC20 {
    using SafeMath  for uint;

    uint public override constant MINIMUM_LIQUIDITY = 10**3;
    bytes4 private constant SELECTOR = bytes4(keccak256(bytes('transfer(address,uint256)')));

    address public override factory;
    address public override token0; // WETH token
    address public override token1; // any ERC20 token


    uint112 private reserve0;           // uses single storage slot, accessible via getReserves
    uint112 private reserve1;           // uses single storage slot, accessible via getReserves

    uint256 constant public K_BASE = 100000;
    uint256 constant public SHARE_BASE = 10000;

    uint private unlocked = 1;
    modifier lock() {
        require(unlocked == 1, 'CPair: LOCKED');
        unlocked = 0;
        _;
        unlocked = 1;
    }

    function getReserves() public override view returns (uint112 _reserve0, uint112 _reserve1) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
    }

    function _safeTransfer(address token, address to, uint value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(SELECTOR, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'CPair: TRANSFER_FAILED');
    }

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
    

    constructor() public {
        factory = msg.sender;
    }

    receive() external payable {
    }

    // called once by the factory at time of deployment
    function initialize(address _token0, address _token1) external override {
        require(msg.sender == factory, 'CPair: FORBIDDEN'); // sufficient check
        token0 = _token0;
        token1 = _token1;
    }

    // update reserves and, on the first call per block, price accumulators
    function _update(uint balance0, uint balance1) private {
        require(balance0 <= uint112(-1) && balance1 <= uint112(-1), 'CPair: OVERFLOW');
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        emit Sync(reserve0, reserve1);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function mint(address to) external payable override lock returns (uint liquidity, uint feeChange) {
        address _token0 = token0;                                // gas savings
        address _token1 = token1;                                // gas savings
        (uint112 _reserve0, uint112 _reserve1) = getReserves(); // gas savings
        uint balance0 = IERC20(_token0).balanceOf(address(this));
        uint balance1 = IERC20(_token1).balanceOf(address(this));
        uint amount0 = balance0.sub(_reserve0);
        uint amount1 = balance1.sub(_reserve1);

        uint256 _ethBalanceBefore = address(this).balance;
        { // scope for ethAmount/erc20Amount/blockNum to avoid stack too deep error
            // query price
            OraclePrice memory _op;
            (_op.K, _op.ethAmount, _op.erc20Amount, _op.blockNum) = queryOracle(_token1, to);
            // TODO: validate
            uint256 share = calcShare(balance0, balance1, _op);
            liquidity = calcLiquidity(amount0, amount1, share, _op);
        }
        feeChange = msg.value.sub(_ethBalanceBefore.sub(address(this).balance));

        require(liquidity > 0, 'CPair: INSUFFICIENT_LIQUIDITY_MINTED');
        _mint(to, liquidity);

        _update(balance0, balance1);
        emit Mint(msg.sender, amount0, amount1);

        TransferHelper.safeTransferETH(msg.sender, feeChange);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function burn(address outToken, address to) external payable override lock returns (uint amountOut, uint feeChange) {
        address _token0 = token0;                                // gas savings
        address _token1 = token1;                                // gas savings
        uint balance0 = IERC20(_token0).balanceOf(address(this));
        uint balance1 = IERC20(_token1).balanceOf(address(this));
        uint liquidity = balanceOf[address(this)];

        uint256 _ethBalanceBefore = address(this).balance;
        {
            // query price
            OraclePrice memory _op;
            (_op.K, _op.ethAmount, _op.erc20Amount, _op.blockNum) = queryOracle(_token1, to);
            // TODO: validate
            uint256 share = calcShare(balance0, balance1, _op);
            if (outToken == _token0) {
                amountOut = calcOutToken0ForBurn(liquidity, share, _op);
            } else if (outToken == _token1) {
                amountOut = calcOutToken1ForBurn(liquidity, share, _op);
            }  else {
                revert("CPair: wrong outToken");
            }
        }
        feeChange = msg.value.sub(_ethBalanceBefore.sub(address(this).balance));

        _burn(address(this), liquidity);
        _safeTransfer(outToken, to, amountOut);
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));

        _update(balance0, balance1);
        TransferHelper.safeTransferETH(msg.sender, feeChange);
        emit Burn(msg.sender, outToken, amountOut, to);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function swapForExact(address outToken, uint amountOutExact, address to)
        external
        payable override lock
        returns (uint amountIn, uint amountOut, uint feeChange)
    {
        address _token0 = token0;
        address _token1 = token1;
        OraclePrice memory _op;

        { // scope for ethAmount/erc20Amount/blockNum to avoid stack too deep error
            uint256 _ethBalanceBefore = address(this).balance;
            // query price
            (_op.K, _op.ethAmount, _op.erc20Amount, _op.blockNum) = queryOracle(_token1, to);
            // TODO: validate
            feeChange = msg.value.sub(_ethBalanceBefore.sub(address(this).balance));
        }

        {
            uint256 balance0 = IERC20(_token0).balanceOf(address(this));
            uint256 balance1 = IERC20(_token1).balanceOf(address(this));
            (uint112 _reserve0, uint112 _reserve1) = getReserves(); // gas savings
            uint _amountInNeeded;
     
            if (outToken == _token1) {
                amountIn = balance0.sub(_reserve0);
                require(amountIn > 0, "CPair: wrong amount0In");
                _amountInNeeded = calcInNeededToken0(amountOutExact, _op);
                _safeTransfer(_token0, to, amountIn.sub(_amountInNeeded)); // send back the token change
            } else if (outToken == _token0) {
                amountIn = balance1.sub(_reserve1);
                require(amountIn > 0, "CPair: wrong amount1In");
                _amountInNeeded = calcInNeededToken1(amountOutExact, _op);
                _safeTransfer(_token1, to, amountIn.sub(_amountInNeeded)); // TODO: think about a better payee than to
            } else {
                revert("CPair: wrong outToken");
            }
            require(_amountInNeeded <= amountIn, "CPair: wrong amountIn"); // TODO: useless check
        }
        
        {
            require(to != _token0 && to != _token1, 'CPair: INVALID_TO');

            amountOut = amountOutExact;
            _safeTransfer(outToken, to, amountOutExact); // optimistically transfer tokens

            uint256 balance0 = IERC20(_token0).balanceOf(address(this));
            uint256 balance1 = IERC20(_token1).balanceOf(address(this));

            _update(balance0, balance1);
            TransferHelper.safeTransferETH(msg.sender, feeChange);
        }

        emit Swap(msg.sender, amountIn, amountOut, outToken, to);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function swapWithExact(address outToken, address to) external payable override lock returns (uint amountIn, uint amountOut, uint feeChange) {
        address _token0 = token0;
        address _token1 = token1;
        uint256 balance0 = IERC20(_token0).balanceOf(address(this));
        uint256 balance1 = IERC20(_token1).balanceOf(address(this));

        { // scope for ethAmount/erc20Amount/blockNum to avoid stack too deep error
            uint256 _ethBalanceBefore = address(this).balance;
            // query price
            OraclePrice memory _op;
            (_op.K, _op.ethAmount, _op.erc20Amount, _op.blockNum) = queryOracle(_token1, to);
            // TODO: validate

            (uint112 _reserve0, uint112 _reserve1) = getReserves(); // gas savings

            if (outToken == _token1) {
                amountIn = balance0.sub(_reserve0);
                require(amountIn > 0, "CPair: wrong amount0In");
                amountOut = calcOutToken1(amountIn, _op);
            } else if (outToken == _token0) {
                amountIn = balance1.sub(_reserve1);
                require(amountIn > 0, "CPair: wrong amount1In");
                amountOut = calcOutToken0(amountIn, _op);
            } else {
                revert("CPair: wrong outToken");
            }
            feeChange = msg.value.sub(_ethBalanceBefore.sub(address(this).balance));
        }
        
        require(to != _token0 && to != _token1, 'CPair: INVALID_TO');

        _safeTransfer(outToken, to, amountOut); // optimistically transfer tokens

        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));

        _update(balance0, balance1);
        TransferHelper.safeTransferETH(msg.sender, feeChange);
        emit Swap(msg.sender, amountIn, amountOut, outToken, to);
    }

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

    // use it in this contract, for optimized gas usage
    function calcShare(uint256 balance0, uint256 balance1, OraclePrice memory _op) public view returns (uint256 share) {
        uint _totalSupply = totalSupply;
        // TODO: handle decimals, safe math op
        if (_totalSupply == 0) {
            share = SHARE_BASE; // TODO: think about extreme small share, e.g. 1e-18
        } else {
            // share = SHARE_BASE*(balance0*_op.erc20Amount/_op.ethAmount + balance1)/(_totalSupply);
            share = SHARE_BASE.mul((balance0.mul(_op.erc20Amount)).add(balance1.mul(_op.ethAmount))).div(_totalSupply).div(_op.ethAmount);
        }
    }

    // use it in this contract, for optimized gas usage
    function calcLiquidity(uint256 amount0, uint256 amount1, uint256 share, OraclePrice memory _op) public pure returns (uint256 liquidity) {
        // liquidity = 1000*SHARE_BASE*(amount0*_op.erc20Amount/_op.ethAmount + amount1)/share/1005; // TODO: optimize calc
        // s=  a*[p*(1-k)]/n
        // liquidity = SHARE_BASE.mul(K_BASE.sub(_op.K)).mul((amount0.mul(_op.erc20Amount)).add(amount1.mul(_op.ethAmount))).div(share).div(_op.ethAmount).div(K_BASE);
        return SHARE_BASE.mul(K_BASE.sub(_op.K)).mul((amount0.mul(_op.erc20Amount)).add(amount1.mul(_op.ethAmount))).div(share).div(_op.ethAmount).div(K_BASE);
    }

    // only for read, could cost more gas if use it directly in contract
    function getShare(OraclePrice memory _op) public view returns (uint256 share) {
        return calcShare(IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)), _op);
    }

    // only for read, could cost more gas if use it directly in contract
    function getLiquidity(uint256 amount0, uint256 amount1, OraclePrice memory _op) public view returns (uint256 liquidity) {
        uint256 share = calcShare(IERC20(token0).balanceOf(address(this)).add(amount0), IERC20(token1).balanceOf(address(this)).add(amount1), _op);
        return calcLiquidity(amount0, amount1, share, _op);
    }

    function calcOutToken0ForBurn(uint256 liquidity, uint256 share, OraclePrice memory _op) public pure returns (uint256 amountOut) {
        // outAmount = 1000*liquidity*share*_op.ethAmount/_op.erc20Amount/SHARE_BASE/1005;
        // b=s*n/[p*(1+k)]
        return liquidity.mul(K_BASE).mul(share).mul(_op.ethAmount).div(_op.erc20Amount).div(SHARE_BASE).div(K_BASE.add(_op.K));
    }

    function calcOutToken1ForBurn(uint256 liquidity, uint256 share, OraclePrice memory _op) public pure returns (uint256 amountOut) {
        // amountOut = liquidity.mul(K_BASE).mul(share).div(SHARE_BASE).div(K_BASE.add(_op.K)); // TODO: how about extreme small share value
        // b=s*n/[p*(1+k)]
        return liquidity.mul(K_BASE).mul(share).div(SHARE_BASE).div(K_BASE.add(_op.K));
    }

    function calcOutToken0(uint256 amountIn, OraclePrice memory _op) public pure returns (uint256 amountOut) {
        // amountOut = amountIn*_op.ethAmount*1000/_op.erc20Amount/1005;
        // x = a/[p*(1+k)]
        return amountIn.mul(_op.ethAmount).mul(K_BASE).div(_op.erc20Amount).div(K_BASE.add(_op.K));
    }

    function calcOutToken1(uint256 amountIn, OraclePrice memory _op) public pure returns (uint256 amountOut) {
        // amountOut = amountIn*_op.erc20Amount*1000/_op.ethAmount/1005;
        // y = b*[p*(1-k)]
        return amountIn.mul(_op.erc20Amount).mul(K_BASE.sub(_op.K)).div(_op.ethAmount).div(K_BASE);
    }

    function calcInNeededToken0(uint256 amountOut, OraclePrice memory _op) public pure returns (uint256 amountInNeeded) {
        // amountOut = amountIn*erc20Amount*1000/ethAmount/1005;
        // amountIn = amountOut*ethAmount*1005/1000/erc20Amount
        // _amountInNeeded = _amountOut*_op.ethAmount*1005/1000/_op.erc20Amount;
        // y = b*[p*(1-k)]
        return amountOut.mul(K_BASE).mul(_op.ethAmount).div(_op.erc20Amount).div(K_BASE.sub(_op.K));
    }

    function calcInNeededToken1(uint256 amountOut, OraclePrice memory _op) public pure returns (uint256 amountInNeeded) {
        // amountOut = amountIn*ethAmount*1000/erc20Amount/1005;
        // amountIn = amountOut*erc20Amount*1005/1000/ethAmount
        // _amountInNeeded = _amountOut*_op.erc20Amount*1005/1000/_op.ethAmount;
        // x = a/[p*(1+k)]
        return amountOut.mul(K_BASE.add(_op.K)).mul(_op.erc20Amount).div(_op.ethAmount).div(K_BASE);
    }

    function queryOracle(address token, address to) internal returns (uint256, uint256, uint256, uint256) {
        return ICofiXController(ICofiXFactory(factory).getController()).queryOracle{value: msg.value}(token, to);
    }

}
