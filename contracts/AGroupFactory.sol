// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.6.6;

import './interface/IAGroupFactory.sol';
import './AGroupPair.sol';
import './interface/INest_3_OfferPrice.sol';


contract AGroupFactory is IAGroupFactory {

    mapping(address => mapping(address => address)) public override getPair;
    address[] public override allPairs;
    INest_3_OfferPrice public priceOracle;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    constructor(address _priceOracle) public {
        priceOracle = INest_3_OfferPrice(_priceOracle);
    }

    function allPairsLength() external override view returns (uint256) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external override returns (address pair) {
        // require(tokenA != tokenB, 'AGroupV1: IDENTICAL_ADDRESSES');
        // (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        // require(token0 != address(0), 'AGroupV1: ZERO_ADDRESS');
        // require(getPair[token0][token1] == address(0), 'AGroupV1: PAIR_EXISTS'); // single check is sufficient
        // bytes memory bytecode = type(AGroupPair).creationCode;
        // bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        // assembly {
        //     pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        // }
        // IAGroupPair(pair).initialize(token0, token1);
        // getPair[token0][token1] = pair;
        // getPair[token1][token0] = pair; // populate mapping in the reverse direction
        // allPairs.push(pair);
        // emit PairCreated(token0, token1, pair, allPairs.length);
    }


    // act as proxy contract to access the NEST Price Oracle
    // TODO: only pair
    function updateAndCheckPriceNow(address tokenAddress) external payable override returns(uint256 ethAmount, uint256 erc20Amount, uint256 blockNum) {
        uint256 _balanceBefore = address(this).balance;
        (ethAmount, erc20Amount, blockNum) = priceOracle.updateAndCheckPriceNow{value: msg.value}(tokenAddress);
        uint256 _cost = address(this).balance - _balanceBefore;
        msg.sender.transfer(msg.value - _cost); // TODO: maybe use call for transferring ETH to contract account
    }


}
