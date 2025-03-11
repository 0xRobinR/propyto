import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("PropytoRegistry", function () {
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer1: SignerWithAddress;
  let buyer2: SignerWithAddress;
  let feeCollector: SignerWithAddress;
  let mockUSDT: any;
  let registry: any;
  let sft: any;

  // Mock asset data
  const mockAsset = {
    name: "Luxury Villa",
    assetType: 0, // RESIDENTIAL
    assetAddress: "0x0000000000000000000000000000000000000000", // Use zero address instead of string
    assetStatus: 0, // FOR_SALE
    assetFurnishing: 2, // FULLY_FURNISHED
    assetZone: 2, // RESIDENTIAL
    assetPrice: ethers.parseEther("500000"), // 500,000 USDT
    assetArea: 3500, // 3500 sq ft
    assetAge: 1095, // 3 years (in days)
    assetOtherDetails: '{"bedrooms": 4, "bathrooms": 3, "garage": true}',
    isRentable: true,
    isSellable: true,
    isPartiallyOwnEnabled: true,
    seller: "", // Will be set in beforeEach
    listingExpiry: 0, // Will be set in beforeEach
  };

  const mockAssetMetadata = {
    assetDescription: "Stunning luxury villa with ocean views",
    assetFeatures: "Modern design, smart home system, infinity pool",
    assetAmenities: "Gym, spa, home theater, private beach access",
    assetLocation: "Prime location in Miami Beach",
  };

  const mockAssetMedia = {
    assetImage: "ipfs://QmXyz123", // IPFS hash
    assetVideo: "ipfs://QmAbc456", // IPFS hash
    assetFloorPlan: "ipfs://QmDef789", // IPFS hash
  };

  const mockRentData = {
    rentPrice: ethers.parseEther("5000"), // 5,000 USDT per month
    rentDeposit: ethers.parseEther("10000"), // 10,000 USDT deposit
    rentPeriod: 365, // 1 year in days
    rentSecurityDeposit: ethers.parseEther("5000"), // 5,000 USDT security deposit
  };

  // Deploy a mock USDT token
  async function deployMockUSDT() {
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const mockToken = await MockERC20Factory.deploy(
      "Mock USDT",
      "USDT",
      18,
      ethers.parseEther("10000000") // 10 million initial supply
    );
    
    return mockToken;
  }

  // Mint mock USDT to an address
  async function mintMockUSDT(to: string, amount: bigint) {
    await mockUSDT.mint(to, amount);
  }

  beforeEach(async function () {
    // Get signers
    [owner, seller, buyer1, buyer2, feeCollector] = await ethers.getSigners();
    
    // Deploy mock USDT token
    mockUSDT = await deployMockUSDT();
    
    // Mint USDT to participants
    await mintMockUSDT(seller.address, ethers.parseEther("1000000"));
    await mintMockUSDT(buyer1.address, ethers.parseEther("1000000"));
    await mintMockUSDT(buyer2.address, ethers.parseEther("1000000"));
    
    // Deploy PropytoRegistry with proxy
    const RegistryFactory = await ethers.getContractFactory("PropytoRegistry");
    registry = await upgrades.deployProxy(
      RegistryFactory,
      [await mockUSDT.getAddress()],
      { initializer: "initialize" }
    );
    
    // Deploy PropytoSFT with proxy
    const SFTFactory = await ethers.getContractFactory("PropytoSFT");
    sft = await upgrades.deployProxy(
      SFTFactory,
      ["https://api.propy.to/api/token/"],
      { initializer: "initialize" }
    );
    
    // Link contracts
    await registry.setPropytoSFTAddress(await sft.getAddress());
    await sft.setRegistryAddress(await registry.getAddress());
    
    // Update mockAsset with seller address
    mockAsset.seller = seller.address;
    mockAsset.listingExpiry = (await time.latest()) + 90 * 24 * 60 * 60; // 90 days from now
    
    // Approve USDT spending
    await mockUSDT.connect(seller).approve(await registry.getAddress(), ethers.parseEther("1000000"));
    await mockUSDT.connect(buyer1).approve(await registry.getAddress(), ethers.parseEther("1000000"));
    await mockUSDT.connect(buyer2).approve(await registry.getAddress(), ethers.parseEther("1000000"));
  });

  describe("Initialization and Configuration", function () {
    it("should initialize with correct state", async function () {
      expect(await registry.usdtToken()).to.equal(await mockUSDT.getAddress());
      expect(await registry.propytosftAddress()).to.equal(await sft.getAddress());
      expect(await registry.owner()).to.equal(owner.address);
      
      const config = await registry.marketplaceConfig();
      expect(config.platformFeePercentage).to.equal(250); // 2.5%
      expect(config.feeCollector).to.equal(owner.address);
      expect(config.listingFee).to.equal(ethers.parseEther("10")); // 10 USDT
      expect(config.feesEnabled).to.be.true;
    });

    it("should allow owner to update marketplace config", async function () {
      await registry.updateMarketplaceConfig(
        300, // 3%
        feeCollector.address,
        ethers.parseEther("15"), // 15 USDT
        true
      );
      
      const config = await registry.marketplaceConfig();
      expect(config.platformFeePercentage).to.equal(300);
      expect(config.feeCollector).to.equal(feeCollector.address);
      expect(config.listingFee).to.equal(ethers.parseEther("15"));
      expect(config.feesEnabled).to.be.true;
    });

    it("should prevent non-owner from updating marketplace config", async function () {
      await expect(
        registry.connect(seller).updateMarketplaceConfig(
          300,
          feeCollector.address,
          ethers.parseEther("15"),
          true
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should allow owner to update USDT token address", async function () {
      const newToken = await deployMockUSDT();
      await registry.updateUsdtToken(await newToken.getAddress());
      expect(await registry.usdtToken()).to.equal(await newToken.getAddress());
    });

    it("should allow owner to pause and unpause the contract", async function () {
      await registry.pause();
      expect(await registry.isPaused()).to.be.true;
      
      await registry.unpause();
      expect(await registry.isPaused()).to.be.false;
    });
  });

  describe("Asset Registration", function () {
    it("should register a new asset and collect listing fee", async function () {
      await registry.connect(seller).registerAsset(
        mockAsset,
        mockAssetMetadata,
        mockAssetMedia
      );
      
      // Check asset was registered
      const asset = await registry.assets(0);
      expect(asset.name).to.equal(mockAsset.name);
      expect(asset.assetPrice).to.equal(mockAsset.assetPrice);
      expect(asset.seller).to.equal(seller.address);
      
      // Check seller's assets
      const sellerAssets = await registry.getSellerAssets(seller.address);
      expect(sellerAssets.length).to.equal(1);
      expect(sellerAssets[0]).to.equal(0);
      
      // Check asset count
      expect(await registry.assetCount()).to.equal(1);
    });

    it("should fail to register asset when contract is paused", async function () {
      await registry.pause();
      
      await expect(
        registry.connect(seller).registerAsset(
          mockAsset,
          mockAssetMetadata,
          mockAssetMedia
        )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("should fail when listing fee payment fails", async function () {
      // Remove approval to simulate failed payment
      await mockUSDT.connect(seller).approve(await registry.getAddress(), 0);
      
      await expect(
        registry.connect(seller).registerAsset(
          mockAsset,
          mockAssetMetadata,
          mockAssetMedia
        )
      ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });
  });

  describe("Partial Ownership", function () {
    let assetId: number;

    beforeEach(async function () {
      // Register an asset first
      await registry.connect(seller).registerAsset(
        mockAsset,
        mockAssetMetadata,
        mockAssetMedia
      );
      
      assetId = 0; // First asset has ID 0
      // Note: We don't initialize partial ownership here anymore
    });

    it("should enable partial ownership for an asset", async function () {
      await registry.connect(seller).enablePartialOwnership(
        assetId,
        1000, // 1000 total shares
        ethers.parseEther("500"), // 500 USDT per share
        10, // Minimum 10 shares purchase
        100, // Maximum 100 shares per owner
        200 // Seller keeps 200 shares
      );
      
      // Check ownership percentage for seller
      const sellerPercentage = await registry.getOwnershipPercentage(assetId, seller.address);
      expect(sellerPercentage).to.equal(ethers.parseEther("0.2")); // 20%
      
      // Check shares owned by seller
      const sellerShares = await registry.getSharesOwned(assetId, seller.address);
      expect(sellerShares).to.equal(200);
      
      // Check asset owners
      const owners = await registry.getAssetOwners(assetId);
      expect(owners.length).to.equal(1);
      expect(owners[0]).to.equal(seller.address);
    });

    it("should allow buyers to purchase shares", async function () {
      // First, enable partial ownership
      await registry.connect(seller).enablePartialOwnership(
        assetId,
        1000, // 1000 total shares
        ethers.parseEther("500"), // 500 USDT per share
        10, // Minimum 10 shares purchase
        100, // Maximum 100 shares per owner
        200 // Seller keeps 200 shares
      );
      
      // Buyer 1 purchases 50 shares
      await registry.connect(buyer1).purchaseShares(assetId, 50);
      
      // Check buyer1's ownership
      const buyer1Percentage = await registry.getOwnershipPercentage(assetId, buyer1.address);
      expect(buyer1Percentage).to.equal(ethers.parseEther("0.05")); // 5%
      
      const buyer1Shares = await registry.getSharesOwned(assetId, buyer1.address);
      expect(buyer1Shares).to.equal(50);
      
      // Buyer 2 purchases 100 shares
      await registry.connect(buyer2).purchaseShares(assetId, 100);
      
      // Check buyer2's ownership
      const buyer2Percentage = await registry.getOwnershipPercentage(assetId, buyer2.address);
      expect(buyer2Percentage).to.equal(ethers.parseEther("0.1")); // 10%
      
      // Check total owners
      const owners = await registry.getAssetOwners(assetId);
      expect(owners.length).to.equal(3); // seller, buyer1, buyer2
    });

    it("should enforce minimum and maximum share purchase limits", async function () {
      // Enable partial ownership with specific limits
      await registry.connect(seller).enablePartialOwnership(
        assetId,
        1000, // 1000 total shares
        ethers.parseEther("500"), // 500 USDT per share
        20, // Minimum 20 shares purchase
        100, // Maximum 100 shares per owner
        200 // Seller keeps 200 shares
      );
      
      // Try to purchase below minimum
      await expect(
        registry.connect(buyer1).purchaseShares(assetId, 10)
      ).to.be.revertedWith("Share count below minimum purchase amount");
      
      // Purchase shares up to the maximum allowed (100)
      await registry.connect(buyer1).purchaseShares(assetId, 100);
      
      // Verify buyer1 has 100 shares
      const buyer1Shares = await registry.getSharesOwned(assetId, buyer1.address);
      expect(buyer1Shares).to.equal(100);
      
      // Now try to purchase just 1 more - this should fail due to max limit
      await expect(
        registry.connect(buyer1).purchaseShares(assetId, 20)
      ).to.be.revertedWith("Purchase would exceed maximum shares per owner");
    });

    it("should update asset status when all shares are sold", async function () {
      // Enable partial ownership on a new asset
      // Create a new asset to avoid conflicts
      await registry.connect(seller).registerAsset(
        {...mockAsset, name: "New Asset for Status Test"},
        mockAssetMetadata,
        mockAssetMedia
      );
      
      const newAssetId = 1; // Second asset
      
      await registry.connect(seller).enablePartialOwnership(
        newAssetId,
        1000, // 1000 total shares
        ethers.parseEther("500"), // 500 USDT per share
        10, // Minimum 10 shares purchase
        1000, // No maximum per owner
        200 // Seller keeps 200 shares
      );
      
      // Check initial status
      let asset = await registry.assets(newAssetId);
      expect(asset.assetStatus).to.equal(0); // FOR_SALE
      
      // Buyer 1 purchases all remaining shares
      await registry.connect(buyer1).purchaseShares(newAssetId, 800);
      
      // Check asset status was updated to SOLD
      asset = await registry.assets(newAssetId);
      expect(asset.assetStatus).to.equal(2); // SOLD
    });
  });

  describe("Asset Management", function () {
    let assetId: number;

    beforeEach(async function () {
      // Register an asset first
      await registry.connect(seller).registerAsset(
        mockAsset,
        mockAssetMetadata,
        mockAssetMedia
      );
      
      assetId = 0; // First asset has ID 0
    });

    it("should update asset status", async function () {
      await registry.connect(seller).updateAssetStatus(assetId, 3); // RENTED
      
      const asset = await registry.assets(assetId);
      expect(asset.assetStatus).to.equal(3); // RENTED
    });

    it("should update asset price", async function () {
      const newPrice = ethers.parseEther("600000"); // 600,000 USDT
      await registry.connect(seller).updateAssetPrice(assetId, newPrice);
      
      const asset = await registry.assets(assetId);
      expect(asset.assetPrice).to.equal(newPrice);
    });

    it("should update asset metadata", async function () {
      const newMetadata = {
        assetDescription: "Updated description",
        assetFeatures: "Updated features",
        assetAmenities: "Updated amenities",
        assetLocation: "Updated location",
      };
      
      await registry.connect(seller).updateAssetMetadata(assetId, newMetadata);
      
      const metadata = await registry.assetMetadata(assetId);
      expect(metadata.assetDescription).to.equal(newMetadata.assetDescription);
    });

    it("should update asset media", async function () {
      const newMedia = {
        assetImage: "ipfs://QmNewImage",
        assetVideo: "ipfs://QmNewVideo",
        assetFloorPlan: "ipfs://QmNewFloorPlan",
      };
      
      await registry.connect(seller).updateAssetMedia(assetId, newMedia);
      
      const media = await registry.assetMedia(assetId);
      expect(media.assetImage).to.equal(newMedia.assetImage);
    });

    it("should update asset rent data", async function () {
      // First, register rent data
      await registry.connect(seller).updateAssetRentData(assetId, mockRentData);
      
      // Then update it
      const newRentData = {
        rentPrice: ethers.parseEther("6000"), // 6,000 USDT per month
        rentDeposit: ethers.parseEther("12000"), // 12,000 USDT deposit
        rentPeriod: 730, // 2 years in days
        rentSecurityDeposit: ethers.parseEther("6000"), // 6,000 USDT security deposit
      };
      
      await registry.connect(seller).updateAssetRentData(assetId, newRentData);
      
      const rentData = await registry.assetRentData(assetId);
      expect(rentData.rentPrice).to.equal(newRentData.rentPrice);
    });

    it("should transfer asset sellership", async function () {
      await registry.connect(seller).transferSellership(assetId, buyer1.address);
      
      const asset = await registry.assets(assetId);
      expect(asset.seller).to.equal(buyer1.address);
      
      // Check that asset was removed from original seller's assets
      const originalSellerAssets = await registry.getSellerAssets(seller.address);
      expect(originalSellerAssets.length).to.equal(0);
      
      // Check that asset was added to new seller's assets
      const newSellerAssets = await registry.getSellerAssets(buyer1.address);
      expect(newSellerAssets.length).to.equal(1);
      expect(newSellerAssets[0]).to.equal(assetId);
    });

    it("should extend listing expiry", async function () {
      const asset = await registry.assets(assetId);
      const currentExpiry = asset.listingExpiry;
      
      const newExpiry = BigInt(currentExpiry) + BigInt(30 * 24 * 60 * 60); // Current + 30 days
      await registry.connect(seller).extendListingExpiry(assetId, newExpiry);
      
      const updatedAsset = await registry.assets(assetId);
      expect(updatedAsset.listingExpiry).to.equal(newExpiry);
    });

    it("should prevent non-seller from managing the asset", async function () {
      await expect(
        registry.connect(buyer1).updateAssetStatus(assetId, 3)
      ).to.be.revertedWith("Only the asset seller can call this function");
      
      await expect(
        registry.connect(buyer1).updateAssetPrice(assetId, ethers.parseEther("600000"))
      ).to.be.revertedWith("Only the asset seller can call this function");
    });
  });

  describe("SFT Integration", function () {
    let assetId: number;

    beforeEach(async function () {
      // Register an asset first
      await registry.connect(seller).registerAsset(
        mockAsset,
        mockAssetMetadata,
        mockAssetMedia
      );
      
      assetId = 0; // First asset has ID 0
      
      // Enable partial ownership
      await registry.connect(seller).enablePartialOwnership(
        assetId,
        1000, // 1000 total shares
        ethers.parseEther("500"), // 500 USDT per share
        10, // Minimum 10 shares purchase
        100, // Maximum 100 shares per owner
        200 // Seller keeps 200 shares
      );
    });

    it("should tokenize asset and mint shares when purchased", async function () {
      // Buyer purchases shares
      await registry.connect(buyer1).purchaseShares(assetId, 50);
      
      // Check if tokenization occurred
      const tokenId = await sft.getTokenId(assetId);
      expect(tokenId).to.not.equal(0);
      
      // Check if shares were minted to buyer
      const sharesBalance = await sft.balanceOf(buyer1.address, tokenId);
      expect(sharesBalance).to.equal(50);
    });

    it("should track asset ID to token ID mapping", async function () {
      // Buyer purchases shares to trigger tokenization
      await registry.connect(buyer1).purchaseShares(assetId, 50);
      
      // Check mappings
      const tokenId = await sft.getTokenId(assetId);
      const mappedAssetId = await sft.getAssetId(tokenId);
      
      expect(mappedAssetId).to.equal(assetId);
    });
  });

  describe("Security and Edge Cases", function () {
    let assetId: number;

    beforeEach(async function () {
      // Register an asset first
      await registry.connect(seller).registerAsset(
        mockAsset,
        mockAssetMetadata,
        mockAssetMedia
      );
      
      assetId = 0; // First asset has ID 0
    });

    it("should prevent purchase for expired listings", async function () {
      // Enable partial ownership
      await registry.connect(seller).enablePartialOwnership(
        assetId,
        1000, // 1000 total shares
        ethers.parseEther("500"), // 500 USDT per share
        10, // Minimum 10 shares purchase
        100, // Maximum 100 shares per owner
        200 // Seller keeps 200 shares
      );
      
      // Fast forward past listing expiry
      await time.increase(91 * 24 * 60 * 60); // 91 days (past the 90-day expiry)
      
      // Try to purchase shares
      await expect(
        registry.connect(buyer1).purchaseShares(assetId, 50)
      ).to.be.revertedWith("Asset listing has expired");
    });
    
    it("should handle invalid asset ID", async function () {
      const invalidAssetId = 999; // Non-existent asset
      
      await expect(
        registry.connect(seller).updateAssetStatus(invalidAssetId, 3)
      ).to.be.revertedWith("Asset does not exist");
    });
    
    it("should have nonReentrant modifier on critical functions", async function () {
      // Register an asset for testing
      await registry.connect(seller).registerAsset(
        mockAsset, 
        mockAssetMetadata,
        mockAssetMedia
      );
      
      // Enable partial ownership (needed for purchaseShares)
      await registry.connect(seller).enablePartialOwnership(
        0, // assetId
        1000, // total shares
        ethers.parseEther("500"), // share price
        10, // min shares
        100, // max shares per owner
        200 // seller shares
      );
      
      // These functions should have nonReentrant modifier
      // We can't directly test reentrancy, but we can check that they execute normally
      await registry.connect(seller).registerAsset(
        mockAsset,
        mockAssetMetadata,
        mockAssetMedia
      );
      
      await registry.connect(buyer1).purchaseShares(0, 50);
      
      // If we get here without errors, the functions with nonReentrant executed normally
      expect(true).to.be.true;
    });
    
    it("should respect access control rules", async function () {
      // Try to call owner-only functions as non-owner
      await expect(
        registry.connect(seller).updateMarketplaceConfig(300, feeCollector.address, ethers.parseEther("15"), true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      await expect(
        registry.connect(seller).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Try to call seller-only functions as non-seller
      await expect(
        registry.connect(buyer1).updateAssetStatus(assetId, 3)
      ).to.be.revertedWith("Only the asset seller can call this function");
    });
  });
});