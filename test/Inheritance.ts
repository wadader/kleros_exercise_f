import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { parseEther } from "ethers";
import { ethers } from "hardhat";

const NOT_OWNER = "not owner";
const NOT_HEIR = "not heir";
const NOW_ENOUGH_ETH_IN_CONTRACT = "Not enough Ether in contract!";

const OWNER_STILL_ACTIVE = "owner still active";

const ONE_ETHER = parseEther("1");
const ONE_POINT_FIVE_ETHER = parseEther("1.5");

const ONE_MONTH_AND_ONE_DAY = 2678400;

describe("Inheritance", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployInheritance() {
    // Contracts are deployed using the first signer/account by default
    const [
      startingOwner,
      startingHeir,
      nextHeir,
      unauthorized_A,
      unauthorized_B,
      randomFunder,
    ] = await ethers.getSigners();

    const inheritanceFactoryPromise = ethers.getContractFactory("Inheritance");

    const [inheritanceFactory] = await Promise.all([inheritanceFactoryPromise]);

    const [inheritance] = await Promise.all([
      inheritanceFactory
        .connect(startingOwner)
        .deploy(startingOwner.address, startingHeir.address),
    ]);

    return {
      inheritance,
      startingOwner,
      startingHeir,
      nextHeir,
      unauthorized_A,
      unauthorized_B,
      randomFunder,
    };
  }

  describe("Withdraw Eth", function () {
    describe("Validations", function () {
      it("Should revert if owner is not calling", async function () {
        const { inheritance, unauthorized_A, startingHeir } = await loadFixture(
          deployInheritance
        );

        const unauthShouldFail = expect(
          inheritance.connect(unauthorized_A).withdraw(ONE_ETHER)
        ).to.be.revertedWith(NOT_OWNER);

        const heirShouldFail = expect(
          inheritance.connect(startingHeir).withdraw(ONE_ETHER)
        ).to.be.revertedWith(NOT_OWNER);

        await Promise.all([unauthShouldFail, heirShouldFail]);
      });

      it("Should fail if insufficent eth in contract", async function () {
        const { inheritance, startingOwner, randomFunder } = await loadFixture(
          deployInheritance
        );

        const inheritanceAddress = await inheritance.getAddress();

        await randomFunder.sendTransaction({
          to: inheritanceAddress,
          value: ONE_ETHER,
        });
        await expect(
          inheritance.connect(startingOwner).withdraw(ONE_POINT_FIVE_ETHER)
        ).to.revertedWith(NOW_ENOUGH_ETH_IN_CONTRACT);
      });
    });

    describe("Working", function () {
      it("Should transfer eth from contract to owner", async function () {
        const { inheritance, startingOwner, randomFunder } = await loadFixture(
          deployInheritance
        );

        const inheritanceAddress = await inheritance.getAddress();

        await randomFunder.sendTransaction({
          to: inheritanceAddress,
          value: ONE_ETHER,
        });
        await expect(
          inheritance.connect(startingOwner).withdraw(ONE_ETHER)
        ).to.changeEtherBalance(startingOwner, ONE_ETHER);
      });
      it("Should update lastWithdrawnTime", async function () {
        const { inheritance, startingOwner, randomFunder } = await loadFixture(
          deployInheritance
        );

        const inheritanceAddress = await inheritance.getAddress();

        await randomFunder.sendTransaction({
          to: inheritanceAddress,
          value: ONE_ETHER,
        });

        await inheritance.connect(startingOwner).withdraw(ONE_ETHER);

        const lastWithdrawnTimePromise = inheritance.lastWithdrawnTime();
        const latestTimePromise = time.latest();

        const [lastWithdrawnTime, latestTime] = await Promise.all([
          lastWithdrawnTimePromise,
          latestTimePromise,
        ]);

        expect(lastWithdrawnTime).to.be.eq(latestTime);
      });

      it("Should work on with 0 eth to reset counter", async function () {
        const { inheritance, startingOwner } = await loadFixture(
          deployInheritance
        );

        await inheritance.connect(startingOwner).withdraw(0);

        const lastWithdrawnTimePromise = inheritance.lastWithdrawnTime();
        const latestTimePromise = time.latest();

        const [lastWithdrawnTime, latestTime] = await Promise.all([
          lastWithdrawnTimePromise,
          latestTimePromise,
        ]);

        expect(lastWithdrawnTime).to.be.eq(latestTime);
      });
    });
  });

  describe("Inherit", function () {
    describe("Validations", function () {
      it("Should revert if heir is not calling", async function () {
        const { inheritance, unauthorized_A, startingOwner, nextHeir } =
          await loadFixture(deployInheritance);

        const unauthShouldFail = expect(
          inheritance.connect(unauthorized_A).inherit(nextHeir)
        ).to.be.revertedWith(NOT_HEIR);

        const ownerShouldFail = expect(
          inheritance.connect(startingOwner).inherit(nextHeir)
        ).to.be.revertedWith(NOT_HEIR);

        const nextHeirShouldFail = expect(
          inheritance.connect(nextHeir).inherit(nextHeir)
        ).to.be.revertedWith(NOT_HEIR);

        await Promise.all([
          unauthShouldFail,
          ownerShouldFail,
          nextHeirShouldFail,
        ]);
      });

      it("should revert if one month has not passed since last withdrawn", async function () {
        const { inheritance, startingHeir, nextHeir } = await loadFixture(
          deployInheritance
        );

        await expect(
          inheritance.connect(startingHeir).inherit(nextHeir)
        ).to.be.revertedWith(OWNER_STILL_ACTIVE);
      });
    });

    describe("Working", function () {
      it("should succeed if more than one month has passed since last withdrawn", async function () {
        const { inheritance, startingHeir, nextHeir } = await loadFixture(
          deployInheritance
        );
        await time.increase(ONE_MONTH_AND_ONE_DAY);
        await inheritance.connect(startingHeir).inherit(nextHeir);

        const newOwnerPromise = inheritance.owner();
        const newHeirPromise = inheritance.heir();

        const startingHeirAddress = startingHeir.address;
        const nextHeirAddress = nextHeir.address;

        const [newOwner, newHeir] = await Promise.all([
          newOwnerPromise,
          newHeirPromise,
        ]);

        const newOwnerShouldBeStartingHeir =
          expect(newOwner).to.be.eq(startingHeirAddress);
        const newHeirShouldBeNextHeir =
          expect(newHeir).to.be.eq(nextHeirAddress);

        await Promise.all([
          newOwnerShouldBeStartingHeir,
          newHeirShouldBeNextHeir,
        ]);
      });
    });
  });
});
