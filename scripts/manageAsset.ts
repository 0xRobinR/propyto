import { ethers } from "hardhat";
import * as readline from "readline";
import { parseUnits, formatUnits, Signer, Contract } from "ethers";
import { PropytoRegistry } from "../typechain-types";
import chalk from "chalk";
import Table from "cli-table3";

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

// ==================== Asset Type Definitions ====================

// Enum mappings from the contract
enum AssetType {
  RESIDENTIAL = 0,
  COMMERCIAL = 1,
  LAND = 2,
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

// Define interfaces that match the contract structs
interface IPropytoAsset {
  name: string;
  assetType: number;
  assetAddress: string;
  assetStatus: number;
  assetFurnishing: number;
  assetZone: number;
  assetPrice: bigint;
  assetArea: number;
  assetAge: number;
  assetOtherDetails: string;
  isRentable: boolean;
  isSellable: boolean;
  isPartiallyOwnEnabled: boolean;
  seller: string;
  listingExpiry: bigint;
}

interface IPropytoAssetMetadata {
  assetDescription: string;
  assetFeatures: string;
  assetAmenities: string;
  assetLocation: string;
}

interface IPropytoAssetMedia {
  assetImage: string;
  assetVideo: string;
  assetFloorPlan: string;
}

interface IAssetDetails {
  asset: IPropytoAsset;
  metadata: IPropytoAssetMetadata;
  media: IPropytoAssetMedia;
  otherDetails: Record<string, any>;
}

interface IAssetListItem extends IAssetDetails {
  id: bigint;
}

interface IPartialOwnershipInfo {
  totalShares: bigint;
  availableShares: bigint;
  sharePrice: bigint;
  minSharePurchase: bigint;
  maxSharesPerOwner: bigint;
  owners: string[];
  sharesByOwner: Record<string, bigint>; // Map of owner address to their share count
}

// ==================== Helper Functions ====================

// Function to format a BigInt price to a readable string
function formatPrice(priceWei: bigint): string {
  return formatUnits(priceWei, 18);
}

// Format asset type for display
function formatAssetType(type: number): string {
  return AssetType[type] || "Unknown";
}

// Format asset status for display
function formatAssetStatus(status: number): string {
  return AssetStatus[status] || "Unknown";
}

// Get detailed asset information
async function getAssetDetails(registry: PropytoRegistry, assetId: bigint): Promise<IAssetDetails | null> {
  try {
    // Fetch raw data from the blockchain
    const assetRaw = await registry.assets(assetId);
    const metadataRaw = await registry.assetMetadata(assetId);
    const mediaRaw = await registry.assetMedia(assetId);
    
    // Map raw asset data to structured object (PropytoAsset struct)
    const asset: IPropytoAsset = {
      name: assetRaw.name,
      assetType: Number(assetRaw.assetType),
      assetAddress: assetRaw.assetAddress,
      assetStatus: Number(assetRaw.assetStatus),
      assetFurnishing: Number(assetRaw.assetFurnishing),
      assetZone: Number(assetRaw.assetZone),
      assetPrice: assetRaw.assetPrice,
      assetArea: Number(assetRaw.assetArea),
      assetAge: Number(assetRaw.assetAge),
      assetOtherDetails: assetRaw.assetOtherDetails,
      isRentable: assetRaw.isRentable,
      isSellable: assetRaw.isSellable,
      isPartiallyOwnEnabled: assetRaw.isPartiallyOwnEnabled,
      seller: assetRaw.seller,
      listingExpiry: assetRaw.listingExpiry
    };
    
    // Map raw metadata to structured object (PropytoAssetMetadata struct)
    const metadata: IPropytoAssetMetadata = {
      assetDescription: metadataRaw.assetDescription,
      assetFeatures: metadataRaw.assetFeatures,
      assetAmenities: metadataRaw.assetAmenities,
      assetLocation: metadataRaw.assetLocation
    };
    
    // Map raw media data to structured object (PropytoAssetMedia struct)
    const media: IPropytoAssetMedia = {
      assetImage: mediaRaw.assetImage,
      assetVideo: mediaRaw.assetVideo,
      assetFloorPlan: mediaRaw.assetFloorPlan
    };
    
    // Parse JSON other details if available
    let otherDetails: Record<string, any> = {};
    try {
      otherDetails = JSON.parse(asset.assetOtherDetails);
    } catch {
      // If not valid JSON, use as is
      otherDetails = { raw: asset.assetOtherDetails };
    }
    
    return {
      asset,
      metadata,
      media,
      otherDetails
    };
  } catch (error) {
    console.error(`Error retrieving asset ${assetId} details:`, error);
    return null;
  }
}

// Display a single asset's full details
function displayAssetDetails(
  asset: IPropytoAsset, 
  metadata: IPropytoAssetMetadata, 
  media: IPropytoAssetMedia, 
  otherDetails: Record<string, any>
): void {
  console.log(chalk.bold("\n============================================"));
  console.log(chalk.bold.green(`ASSET: ${asset.name}`));
  console.log(chalk.bold("============================================"));
  
  console.log(chalk.bold("\n📋 Basic Information:"));
  console.log(`🏠 Type: ${formatAssetType(asset.assetType)}`);
  console.log(`🔖 Status: ${formatAssetStatus(asset.assetStatus)}`);
  console.log(`💰 Price: ${formatPrice(asset.assetPrice)} USDT`);
  console.log(`📏 Area: ${asset.assetArea} sq ft`);
  console.log(`🕒 Age: ${asset.assetAge} days`);
  console.log(`📅 Listing Expires: ${new Date(Number(asset.listingExpiry) * 1000).toLocaleDateString()}`);
  
  console.log(chalk.bold("\n📝 Description:"));
  console.log(metadata.assetDescription);
  
  console.log(chalk.bold("\n✨ Features:"));
  const features = metadata.assetFeatures.split(",").filter((f: string) => f.trim());
  if (features.length > 0) {
    features.forEach((feature: string) => console.log(`• ${feature.trim()}`));
  } else {
    console.log("No features listed");
  }
  
  console.log(chalk.bold("\n🏙️ Location:"));
  console.log(metadata.assetLocation);
  
  console.log(chalk.bold("\n📸 Media:"));
  if (media.assetImage) console.log(`Image: ${media.assetImage}`);
  if (media.assetVideo) console.log(`Video: ${media.assetVideo}`);
  if (media.assetFloorPlan) console.log(`Floor Plan: ${media.assetFloorPlan}`);
  
  if (otherDetails && Object.keys(otherDetails).length > 0) {
    console.log(chalk.bold("\n🔍 Additional Details:"));
    for (const [key, value] of Object.entries(otherDetails)) {
      if (key !== "raw") {
        console.log(`${key}: ${value}`);
      }
    }
  }
  
  console.log(chalk.bold("\n🔗 Blockchain Info:"));
  console.log(`Seller: ${asset.seller}`);
  console.log(`Partially Ownable: ${asset.isPartiallyOwnEnabled ? "Yes" : "No"}`);
  console.log(`Rentable: ${asset.isRentable ? "Yes" : "No"}`);
  console.log(`Sellable: ${asset.isSellable ? "Yes" : "No"}`);
}

// Display a list of assets in a table format
function displayAssetsList(assets: Array<IAssetListItem>): void {
  if (assets.length === 0) {
    console.log(chalk.yellow("\nNo assets found."));
    return;
  }
  
  const table = new Table({
    head: [
      chalk.cyan('ID'), 
      chalk.cyan('Name'), 
      chalk.cyan('Type'),
      chalk.cyan('Price (USDT)'),
      chalk.cyan('Status'),
      chalk.cyan('Expires')
    ],
    colWidths: [8, 30, 15, 15, 15, 15]
  });
  
  assets.forEach(asset => {
    // Using any to avoid type mismatches with cli-table3
    (table as any).push([
      asset.id.toString(),
      asset.asset.name.length > 28 ? asset.asset.name.substring(0, 25) + '...' : asset.asset.name,
      formatAssetType(asset.asset.assetType),
      formatPrice(asset.asset.assetPrice),
      formatAssetStatus(asset.asset.assetStatus),
      new Date(Number(asset.asset.listingExpiry) * 1000).toLocaleDateString()
    ]);
  });
  
  console.log(table.toString());
}

// Fetch and display partial ownership information for an asset
async function getPartialOwnershipInfo(
  registry: PropytoRegistry, 
  assetId: bigint
): Promise<IPartialOwnershipInfo | null> {
  try {
    // Get ownership information
    // Note: This is a simplified version. In a real implementation, you'd need contract methods
    // to get this information, as mapping data inside structs can't be directly accessed.
    
    // For now, we'll create a placeholder function until the contract provides this
    const isPartialOwnershipEnabled = (await registry.assets(assetId)).isPartiallyOwnEnabled;
    
    if (!isPartialOwnershipEnabled) {
      return null;
    }
    
    // Placeholder for partial ownership data
    // In a real implementation, you'd call contract methods to retrieve this data
    return {
      totalShares: 1000n,
      availableShares: 500n,
      sharePrice: (await registry.assets(assetId)).assetPrice / 1000n,
      minSharePurchase: 1n,
      maxSharesPerOwner: 200n,
      owners: [(await registry.assets(assetId)).seller],
      sharesByOwner: {
        [(await registry.assets(assetId)).seller]: 500n
      }
    };
  } catch (error) {
    console.error(`Error retrieving partial ownership data for asset ${assetId}:`, error);
    return null;
  }
}

// Display partial ownership information
function displayPartialOwnershipInfo(ownershipInfo: IPartialOwnershipInfo): void {
  console.log(chalk.bold("\n🔄 Partial Ownership Information:"));
  console.log(`Total Shares: ${ownershipInfo.totalShares.toString()}`);
  console.log(`Available Shares: ${ownershipInfo.availableShares.toString()}`);
  console.log(`Share Price: ${formatPrice(ownershipInfo.sharePrice)} USDT`);
  console.log(`Minimum Purchase: ${ownershipInfo.minSharePurchase.toString()} shares`);
  console.log(`Maximum Per Owner: ${ownershipInfo.maxSharesPerOwner.toString()} shares`);
  
  console.log(chalk.bold("\n👥 Current Owners:"));
  if (ownershipInfo.owners.length === 0) {
    console.log("No owners yet");
  } else {
    const ownerTable = new Table({
      head: [
        chalk.cyan('Owner Address'),
        chalk.cyan('Shares'),
        chalk.cyan('Percentage')
      ],
      colWidths: [45, 15, 15]
    });
    
    ownershipInfo.owners.forEach(owner => {
      const shares = ownershipInfo.sharesByOwner[owner] || 0n;
      const percentage = Number(shares * 10000n / ownershipInfo.totalShares) / 100;
      
      // Using any to avoid type mismatches with cli-table3
      (ownerTable as any).push([
        owner,
        shares.toString(),
        `${percentage.toFixed(2)}%`
      ]);
    });
    
    console.log(ownerTable.toString());
  }
}

// Display the main menu
async function displayMenu(): Promise<string> {
  console.log(chalk.bold("\n🔍 ASSET MANAGEMENT OPTIONS:"));
  console.log("1. View my assets");
  console.log("2. Update asset details");
  console.log("3. Update asset price");
  console.log("4. Update asset status");
  console.log("5. Update asset metadata");
  console.log("6. Update asset media");
  console.log("7. Manage partial ownership");
  console.log("8. Transfer asset ownership");
  console.log("9. Exit");
  
  return await prompt(chalk.green("Enter your choice (1-9)"));
}

// Update asset price
async function updateAssetPrice(
  registry: PropytoRegistry,
  assetId: bigint,
  owner: Signer
): Promise<boolean> {
  try {
    const assetDetails = await getAssetDetails(registry, assetId);
    if (!assetDetails) {
      console.log(chalk.red("Asset not found."));
      return false;
    }

    const currentPrice = assetDetails.asset.assetPrice;
    console.log(`Current price: ${formatPrice(currentPrice)} USDT`);
    
    const newPriceInput = await prompt("Enter new price in USDT");
    if (!newPriceInput.trim()) {
      console.log(chalk.yellow("Price update cancelled."));
      return false;
    }
    
    const newPrice = parseUnits(newPriceInput, 18);
    
    const confirmUpdate = await prompt(chalk.yellow(`Confirm price update from ${formatPrice(currentPrice)} to ${formatPrice(newPrice)}? (yes/no)`));
    if (confirmUpdate.toLowerCase() !== "yes") {
      console.log("Price update cancelled.");
      return false;
    }
    
    console.log("Updating asset price...");
    const tx = await registry.updateAssetPrice(assetId, newPrice);
    await tx.wait();
    
    console.log(chalk.green("\n✅ Asset price updated successfully!"));
    return true;
  } catch (error) {
    console.error("Error updating asset price:", error);
    return false;
  }
}

// Update asset status
async function updateAssetStatus(
  registry: PropytoRegistry,
  assetId: bigint,
  owner: Signer
): Promise<boolean> {
  try {
    const assetDetails = await getAssetDetails(registry, assetId);
    if (!assetDetails) {
      console.log(chalk.red("Asset not found."));
      return false;
    }

    const currentStatus = assetDetails.asset.assetStatus;
    console.log(`Current status: ${formatAssetStatus(currentStatus)}`);
    
    console.log("\nSelect new status:");
    console.log("0 - FOR_SALE");
    console.log("1 - FOR_RENT");
    console.log("2 - SOLD");
    console.log("3 - RENTED");
    console.log("4 - DELISTED");
    console.log("5 - OTHER");
    
    const newStatusInput = await prompt("Enter new status (0-5)");
    if (!newStatusInput.trim()) {
      console.log(chalk.yellow("Status update cancelled."));
      return false;
    }
    
    const newStatus = parseInt(newStatusInput);
    if (isNaN(newStatus) || newStatus < 0 || newStatus > 5) {
      console.log(chalk.red("Invalid status selection."));
      return false;
    }
    
    const confirmUpdate = await prompt(chalk.yellow(`Confirm status update from ${formatAssetStatus(currentStatus)} to ${formatAssetStatus(newStatus)}? (yes/no)`));
    if (confirmUpdate.toLowerCase() !== "yes") {
      console.log("Status update cancelled.");
      return false;
    }
    
    console.log("Updating asset status...");
    const tx = await (registry as any).updateAssetStatus(assetId, newStatus);
    await tx.wait();
    
    console.log(chalk.green("\n✅ Asset status updated successfully!"));
    return true;
  } catch (error) {
    console.error("Error updating asset status:", error);
    return false;
  }
}

// Update asset metadata
async function updateAssetMetadata(
  registry: PropytoRegistry,
  assetId: bigint,
  owner: Signer
): Promise<boolean> {
  try {
    const assetDetails = await getAssetDetails(registry, assetId);
    if (!assetDetails) {
      console.log(chalk.red("Asset not found."));
      return false;
    }

    console.log(chalk.cyan("\n--- Current Metadata ---"));
    console.log(`Description: ${assetDetails.metadata.assetDescription}`);
    console.log(`Features: ${assetDetails.metadata.assetFeatures}`);
    console.log(`Amenities: ${assetDetails.metadata.assetAmenities}`);
    console.log(`Location: ${assetDetails.metadata.assetLocation}`);
    
    console.log(chalk.cyan("\n--- Update Metadata ---"));
    console.log(chalk.yellow("(Press Enter to keep current value)"));
    
    const description = await prompt("Description");
    const features = await prompt("Features (comma separated)");
    const amenities = await prompt("Amenities (comma separated)");
    const location = await prompt("Location");
    
    // If no changes were made, exit
    if (!description && !features && !amenities && !location) {
      console.log(chalk.yellow("No changes made to metadata."));
      return false;
    }
    
    // Create updated metadata object, keeping existing values if not changed
    const newMetadata = {
      assetDescription: description || assetDetails.metadata.assetDescription,
      assetFeatures: features || assetDetails.metadata.assetFeatures,
      assetAmenities: amenities || assetDetails.metadata.assetAmenities,
      assetLocation: location || assetDetails.metadata.assetLocation
    };
    
    const confirmUpdate = await prompt(chalk.yellow("Confirm metadata update? (yes/no)"));
    if (confirmUpdate.toLowerCase() !== "yes") {
      console.log("Metadata update cancelled.");
      return false;
    }
    
    console.log("Updating asset metadata...");
    const tx = await (registry as any).updateAssetMetadata(assetId, newMetadata);
    await tx.wait();
    
    console.log(chalk.green("\n✅ Asset metadata updated successfully!"));
    return true;
  } catch (error) {
    console.error("Error updating asset metadata:", error);
    return false;
  }
}

// Update asset media
async function updateAssetMedia(
  registry: PropytoRegistry,
  assetId: bigint,
  owner: Signer
): Promise<boolean> {
  try {
    const assetDetails = await getAssetDetails(registry, assetId);
    if (!assetDetails) {
      console.log(chalk.red("Asset not found."));
      return false;
    }

    console.log(chalk.cyan("\n--- Current Media ---"));
    console.log(`Image: ${assetDetails.media.assetImage || 'None'}`);
    console.log(`Video: ${assetDetails.media.assetVideo || 'None'}`);
    console.log(`Floor Plan: ${assetDetails.media.assetFloorPlan || 'None'}`);
    
    console.log(chalk.cyan("\n--- Update Media ---"));
    console.log(chalk.yellow("(Press Enter to keep current value)"));
    console.log(chalk.yellow("Enter IPFS hash or URL for each media item"));
    
    const image = await prompt("Image");
    const video = await prompt("Video");
    const floorPlan = await prompt("Floor Plan");
    
    // If no changes were made, exit
    if (!image && !video && !floorPlan) {
      console.log(chalk.yellow("No changes made to media."));
      return false;
    }
    
    // Create updated media object, keeping existing values if not changed
    const newMedia = {
      assetImage: image || assetDetails.media.assetImage,
      assetVideo: video || assetDetails.media.assetVideo,
      assetFloorPlan: floorPlan || assetDetails.media.assetFloorPlan
    };
    
    const confirmUpdate = await prompt(chalk.yellow("Confirm media update? (yes/no)"));
    if (confirmUpdate.toLowerCase() !== "yes") {
      console.log("Media update cancelled.");
      return false;
    }
    
    console.log("Updating asset media...");
    const tx = await (registry as any).updateAssetMedia(assetId, newMedia);
    await tx.wait();
    
    console.log(chalk.green("\n✅ Asset media updated successfully!"));
    return true;
  } catch (error) {
    console.error("Error updating asset media:", error);
    return false;
  }
}

// Transfer asset ownership
async function transferAssetOwnership(
  registry: PropytoRegistry,
  assetId: bigint,
  owner: Signer
): Promise<boolean> {
  try {
    const assetDetails = await getAssetDetails(registry, assetId);
    if (!assetDetails) {
      console.log(chalk.red("Asset not found."));
      return false;
    }

    const currentOwner = assetDetails.asset.seller;
    console.log(`Current owner: ${currentOwner}`);
    
    const newOwnerAddress = await prompt("Enter new owner address");
    if (!newOwnerAddress.trim() || !ethers.isAddress(newOwnerAddress)) {
      console.log(chalk.red("Invalid address format."));
      return false;
    }
    
    const confirmTransfer = await prompt(chalk.yellow(`Confirm ownership transfer to ${newOwnerAddress}? (yes/no)`));
    if (confirmTransfer.toLowerCase() !== "yes") {
      console.log("Ownership transfer cancelled.");
      return false;
    }
    
    console.log("Transferring asset ownership...");
    const tx = await (registry as any).transferAssetOwnership(assetId, newOwnerAddress);
    await tx.wait();
    
    console.log(chalk.green("\n✅ Asset ownership transferred successfully!"));
    return true;
  } catch (error) {
    console.error("Error transferring asset ownership:", error);
    return false;
  }
}

// Manage partial ownership
async function managePartialOwnership(
  registry: PropytoRegistry,
  assetId: bigint,
  owner: Signer
): Promise<boolean> {
  try {
    const assetDetails = await getAssetDetails(registry, assetId);
    if (!assetDetails) {
      console.log(chalk.red("Asset not found."));
      return false;
    }

    // Check if partial ownership is already enabled
    const isPartiallyOwnable = assetDetails.asset.isPartiallyOwnEnabled;
    
    // If not enabled, prompt to enable it
    if (!isPartiallyOwnable) {
      console.log(chalk.yellow("Partial ownership is not enabled for this asset."));
      const enablePartial = await prompt("Would you like to enable partial ownership? (yes/no)");
      if (enablePartial.toLowerCase() !== "yes") {
        return false;
      }
      
      // Gather information to enable partial ownership
      console.log(chalk.cyan("\n--- Partial Ownership Setup ---"));
      
      const totalSharesInput = await prompt("Total number of shares (default: 1000)");
      const totalShares = totalSharesInput.trim() === "" ? 1000 : parseInt(totalSharesInput);
      
      const sharePriceInput = await prompt("Price per share in USDT (default: asset price / total shares)");
      const defaultSharePrice = assetDetails.asset.assetPrice / BigInt(totalShares);
      const sharePrice = sharePriceInput.trim() === "" ? 
        defaultSharePrice : 
        parseUnits(sharePriceInput, 18);
      
      const minSharePurchaseInput = await prompt("Minimum shares per purchase (default: 1)");
      const minSharePurchase = minSharePurchaseInput.trim() === "" ? 1 : parseInt(minSharePurchaseInput);
      
      const maxSharesPerOwnerInput = await prompt("Maximum shares per owner (default: no limit)");
      const maxSharesPerOwner = maxSharesPerOwnerInput.trim() === "" ? totalShares : parseInt(maxSharesPerOwnerInput);
      
      const sellerSharesInput = await prompt("Shares retained by seller (default: 0)");
      const sellerShares = sellerSharesInput.trim() === "" ? 0 : parseInt(sellerSharesInput);
      
      // Confirm partial ownership setup
      console.log(chalk.cyan("\n--- Partial Ownership Summary ---"));
      console.log(`Total Shares: ${totalShares}`);
      console.log(`Share Price: ${formatPrice(sharePrice)} USDT`);
      console.log(`Minimum Purchase: ${minSharePurchase} shares`);
      console.log(`Maximum Per Owner: ${maxSharesPerOwner} shares`);
      console.log(`Seller's Shares: ${sellerShares}`);
      
      const confirmEnable = await prompt(chalk.yellow("Confirm partial ownership setup? (yes/no)"));
      if (confirmEnable.toLowerCase() !== "yes") {
        console.log("Partial ownership setup cancelled.");
        return false;
      }
      
      console.log("Enabling partial ownership...");
      const tx = await registry.enablePartialOwnership(
        assetId,
        totalShares,
        sharePrice,
        minSharePurchase,
        maxSharesPerOwner,
        sellerShares
      );
      await tx.wait();
      
      console.log(chalk.green("\n✅ Partial ownership enabled successfully!"));
      return true;
    } 
    // If already enabled, display and manage it
    else {
      // Get ownership info
      const ownershipInfo = await getPartialOwnershipInfo(registry, assetId);
      if (!ownershipInfo) {
        console.log(chalk.red("Error retrieving partial ownership data."));
        return false;
      }
      
      // Display ownership info
      displayPartialOwnershipInfo(ownershipInfo);
      
      // Offer management options
      console.log(chalk.cyan("\n--- Partial Ownership Management ---"));
      console.log("1. Update share price");
      console.log("2. Exit partial ownership (cancel/complete)");
      console.log("3. Return to main menu");
      
      const managementChoice = await prompt("Enter your choice");
      
      switch (managementChoice) {
        case "1": // Update share price
          // Add functionality to update share price
          console.log(chalk.yellow("Share price update not implemented in this version."));
          return false;
        
        case "2": // Exit partial ownership
          // Add functionality to exit partial ownership
          console.log(chalk.yellow("Exiting partial ownership not implemented in this version."));
          return false;
          
        default:
          return false;
      }
    }
  } catch (error) {
    console.error("Error managing partial ownership:", error);
    return false;
  }
}

// Main function
async function main() {
  try {
    // Get the signer
    const [owner] = await ethers.getSigners();
    console.log(chalk.cyan(`Running with the account: ${owner.address}`));
    
    // Get the registry contract address
    const registryAddress = await prompt("Enter the PropytoRegistry contract address");
    
    // Get the PropytoRegistry contract
    const PropytoRegistryFactory = await ethers.getContractFactory("PropytoRegistry");
    const registry = (await PropytoRegistryFactory.attach(registryAddress)) as PropytoRegistry;
    
    console.log(chalk.green("\n🏢 Welcome to the Propyto Asset Management Portal! 🏢"));
    
    let exit = false;
    while (!exit) {
      const choice = await displayMenu();
      
      switch (choice) {
        case "1": { // View my assets
          console.log(chalk.cyan("\nFetching your assets..."));
          
          // Get total asset count
          const assetCount = await registry.assetCount();
          const ownerAssets: IAssetListItem[] = [];
          const ownerAddress = await owner.getAddress();
          
          // Fetch owner's assets
          for (let i = 0n; i < assetCount; i++) {
            const assetDetails = await getAssetDetails(registry, i);
            if (assetDetails && assetDetails.asset.seller.toLowerCase() === ownerAddress.toLowerCase()) {
              ownerAssets.push({
                id: i,
                ...assetDetails
              });
            }
          }
          
          // Display assets
          if (ownerAssets.length === 0) {
            console.log(chalk.yellow("\nYou don't own any assets."));
          } else {
            console.log(chalk.cyan(`\nYou own ${ownerAssets.length} asset(s):`));
            displayAssetsList(ownerAssets);
          }
          break;
        }
        
        case "2": { // Update asset details
          const assetIdInput = await prompt("Enter the asset ID to update");
          
          try {
            const assetId = BigInt(assetIdInput);
            
            // Verify ownership
            const assetDetails = await getAssetDetails(registry, assetId);
            const ownerAddress = await owner.getAddress();
            
            if (!assetDetails) {
              console.log(chalk.red("Asset not found."));
              break;
            }
            
            if (assetDetails.asset.seller.toLowerCase() !== ownerAddress.toLowerCase()) {
              console.log(chalk.red("You are not the owner of this asset."));
              break;
            }
            
            // Display asset details
            displayAssetDetails(
              assetDetails.asset,
              assetDetails.metadata,
              assetDetails.media,
              assetDetails.otherDetails
            );
            
            // Choose which details to update
            console.log(chalk.cyan("\n--- Update Asset Details ---"));
            console.log("1. Update price");
            console.log("2. Update status");
            console.log("3. Update metadata");
            console.log("4. Update media");
            console.log("5. Return to main menu");
            
            const updateChoice = await prompt("Enter your choice");
            
            switch (updateChoice) {
              case "1": 
                await updateAssetPrice(registry, assetId, owner);
                break;
              case "2": 
                await updateAssetStatus(registry, assetId, owner);
                break;
              case "3": 
                await updateAssetMetadata(registry, assetId, owner);
                break;
              case "4": 
                await updateAssetMedia(registry, assetId, owner);
                break;
              default:
                console.log("Returning to main menu.");
                break;
            }
          } catch (error) {
            console.log(chalk.red("Invalid asset ID. Please enter a valid number."));
          }
          break;
        }
        
        case "3": { // Update asset price
          const assetIdInput = await prompt("Enter the asset ID to update price");
          
          try {
            const assetId = BigInt(assetIdInput);
            await updateAssetPrice(registry, assetId, owner);
          } catch (error) {
            console.log(chalk.red("Invalid asset ID. Please enter a valid number."));
          }
          break;
        }
        
        case "4": { // Update asset status
          const assetIdInput = await prompt("Enter the asset ID to update status");
          
          try {
            const assetId = BigInt(assetIdInput);
            await updateAssetStatus(registry, assetId, owner);
          } catch (error) {
            console.log(chalk.red("Invalid asset ID. Please enter a valid number."));
          }
          break;
        }
        
        case "5": { // Update asset metadata
          const assetIdInput = await prompt("Enter the asset ID to update metadata");
          
          try {
            const assetId = BigInt(assetIdInput);
            await updateAssetMetadata(registry, assetId, owner);
          } catch (error) {
            console.log(chalk.red("Invalid asset ID. Please enter a valid number."));
          }
          break;
        }
        
        case "6": { // Update asset media
          const assetIdInput = await prompt("Enter the asset ID to update media");
          
          try {
            const assetId = BigInt(assetIdInput);
            await updateAssetMedia(registry, assetId, owner);
          } catch (error) {
            console.log(chalk.red("Invalid asset ID. Please enter a valid number."));
          }
          break;
        }
        
        case "7": { // Manage partial ownership
          const assetIdInput = await prompt("Enter the asset ID to manage partial ownership");
          
          try {
            const assetId = BigInt(assetIdInput);
            await managePartialOwnership(registry, assetId, owner);
          } catch (error) {
            console.log(chalk.red("Invalid asset ID. Please enter a valid number."));
          }
          break;
        }
        
        case "8": { // Transfer asset ownership
          const assetIdInput = await prompt("Enter the asset ID to transfer ownership");
          
          try {
            const assetId = BigInt(assetIdInput);
            await transferAssetOwnership(registry, assetId, owner);
          } catch (error) {
            console.log(chalk.red("Invalid asset ID. Please enter a valid number."));
          }
          break;
        }
        
        case "9": // Exit
          console.log(chalk.green("Thank you for using the Propyto Asset Management Portal!"));
          exit = true;
          break;
          
        default:
          console.log(chalk.red("Invalid choice. Please enter a number between 1 and 9."));
      }
      
      if (!exit) {
        await prompt(chalk.yellow("Press Enter to continue..."));
      }
    }
    
    rl.close();
  } catch (error) {
    console.error("Error in main process:", error);
    rl.close();
    process.exit(1);
  }
}

// Run the main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
