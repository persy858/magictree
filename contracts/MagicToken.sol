// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MagicToken is ERC20, Ownable {
    // 最大供应量：1亿代币（不可修改）
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18;
    
    // MagicTree合约地址（有权限铸造）
    address public minter;
    
    // 标记minter是否已设置（防止重复设置）
    bool public minterSet;
    
    constructor() ERC20("Magic Tree Token", "MTT") Ownable(msg.sender) {}
    
    // 设置铸造者（只能设置一次，之后永久锁定）
    function setMinter(address _minter) external onlyOwner {
        require(!minterSet, "Minter already set");
        require(_minter != address(0), "Invalid minter address");
        minter = _minter;
        minterSet = true;
        
        // 可选：设置后放弃owner权限，实现完全去中心化
        renounceOwnership();
    }
    
    // 铸造代币（仅限minter调用）
    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "Only minter can mint");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }
    
    // 查询剩余可铸造数量
    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }
}