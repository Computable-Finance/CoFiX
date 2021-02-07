// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestXToken is ERC20("TestXToken", "XT-1") {

    address public token0; // WETH token
    address public token1; // any ERC20 token

    uint112 private reserve0;          
    uint112 private reserve1;          

    uint256 public initToken1Amount;
    uint256 public initToken0Amount;

    constructor() public {
    }

    function initialize(address _token0, address _token1, uint256 _initToken0Amount, uint256 _initToken1Amount) external {
        token0 = _token0;
        token1 = _token1;
        initToken0Amount = _initToken0Amount;
        initToken1Amount = _initToken1Amount;
    }

    // ONLY TEST, NOT SAFE!
    function mint(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }

    function getInitialAssetRatio() public view returns (uint256 _initToken0Amount, uint256 _initToken1Amount) {
        _initToken1Amount = initToken1Amount;
        _initToken0Amount = initToken0Amount;
    }

    function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
    }

    function update(uint balance0, uint balance1) public {
        require(balance0 <= uint112(-1) && balance1 <= uint112(-1), "CPair: OVERFLOW");
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
    }

}