// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./PropytoSFT.sol";

contract PropytoRegistry is OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using Strings for uint256;

    enum AssetType {
        RESIDENTIAL,
        COMMERCIAL,
        LAND,
        OTHER
    }

    enum ResidentialType {
        NONE,
        APARTMENT,
        FARMHOUSE,
        VILLA,
        BUNGALOW,
        OTHER
    }

    enum CommercialType {
        NONE,
        SHOP,
        OFFICE,
        GODOWN,
        OTHER
    }

    enum LandType {
        NONE,
        PLOT,
        FARMS,
        OTHER
    }

    enum AssetStatus {
        FOR_SALE,
        FOR_RENT,
        SOLD,
        RENTED,
        DELISTED,
        OTHER
    }

    enum AssetFurnishing {
        UNFURNISHED,
        PARTIALLY_FURNISHED,
        FULLY_FURNISHED,
        OTHER
    }

    enum AssetZone {
        INDUSTRIAL,
        COMMERCIAL,
        RESIDENTIAL,
        LAND,
        OTHER
    }

    enum ProposalType {
        PRICE_CHANGE,
        MAINTENANCE,
        SELL_PROPERTY,
        RENOVATE,
        OTHER
    }

    enum ProposalStatus {
        ACTIVE,
        EXECUTED,
        REJECTED,
        EXPIRED
    }
    
    struct PropytoAsset {
        string name;
        AssetType assetType;
        address assetAddress;
        AssetStatus assetStatus;
        AssetFurnishing assetFurnishing;
        AssetZone assetZone;
        
        uint256 assetPrice; // in USDT
        uint256 assetArea; // in square feet
        uint256 assetAge; // in days

        string assetOtherDetails; // JSON string or IPFS hash

        bool isRentable;
        bool isSellable;
        bool isPartiallyOwnEnabled;
        
        address seller;
        uint256 listingExpiry;
    }

    struct PropytoAssetMetadata {
        string assetDescription;
        string assetFeatures;
        string assetAmenities;
        string assetLocation;
    }

    struct PropytoAssetMedia {
        string assetImage; // IPFS hash
        string assetVideo; // IPFS hash
        string assetFloorPlan; // IPFS hash
    }

    struct PropytoRentData {
        uint256 rentPrice; // in USDT
        uint256 rentDeposit; // in USDT
        uint256 rentPeriod; // in days
        uint256 rentSecurityDeposit; // in USDT
    }

    struct PartialOwnership {
        uint256 totalShares;
        uint256 availableShares;
        uint256 sharePrice;
        uint256 minSharePurchase;
        uint256 maxSharesPerOwner;
        address[] owners;
        mapping(address => uint256) shares;
        bool isInitialized;
    }

    struct MarketplaceConfig {
        uint256 platformFeePercentage;
        address feeCollector;
        uint256 listingFee;
        bool feesEnabled;
    }

    // State variables
    mapping(uint256 => PropytoAsset) public assets;
    mapping(uint256 => PropytoAssetMetadata) public assetMetadata;
    mapping(uint256 => PropytoAssetMedia) public assetMedia;
    mapping(uint256 => PropytoRentData) public assetRentData;
    mapping(uint256 => PartialOwnership) private assetOwnership;
    mapping(address => uint256[]) private sellerAssets; // Track assets listed by each seller
    mapping(uint256 => uint256) private assetProposalCount; // Track number of proposals per asset
    mapping(uint256 => address) public propytosftAddress;
    
    uint256 public assetCount;
    address public usdtToken; // USDT token contract address
    MarketplaceConfig public marketplaceConfig;

    // Events
    event AssetRegistered(uint256 indexed assetId, string name, address indexed registeredBy, address indexed seller, address propytosftAddress);
    event PartialOwnershipEnabled(uint256 indexed assetId, uint256 totalShares, uint256 sharePrice);
    event SharesPurchased(uint256 indexed assetId, address indexed buyer, uint256 shareCount, uint256 totalPrice);
    event SharesTransferred(uint256 indexed assetId, address indexed from, address indexed to, uint256 shareCount);
    
    event AssetStatusUpdated(uint256 indexed assetId, AssetStatus oldStatus, AssetStatus newStatus);
    event AssetPriceUpdated(uint256 indexed assetId, uint256 oldPrice, uint256 newPrice);
    event AssetMetadataUpdated(uint256 indexed assetId);
    event AssetMediaUpdated(uint256 indexed assetId);
    event AssetSellershipTransferred(uint256 indexed assetId, address indexed oldSeller, address indexed newSeller);
    
    event MarketplaceConfigUpdated(uint256 platformFeePercentage, address feeCollector);
    event FeesCollected(uint256 indexed assetId, uint256 feeAmount);

    modifier assetExists(uint256 assetId) {
        require(assetId < assetCount, "E7"); // Asset does not exist
        _;
    }

    modifier onlySeller(uint256 assetId) {
        require(msg.sender == assets[assetId].seller, "E8"); // Only the asset seller can call this function
        _;
    }

    modifier canManageAsset(uint256 assetId) {
        require(
            msg.sender == owner() || msg.sender == assets[assetId].seller,
            "E9" // Only the contract owner or asset seller can call this function
        );
        _;
    }

    function initialize(address _usdtToken) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        usdtToken = _usdtToken;
        
        marketplaceConfig.platformFeePercentage = 250; // 2.5%
        marketplaceConfig.feeCollector = msg.sender;
        marketplaceConfig.listingFee = 10 * 10**18; // 10 USDT
        marketplaceConfig.feesEnabled = true;
    }

    function registerAsset(
        PropytoAsset memory _asset,
        PropytoAssetMetadata memory _metadata,
        PropytoAssetMedia memory _media
    ) public nonReentrant whenNotPaused returns (uint256) {
        if (marketplaceConfig.feesEnabled && marketplaceConfig.listingFee > 0) {
            require(
                IERC20(usdtToken).transferFrom(msg.sender, marketplaceConfig.feeCollector, marketplaceConfig.listingFee),
                "E10" // Listing fee transfer failed
            );
        }
        
        uint256 assetId = assetCount;
        
        _asset.seller = msg.sender;
        
        if (_asset.listingExpiry == 0) {
            _asset.listingExpiry = block.timestamp + 90 days;
        }
        
        assets[assetId] = _asset;
        assetMetadata[assetId] = _metadata;
        assetMedia[assetId] = _media;
        
        sellerAssets[msg.sender].push(assetId);

        PropytoSFT _propytosftAddress = new PropytoSFT(constructTokenURI(assetId), _asset.name, "PROPYTO");
        propytosftAddress[assetId] = address(_propytosftAddress);
        
        assetCount++;
        
        emit AssetRegistered(assetId, _asset.name, msg.sender, _asset.seller, address(_propytosftAddress));
        return assetId;
    }

    function enablePartialOwnership(
        uint256 assetId,
        uint256 totalShares,
        uint256 sharePrice,
        uint256 minSharePurchase,
        uint256 maxSharesPerOwner,
        uint256 sellerShares
    ) public assetExists(assetId) onlySeller(assetId) whenNotPaused {
        PropytoAsset storage asset = assets[assetId];
        require(asset.isPartiallyOwnEnabled, "E1"); // Asset must have partial ownership enabled in its settings
        require(!assetOwnership[assetId].isInitialized, "E2"); // Partial ownership already initialized

        require(totalShares > 0, "E3"); // Total shares must be greater than zero
        require(sharePrice > 0, "E4"); // Share price must be greater than zero
        require(minSharePurchase > 0 && minSharePurchase <= totalShares, "E5"); // Invalid minimum share purchase
        require(sellerShares <= totalShares, "E6"); // Seller shares cannot exceed total shares
        
        PartialOwnership storage ownership = assetOwnership[assetId];
        ownership.totalShares = totalShares;
        ownership.availableShares = totalShares - sellerShares;
        ownership.sharePrice = sharePrice;
        ownership.minSharePurchase = minSharePurchase;
        ownership.maxSharesPerOwner = maxSharesPerOwner;
        ownership.isInitialized = true;
        
        if (sellerShares > 0) {
            ownership.shares[asset.seller] = sellerShares;
            ownership.owners.push(asset.seller);
        }
        
        emit PartialOwnershipEnabled(assetId, totalShares, sharePrice);
    }

    function purchaseShares(uint256 assetId, uint256 shareCount, bool isBuyAsset) public nonReentrant assetExists(assetId) {
        PropytoAsset storage asset = assets[assetId];
        require(
            asset.assetStatus == AssetStatus.FOR_SALE || 
            asset.assetStatus == AssetStatus.FOR_RENT,
            "E11" // Asset is not available for purchase
        );
        require(block.timestamp < asset.listingExpiry, "E12"); // Asset listing has expired
        
        uint256 totalPrice;
        uint256 platformFee;
        uint256 sellerAmount;
        // Handle entire asset purchase
        if (isBuyAsset) {
            // Use the asset price for entire purchase
            totalPrice = asset.assetPrice;
            
            // Process payment
            platformFee = marketplaceConfig.feesEnabled ? 
                (totalPrice * marketplaceConfig.platformFeePercentage) / 10000 : 0;
            sellerAmount = totalPrice - platformFee;
            
            require(
                IERC20(usdtToken).transferFrom(msg.sender, asset.seller, sellerAmount),
                "E17" // Payment to seller failed
            );
            
            if (platformFee > 0) {
                require(
                    IERC20(usdtToken).transferFrom(msg.sender, marketplaceConfig.feeCollector, platformFee),
                    "E18" // Platform fee payment failed
                );
                emit FeesCollected(assetId, platformFee);
            }
            
            // Mint SFT for entire asset
            if (propytosftAddress[assetId] != address(0)) {
                PropytoSFT sft = PropytoSFT(propytosftAddress[assetId]);
                
                uint256 tokenId = sft.getTokenId(assetId);
                if (tokenId == 0) {
                    string memory uri = constructTokenURI(assetId);
                    sft.tokenizeAsset(assetId, uri);
                }
                
                // For complete asset purchase, mint all shares to the buyer
                PartialOwnership storage _ownership = assetOwnership[assetId];
                uint256 sharesToMint = _ownership.isInitialized ? _ownership.totalShares : 100;
                
                sft.mintShares(msg.sender, assetId, sharesToMint);
            }
            
            // Update asset status to SOLD
            AssetStatus oldStatus = asset.assetStatus;
            asset.assetStatus = AssetStatus.SOLD;
            emit AssetStatusUpdated(assetId, oldStatus, asset.assetStatus);
            
            return;
        }
        
        // Handle partial shares purchase
        PartialOwnership storage ownership = assetOwnership[assetId];
        require(ownership.isInitialized, "E13"); // Partial ownership not initialized for this asset
        require(shareCount >= ownership.minSharePurchase, "E14"); // Share count below minimum purchase amount
        require(shareCount <= ownership.availableShares, "E15"); // Not enough shares available
        
        // Prevent seller from buying their own shares
        require(msg.sender != asset.seller, "Cannot buy your own shares");
        
        if (ownership.maxSharesPerOwner > 0) {
            require(
                ownership.shares[msg.sender] + shareCount <= ownership.maxSharesPerOwner,
                "E16" // Purchase would exceed maximum shares per owner
            );
        }
        
        totalPrice = shareCount * ownership.sharePrice;
        
        platformFee = 0;
        if (marketplaceConfig.feesEnabled) {
            platformFee = (totalPrice * marketplaceConfig.platformFeePercentage) / 10000;
        }
        
        sellerAmount = totalPrice - platformFee;
        
        require(
            IERC20(usdtToken).transferFrom(msg.sender, asset.seller, sellerAmount),
            "E17" // Payment to seller failed
        );
        
        if (platformFee > 0) {
            require(
                IERC20(usdtToken).transferFrom(msg.sender, marketplaceConfig.feeCollector, platformFee),
                "E18" // Platform fee payment failed
            );
            emit FeesCollected(assetId, platformFee);
        }
        
        if (ownership.shares[msg.sender] == 0) {
            ownership.owners.push(msg.sender);
        }
        
        ownership.shares[msg.sender] += shareCount;
        ownership.availableShares -= shareCount;
        
        emit SharesPurchased(assetId, msg.sender, shareCount, totalPrice);

        if (propytosftAddress[assetId] != address(0)) {
            PropytoSFT sft = PropytoSFT(propytosftAddress[assetId]);
            
            uint256 tokenId = sft.getTokenId(assetId);
            if (tokenId == 0) {
                string memory uri = constructTokenURI(assetId);
                sft.tokenizeAsset(assetId, uri);
            }
            
            sft.mintShares(msg.sender, assetId, shareCount);
        }
        
        if (ownership.availableShares == 0 && asset.assetStatus == AssetStatus.FOR_SALE) {
            AssetStatus oldStatus = asset.assetStatus;
            asset.assetStatus = AssetStatus.SOLD;
            emit AssetStatusUpdated(assetId, oldStatus, asset.assetStatus);
        }
    }

    function constructTokenURI(uint256 assetId) internal pure returns (string memory) {
        // PropytoAssetMedia storage media = assetMedia[assetId];
        
        // if (bytes(media.assetImage).length > 0) {
        //     return media.assetImage;
        // }
        
        return string(abi.encodePacked("https://api.propy.to/metadata/", assetId.toString()));
    }

    function getOwnershipPercentage(uint256 assetId, address ownerAddress) public view assetExists(assetId) returns (uint256) {
        PartialOwnership storage ownership = assetOwnership[assetId];
        require(ownership.isInitialized, "E19"); // Partial ownership not initialized for this asset
        
        if (ownership.totalShares == 0) return 0;
        
        return (ownership.shares[ownerAddress] * 1e18) / ownership.totalShares;
    }

    function getSharesOwned(uint256 assetId, address ownerAddress) public view assetExists(assetId) returns (uint256) {
        PartialOwnership storage ownership = assetOwnership[assetId];
        return ownership.shares[ownerAddress];
    }

    function getAssetOwners(uint256 assetId) public view assetExists(assetId) returns (address[] memory) {
        return assetOwnership[assetId].owners;
    }

    // function updateAssetStatus(uint256 assetId, AssetStatus newStatus) public assetExists(assetId) onlySeller(assetId) {
    //     PropytoAsset storage asset = assets[assetId];
    //     AssetStatus oldStatus = asset.assetStatus;
    //     asset.assetStatus = newStatus;
        
    //     emit AssetStatusUpdated(assetId, oldStatus, newStatus);
    // }

    function updateAssetPrice(uint256 assetId, uint256 newPrice) public assetExists(assetId) onlySeller(assetId) {
        require(newPrice > 0, "E20"); // Price must be greater than zero
        
        PropytoAsset storage asset = assets[assetId];
        
        PartialOwnership storage ownership = assetOwnership[assetId];
        
        uint256 oldPrice = asset.assetPrice;
        asset.assetPrice = newPrice;
        
        emit AssetPriceUpdated(assetId, oldPrice, newPrice);
        
        if (asset.isPartiallyOwnEnabled && ownership.isInitialized) {
            ownership.sharePrice = newPrice / ownership.totalShares;
        }
    }
    
    function getSellerAssets(address seller) public view returns (uint256[] memory) {
        return sellerAssets[seller];
    }

    function updateMarketplaceConfig(
        uint256 newFeePercentage,
        address newFeeCollector,
        uint256 newListingFee,
        bool feesEnabled
    ) public onlyOwner {
        require(newFeePercentage <= 3000, "E24"); // Fee percentage cannot exceed 30%
        require(newFeeCollector != address(0), "E25"); // Fee collector cannot be zero address
        
        marketplaceConfig.platformFeePercentage = newFeePercentage;
        marketplaceConfig.feeCollector = newFeeCollector;
        marketplaceConfig.listingFee = newListingFee;
        marketplaceConfig.feesEnabled = feesEnabled;
        
        emit MarketplaceConfigUpdated(newFeePercentage, newFeeCollector);
    }

    function updateUsdtToken(address newUsdtToken) public onlyOwner {
        require(newUsdtToken != address(0), "E26"); // Token address cannot be zero address
        usdtToken = newUsdtToken;
    }

    function extendListingExpiry(uint256 assetId, uint256 newExpiry) public assetExists(assetId) onlySeller(assetId) {
        require(newExpiry > block.timestamp, "E27"); // New expiry must be in the future
        require(newExpiry > assets[assetId].listingExpiry, "E28"); // New expiry must be later than current expiry
        
        assets[assetId].listingExpiry = newExpiry;
    }
}
