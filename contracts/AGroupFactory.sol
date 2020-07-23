// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.6.6;

import './interface/IAGroupFactory.sol';
import './AGroupPair.sol';

contract AGroupFactory is IAGroupFactory {

    mapping(address => mapping(address => address)) public override getPair;
    address[] public override allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    // constructor() public {
    // }

    function allPairsLength() external override view returns (uint256) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
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

}
