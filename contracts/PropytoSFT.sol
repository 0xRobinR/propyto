// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract PropytoSFT is 
    ERC1155, 
    Ownable, 
    Pausable,
    ERC1155Supply 
{
    using Counters for Counters.Counter;
    using Strings for uint256;

    Counters.Counter private _tokenIdCounter;
    
    address public registryAddress;

    string public name;
    string public symbol;
    
    mapping(uint256 => uint256) public tokenToAssetId;
    
    mapping(uint256 => uint256) public assetToTokenId;
    
    mapping(uint256 => string) private _tokenURIs;
    
    event AssetTokenized(uint256 indexed assetId, uint256 indexed tokenId, string uri);
    event SharesMinted(uint256 indexed tokenId, address indexed to, uint256 amount);
    event SharesBurned(uint256 indexed tokenId, address indexed from, uint256 amount);
    
    constructor(string memory uri_, string memory name_, string memory symbol_) ERC1155(uri_) {
        name = name_;
        symbol = symbol_;
    }
    
    function setRegistryAddress(address _registryAddress) public onlyOwner {
        require(_registryAddress != address(0), "Registry address cannot be zero");
        registryAddress = _registryAddress;
    }
    
    function tokenizeAsset(uint256 assetId, string memory assetURI) public returns (uint256) {
        require(msg.sender == registryAddress || msg.sender == owner(), "Only registry or owner can tokenize assets");
        require(assetToTokenId[assetId] == 0, "Asset already tokenized");
        
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        tokenToAssetId[tokenId] = assetId;
        assetToTokenId[assetId] = tokenId;
        _tokenURIs[tokenId] = assetURI;
        
        emit AssetTokenized(assetId, tokenId, assetURI);
        return tokenId;
    }
    
    function mintShares(address to, uint256 assetId, uint256 amount) public {
        require(msg.sender == registryAddress || msg.sender == owner(), "Only registry or owner can mint shares");
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than zero");
        
        uint256 tokenId = assetToTokenId[assetId];
        require(tokenId != 0, "Asset not tokenized");
        
        _mint(to, tokenId, amount, "");
        emit SharesMinted(tokenId, to, amount);
    }
    
    function burnShares(address from, uint256 assetId, uint256 amount) public {
        require(
            msg.sender == registryAddress || 
            msg.sender == owner() || 
            msg.sender == from || 
            isApprovedForAll(from, msg.sender),
            "Not authorized to burn shares"
        );
        require(amount > 0, "Amount must be greater than zero");
        
        uint256 tokenId = assetToTokenId[assetId];
        require(tokenId != 0, "Asset not tokenized");
        require(balanceOf(from, tokenId) >= amount, "Insufficient shares to burn");
        
        _burn(from, tokenId, amount);
        emit SharesBurned(tokenId, from, amount);
    }

    function setTokenURI(uint256 tokenId, string memory assetURI) public {
        require(msg.sender == registryAddress || msg.sender == owner(), "Only registry or owner can set URI");
        require(tokenId <= _tokenIdCounter.current() && tokenId > 0, "Token does not exist");
        
        _tokenURIs[tokenId] = assetURI;
    }
    
    function uri(uint256 tokenId) public view override returns (string memory) {
        require(tokenId <= _tokenIdCounter.current() && tokenId > 0, "Token does not exist");
        
        string memory tokenURI = _tokenURIs[tokenId];
        string memory baseURI = super.uri(tokenId);
        
        if (bytes(tokenURI).length > 0) {
            return tokenURI;
        } else {
            return string(abi.encodePacked(baseURI, tokenId.toString()));
        }
    }
    
    function getAssetId(uint256 tokenId) public view returns (uint256) {
        require(tokenId <= _tokenIdCounter.current() && tokenId > 0, "Token does not exist");
        return tokenToAssetId[tokenId];
    }
    
    function getTokenId(uint256 assetId) public view returns (uint256) {
        return assetToTokenId[assetId];
    }

    function pause() public onlyOwner {
        _pause();
    }
    
    function unpause() public onlyOwner {
        _unpause();
    }
    
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155, ERC1155Supply) whenNotPaused {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
