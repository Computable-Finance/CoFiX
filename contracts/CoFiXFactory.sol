// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

import './interface/ICoFiXFactory.sol';
import './interface/ICoFiXController.sol';
import './CoFiXPair.sol';

contract CoFiXFactory is ICoFiXFactory {
    using SafeMath for uint;

    string constant internal pairNamePrefix = "CoFiX Pool Token ";
    string constant internal pairSymbolPrefix = "CPT-";

    mapping(address => address) public override getPair;
    address[] public override allPairs;
    address public immutable WETH;
    address public governance;
    address public controller;
    address public feeReceiver;

    event PairCreated(address indexed token, address pair, uint);

    constructor(address _WETH) public {
        governance = msg.sender;
        feeReceiver = msg.sender; // set feeReceiver to a feeReceiver contract later
        WETH = _WETH;
    }

    receive() external payable {}

    function allPairsLength() external override view returns (uint256) {
        return allPairs.length;
    }

    function createPair(address token) external override returns (address pair) {
        require(token != address(0), 'CFactory: ZERO_ADDRESS');
        require(getPair[token] == address(0), 'CFactory: PAIR_EXISTS');
        bytes memory bytecode = type(CoFiXPair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        getPair[token] = pair;
        allPairs.push(pair);

        uint256 pairLen = allPairs.length;
        string memory _idx = uint2str(pairLen);
        string memory _name = append(pairNamePrefix, _idx);
        string memory _symbol = append(pairSymbolPrefix, _idx);
        ICoFiXPair(pair).initialize(WETH, token, _name, _symbol);

        ICoFiXController(controller).addCaller(pair);
        emit PairCreated(token, pair, pairLen);
    }

    function setGovernance(address _new) external override {
        require(msg.sender == governance, "CFactory: !governance");
        governance = _new;
    }
    
    function setController(address _new) external override {
        require(msg.sender == governance, "CFactory: !governance");
        controller = _new;
    }

    function setFeeReceiver(address _new) external override {
        require(msg.sender == governance, "CFactory: !governance");
        feeReceiver = _new;
    }

    function getController() external view override returns (address) {
        return controller;
    }

    function getFeeReceiver() external view override returns (address) {
        return feeReceiver;
    }

    function append(string memory a, string memory b) internal pure returns (string memory _concatenatedString) {
        return string(abi.encodePacked(a, b));
    }

    function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (_i != 0) {
            bstr[k--] = byte(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
    }
}
