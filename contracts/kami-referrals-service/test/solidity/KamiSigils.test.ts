import { expect } from "chai";
import { ethers } from "hardhat";
import { KamiSigils } from "../typechain-types";

describe("KamiSigils", function () {
  let kamiSigils: KamiSigils;
  let owner: any;
  let user1: any;
  let user2: any;
  const INITIAL_URI = "https://example.com/metadata/";

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const KamiSigilsFactory = await ethers.getContractFactory("KamiSigils");
    kamiSigils = await KamiSigilsFactory.deploy(INITIAL_URI);
    await kamiSigils.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await kamiSigils.owner()).to.equal(owner.address);
    });
  });

  describe("setTokenURI", function () {
    it("Should set token URI successfully", async function () {
      const newUri = "https://example.com/token/1";
      const tokenId = 1;

      const tx = await kamiSigils.setTokenURI(tokenId, newUri);
      const receipt = await tx.wait();
      
      // Check for URI event
      const uriEvent = receipt?.logs.find(
        (log: any) => {
          try {
            const parsed = kamiSigils.interface.parseLog(log);
            return parsed?.name === "URI";
          } catch {
            return false;
          }
        }
      );
      expect(uriEvent).to.not.be.undefined;

      expect(await kamiSigils.uri(tokenId)).to.equal(newUri);
    });

    it("Should revert for invalid token ID (0)", async function () {
      let errorOccurred = false;
      try {
        await kamiSigils.setTokenURI(0, "https://example.com/token/0");
      } catch (error: any) {
        errorOccurred = true;
        expect(error.message).to.include("Invalid Token ID. Must be 1-6.");
      }
      expect(errorOccurred).to.be.true;
    });

    it("Should revert for invalid token ID (7)", async function () {
      let errorOccurred = false;
      try {
        await kamiSigils.setTokenURI(7, "https://example.com/token/7");
      } catch (error: any) {
        errorOccurred = true;
        expect(error.message).to.include("Invalid Token ID. Must be 1-6.");
      }
      expect(errorOccurred).to.be.true;
    });

    it("Should revert when called by non-owner", async function () {
      let errorOccurred = false;
      try {
        await kamiSigils.connect(user1).setTokenURI(1, "https://example.com/token/1");
      } catch (error: any) {
        errorOccurred = true;
        // Check for ownership error
        expect(error.message).to.match(/Ownable|revert|unauthorized/i);
      }
      expect(errorOccurred).to.be.true;
    });
  });

  describe("mint", function () {
    it("Should mint tokens successfully", async function () {
      const tokenId = 1;
      const amount = 10;

      const tx = await kamiSigils.mint(tokenId, amount, user1.address);
      const receipt = await tx.wait();
      
      // Check for TokenSupply event
      const tokenSupplyEvent = receipt?.logs.find(
        (log: any) => {
          try {
            const parsed = kamiSigils.interface.parseLog(log);
            return parsed?.name === "TokenSupply";
          } catch {
            return false;
          }
        }
      );
      expect(tokenSupplyEvent).to.not.be.undefined;

      expect(await kamiSigils.balanceOf(user1.address, tokenId)).to.equal(BigInt(amount));
      expect(await kamiSigils.getTotalSupply(tokenId)).to.equal(BigInt(amount));
    });

    it("Should mint multiple times and update total supply", async function () {
      const tokenId = 1;
      const amount1 = 5;
      const amount2 = 3;

      await kamiSigils.mint(tokenId, amount1, user1.address);
      await kamiSigils.mint(tokenId, amount2, user2.address);

      expect(await kamiSigils.balanceOf(user1.address, tokenId)).to.equal(BigInt(amount1));
      expect(await kamiSigils.balanceOf(user2.address, tokenId)).to.equal(BigInt(amount2));
      expect(await kamiSigils.getTotalSupply(tokenId)).to.equal(BigInt(amount1 + amount2));
    });

    it("Should revert for invalid token ID (0)", async function () {
      let errorOccurred = false;
      try {
        await kamiSigils.mint(0, 1, user1.address);
      } catch (error: any) {
        errorOccurred = true;
        expect(error.message).to.include("Invalid Token ID. Must be 1-6.");
      }
      expect(errorOccurred).to.be.true;
    });

    it("Should revert for invalid token ID (7)", async function () {
      let errorOccurred = false;
      try {
        await kamiSigils.mint(7, 1, user1.address);
      } catch (error: any) {
        errorOccurred = true;
        expect(error.message).to.include("Invalid Token ID. Must be 1-6.");
      }
      expect(errorOccurred).to.be.true;
    });

    it("Should revert for zero amount", async function () {
      let errorOccurred = false;
      try {
        await kamiSigils.mint(1, 0, user1.address);
      } catch (error: any) {
        errorOccurred = true;
        expect(error.message).to.include("Amount must be greater than zero");
      }
      expect(errorOccurred).to.be.true;
    });

    it("Should revert when called by non-owner", async function () {
      let errorOccurred = false;
      try {
        await kamiSigils.connect(user1).mint(1, 1, user2.address);
      } catch (error: any) {
        errorOccurred = true;
        // Check for ownership error
        expect(error.message).to.match(/Ownable|revert|unauthorized/i);
      }
      expect(errorOccurred).to.be.true;
    });
  });

  describe("getTotalSupply", function () {
    it("Should return zero for unminted token", async function () {
      expect(await kamiSigils.getTotalSupply(2)).to.equal(0n);
    });

    it("Should return correct total supply after minting", async function () {
      const tokenId = 2;
      const amount = 20;

      await kamiSigils.mint(tokenId, amount, user1.address);
      expect(await kamiSigils.getTotalSupply(tokenId)).to.equal(BigInt(amount));

      await kamiSigils.mint(tokenId, 5, user2.address);
      expect(await kamiSigils.getTotalSupply(tokenId)).to.equal(BigInt(amount + 5));
    });

    it("Should revert for invalid token ID (0)", async function () {
      let errorOccurred = false;
      try {
        await kamiSigils.getTotalSupply(0);
      } catch (error: any) {
        errorOccurred = true;
        expect(error.message).to.include("Invalid Token ID. Must be 1-6.");
      }
      expect(errorOccurred).to.be.true;
    });

    it("Should revert for invalid token ID (7)", async function () {
      let errorOccurred = false;
      try {
        await kamiSigils.getTotalSupply(7);
      } catch (error: any) {
        errorOccurred = true;
        expect(error.message).to.include("Invalid Token ID. Must be 1-6.");
      }
      expect(errorOccurred).to.be.true;
    });
  });

  describe("Soul-bound (Non-Transferable)", function () {
    it("Should prevent token transfers", async function () {
      const tokenId = 1;
      const amount = 10;

      await kamiSigils.mint(tokenId, amount, user1.address);

      let errorOccurred = false;
      try {
        await kamiSigils.connect(user1).safeTransferFrom(
          user1.address,
          user2.address,
          tokenId,
          amount,
          "0x"
        );
      } catch (error: any) {
        errorOccurred = true;
        expect(error.message).to.include("soul-bound and non-transferable");
      }
      expect(errorOccurred).to.be.true;
    });

    it("Should prevent batch token transfers", async function () {
      const tokenId = 1;
      const amount = 10;

      await kamiSigils.mint(tokenId, amount, user1.address);

      const ids = [tokenId];
      const amounts = [amount];

      let errorOccurred = false;
      try {
        await kamiSigils.connect(user1).safeBatchTransferFrom(
          user1.address,
          user2.address,
          ids,
          amounts,
          "0x"
        );
      } catch (error: any) {
        errorOccurred = true;
        expect(error.message).to.include("soul-bound and non-transferable");
      }
      expect(errorOccurred).to.be.true;
    });
  });

  describe("Mint all token IDs", function () {
    it("Should mint all token IDs successfully", async function () {
      for (let i = 1; i <= 6; i++) {
        await kamiSigils.mint(i, 1, user1.address);
        expect(await kamiSigils.balanceOf(user1.address, i)).to.equal(1n);
        expect(await kamiSigils.getTotalSupply(i)).to.equal(1n);
      }
    });
  });
});
