import { ethers } from "hardhat";
import * as readline from "readline";
import { parseUnits, formatUnits } from "ethers";
import { PropytoRegistry } from "../typechain-types";
import config from "./config.json";

// Create an interface for reading user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt function that returns a promise
const prompt = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(`${question}: `, (answer) => {
      resolve(answer);
    });
  });
};

// Enums from the contract
enum AssetType {
  RESIDENTIAL = 0,
  COMMERCIAL = 1,
  LAND = 2,
  OTHER = 3
}

enum ResidentialType {
  NONE = 0,
  APARTMENT = 1,
  FARMHOUSE = 2,
  VILLA = 3,
  BUNGALOW = 4,
  OTHER = 5
}

enum CommercialType {
  NONE = 0,
  SHOP = 1,
  OFFICE = 2,
  GODOWN = 3,
  OTHER = 4
}

enum LandType {
  NONE = 0,
  PLOT = 1,
  FARMS = 2,
  OTHER = 3
}

enum AssetStatus {
  FOR_SALE = 0,
  FOR_RENT = 1,
  SOLD = 2,
  RENTED = 3,
  DELISTED = 4,
  OTHER = 5
}

enum AssetFurnishing {
  UNFURNISHED = 0,
  PARTIALLY_FURNISHED = 1,
  FULLY_FURNISHED = 2,
  OTHER = 3
}

