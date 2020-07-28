// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

import './interface/IAGroupFactory.sol';
import './AGroupPair.sol';
import './interface/INest_3_OfferPrice.sol';
import './lib/SafeMath.sol';


contract AGroupFactory is IAGroupFactory {
    using SafeMath for uint;

    mapping(address => address) public override getPair;
    address[] public override allPairs;
    INest_3_OfferPrice public priceOracle;
    address public immutable WETH;

    event PairCreated(address indexed token, address pair, uint);

    constructor(address _priceOracle, address _WETH) public {
        priceOracle = INest_3_OfferPrice(_priceOracle);
        WETH = _WETH;
    }

    receive() external payable {
        // require(msg.sender == address(priceOracle), "AGroupFactory: invalid eth sender");
        // TODO: strict check here
    }

    function allPairsLength() external override view returns (uint256) {
        return allPairs.length;
    }

    // For Debug
    event ByteCode(bytes _bytes);
    event ByteCodeHash(bytes32 _hash);

    function createPair(address token) external override returns (address pair) {
        require(token != address(0), 'AGroupV1: ZERO_ADDRESS');
        require(getPair[token] == address(0), 'AGroupV1: PAIR_EXISTS');
        bytes memory bytecode = type(AGroupPair).creationCode;
        // emit ByteCode(bytecode);
        emit ByteCodeHash(keccak256(bytecode));
        bytes32 salt = keccak256(abi.encodePacked(token));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        IAGroupPair(pair).initialize(WETH, token);
        getPair[token] = pair;
        allPairs.push(pair);
        emit PairCreated(token, pair, allPairs.length);
    }


    // act as proxy contract to access the NEST Price Oracle
    // TODO: only pair
    function updateAndCheckPriceNow(address tokenAddress) external payable override returns(uint256 ethAmount, uint256 erc20Amount, uint256 blockNum) {
        uint256 _balanceBefore = address(this).balance;
        (ethAmount, erc20Amount, blockNum) = priceOracle.updateAndCheckPriceNow{value: msg.value}(tokenAddress);
        msg.sender.transfer(msg.value.sub(_balanceBefore.sub(address(this).balance))); // TODO: maybe use call for transferring ETH to contract account
    }


}
