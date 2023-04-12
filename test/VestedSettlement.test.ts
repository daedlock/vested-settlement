import { ethers } from "hardhat";

import { expect } from "chai";
import { MockUSDC, VestedSettlement } from "../typechain-types";
import { mockUsdcSol } from "../typechain-types/contracts/mocks";
import { BigNumber, Signer } from "ethers";

describe("VestedSettlement", function () {
  let vestedSettlement: VestedSettlement;
  let arbiter: any;
  let sender: any;
  let receiver: any;
  let settlementAmount: BigNumber;
  let settlementToken: MockUSDC;


  beforeEach(async function () {
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    settlementToken = await MockUSDC.deploy();
    await settlementToken.deployed();
    const VestedSettlement = await ethers.getContractFactory(
      "VestedSettlement"
    );
    const accounts = await ethers.getSigners();

    arbiter = accounts[1];
    sender = accounts[2];
    receiver = accounts[3];
    settlementAmount = BigNumber.from(100000).mul(1e6); //100K USDC

    vestedSettlement = await VestedSettlement.deploy(
      sender.address,
      receiver.address,
      arbiter.address,
      settlementToken.address,
      settlementAmount
    ) as VestedSettlement;

    await vestedSettlement.deployed()

    await settlementToken.transfer(sender.address, settlementAmount)

  });

  async function fund() {
    await settlementToken.connect(sender).approve(vestedSettlement.address, settlementAmount)
    await vestedSettlement.connect(sender).fund();

  }

  describe("Fund", function () {
    it("Sender: Should fund the contract", async function () {
      await fund()
      expect(await vestedSettlement.funded()).to.equal(true);
      expect(await settlementToken.balanceOf(vestedSettlement.address)).to.equal(settlementAmount)
    })


    it("Receiver/Arbiter: Should not fund the contract", async function () {
      await settlementToken.connect(receiver).approve(vestedSettlement.address, settlementAmount)
      await expect(vestedSettlement.connect(receiver).fund()).to.be.revertedWith("Only the sender can call this function")
    })

  })

  describe("Withdraw", function () {

    it("should allow receiver to claim 50% immediately then 25% every 90 days", async () => {
      await fund()

      // FIRST CLAIM (50% now)
      await vestedSettlement.connect(receiver).withdraw()

      expect(await settlementToken.balanceOf(receiver.address)).to.equal(settlementAmount.div(2)) //50%

      //should revert if withdrawn before next unlock window
      await expect(vestedSettlement.connect(receiver).withdraw()).to.be.revertedWith("Claim period has not yet passed")


      // fast forward 90 days
      await ethers.provider.send("evm_increaseTime", [90 * 24 * 60 * 60])

      // SECOND CLAIM (25%) 90 days later
      await vestedSettlement.connect(receiver).withdraw()
      expect(await settlementToken.balanceOf(receiver.address)).to.equal(settlementAmount.div(4).mul(3)) //100%

      //should revert if withdrawn before next unlock window
      await expect(vestedSettlement.connect(receiver).withdraw()).to.be.revertedWith("Claim period has not yet passed")

      // fast forward 90 days
      await ethers.provider.send("evm_increaseTime", [90 * 24 * 60 * 60])

      // THIRD CLAIM (25%) 90 days later
      await vestedSettlement.connect(receiver).withdraw()
      expect(await settlementToken.balanceOf(receiver.address)).to.equal(settlementAmount) //100%

      //should revert if withdrawn before next unlock window
      await expect(vestedSettlement.connect(receiver).withdraw()).to.be.revertedWith("All settlement funds have been claimed")

      expect(await settlementToken.balanceOf(receiver.address)).to.equal(await vestedSettlement.totalClaimed()) //100%
    })

    it('should disallow withdraw from any other party', async () => {
      await fund()
      await expect(vestedSettlement.connect(arbiter).withdraw()).to.be.revertedWith("Only the receiver can call this function")
    })

    it("should disallow withdraw before funding", async () => {
      await expect(vestedSettlement.connect(receiver).withdraw()).to.be.revertedWith("Settlement has not been funded yet")
    })
  })

  describe("Freeze", function () {
    it("should allow arbiter or receiver to freeze", async () => {
      await expect(vestedSettlement.connect(arbiter).freeze()).to.not.be.reverted
    })
    it("should disallow receiver to freeze", async () => {
      await expect(vestedSettlement.connect(receiver).freeze()).to.be.revertedWith("Only the arbiter can call this function")
    })
    it("should disallow sender to freeze", async () => {
      await expect(vestedSettlement.connect(sender).freeze()).to.be.revertedWith("Only the arbiter can call this function")
    })
    it("should allow arbiter only to unfreeze", async () => {
      await expect(vestedSettlement.connect(arbiter).freeze()).to.not.be.reverted
      await expect(vestedSettlement.connect(receiver).unfreeze()).to.be.revertedWith("Only the arbiter can call this function")
      await expect(vestedSettlement.connect(sender).unfreeze()).to.be.revertedWith("Only the arbiter can call this function")
      await expect(vestedSettlement.connect(arbiter).unfreeze()).to.not.be.reverted

    })

    it("should revert on fund if frozen", async () => {
      await expect(vestedSettlement.connect(arbiter).freeze()).to.not.be.reverted
      await expect(fund()).to.be.revertedWith("Contract is frozen")
    });

    it("should revert on withdraw if frozen", async () => {
      await fund()
      await expect(vestedSettlement.connect(arbiter).freeze()).to.not.be.reverted
      await expect(vestedSettlement.connect(receiver).withdraw()).to.be.revertedWith("Contract is frozen")
    })
  })

  describe("Arbiter: Recover Funds", function () {
    it("should allow arbiter to recover funds", async () => {
      await fund()
      await expect(vestedSettlement.connect(arbiter).recoverFunds()).to.not.be.reverted
      await expect(await settlementToken.balanceOf(arbiter.address)).to.equal(settlementAmount)
    })

    it("should disallow sender to recover funds", async () => {
      await fund()
      await expect(vestedSettlement.connect(sender).recoverFunds()).to.be.revertedWith("Only the arbiter can call this function")
    })

    it("should disallow receiver to recover funds", async () => {
      await fund()
      await expect(vestedSettlement.connect(receiver).recoverFunds()).to.be.revertedWith("Only the arbiter can call this function")
    })
  })

  describe("recoverERC20", function () {
    it("should allow arbiter to recover ERC20", async () => {
      const MockUSDC = await ethers.getContractFactory("MockUSDC");
      const newToken = await MockUSDC.deploy();
      await newToken.deployed();
      await newToken.transfer(vestedSettlement.address, settlementAmount)

      await expect(vestedSettlement.connect(arbiter).recoverERC20(newToken.address, settlementAmount.div(2))).to.not.be.reverted
      expect(await newToken.balanceOf(arbiter.address)).to.equal(settlementAmount.div(2))

    })

    it("should disallow sender to recover ERC20", async () => {
      const MockUSDC = await ethers.getContractFactory("MockUSDC");
      const newToken = await MockUSDC.deploy();
      await newToken.deployed();
      await newToken.transfer(vestedSettlement.address, settlementAmount)

      await expect(vestedSettlement.connect(sender).recoverERC20(newToken.address, settlementAmount.div(2))).to.be.revertedWith("Only the arbiter can call this function")
    })

    it("should disallow receiver to recover ERC20", async () => {
      const MockUSDC = await ethers.getContractFactory("MockUSDC");
      const newToken = await MockUSDC.deploy();
      await newToken.deployed();
      await newToken.transfer(vestedSettlement.address, settlementAmount)

      await expect(vestedSettlement.connect(receiver).recoverERC20(newToken.address, settlementAmount.div(2))).to.be.revertedWith("Only the arbiter can call this function")
    })

  })

});