enum AssetZone {
  INDUSTRIAL = 0,
  COMMERCIAL = 1,
  RESIDENTIAL = 2,
  LAND = 3,
  OTHER = 4
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Running with the account: ${deployer.address}`);

  // Get the registry contract address
  // const registryAddress = await prompt("Enter the PropytoRegistry contract address");
  
  // Get the PropytoRegistry contract
  const PropytoRegistryFactory = await ethers.getContractFactory("PropytoRegistry")
  const registry = PropytoRegistryFactory.attach(config.registryAddress) as PropytoRegistry;

  console.log("\n--- Asset Details ---");
  
  // Basic Asset Information
  const name = await prompt("Asset name");
  
  console.log("\nSelect Asset Type:");
  console.log("0 - RESIDENTIAL");
  console.log("1 - COMMERCIAL");
  console.log("2 - LAND");
  console.log("3 - OTHER");
  const assetTypeInput = await prompt("Asset type (default: 0)");
  const assetType = assetTypeInput === "" ? AssetType.RESIDENTIAL : parseInt(assetTypeInput);
  
  // Different prompts based on asset type
  let assetSubType = 0;
  if (assetType === AssetType.RESIDENTIAL) {
    console.log("\nSelect Residential Type:");
    console.log("1 - APARTMENT");
    console.log("2 - FARMHOUSE");
    console.log("3 - VILLA");
    console.log("4 - BUNGALOW");
    console.log("5 - OTHER");
    const subTypeInput = await prompt("Residential type (default: 1)");
    assetSubType = subTypeInput === "" ? ResidentialType.APARTMENT : parseInt(subTypeInput);
  } else if (assetType === AssetType.COMMERCIAL) {
    console.log("\nSelect Commercial Type:");
    console.log("1 - SHOP");
    console.log("2 - OFFICE");
    console.log("3 - GODOWN");
    console.log("4 - OTHER");
    const subTypeInput = await prompt("Commercial type (default: 1)");
    assetSubType = subTypeInput === "" ? CommercialType.SHOP : parseInt(subTypeInput);
  } else if (assetType === AssetType.LAND) {
    console.log("\nSelect Land Type:");
    console.log("1 - PLOT");
    console.log("2 - FARMS");
    console.log("3 - OTHER");
    const subTypeInput = await prompt("Land type (default: 1)");
    assetSubType = subTypeInput === "" ? LandType.PLOT : parseInt(subTypeInput);
  }
  
  console.log("\nSelect Asset Status:");
  console.log("0 - FOR_SALE");
  console.log("1 - FOR_RENT");
  const statusInput = await prompt("Asset status (default: 0)");
  const assetStatus = statusInput === "" ? AssetStatus.FOR_SALE : parseInt(statusInput);
  
  console.log("\nSelect Asset Furnishing:");
  console.log("0 - UNFURNISHED");
  console.log("1 - PARTIALLY_FURNISHED");
  console.log("2 - FULLY_FURNISHED");
  console.log("3 - OTHER");
  const furnishingInput = await prompt("Asset furnishing (default: 0)");
  const assetFurnishing = furnishingInput === "" ? AssetFurnishing.UNFURNISHED : parseInt(furnishingInput);
  
  console.log("\nSelect Asset Zone:");
  console.log("0 - INDUSTRIAL");
  console.log("1 - COMMERCIAL");
  console.log("2 - RESIDENTIAL");
  console.log("3 - LAND");
  console.log("4 - OTHER");
  const zoneInput = await prompt("Asset zone (default matches asset type)");
  const assetZone = zoneInput === "" ? assetType : parseInt(zoneInput);
  
  // Asset pricing and specifications
  const priceInput = await prompt("Asset price in USDT (default: 10000)");
  const assetPrice = priceInput === "" ? 
    parseUnits("10000", 18) : 
    parseUnits(priceInput, 18);
  
  const areaInput = await prompt("Asset area in square feet (default: 1000)");
  const assetArea = areaInput === "" ? 1000 : parseInt(areaInput);
  
  const ageInput = await prompt("Asset age in days (default: 365)");
  const assetAge = ageInput === "" ? 365 : parseInt(ageInput);
  
  // JSON details - can be extended based on requirements
  const locationInput = await prompt("Asset location (city, state, country)");
  const bedroomsInput = await prompt("Number of bedrooms (if applicable)");
  const bathroomsInput = await prompt("Number of bathrooms (if applicable)");
  
  // Creating JSON for other details
  const assetOtherDetails = JSON.stringify({
    location: locationInput || "Not specified",
    bedrooms: bedroomsInput || "N/A",
    bathrooms: bathroomsInput || "N/A",
    subType: assetSubType
  });
  
  // Asset flags
  const isRentableInput = await prompt("Is asset rentable? (yes/no, default: yes)");
  const isRentable = isRentableInput.toLowerCase() !== "no";
  
  const isSellableInput = await prompt("Is asset sellable? (yes/no, default: yes)");
  const isSellable = isSellableInput.toLowerCase() !== "no";
  
  const isPartiallyOwnEnabledInput = await prompt("Enable partial ownership? (yes/no, default: no)");
  const isPartiallyOwnEnabled = isPartiallyOwnEnabledInput.toLowerCase() === "yes";
  
  // Listing expiry (default to 90 days from now)
  const expiryDaysInput = await prompt("Listing expiry in days (default: 90)");
  const expiryDays = expiryDaysInput === "" ? 90 : parseInt(expiryDaysInput);
  const listingExpiry = Math.floor(Date.now() / 1000) + (expiryDays * 86400); // Convert to Unix timestamp
  
  console.log("\n--- Asset Metadata ---");
  const assetDescription = await prompt("Asset description");
  const assetFeatures = await prompt("Asset features (comma separated)");
  const assetAmenities = await prompt("Asset amenities (comma separated)");
  const assetLocation = await prompt("Detailed asset location/address");
  
  console.log("\n--- Asset Media ---");
  const assetImage = await prompt("Asset image IPFS hash (default: empty)");
  const assetVideo = await prompt("Asset video IPFS hash (default: empty)");
  const assetFloorPlan = await prompt("Asset floor plan IPFS hash (default: empty)");
  
  // Create asset object
  const asset = {
    name,
    assetType,
    assetAddress: ethers.ZeroAddress, // Using ethers v6 ZeroAddress
    assetStatus,
    assetFurnishing,
    assetZone,
    assetPrice,
    assetArea,
    assetAge,
    assetOtherDetails,
    isRentable,
    isSellable,
    isPartiallyOwnEnabled,
    seller: deployer.address, // This will be overwritten by the contract
    listingExpiry
  };
  
  // Create metadata object
  const metadata = {
    assetDescription: assetDescription || "No description provided",
    assetFeatures: assetFeatures || "",
    assetAmenities: assetAmenities || "",
    assetLocation: assetLocation || "Location not specified"
  };
  
  // Create media object
  const media = {
    assetImage: assetImage || "",
    assetVideo: assetVideo || "",
    assetFloorPlan: assetFloorPlan || ""
  };
  
  // Display summary
  console.log("\n--- Asset Registration Summary ---");
  console.log(`Name: ${name}`);
  console.log(`Asset Type: ${AssetType[assetType]}`);
  console.log(`Asset Status: ${AssetStatus[assetStatus]}`);
  console.log(`Price: ${formatUnits(assetPrice, 18)} USDT`);
  console.log(`Area: ${assetArea} sqft`);
  console.log(`Listing Expiry: ${new Date(listingExpiry * 1000).toLocaleDateString()}`);
  
  // Confirm registration
  const confirmInput = await prompt("\nConfirm asset registration? (yes/no)");
  if (confirmInput.toLowerCase() !== "yes") {
    console.log("Asset registration cancelled");
    rl.close();
    return;
  }
  
  console.log("\nRegistering asset on the blockchain...");
  
  try {
    // First, check if we need to approve USDT for the listing fee
    const usdtAddress = await registry.usdtToken();
    const marketplaceConfig = await registry.marketplaceConfig();
    
    if (marketplaceConfig.feesEnabled && marketplaceConfig.listingFee > 0n) {
      console.log(`Approving ${formatUnits(marketplaceConfig.listingFee, 18)} USDT for listing fee...`);
      
      // Get USDT contract
      const usdtAbi = [
        "function approve(address spender, uint256 amount) external returns (bool)"
      ];
      const usdt = new ethers.Contract(usdtAddress, usdtAbi, deployer);
      
      // Approve the listing fee
      const approveTx = await usdt.approve(config.registryAddress, marketplaceConfig.listingFee);
      await approveTx.wait();
      console.log("Approval confirmed!");
    }
    
    // Register the asset
    const tx = await registry.registerAsset(asset, metadata, media);
    console.debug(tx.hash)
    const receipt = await tx.wait();
    
    // Parse logs from receipt
    let assetRegisteredEvents: Array<{
      name: string;
      args: {
        assetId: bigint;
        name: string;
        registeredBy: string;
        seller: string;
        propytosftAddress: string;
      };
    }> = [];
    
    if (receipt && receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsedLog = registry.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === "AssetRegistered") {
            assetRegisteredEvents.push(parsedLog as any);
          }
        } catch (e) {
          console.debug(e)
          // Skip logs that can't be parsed
        }
      }
    }
    
    if (assetRegisteredEvents && assetRegisteredEvents.length > 0) {
      const assetId = assetRegisteredEvents[0].args.assetId;
      console.log(`\nAsset successfully registered with ID: ${assetId}`);
      console.log(`SFT Token Address: ${assetRegisteredEvents[0].args.propytosftAddress}`);
      
      // If partial ownership is enabled, prompt for that setup
      if (isPartiallyOwnEnabled) {
        console.log("\n--- Partial Ownership Setup ---");
        
        const totalSharesInput = await prompt("Total number of shares (default: 1000)");
        const totalShares = totalSharesInput === "" ? 1000 : parseInt(totalSharesInput);
        
        const sharePriceInput = await prompt("Price per share in USDT (default: asset price / total shares)");
        const defaultSharePrice = assetPrice / BigInt(totalShares);
        const sharePrice = sharePriceInput === "" ? 
          defaultSharePrice : 
          parseUnits(sharePriceInput, 18);
        
        const minSharePurchaseInput = await prompt("Minimum shares per purchase (default: 1)");
        const minSharePurchase = minSharePurchaseInput === "" ? 1 : parseInt(minSharePurchaseInput);
        
        const maxSharesPerOwnerInput = await prompt("Maximum shares per owner (default: no limit)");
        const maxSharesPerOwner = maxSharesPerOwnerInput === "" ? totalShares : parseInt(maxSharesPerOwnerInput);
        
        const sellerSharesInput = await prompt("Shares retained by seller (default: 0)");
        const sellerShares = sellerSharesInput === "" ? 0 : parseInt(sellerSharesInput);
        
        // Now enable partial ownership
        console.log("\nEnabling partial ownership...");
        
        try {
          const tx = await registry.enablePartialOwnership(
            assetId,
            totalShares,
            sharePrice,
            minSharePurchase,
            maxSharesPerOwner,
            sellerShares
          );
          await tx.wait();
          console.log("Partial ownership enabled successfully!");
        } catch (error) {
          console.error("Failed to enable partial ownership:", error);
        }
      }
    } else {
      console.log("\nAsset registered, but could not retrieve the asset ID from events");
    }
    
  } catch (error: any) {
    console.error("Error registering asset:", error, error?.stack);
  }
  
  rl.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 