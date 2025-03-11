import { ethers } from "hardhat";
import * as readline from "readline";
import { parseUnits, formatUnits } from "ethers";
import { PropytoRegistry } from "../typechain-types";
import chalk from "chalk";
import Table from "cli-table3";
import config from "./config.json"

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
async function getAssetDetails(registry: PropytoRegistry, assetId: bigint): Promise<any> {
  try {
    const asset = await registry.assets(assetId);
    const metadata = await registry.assetMetadata(assetId);
    const media = await registry.assetMedia(assetId);
    
    // Parse JSON other details if available
    let otherDetails = {};
    try {
      otherDetails = JSON.parse(asset.assetOtherDetails);
    } catch {
      // If not valid JSON, use as is
      otherDetails = { raw: asset.assetOtherDetails };
    }

    // console.debug(asset.name)
    // const parsedAsset: PropytoRegistry.PropytoAssetStruct = {
    //     name: asset.name,
    //     assetType: "",
    //     assetAddress: "",
    //     assetStatus: "",
    //     assetFurnishing: "",
    //     assetZone: "",
    //     assetPrice: "",
    //     assetArea: "",
    //     assetAge: "",
    //     assetOtherDetails: "",
    //     isRentable: false,
    //     isSellable: false,
    //     isPartiallyOwnEnabled: false,
    //     seller: "",
    //     listingExpiry: "",
    // }
    // console.debug(asset)
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

// Check if an asset is available for purchase
function isAssetAvailable(asset: any): boolean {
  if (!asset) return false;
  const now = Math.floor(Date.now() / 1000);
//   console.debug(asset.isSellable, asset.assetStatus, BigInt(AssetStatus.FOR_SALE), asset.listingExpiry, now)
  return (
    (asset.assetStatus === BigInt(AssetStatus.FOR_SALE) || asset.assetStatus === BigInt(AssetStatus.FOR_RENT))
    // && asset.isSellable
    && BigInt(asset.listingExpiry) > BigInt(now)
  );
}

// Display a single asset's full details
function displayAssetDetails(asset: any, metadata: any, media: any, otherDetails: any): void {
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
  
  if (otherDetails) {
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
}

// Display a list of assets in a table format
function displayAssetsList(assets: Array<any>): void {
  if (assets.length === 0) {
    console.log(chalk.yellow("\nNo assets available for purchase at this time."));
    return;
  }
  
  const table = new Table({
    head: [
      chalk.cyan('ID'), 
      chalk.cyan('Name'), 
      chalk.cyan('Type'),
      chalk.cyan('Price (USDT)'),
      chalk.cyan('Area (sqft)'),
      chalk.cyan('Status')
    ],
    colWidths: [8, 30, 15, 15, 12, 15]
  });
  
  assets.forEach(asset => {
    // Using any to avoid type mismatches with cli-table3
    (table as any).push([
      asset.id.toString(),
      asset.asset.name.length > 28 ? asset.asset.name.substring(0, 25) + '...' : asset.asset.name,
      formatAssetType(asset.asset.assetType),
      formatPrice(asset.asset.assetPrice),
      asset.asset.assetArea.toString(),
      formatAssetStatus(asset.asset.assetStatus)
    ]);
  });
  
  console.log(table.toString());
}

// Display a menu of available actions
async function displayMenu(): Promise<string> {
  console.log(chalk.bold("\n🔍 AVAILABLE ACTIONS:"));
  console.log("1. View all assets for sale");
  console.log("2. View assets by type (Residential, Commercial, Land)");
  console.log("3. View asset details");
  console.log("4. Purchase an asset");
  console.log("5. Purchase shares in an asset");
  console.log("6. Exit");
  
  return await prompt(chalk.green("Enter your choice (1-6)"));
}

// Function to handle asset purchase
async function purchaseAsset(
  registry: PropytoRegistry, 
  assetId: bigint, 
  buyer: any, 
  isBuyShares: boolean = false
): Promise<boolean> {
  try {
    // Get asset details
    const assetDetails = await getAssetDetails(registry, assetId);
    if (!assetDetails || !isAssetAvailable(assetDetails.asset)) {
      console.log(chalk.red("Asset is not available for purchase."));
      return false;
    }
    
    // Get USDT token address
    const usdtAddress = await registry.usdtToken();
    
    // If buying shares instead of entire asset
    if (isBuyShares && assetDetails.asset.isPartiallyOwnEnabled) {
      const totalSharesInput = await prompt("How many shares would you like to purchase?");
      const sharesToBuy = parseInt(totalSharesInput);
      
      if (isNaN(sharesToBuy) || sharesToBuy <= 0) {
        console.log(chalk.red("Invalid number of shares."));
        return false;
      }
      
      // Get ownership details
      // Note: We'll need to implement a view function to see available shares
      // For now, we'll just proceed with the purchase
      
      console.log(chalk.yellow("\nPreparing to purchase shares..."));
      console.log(`Asset: ${assetDetails.asset.name}`);
      console.log(`Shares to buy: ${sharesToBuy}`);
      
      // Calculate estimated cost
      // This would be better handled by a contract view function
      const estimatedCost = BigInt(sharesToBuy) * assetDetails.asset.assetPrice / 1000n; // Assuming 1000 shares total
      console.log(`Estimated cost: ${formatPrice(estimatedCost)} USDT`);
      
      const confirmPurchase = await prompt(chalk.yellow("Confirm share purchase? (yes/no)"));
      if (confirmPurchase.toLowerCase() !== "yes") {
        console.log("Share purchase cancelled.");
        return false;
      }
      
      // Get USDT contract
      const usdtAbi = [
        "function balanceOf(address owner) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)"
      ];
      const usdt = new ethers.Contract(usdtAddress, usdtAbi, buyer);
      
      // Check USDT balance
      const balance = await usdt.balanceOf(buyer.address);
      if (balance < estimatedCost) {
        console.log(chalk.red(`Insufficient USDT balance. You have ${formatPrice(balance)} USDT but need ${formatPrice(estimatedCost)} USDT.`));
        return false;
      }
      
      // Approve USDT for the purchase
      console.log("Approving USDT for the share purchase...");
      const approveTx = await usdt.approve(registry.target, estimatedCost);
      await approveTx.wait();
      console.log(chalk.green("USDT approved successfully!"));
      
      // Purchase shares
      console.log("Purchasing shares...");
      const tx = await registry.purchaseShares(assetId, sharesToBuy, false);
      const receipt = await tx.wait();
      
      console.log(chalk.green("\n✅ Shares purchased successfully!"));
      return true;
    } 
    // Buy entire asset
    else {
      const price = assetDetails.asset.assetPrice;
      
      console.log(chalk.yellow("\nPreparing to purchase asset..."));
      console.log(`Asset: ${assetDetails.asset.name}`);
      console.log(`Price: ${formatPrice(price)} USDT`);
      
      const confirmPurchase = await prompt(chalk.yellow("Confirm asset purchase? (yes/no)"));
      if (confirmPurchase.toLowerCase() !== "yes") {
        console.log("Asset purchase cancelled.");
        return false;
      }
      
      // Get USDT contract
      const usdtAbi = [
        "function balanceOf(address owner) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)"
      ];
      const usdt = new ethers.Contract(usdtAddress, usdtAbi, buyer);
      
      // Check USDT balance
      const balance = await usdt.balanceOf(buyer.address);
      if (balance < price) {
        console.log(chalk.red(`Insufficient USDT balance. You have ${formatPrice(balance)} USDT but need ${formatPrice(price)} USDT.`));
        return false;
      }
      
      // Calculate platform fee
      const marketplaceConfig = await registry.marketplaceConfig();
      const totalAmount = price;
      
      // Approve USDT for the purchase
      console.log("Approving USDT for the asset purchase...");
      const approveTx = await usdt.approve(registry.target, totalAmount);
      await approveTx.wait();
      console.log(chalk.green("USDT approved successfully!"));
      
      // Purchase asset
      console.log("Purchasing asset...");
      const tx = await registry.purchaseShares(assetId, 0, true); // isBuyAsset flag set to true
      console.debug("+ tx hash", tx.hash)
      const receipt = await tx.wait();
      
      console.log(chalk.green("\n✅ Asset purchased successfully!"));
      return true;
    }
  } catch (error) {
    console.error("Error purchasing asset:", error);
    return false;
  }
}

async function main() {
  try {
    // Get the signer
    const [buyer] = await ethers.getSigners();
    console.log(chalk.cyan(`Running with the account: ${buyer.address}`));
    
    // Get the registry contract address
    // const registryAddress = await prompt("Enter the PropytoRegistry contract address");
    
    // Get the PropytoRegistry contract
    const PropytoRegistryFactory = await ethers.getContractFactory("PropytoRegistry");
    const registry = PropytoRegistryFactory.attach(config.registryAddress) as PropytoRegistry;
    
    console.log(chalk.green("\n🏢 Welcome to the Propyto Asset Marketplace! 🏢"));
    
    let exit = false;
    while (!exit) {
      const choice = await displayMenu();
      
      switch (choice) {
        case "1": { // View all assets for sale
          console.log(chalk.cyan("\nFetching all assets for sale..."));
          
          // Get total asset count
          const assetCount = await registry.assetCount();
        //   console.debug(assetCount)
          const availableAssets = [];
          
          // Fetch all assets and filter for available ones
          for (let i = 0n; i < assetCount; i++) {
            const assetDetails = await getAssetDetails(registry, i);
            if (assetDetails && isAssetAvailable(assetDetails.asset)) {
              availableAssets.push({
                id: i,
                ...assetDetails
              });
            } else {
                // console.debug(assetDetails)
            }
          }
          
          // Display assets in a table
          displayAssetsList(availableAssets);
          break;
        }
        
        case "2": { // View assets by type
          console.log(chalk.cyan("\nSelect Asset Type:"));
          console.log("1. Residential");
          console.log("2. Commercial");
          console.log("3. Land");
          console.log("4. Other");
          
          const typeChoice = await prompt("Enter your choice (1-4)");
          let selectedType = -1;
          
          switch (typeChoice) {
            case "1": selectedType = AssetType.RESIDENTIAL; break;
            case "2": selectedType = AssetType.COMMERCIAL; break;
            case "3": selectedType = AssetType.LAND; break;
            case "4": selectedType = AssetType.OTHER; break;
            default:
              console.log(chalk.red("Invalid choice. Please try again."));
              continue;
          }
          
          console.log(chalk.cyan(`\nFetching ${AssetType[selectedType]} assets for sale...`));
          
          // Get total asset count
          const assetCount = await registry.assetCount();
          const availableAssets = [];
          
          // Fetch assets of selected type
          for (let i = 0n; i < assetCount; i++) {
            const assetDetails = await getAssetDetails(registry, i);
            if (
              assetDetails && 
              isAssetAvailable(assetDetails.asset) && 
              assetDetails.asset.assetType === BigInt(selectedType)
            ) {
              availableAssets.push({
                id: i,
                ...assetDetails
              });
            }
          }
          
          // Display assets in a table
          displayAssetsList(availableAssets);
          break;
        }
        
        case "3": { // View asset details
          const assetIdInput = await prompt("Enter the asset ID to view details");
          const assetId = BigInt(assetIdInput);
          
          if (isNaN(Number(assetId)) || assetId < 0n) {
            console.log(chalk.red("Invalid asset ID."));
            continue;
          }
          
          console.log(chalk.cyan(`\nFetching details for asset ${assetId}...`));
          
          const assetDetails = await getAssetDetails(registry, assetId);
          if (!assetDetails) {
            console.log(chalk.red("Asset not found or error retrieving details."));
            continue;
          }
          
          displayAssetDetails(
            assetDetails.asset, 
            assetDetails.metadata, 
            assetDetails.media, 
            assetDetails.otherDetails
          );
          break;
        }
        
        case "4": { // Purchase an asset
          const assetIdInput = await prompt("Enter the asset ID to purchase");
          const assetId = BigInt(assetIdInput);
          
          if (isNaN(Number(assetId)) || assetId < 0n) {
            console.log(chalk.red("Invalid asset ID."));
            continue;
          }
          
          await purchaseAsset(registry, assetId, buyer, false);
          break;
        }
        
        case "5": { // Purchase shares in an asset
          const assetIdInput = await prompt("Enter the asset ID to purchase shares from");
          const assetId = BigInt(assetIdInput);
          
          if (isNaN(Number(assetId)) || assetId < 0n) {
            console.log(chalk.red("Invalid asset ID."));
            continue;
          }
          
          // Verify asset supports partial ownership
          const assetDetails = await getAssetDetails(registry, assetId);
          if (!assetDetails || !assetDetails.asset.isPartiallyOwnEnabled) {
            console.log(chalk.red("This asset does not support partial ownership."));
            continue;
          }
          
          await purchaseAsset(registry, assetId, buyer, true);
          break;
        }
        
        case "6": // Exit
          console.log(chalk.green("Thank you for using the Propyto Asset Marketplace!"));
          exit = true;
          break;
          
        default:
          console.log(chalk.red("Invalid choice. Please enter a number between 1 and 6."));
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
