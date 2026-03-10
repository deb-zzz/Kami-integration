import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying upgradeable contracts with the account:",
    deployer.address
  );

  // Deploy mock payment token for testing
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const paymentToken = await MockERC20.deploy("Mock Payment Token", "MPT", 6);
  await paymentToken.waitForDeployment();
  console.log("Payment token deployed to:", await paymentToken.getAddress());

  // Deploy KAMI721CUpgradeable
  const KAMI721CUpgradeable = await ethers.getContractFactory(
    "KAMI721CUpgradeable"
  );
  const kami721c = await upgrades.deployProxy(
    KAMI721CUpgradeable,
    [
      await paymentToken.getAddress(),
      "KAMI721C",
      "KAMI",
      "https://api.kami.com/token/",
      ethers.parseUnits("100", 6), // 100 tokens with 6 decimals
      deployer.address, // Platform address
      500, // 5% platform commission
    ],
    {
      initializer: "initialize",
      kind: "transparent",
    }
  );

  await kami721c.waitForDeployment();
  console.log("KAMI721CUpgradeable deployed to:", await kami721c.getAddress());
  console.log("Payment token address:", await paymentToken.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
