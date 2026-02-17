import { createVRFCoordinatorService } from "@integration-services";
import { createClient } from "@utils/viemClient";
import { EnvConfig } from "@config/env";
import VRF_ABI from "@abis/VRFCoordinatorV2.json";
import { AbiEvent } from "viem";
import { handleRandomnessRequest } from "@jobs/handlers/requestRandomness";

let lastProcessedBlock: bigint | null = null;

export const startVRFListener = async (config: EnvConfig) => {
  const VRFCoordinatorAddress = process.env
    .VRF_COORDINATOR_ADDRESS as `0x${string}`;
  if (!VRFCoordinatorAddress)
    throw new Error("❌ Missing VRF Contract Address!");

  const { publicClient, walletClient } = createClient(config);
  const coordinatorContract = createVRFCoordinatorService(
    VRFCoordinatorAddress,
    publicClient,
    walletClient
  );

  const eventABI = VRF_ABI.abi.find((e) => e.name === "RandomWordsRequested");
  if (!eventABI) throw new Error("Missing ABI for RandomWordsRequested event");

  const pollInterval = 5000; // 5s interval

  const pollEvents = async () => {
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = lastProcessedBlock
        ? lastProcessedBlock + 1n
        : latestBlock;

      if (latestBlock < fromBlock) return; // No new block

      const logs = await publicClient.getLogs({
        address: VRFCoordinatorAddress,
        event: eventABI as AbiEvent,
        fromBlock,
        toBlock: latestBlock,
      });

      for (const log of logs) {
        if (!log.args) continue;
        console.log("📥 RandomWordsRequested: ", log.args);
        await handleRandomnessRequest(log, coordinatorContract);
      }

      lastProcessedBlock = latestBlock;
    } catch (err) {
      console.error("❌ Listener error:", err);
    }
  };

  setInterval(pollEvents, pollInterval);

  console.log("👂 VRF Listener Started (Polling Mode)...");
};
