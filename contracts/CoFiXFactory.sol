// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

import './interface/ICoFiXFactory.sol';
import './interface/ICoFiXController.sol';
import './CoFiXPair.sol';
import './interface/INest_3_OfferPrice.sol';
import './lib/SafeMath.sol';


contract CoFiXFactory is ICoFiXFactory {
    using SafeMath for uint;

    mapping(address => address) public override getPair;
    address[] public override allPairs;
    address public governance;
    address public controller;
    address public immutable WETH;

    event PairCreated(address indexed token, address pair, uint);

    constructor(address _WETH) public {
        governance = msg.sender;
        WETH = _WETH;
    }

    receive() external payable {
        // TODO: strict check here
    }

    function allPairsLength() external override view returns (uint256) {
        return allPairs.length;
    }

    // For Debug
    event ByteCode(bytes _bytes);
    event ByteCodeHash(bytes32 _hash);

    function createPair(address token) external override returns (address pair) {
        require(token != address(0), 'CFactory: ZERO_ADDRESS');
        require(getPair[token] == address(0), 'CFactory: PAIR_EXISTS');
        bytes memory bytecode = type(CoFiXPair).creationCode;
        // emit ByteCode(bytecode);
        emit ByteCodeHash(keccak256(bytecode));
        bytes32 salt = keccak256(abi.encodePacked(token));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        ICoFiXPair(pair).initialize(WETH, token);
        getPair[token] = pair;
        allPairs.push(pair);
        ICoFiXController(controller).addCaller(pair);
        emit PairCreated(token, pair, allPairs.length);
    }

    function setGovernance(address _new) external override {
        require(msg.sender == governance, "CFactory: !governance");
        governance = _new;
    }
    
    function setController(address _new) external override {
        require(msg.sender == governance, "CFactory: !governance");
        controller = _new;
    }

    function getController() external view override returns (address) {
        return controller;
    }
}
