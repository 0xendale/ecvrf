// scripts/deploy.ts
import { parseArgs } from "node:util";
import { EnvConfig, getEnvConfig, KeyStoreManager } from "@config/env";
import { requestRandomWords } from "./tests/requestRandom";
import {
  createVRFComsumerService,
  createVRFCoordinatorService,
} from "@integration-services";
import { createClient } from "@utils/viemClient";
import { generateVRFProof } from "jobs/core/generateVRFProof";
import { computeRequestId } from "@utils/keys";

const { values } = parseArgs({
  options: {
    testnet: {
      type: "boolean",
      short: "t",
    },
  },
});

const main = async () => {
  const config: EnvConfig = getEnvConfig(values.testnet);
  const { publicClient, walletClient } = createClient(config);

  const dappContract = createVRFComsumerService(
    process.env.DAPP_CONTRACT_ADDRESS as `0x${string}`,
    publicClient,
    walletClient
  );

  const coordinatorContract = createVRFCoordinatorService(
    process.env.VRF_COORDINATOR_ADDRESS as `0x${string}`,
    publicClient,
    walletClient
  );

  const keyHash = await dappContract.keyHash();
  console.log("🔧 Key Hash:", keyHash);

  const contractState = dappContract.getContractState();

  const nonce = await coordinatorContract.getConsumer();

  const account = await walletClient.getAddresses();

  const preSeed = await computeRequestId(
    keyHash as `0x${string}`,
    account[0] as `0x${string}`,
    nonce
  );

  console.log("🔧 Contract State:", await contractState);

  const state = {
    miminumRequestConfirmations: 100,
    maxGasLimit: 34000000,
    gasAfterPaymentCalculation: 300,
  };

  console.log("requestRandomWords", {
    keyHash,
    requestComfirmations: state.miminumRequestConfirmations,
    callbackGasLimit: state.maxGasLimit,
    numWords: 1,
  });

  const vrfKey = KeyStoreManager();




  // const proof = await generateVRFProof(preSeed);

  const testComputeAddress = await coordinatorContract._devTestHookRead?.(
    "testComputeAddress"
  );

  console.log("testComputeAddress", testComputeAddress);

  // const proof = await generateVRFProof(
  //   console.log()
  // )

  // const addressD = await coordinatorContract._devTestHook?.(
  //   "testComputeAddress",
  //   testComputeAddress,
  // );

  // console.log("🔧 Key Hash:", keyHash);
};

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
