// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;
import "../interface/INest_3_VoteFactory.sol";

contract NEST3VoteFactoryMock is INest_3_VoteFactory {
    mapping(string => address) public contractMapping;
    address public governance;

    constructor (address _offerPrice) public {
        contractMapping["nest.v3.offerPrice"] = _offerPrice; // nest price oracle
        governance= msg.sender;
    }

    function setOfferPrice(address _offerPrice) public {
        require(msg.sender == governance, "voteFactory: !governance");
        contractMapping["nest.v3.offerPrice"] = _offerPrice; // nest price oracle
    }

	function checkAddress(string calldata name) external override view returns (address contractAddress) {
        return contractMapping[name];
    }
}