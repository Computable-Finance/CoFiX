// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.6;

library CofiXLibrary {

    // calculates the CREATE2 address for a pair without making any external calls
    function pairFor(address _factory, address token) internal pure returns (address pair) {
        pair = address(uint(keccak256(abi.encodePacked(
                hex'ff',
                _factory,
                keccak256(abi.encodePacked(token)),
                hex'0961a1430ce0e501e0b8c1a7177513ea2b5b8bc85f38cdd70c796616f040c9ad' // init code hash
            ))));
    }

}