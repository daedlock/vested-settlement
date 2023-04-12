pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

//erc20 contract
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 100000 * (10 ** uint256(decimals())));
    }
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}