import {
  createPublicClient,
  decodeEventLog,
  keccak256,
  toEventSelector,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import CONSUMER_ABI from "@abis/Dapp.json";
import { abi as VRF_ABI } from "@abis/VRFCoordinator.json";
import { parseArgs } from "node:util";
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { EnvConfig, getEnvConfig } from "@config/env";
import { deployVRFCoordinatorContract } from "./contractDeployment/deployVRFCoordinator";
import { deployDappContract } from "./tests/deployDapp";
import { createClient } from "@utils/viemClient";
import { VRFKey } from "@utils/vrfProof";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY! as `0x${string}`;

const { values } = parseArgs({
  options: {
    testnet: {
      type: "boolean",
      short: "t",
    },
  },
});

async function main() {
  const config: EnvConfig = getEnvConfig(values.testnet);
  console.log("Deploying contracts on", values.testnet ? "Testnet" : "Mainnet");

  const { publicClient, walletClient } = createClient(config);

  const nativeKeyStore = new VRFKey(PRIVATE_KEY);

  // 2. Call `requestRandomWords` on consumer
  const { request } = await publicClient.simulateContract({
    account: nativeKeyStore.account,
    address: config.DAPP_CONTRACT_ADDRESS as `0x${string}`,
    abi: CONSUMER_ABI,
    functionName: "requestRandomWords",
  });

  console.log("📤 Request tx sent:", request);

  await walletClient.writeContract(request);

  // // 3. Wait for tx receipt & parse event log
  // const receipt = await publicClient.waitForTransactionReceipt({
  //   hash: txHash,
  // });
  // const requestLog = receipt.logs.find(
  //   (log) =>
  //     log.topics[0] ===
  //     toEventSelector(
  //       "RandomWordsRequested(bytes32,uint64,uint256,uint256,uint16,uint32,uint32,address)"
  //     )
  // );

  // if (!requestLog) throw new Error("No RandomWordsRequested event found");

  // const { requestId, preSeed, blockNum, sender, callbackGasLimit, numWords } =
  //   decodeEventLog({
  //     abi: VRF_ABI,
  //     ...requestLog,
  //   }).args as any;

  // console.log("🔍 Requested RandomWords:", {
  //   requestId,
  //   preSeed,
  //   blockNum,
  //   sender,
  //   callbackGasLimit,
  //   numWords,
  // });

  // 4. Fetch blockhash & generate proof
  // const block = await publicClient.getBlock({ blockNumber: BigInt(blockNum) });
  // const finalSeed = computeFinalSeed(preSeed, block.hash);
  // const proof = generateVRFProof(finalSeed);

  // // 5. Fulfill randomness manually
  // const fulfillTx = await walletClient.writeContract({
  //   address: VRF_COORDINATOR,
  //   abi: VRF_ABI,
  //   functionName: "fulfillRandomWords",
  //   args: [
  //     proof,
  //     {
  //       blockNum,
  //       callbackGasLimit,
  //       numWords,
  //       sender,
  //     },
  //   ],
  // });

  // console.log("🎯 Fulfilled VRF manually:", fulfillTx);
}

function computeFinalSeed(preSeed: bigint, blockHash: `0x${string}`): bigint {
  const seedInput = new Uint8Array([
    ...Buffer.from(preSeed.toString(16).padStart(64, "0"), "hex"),
    ...Buffer.from(blockHash.slice(2), "hex"),
  ]);
  return BigInt("0x" + Buffer.from(keccak256(seedInput)).toString("hex"));
}

main().catch((err) => {
  console.error("💥 Error:", err);
  process.exit(1);
});
