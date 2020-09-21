// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

interface INest_3_VoteFactory {
    // 查询地址
	function checkAddress(string calldata name) external view returns (address contractAddress);
    // _offerPrice = Nest_3_OfferPrice(address(voteFactoryMap.checkAddress("nest.v3.offerPrice")));
}