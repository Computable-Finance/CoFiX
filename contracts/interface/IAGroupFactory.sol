pragma solidity ^0.6.6;

interface IAGroupFactory {
    event PairCreated(address indexed token0, address indexed token1, address pair, uint256);

    /// @dev Create a new token pair for trading
    /// @param  tokenA the address of token A
    /// @param  tokenB the address of token B
    /// @param  amountA the amount of token A
    /// @param  amountB the amount of token B
    /// @return pair the address of token pair
    function createPair(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
        )
        external
        returns (address pair);

    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function allPairs(uint256) external view returns (address pair);
    function allPairsLength() external view returns (uint256);
}