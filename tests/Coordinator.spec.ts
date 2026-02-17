import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { generateKeyHash } from "@utils/keys";
import { VRFKey } from "@utils/vrfProof";
import { RequestCommitment } from "@integration-services";
import { decodeRandomeseEvent, randomWordsFulfilled } from "./shared/decoder";

describe("VRF System Workflow test", function () {
  let vrfKey: VRFKey;

  async function deployCoordinatorFixture() {
    const [deployer, user] = await viem.getWalletClients();
    const coordinator = await viem.deployContract("VRFCoordinatorV2", []);
    const coordinatorConfig = {
      miminumRequestConfirmations: 1,
      maxGasLimit: 34000000,
      gasAfterPaymentCalculation: 300,
    };

    await coordinator.write.setConfig([
      coordinatorConfig.miminumRequestConfirmations,
      coordinatorConfig.maxGasLimit,
      coordinatorConfig.gasAfterPaymentCalculation,
    ]);
    const publicClient = await viem.getPublicClient();

    const publicKey = vrfKey.getPublicKeyTuple();
    const keyHash = generateKeyHash(publicKey);

    const requestConfirmations = 2;
    const upkeepInterval = 0; // 60s

    const consumer = await viem.deployContract("DappConsumer", [
      coordinator.address,
      keyHash,
      requestConfirmations,
      upkeepInterval,
    ]);

    return {
      coordinator,
      deployer,
      consumer,
      user,
      publicClient,
    };
  }

  this.beforeAll(async function () {
    vrfKey = new VRFKey(process.env.PRIVATE_KEY as string);
  });

  describe("Coordinator", function () {
    context("Deployment", function () {
      it("Should allow owner to register and remove a consumer", async function () {
        const { coordinator, deployer, user, publicClient } = await loadFixture(
          deployCoordinatorFixture
        );

        // Register user as consumer
        const hash = await coordinator.write.addConsumer([
          user.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        const nonce = await coordinator.read.getConsumer([
          user.account.address,
        ]);
        expect(nonce).to.equal(1n);

        // Remove consumer
        const tx = await coordinator.write.removeConsumer([
          user.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: tx });

        const after = await coordinator.read.getConsumer([
          user.account.address,
        ]);
        expect(after).to.equal(0n);
      });

      it("Should revert when non-owner tries to register consumer", async function () {
        const { coordinator, consumer, user, deployer } = await loadFixture(
          deployCoordinatorFixture
        );

        await expect(
          coordinator.write.addConsumer([user.account.address], {
            account: user.account,
          })
        ).to.be.rejectedWith("Only callable by owner");
      });
    });

    context("Working workflows", function () {
      it("Should can request random words", async function () {
        const { coordinator, publicClient, consumer, user, deployer } =
          await loadFixture(deployCoordinatorFixture);

        const hashRegisterConsumer = await coordinator.write.addConsumer([
          consumer.address,
        ]);
        await publicClient.waitForTransactionReceipt({
          hash: hashRegisterConsumer,
        });

        const after = await coordinator.read.getConsumer([consumer.address]);
        expect(after).to.equal(1n);

        const hashRequestRandomWords = await consumer.write.requestRandomWords(
          []
        );

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: hashRequestRandomWords,
        });

        await coordinator.write.registerProvingKey([
          vrfKey.account.address,
          vrfKey.getPublicKeyTuple(),
        ]);

        const {
          keyHash: decodedKeyHash,
          blockNum,
          requestId,
          preSeed,
          minimumRequestConfirmations,
          callbackGasLimit,
          numWords,
          sender,
        } = decodeRandomeseEvent(receipt.logs[0]);

        const block = await publicClient.getBlock({
          blockNumber: BigInt(blockNum),
        });

        let proof = vrfKey.generateProof(preSeed, block.hash);

        const requestCommitment: RequestCommitment = {
          blockNum: BigInt(blockNum),
          callbackGasLimit,
          numWords,
          sender,
        };

        // // // 3. Send proof back to contract
        const fulFillHash = await coordinator.write.fulfillRandomWords([
          proof,
          requestCommitment,
        ]);

        const receiptFulfill = await publicClient.waitForTransactionReceipt({
          hash: fulFillHash,
        });

        console.log("receiptFulfill", receiptFulfill);

        const {
          requestId: requestIdFulfill,
          randomness,
          vrfRequestCounter,
          vrfResponseCounter,
        } = randomWordsFulfilled(receiptFulfill.logs[0]);

        console.log(" Event fulfill emited :", {
          requestID: requestIdFulfill,
          randomness: randomness,
          vrfRequestCounter: vrfRequestCounter,
          vrfResponseCounter: vrfResponseCounter,
        });

        const requestRecord = await consumer.read.s_requests([requestId]);

        const [, fulfilled, ,] = requestRecord;

        expect(fulfilled).to.equal(true);

        console.log("Request Record : ", {
          requestID: requestRecord[0],
          fulfilled: requestRecord[1],
          callbackGasLimit: requestRecord[2],
          randomness: requestRecord[3],
        });
      });
    });
  });
});
