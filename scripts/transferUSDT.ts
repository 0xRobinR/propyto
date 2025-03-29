
import {ethers, upgrades} from "hardhat";
import fs from "fs";
import { MockERC20 } from "../typechain-types";
async function main() {
  console.log("Starting Propyto protocol deployment...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  console.log("Deploying contracts using Ignition...");

  const MockUSDT = await ethers.getContractFactory("MockERC20");
  const usdt = MockUSDT.attach("usdt-address") as MockERC20;
  console.log(`MockUSDT deployed to: ${usdt.target}`);

  const amount = "1000"
  const txn = await usdt.transfer(deployer.address, ethers.parseEther(amount));
  await txn.wait();
  console.log(`Transferred ${amount} USDT to ${deployer.address}`);
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 