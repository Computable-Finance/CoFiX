// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

import './interface/IAGroupPair.sol';
import './AGroupERC20.sol';
import './lib/Math.sol';
import './interface/IERC20.sol';
import './interface/IAGroupFactory.sol';

contract AGroupPair is IAGroupPair, AGroupERC20 {
    using SafeMath  for uint;

    uint public override constant MINIMUM_LIQUIDITY = 10**3;
    bytes4 private constant SELECTOR = bytes4(keccak256(bytes('transfer(address,uint256)')));

    address public override factory;
    address public override token0; // WETH token
    address public override token1; // any ERC20 token

    // INest_3_OfferPrice public priceOracle;

    uint112 private reserve0;           // uses single storage slot, accessible via getReserves
    uint112 private reserve1;           // uses single storage slot, accessible via getReserves

    uint private unlocked = 1;
    modifier lock() {
        require(unlocked == 1, 'AGroupV1: LOCKED');
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
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'AGroupV1: TRANSFER_FAILED');
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
        // require(msg.sender == address(factory), "AGroupFactory: invalid eth sender");
    }

    // called once by the factory at time of deployment
    function initialize(address _token0, address _token1) external override {
        require(msg.sender == factory, 'AGroupV1: FORBIDDEN'); // sufficient check
        token0 = _token0;
        token1 = _token1;
    }

    // update reserves and, on the first call per block, price accumulators
    function _update(uint balance0, uint balance1) private {
        require(balance0 <= uint112(-1) && balance1 <= uint112(-1), 'AGroupV1: OVERFLOW');
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
            (_op.ethAmount, _op.erc20Amount, _op.blockNum) = IAGroupFactory(factory).updateAndCheckPriceNow{value: msg.value}(_token1);
            // TODO: validate
            uint _totalSupply = totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee

            uint256 share;
            // TODO: handle decimals, safe math op
            if (_totalSupply == 0) {
                share = 10000;
            } else {
                share = 10000*(balance0*_op.erc20Amount/_op.ethAmount + balance1) / _totalSupply;
            }
            liquidity = 1000*10000*(amount0*_op.erc20Amount/_op.ethAmount + amount1)/share/1005; // TODO: optimize calc
        }
        feeChange = msg.value.sub(_ethBalanceBefore.sub(address(this).balance));

        require(liquidity > 0, 'AGroupV1: INSUFFICIENT_LIQUIDITY_MINTED');
        _mint(to, liquidity);

        _update(balance0, balance1);
        emit Mint(msg.sender, amount0, amount1);

        msg.sender.transfer(feeChange); // TODO: maybe use call for transferring ETH to contract account
    }

    // this low-level function should be called from a contract which performs important safety checks
    function burn(address outToken, address to) external payable override lock returns (uint outAmount, uint feeChange) {
        address _token0 = token0;                                // gas savings
        address _token1 = token1;                                // gas savings
        uint balance0 = IERC20(_token0).balanceOf(address(this));
        uint balance1 = IERC20(_token1).balanceOf(address(this));
        uint liquidity = balanceOf[address(this)];

        uint256 _ethBalanceBefore = address(this).balance;
        {
            // query price
            OraclePrice memory _op;
            (_op.ethAmount, _op.erc20Amount, _op.blockNum) = IAGroupFactory(factory).updateAndCheckPriceNow{value: msg.value}(_token1);
            // TODO: validate
            uint _totalSupply = totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee

            uint256 share;
            // TODO: handle decimals
            if (_totalSupply == 0) {
                share = 10000;
            } else {
                share = 10000*(balance0*_op.erc20Amount/_op.ethAmount + balance1) / _totalSupply;
            }
            if (outToken == _token0) {
                outAmount = 1000*liquidity*share*_op.ethAmount/_op.erc20Amount/10000/1005;
            } else if (outToken == _token1) {
                outAmount = liquidity*share/10000;
            }  else {
                revert("wrong outToken");
            }
        }
        feeChange = msg.value.sub(_ethBalanceBefore.sub(address(this).balance));

        _burn(address(this), liquidity);
        _safeTransfer(outToken, to, outAmount);
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));

        _update(balance0, balance1);
        msg.sender.transfer(feeChange); // TODO: maybe use call for transferring ETH to contract account
        emit Burn(msg.sender, outToken, outAmount, to);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function swapForExact(address outToken, uint _amountOut, address to)
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
            (_op.ethAmount, _op.erc20Amount, _op.blockNum) = IAGroupFactory(factory).updateAndCheckPriceNow{value: msg.value}(_token1);
            // TODO: validate

            feeChange = msg.value.sub(_ethBalanceBefore.sub(address(this).balance));
        }

        {
            uint256 balance0 = IERC20(_token0).balanceOf(address(this));
            uint256 balance1 = IERC20(_token1).balanceOf(address(this));
            (uint112 _reserve0, uint112 _reserve1) = getReserves(); // gas savings
            uint _amountInNeeded;
     
            if (outToken == _token1) {
                amountIn = balance0 - _reserve0;
                require(amountIn > 0, "wrong amount0In");
                // amountOut = amountIn*erc20Amount*1000/ethAmount/1005;
                // amountIn = amountOut*ethAmount*1005/1000/erc20Amount
                _amountInNeeded = _amountOut*_op.ethAmount*1005/1000/_op.erc20Amount;
                _safeTransfer(_token0, to, amountIn.sub(_amountInNeeded)); // send back the token change
            } else if (outToken == _token0) {
                amountIn = balance1 - _reserve1;
                require(amountIn > 0, "wrong amount1In");
                // amountOut = amountIn*ethAmount*1000/erc20Amount/1005;
                // amountIn = amountOut*erc20Amount*1005/1000/ethAmount
                _amountInNeeded = _amountOut*_op.erc20Amount*1005/1000/_op.ethAmount;
                _safeTransfer(_token1, to, amountIn.sub(_amountInNeeded)); // TODO: think about a better payee than to
            } else {
                revert("wrong outToken");
            }
            require(_amountInNeeded <= amountIn, "wrong amountIn");
        }
        
        {
            require(to != _token0 && to != _token1, 'AGroupV1: INVALID_TO');

            amountOut = _amountOut;
            _safeTransfer(outToken, to, _amountOut); // optimistically transfer tokens

            uint256 balance0 = IERC20(_token0).balanceOf(address(this));
            uint256 balance1 = IERC20(_token1).balanceOf(address(this));

            _update(balance0, balance1);
            msg.sender.transfer(feeChange); // TODO: maybe use call for transferring ETH to contract account
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
            (_op.ethAmount, _op.erc20Amount, _op.blockNum) = IAGroupFactory(factory).updateAndCheckPriceNow{value: msg.value}(_token1);
            // TODO: validate

            (uint112 _reserve0, uint112 _reserve1) = getReserves(); // gas savings

            if (outToken == _token1) {
                amountIn = balance0 - _reserve0;
                require(amountIn > 0, "wrong amount0In");
                amountOut = amountIn*_op.erc20Amount*1000/_op.ethAmount/1005;
            } else if (outToken == _token0) {
                amountIn = balance1 - _reserve1;
                require(amountIn > 0, "wrong amount1In");
                amountOut = amountIn*_op.ethAmount*1000/_op.erc20Amount/1005;
            } else {
                revert("wrong outToken");
            }
            feeChange = msg.value.sub(_ethBalanceBefore.sub(address(this).balance));
        }
        
        require(to != _token0 && to != _token1, 'AGroupV1: INVALID_TO');

        _safeTransfer(outToken, to, amountOut); // optimistically transfer tokens

        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));

        _update(balance0, balance1);
        msg.sender.transfer(feeChange); // TODO: maybe use call for transferring ETH to contract account
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
}
