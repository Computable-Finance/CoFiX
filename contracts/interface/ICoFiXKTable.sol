// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

interface ICoFiXKTable {
    function setK0(uint256 tIdx, uint256 sigmaIdx, int128 k0) external;
    function setK0InBatch(uint256[] memory tIdxs, uint256[] memory sigmaIdxs, int128[] memory k0s) external;
    function getK0(uint256 tIdx, uint256 sigmaIdx) external view returns (int128);
}