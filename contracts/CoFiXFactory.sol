// SPDX-License-Identifier: GPL-3.0-or-later
pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "./interface/ICoFiXFactory.sol";
import "./interface/ICoFiXController.sol";
import "./CoFiXPair.sol";

// Factory of CoFiX to create new CoFiXPair contract when new pair is created, managed by governance
// Governance role of this contract should be the `Timelock` contract, which is further managed by a multisig contract
contract CoFiXFactory is ICoFiXFactory {

    string constant internal pairNamePrefix = "XToken ";
    string constant internal pairSymbolPrefix = "XT-";

    mapping(address => address) public override getPair;
    address[] public override allPairs;
    address public immutable WETH;
    address public governance;
    address public controller;
    address public feeReceiver;

    address public vaultForLP;
    address public vaultForTrader;
    address public vaultForCNode;

    modifier onlyGovernance() {
        require(msg.sender == governance, "CFactory: !governance");
        _;
    }

    constructor(address _WETH) public {
        governance = msg.sender;
        feeReceiver = msg.sender; // set feeReceiver to a feeReceiver contract later
        WETH = _WETH;
    }

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
        require(pair != address(0), "CFactory: Failed on deploy");

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

    function setGovernance(address _new) external override onlyGovernance {
        require(_new != address(0), "CFactory: zero addr");
        require(_new != governance, "CFactory: same addr");
        governance = _new;
        emit NewGovernance(_new);
    }
    
    function setController(address _new) external override onlyGovernance {
        require(_new != address(0), "CFactory: zero addr");
        require(_new != controller, "CFactory: same addr");
        controller = _new;
        emit NewController(_new);
    }

    function setFeeReceiver(address _new) external override onlyGovernance {
        require(_new != address(0), "CFactory: zero addr");
        require(_new != feeReceiver, "CFactory: same addr");
        feeReceiver = _new;
        emit NewGovernance(_new);
    }

    function setVaultForLP(address _new) external override onlyGovernance {
        require(_new != address(0), "CFactory: zero addr");
        require(_new != vaultForLP, "CFactory: same addr");
        vaultForLP = _new;
        emit NewVaultForLP(_new);
    }

    function setVaultForTrader(address _new) external override onlyGovernance {
        require(_new != address(0), "CFactory: zero addr");
        require(_new != vaultForTrader, "CFactory: same addr");
        vaultForTrader = _new;
        emit NewVaultForTrader(_new);
    }

    function setVaultForCNode(address _new) external override onlyGovernance {
        require(_new != address(0), "CFactory: zero addr");
        require(_new != vaultForCNode, "CFactory: same addr");
        vaultForCNode = _new;
        emit NewVaultForCNode(_new);
    }

    function getController() external view override returns (address) {
        return controller;
    }

    function getFeeReceiver() external view override returns (address) {
        return feeReceiver;
    }

    function getVaultForLP() external view override returns (address) {
        return vaultForLP;
    }

    function getVaultForTrader() external view override returns (address) {
        return vaultForTrader;
    }

    function getVaultForCNode() external view override returns (address) {
        return vaultForCNode;
    }

    function append(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    function uint2str(uint _i) internal pure returns (string memory) {
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
