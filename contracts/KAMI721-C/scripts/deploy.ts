import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy mock payment token for testing
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const paymentToken = await MockERC20.deploy("Mock Payment Token", "MPT", 6);
  await paymentToken.waitForDeployment();

  console.log("Payment token deployed to:", await paymentToken.getAddress());

  // Deploy KAMI721C
  const KAMI721C = await ethers.getContractFactory("KAMI721C");
  const kami721c = await KAMI721C.deploy(
    await paymentToken.getAddress(),
    "KAMI721C",
    "KAMI",
    "https://api.kami.com/token/",
    ethers.parseUnits("100", 6), // 100 tokens with 6 decimals
    deployer.address, // Platform address
    500 // 5% platform commission
  );

  await kami721c.waitForDeployment();

  console.log("KAMI721C deployed to:", await kami721c.getAddress());
  console.log("Payment token address:", await paymentToken.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
