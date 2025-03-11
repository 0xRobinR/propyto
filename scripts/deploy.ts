
import {ethers, upgrades} from "hardhat";
import fs from "fs";
async function main() {
  console.log("Starting Propyto protocol deployment...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  console.log("Deploying contracts using Ignition...");

  const MockUSDT = await ethers.getContractFactory("MockERC20");
  const usdt = await MockUSDT.deploy(
    "Mock USDT",
    "MUSDT",
    18,
    ethers.parseEther("1000000")
  );
  console.log(`MockUSDT deployed to: ${usdt.target}`);

  const PropytoRegistry = await ethers.getContractFactory("PropytoRegistry");
  const contract = await upgrades.deployProxy(PropytoRegistry, [
    usdt.target
  ]);
  console.log(`PropytoRegistry deployed to: ${contract.target}`);
  
  await contract.connect(deployer).updateMarketplaceConfig(
    250,
    deployer.address,
    ethers.parseEther("10"),
    true
  );

  const configFile = {
    registryAddress: contract.target,
    usdtAddress: usdt.target,
  }

  fs.writeFileSync("./scripts/config.json", JSON.stringify(configFile, null, 2));
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 